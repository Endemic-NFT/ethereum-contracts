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
error NoActiveOffer();
error RefundFailed();

abstract contract EndemicOffer is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    uint256 public MIN_BID_DURATION;

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
        uint256 priceWithFee;
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
        MIN_BID_DURATION = 1 hours;

        nextOfferId = 1;
    }

    function placeOffer(
        address nftContract,
        uint256 tokenId,
        uint256 duration
    ) external payable nonReentrant {
        if (msg.value <= 0) {
            revert InvalidValueSent();
        }

        IERC721 nft = IERC721(nftContract);
        address nftOwner = nft.ownerOf(tokenId);

        if (nftOwner == address(0) || nftOwner == _msgSender()) {
            revert InvalidTokenOwner();
        }

        if (duration < MIN_BID_DURATION) {
            revert DurationTooShort();
        }

        uint256 offerId = nextOfferId++;
        uint256 takerFee = feeProvider.getTakerFee();

        if (_bidderHasOffer(nftContract, tokenId, _msgSender())) {
            revert OfferExists();
        }

        uint256 price = (msg.value * 10000) / (takerFee + 10000);
        uint256 expiresAt = block.timestamp + duration;

        offerIdsByBidder[nftContract][tokenId][_msgSender()] = offerId;
        offersById[offerId] = Offer({
            id: offerId,
            bidder: _msgSender(),
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            priceWithFee: msg.value,
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

        delete offersById[offerId];
        delete offerIdsByBidder[offer.nftContract][offer.tokenId][offer.bidder];

        uint256 totalCut = _calculateCut(
            offer.nftContract,
            offer.tokenId,
            _msgSender(),
            offer.price,
            offer.priceWithFee
        );

        (address royaltiesRecipient, uint256 royaltiesCut) = royaltiesProvider
            .calculateRoyaltiesAndGetRecipient(
                offer.nftContract,
                offer.tokenId,
                offer.price
            );

        // sale happened
        feeProvider.onSale(offer.nftContract, offer.tokenId);

        // Transfer token to bidder
        IERC721(offer.nftContract).safeTransferFrom(
            _msgSender(),
            offer.bidder,
            offer.tokenId
        );

        // transfer fees
        if (totalCut > 0) {
            _transferFees(totalCut);
        }

        // transfer royalties
        if (royaltiesCut > 0) {
            _transferRoyalties(royaltiesRecipient, royaltiesCut);
        }

        // Transfer ETH from bidder to seller
        _transferFunds(
            _msgSender(),
            offer.priceWithFee - totalCut - royaltiesCut
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
        if (offer.id != offerId) {
            revert NoActiveOffer();
        }
        return offer;
    }

    function _calculateCut(
        address tokenAddress,
        uint256 tokenId,
        address seller,
        uint256 price,
        uint256 priceWithFee
    ) internal view returns (uint256) {
        uint256 makerCut = feeProvider.calculateMakerFee(
            seller,
            tokenAddress,
            tokenId,
            price
        );
        uint256 takerCut = priceWithFee - price;

        return makerCut + takerCut;
    }

    function removeExpiredOffers(
        address[] memory tokenAddresses,
        uint256[] memory tokenIds,
        address[] memory offerders
    ) public onlyOwner nonReentrant {
        uint256 loopLength = tokenAddresses.length;

        require(
            loopLength == tokenIds.length,
            "Parameter arrays should have the same length"
        );
        require(
            loopLength == offerders.length,
            "Parameter arrays should have the same length"
        );

        for (uint256 i = 0; i < loopLength; i++) {
            _removeExpiredOffer(tokenAddresses[i], tokenIds[i], offerders[i]);
        }
    }

    function _removeExpiredOffer(
        address nftContract,
        uint256 tokenId,
        address offerder
    ) internal {
        uint256 offerId = offerIdsByBidder[nftContract][tokenId][offerder];
        Offer memory offer = offersById[offerId];

        require(
            offer.expiresAt < block.timestamp,
            "The offer to remove should be expired"
        );

        _cancelOffer(offer);
    }

    function _cancelOffer(Offer memory offer) internal {
        delete offersById[offer.id];
        delete offerIdsByBidder[offer.nftContract][offer.tokenId][offer.bidder];

        (bool success, ) = payable(offer.bidder).call{
            value: offer.priceWithFee
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

    uint256[100] private __gap;
}
