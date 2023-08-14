// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./EndemicFundsDistributor.sol";
import "./EndemicExchangeCore.sol";
import "./EndemicEIP712.sol";
import "./EndemicNonceManager.sol";

error InvalidOffer();
error AcceptFromSelf();

abstract contract EndemicOffer2 is
    ReentrancyGuardUpgradeable,
    EndemicFundsDistributor,
    EndemicExchangeCore,
    EndemicEIP712,
    EndemicNonceManager
{
    using ECDSA for bytes32;

    bytes32 private constant OFFER_TYPEHASH =
        keccak256(
            "Offer(uint256 orderNonce,address nftContract,uint256 tokenId,address paymentErc20TokenAddress,uint256 price,uint256 expiresAt,bool isForCollection)"
        );

    struct Offer {
        address bidder;
        uint256 orderNonce;
        address nftContract;
        uint256 tokenId;
        address paymentErc20TokenAddress;
        uint256 price;
        uint256 expiresAt;
        bool isForCollection;
    }

    event OfferAccepted(
        address indexed nftContract,
        uint256 indexed tokenId,
        address bidder,
        address indexed seller,
        uint256 price,
        uint256 totalFees
    );

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

        _invalidateNonce(offer.bidder, offer.orderNonce);

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

        if (offer.bidder == msg.sender) revert AcceptFromSelf();

        _verifySignature(v, r, s, offer);

        _invalidateNonce(offer.bidder, offer.orderNonce);

        _acceptOffer(offer, tokenId);
    }

    function _verifySignature(
        uint8 v,
        bytes32 r,
        bytes32 s,
        Offer calldata offer
    ) internal view {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _buildDomainSeparator(),
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
            revert InvalidSignature();
        }
    }

    function _acceptOffer(Offer calldata offer, uint256 tokenId) internal {
        (
            uint256 makerCut,
            address royaltiesRecipient,
            uint256 royaltiesFee,
            uint256 totalCut,
            uint256 listingPrice
        ) = _calculateOfferFees(
            offer.paymentErc20TokenAddress,
            offer.nftContract,
            tokenId,
            offer.price
        );

        IERC721(offer.nftContract).transferFrom(
            msg.sender,
            offer.bidder,
            tokenId
        );

        _distributeFunds(
            listingPrice,
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
            listingPrice,
            totalCut
        );
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
