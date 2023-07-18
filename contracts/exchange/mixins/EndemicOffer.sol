// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./EndemicFundsDistributor.sol";
import "./EndemicExchangeCore.sol";
import "./EndemicEIP712.sol";

error InvalidOffer();
error InvalidOfferSignature();
error SignatureUsed();
error AcceptFromSelf();

abstract contract EndemicOffer is
    ReentrancyGuardUpgradeable,
    EndemicFundsDistributor,
    EndemicExchangeCore,
    EndemicEIP712
{
    using ECDSA for bytes32;

    bytes32 private constant OFFER_TYPEHASH =
        keccak256(
            "Offer(address nftContract,uint256 tokenId,address paymentErc20TokenAddress,uint256 price,uint256 expiresAt,bool isForCollection)"
        );

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

    /// @notice Accept an offer for NFT
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

        if (offer.bidder == msg.sender) revert AcceptFromSelf();

        _verifySignature(v, r, s, offer);

        _acceptOffer(offer, offer.tokenId);
    }

    /// @notice Accept a collection offer
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

        if (offer.bidder == msg.sender) revert AcceptFromSelf();

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
            revert InvalidOfferSignature();
        }

        bytes32 signature = keccak256(abi.encodePacked(v, r, s));

        if (_usedSignatures[signature]) {
            revert SignatureUsed();
        }

        _usedSignatures[signature] = true;
    }

    function _acceptOffer(Offer calldata offer, uint256 tokenId) internal {
        (uint256 takerFee, ) = paymentManager.getPaymentMethodFees(
            offer.paymentErc20TokenAddress
        );

        uint256 priceWithTakerFeeDeducted = (offer.price * MAX_FEE) /
            (takerFee + MAX_FEE);

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
