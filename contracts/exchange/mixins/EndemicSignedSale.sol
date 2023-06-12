// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./EndemicFundsDistributor.sol";
import "./EndemicExchangeCore.sol";

error SignedSaleExpired();
error InvalidSignature();
error InvalidSignedSale();

abstract contract EndemicSignedSale is
    ContextUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicFundsDistributor,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    bytes32 private constant SIGNED_SALE_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "SignedSale(address nftContract,uint256 tokenId,address paymentErc20TokenAddress,address seller,address buyer,uint256 price,uint256 deadline)"
        );

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
        );

    bytes32 private constant SALT_HASH = keccak256("Endemic Exchange Salt");

    string private constant DOMAIN_NAME = "Endemic Exchange";

    bytes32 public DOMAIN_SEPARATOR;

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

    function __EndemicSignedSale___init_unchained() internal {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes("1")),
                block.chainid,
                address(this),
                SALT_HASH
            )
        );
    }

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

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        SIGNED_SALE_TYPEHASH,
                        nftContract,
                        tokenId,
                        paymentErc20TokenAddress,
                        seller,
                        address(0),
                        price,
                        deadline
                    )
                )
            )
        );

        if (ecrecover(digest, v, r, s) != seller) {
            revert InvalidSignature();
        }

        _finalizeSignedSale(
            nftContract,
            tokenId,
            paymentErc20TokenAddress,
            seller,
            price,
            deadline
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

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
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

        _finalizeSignedSale(
            nftContract,
            tokenId,
            paymentErc20TokenAddress,
            seller,
            price,
            deadline
        );
    }

    function _finalizeSignedSale(
        address nftContract,
        uint256 tokenId,
        address paymentErc20TokenAddress,
        address payable seller,
        uint256 price,
        uint256 deadline
    ) internal {
        signedSaleInvalidated[nftContract][tokenId][seller][msg.sender][price][
            deadline
        ] = true;

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

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
