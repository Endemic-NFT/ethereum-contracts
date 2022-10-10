// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./EndemicFundsDistributor.sol";
import "./EndemicExchangeCore.sol";

error PrivateSaleExpired();
error InvalidSignature();
error InvalidPrivateSale();

abstract contract EndemicPrivateSale is
    ContextUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicFundsDistributor,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    bytes32 private constant PRIVATE_SALE_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "PrivateSale(address nftContract,uint256 tokenId,address paymentErc20TokenAddress,address seller,address buyer,uint256 price,uint256 deadline)"
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
        private privateSaleInvalidated;

    event PrivateSaleSuccess(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price,
        uint256 totalFees,
        address paymentErc20TokenAddress
    );

    function __EndemicPrivateSale___init_unchained() internal {
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

    function buyFromPrivateSale(
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
            revert PrivateSaleExpired();
        }

        uint256 takerCut = _calculateTakerCut(paymentErc20TokenAddress, price);

        address buyer = _msgSender();

        _requireSupportedPaymentMethod(paymentErc20TokenAddress);
        _requireSufficientCurrencySupplied(
            price + takerCut,
            paymentErc20TokenAddress,
            buyer
        );

        address payable seller = payable(IERC721(nftContract).ownerOf(tokenId));

        if (
            privateSaleInvalidated[nftContract][tokenId][seller][buyer][price][
                deadline
            ]
        ) {
            revert InvalidPrivateSale();
        }

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        PRIVATE_SALE_TYPEHASH,
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

        _finalizePrivateSale(
            nftContract,
            tokenId,
            paymentErc20TokenAddress,
            seller,
            price,
            deadline
        );
    }

    function _finalizePrivateSale(
        address nftContract,
        uint256 tokenId,
        address paymentErc20TokenAddress,
        address payable seller,
        uint256 price,
        uint256 deadline
    ) internal {
        privateSaleInvalidated[nftContract][tokenId][seller][_msgSender()][
            price
        ][deadline] = true;

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

        IERC721(nftContract).transferFrom(seller, _msgSender(), tokenId);

        _distributeFunds(
            price,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            seller,
            _msgSender(),
            paymentErc20TokenAddress
        );

        emit PrivateSaleSuccess(
            nftContract,
            tokenId,
            seller,
            _msgSender(),
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
