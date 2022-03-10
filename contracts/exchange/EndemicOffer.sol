// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./EndemicExchangeCore.sol";

error InvalidValueSent();
error InvalidTokenOwner();
error DurationTooShort();
error OfferExists();
error InvalidOffer();
error NotExpiredOffer();
error RefundFailed();
error AcceptFromSelf();
error ParametersDiffInSize();

abstract contract EndemicOffer is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    uint256 public constant MIN_OFFER_DURATION = 1 hours;

    uint256 private nextOfferId;

    mapping(uint256 => Offer) private offersById;

    // Offer by token address => token id => offerder => offerId
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        private offerIdsByBidder;

    struct Offer {
        uint256 id;
        address nftContract;
        uint256 tokenId;
        address bidder;
        uint256 price;
        uint256 priceWithTakerFee;
        uint256 expiresAt;
    }

    event OfferCreated(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 price,
        uint256 expiresAt
    );

    event OfferAccepted(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address bidder,
        address indexed seller,
        uint256 price,
        uint256 totalFees
    );

    event OfferCancelled(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed bidder
    );

    function __EndemicOffer___init_unchained() internal {
        nextOfferId = 1;
    }

    function placeOffer(
        address nftContract,
        uint256 tokenId,
        uint256 duration
    ) external payable nonReentrant {
        if (msg.value == 0) revert InvalidValueSent();

        IERC721 nft = IERC721(nftContract);
        address nftOwner = nft.ownerOf(tokenId);

        if (nftOwner == _msgSender()) revert InvalidTokenOwner();
        if (duration < MIN_OFFER_DURATION) revert DurationTooShort();
        if (_bidderHasOffer(nftContract, tokenId, _msgSender()))
            revert OfferExists();

        uint256 offerId = nextOfferId++;

        uint256 price = (msg.value * FEE_BASIS_POINTS) /
            (takerFee + FEE_BASIS_POINTS);
        uint256 expiresAt = block.timestamp + duration;

        offerIdsByBidder[nftContract][tokenId][_msgSender()] = offerId;
        offersById[offerId] = Offer({
            id: offerId,
            bidder: _msgSender(),
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            priceWithTakerFee: msg.value,
            expiresAt: expiresAt
        });

        emit OfferCreated(
            offerId,
            nftContract,
            tokenId,
            _msgSender(),
            price,
            expiresAt
        );
    }

    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer memory offer = offersById[offerId];
        _cancelOffer(offer);
    }

    function acceptOffer(uint256 offerId) external nonReentrant {
        Offer memory offer = offersById[offerId];

        if (offer.id != offerId || offer.expiresAt < block.timestamp) {
            revert InvalidOffer();
        }
        if (offer.bidder == _msgSender()) revert AcceptFromSelf();

        delete offersById[offerId];
        delete offerIdsByBidder[offer.nftContract][offer.tokenId][offer.bidder];

        (
            uint256 makerCut,
            ,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(offer.nftContract, offer.tokenId, offer.price);

        // Transfer token to bidder
        IERC721(offer.nftContract).transferFrom(
            _msgSender(),
            offer.bidder,
            offer.tokenId
        );

        _distributeFunds(
            offer.price,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            _msgSender()
        );

        emit OfferAccepted(
            offerId,
            offer.nftContract,
            offer.tokenId,
            offer.bidder,
            _msgSender(),
            offer.price,
            totalCut
        );
    }

    function getOffer(uint256 offerId) external view returns (Offer memory) {
        Offer memory offer = offersById[offerId];
        if (offer.id != offerId) revert InvalidOffer();

        return offer;
    }

    /**
     * @notice Allows owner to cancel offers, refunding eth to bidders
     * @dev This should only be used for extreme cases
     */
    function adminCancelOffers(uint256[] calldata offerIds)
        external
        onlyOwner
        nonReentrant
    {
        for (uint256 i = 0; i < offerIds.length; i++) {
            Offer memory offer = offersById[offerIds[i]];
            _cancelOffer(offer);
        }
    }

    function _removeExpiredOffer(
        address nftContract,
        uint256 tokenId,
        address bidder
    ) internal {
        uint256 offerId = offerIdsByBidder[nftContract][tokenId][bidder];
        Offer memory offer = offersById[offerId];

        if (offer.expiresAt >= block.timestamp) revert NotExpiredOffer();

        _cancelOffer(offer);
    }

    function _cancelOffer(Offer memory offer) internal {
        delete offersById[offer.id];
        delete offerIdsByBidder[offer.nftContract][offer.tokenId][offer.bidder];

        (bool success, ) = payable(offer.bidder).call{
            value: offer.priceWithTakerFee
        }("");
        if (!success) revert RefundFailed();

        emit OfferCancelled(
            offer.id,
            offer.nftContract,
            offer.tokenId,
            offer.bidder
        );
    }

    function _bidderHasOffer(
        address nftContract,
        uint256 tokenId,
        address bidder
    ) internal view returns (bool) {
        uint256 offerId = offerIdsByBidder[nftContract][tokenId][bidder];
        Offer memory offer = offersById[offerId];
        return offer.bidder == bidder;
    }

    uint256[1000] private __gap;
}
