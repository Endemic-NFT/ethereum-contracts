// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./EndemicFundsDistributor.sol";
import "./EndemicExchangeCore.sol";
import "./EndemicEIP712.sol";

error SignedSaleExpired();
error InvalidSignature();
error InvalidSignedSale();

abstract contract EndemicSignedSale is
    ContextUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicFundsDistributor,
    EndemicExchangeCore,
    EndemicEIP712
{
    using AddressUpgradeable for address;

    bytes32 private constant SIGNED_SALE_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "SignedSale(address nftContract,uint256 tokenId,address paymentErc20TokenAddress,address seller,address buyer,uint256 price,uint256 deadline)"
        );

    // Maps nftContract -> tokenId -> seller -> buyer -> price -> deadline -> invalidated.
    // solhint-disable-next-line max-line-length
    mapping(address => mapping(uint256 => mapping(address => mapping(address => mapping(uint256 => mapping(uint256 => bool))))))
        private signedSaleInvalidated;

    event SignedSaleSuccess(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price,
        uint256 totalFees,
        address paymentErc20TokenAddress
    );

    function buyFromSignedSale(
        address paymentErc20TokenAddress,
        address nftContract,
        uint256 tokenId,
        uint256 price,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant {
        if (deadline < block.timestamp) {
            revert SignedSaleExpired();
        }

        uint256 takerCut = _calculateTakerCut(paymentErc20TokenAddress, price);

        _requireSupportedPaymentMethod(paymentErc20TokenAddress);
        _requireSufficientCurrencySupplied(
            price + takerCut,
            paymentErc20TokenAddress,
            msg.sender
        );

        address payable seller = payable(IERC721(nftContract).ownerOf(tokenId));

        if (
            signedSaleInvalidated[nftContract][tokenId][seller][address(0)][price][
                deadline
            ]
        ) {
            revert InvalidSignedSale();
        }

        _verifySignature(
            nftContract,
            tokenId,
            paymentErc20TokenAddress,
            seller,
            address(0),
            price,
            deadline,
            v,
            r,
            s
        );

        signedSaleInvalidated[nftContract][tokenId][seller][address(0)][price][
            deadline
        ] = true;

        _finalizeSignedSale(
            nftContract,
            tokenId,
            paymentErc20TokenAddress,
            seller,
            price
        );
    }

    function buyFromReservedSignedSale(
        address paymentErc20TokenAddress,
        address nftContract,
        uint256 tokenId,
        uint256 price,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant {
        if (deadline < block.timestamp) {
            revert SignedSaleExpired();
        }

        uint256 takerCut = _calculateTakerCut(paymentErc20TokenAddress, price);

        address buyer = msg.sender;

        _requireSupportedPaymentMethod(paymentErc20TokenAddress);
        _requireSufficientCurrencySupplied(
            price + takerCut,
            paymentErc20TokenAddress,
            buyer
        );

        address payable seller = payable(IERC721(nftContract).ownerOf(tokenId));

        if (
            signedSaleInvalidated[nftContract][tokenId][seller][buyer][price][
                deadline
            ]
        ) {
            revert InvalidSignedSale();
        }

        _verifySignature(
            nftContract,
            tokenId,
            paymentErc20TokenAddress,
            seller,
            buyer,
            price,
            deadline,
            v,
            r,
            s
        );

        signedSaleInvalidated[nftContract][tokenId][seller][msg.sender][price][
            deadline
        ] = true;

        _finalizeSignedSale(
            nftContract,
            tokenId,
            paymentErc20TokenAddress,
            seller,
            price
        );
    }

    function _finalizeSignedSale(
        address nftContract,
        uint256 tokenId,
        address paymentErc20TokenAddress,
        address payable seller,
        uint256 price
    ) internal {
        (
            uint256 makerCut,
            ,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(
                paymentErc20TokenAddress,
                nftContract,
                tokenId,
                price
            );

        IERC721(nftContract).transferFrom(seller, msg.sender, tokenId);

        _distributeFunds(
            price,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            seller,
            msg.sender,
            paymentErc20TokenAddress
        );

        emit SignedSaleSuccess(
            nftContract,
            tokenId,
            seller,
            msg.sender,
            price,
            totalCut,
            paymentErc20TokenAddress
        );
    }

    function _verifySignature(
        address nftContract,
        uint256 tokenId,
        address paymentErc20TokenAddress,
        address seller,
        address buyer,
        uint256 price,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _buildDomainSeparator(),
                keccak256(
                    abi.encode(
                        SIGNED_SALE_TYPEHASH,
                        nftContract,
                        tokenId,
                        paymentErc20TokenAddress,
                        seller,
                        buyer,
                        price,
                        deadline
                    )
                )
            )
        );

        if (ecrecover(digest, v, r, s) != seller) {
            revert InvalidSignature();
        }
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
