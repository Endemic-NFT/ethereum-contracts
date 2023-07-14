// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./EndemicFundsDistributor.sol";
import "./EndemicExchangeCore.sol";

error InvalidOffer();

abstract contract EndemicOfferV2 is
    ReentrancyGuardUpgradeable,
    EndemicFundsDistributor,
    EndemicExchangeCore
{
    using ECDSA for bytes32;

    bytes32 private constant OFFER_TYPEHASH =
        keccak256(
            "Offer(address nftContract,uint256 tokenId,address paymentErc20TokenAddress,uint256 price,uint256 expiresAt,bool isForCollection)"
        );

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
        );

    bytes32 private constant SALT_HASH = keccak256("Endemic Exchange Salt");

    string private constant DOMAIN_NAME = "Endemic Exchange";

    bytes32 public DOMAIN_SEPARATOR;

    mapping(bytes32 signature => bool used) private _usedSignatures;

    struct Offer {
        address bidder;
        address nftContract;
        uint256 tokenId;
        address paymentErc20TokenAddress;
        uint256 price;
        uint256 expiresAt;
        bool isForCollection;
    }

    /// @notice Fired when offer is accepted by the NFT owner
    event OfferAccepted(
        address indexed nftContract,
        uint256 indexed tokenId,
        address bidder,
        address indexed seller,
        uint256 price,
        uint256 totalFees
    );

    function __EndemicOffer___init_unchained() internal {
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

    function acceptNftOffer(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Offer calldata offer
    )
        external
        nonReentrant
        onlySupportedERC20Payments(offer.paymentErc20TokenAddress)
    {
        if (block.timestamp > offer.expiresAt || offer.isForCollection) {
            revert InvalidOffer();
        }

        _verifySignature(v, r, s, offer);

        _acceptOffer(offer, offer.tokenId);
    }

    function acceptCollectionOffer(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Offer calldata offer,
        uint256 tokenId
    )
        external
        nonReentrant
        onlySupportedERC20Payments(offer.paymentErc20TokenAddress)
    {
        if (block.timestamp > offer.expiresAt || !offer.isForCollection) {
            revert InvalidOffer();
        }

        _verifySignature(v, r, s, offer);

        _acceptOffer(offer, tokenId);
    }

    function _verifySignature(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Offer calldata offer
    ) internal {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        OFFER_TYPEHASH,
                        offer.nftContract,
                        offer.tokenId,
                        offer.paymentErc20TokenAddress,
                        offer.price,
                        offer.expiresAt,
                        offer.isForCollection
                    )
                )
            )
        );

        if (digest.recover(v, r, s) != offer.bidder) {
            revert();
        }

        bytes32 signature = keccak256(abi.encodePacked(v, r, s));

        if (_usedSignatures[signature]) {
            revert();
        }

        _usedSignatures[signature] = true;
    }

    function _acceptOffer(
        Offer calldata offer,
        uint256 tokenId
    ) internal {
        (uint256 takerFee, ) = paymentManager.getPaymentMethodFees(
            offer.paymentErc20TokenAddress
        );

        uint256 priceWithTakerFeeDeducted = (offer.price * MAX_FEE) / (takerFee + MAX_FEE);

        (
            uint256 makerCut,
            ,
            address royaltiesRecipient,
            uint256 royaltiesFee,
            uint256 totalCut
        ) = _calculateFees(
            offer.paymentErc20TokenAddress,
            offer.nftContract,
            tokenId,
            priceWithTakerFeeDeducted
        );

        // Transfer token to bidder
        IERC721(offer.nftContract).transferFrom(
            msg.sender,
            offer.bidder,
            tokenId
        );

        _distributeFunds(
            priceWithTakerFeeDeducted,
            makerCut,
            totalCut,
            royaltiesFee,
            royaltiesRecipient,
            msg.sender,
            offer.bidder,
            offer.paymentErc20TokenAddress
        );

        emit OfferAccepted(
            offer.nftContract,
            tokenId,
            offer.bidder,
            msg.sender,
            priceWithTakerFeeDeducted,
            totalCut
        );
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
