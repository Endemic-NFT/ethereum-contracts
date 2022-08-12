// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./EndemicExchangeCore.sol";

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

    // Offer by token address => token id => offerer => offerId
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        private offerIdsByBidder;

    struct Offer {
        uint256 id;
        address nftContract;
        address paymentErc20TokenAddress;
        address bidder;
        uint256 tokenId;
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
        uint256 expiresAt,
        address paymentErc20TokenAddress
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
        _requireCorrectEtherValueProvided(MIN_PRICE);

        uint256 price = (msg.value * MAX_FEE) / (takerFee + MAX_FEE);

        _placeOffer(
            nftContract,
            address(0),
            tokenId,
            duration,
            price,
            msg.value
        );
    }

    function placeOfferInErc20(
        address nftContract,
        address paymentErc20TokenAddress,
        uint256 offerInErc20,
        uint256 tokenId,
        uint256 duration
    ) external nonReentrant {
        if (!supportedErc20Addresses[paymentErc20TokenAddress]) {
            revert InvalidPaymentMethod();
        }

        _requireCorrectErc20ValueProvided(
            offerInErc20,
            paymentErc20TokenAddress,
            _msgSender()
        );

        uint256 price = (offerInErc20 * MAX_FEE) / (takerFee + MAX_FEE);

        _placeOffer(
            nftContract,
            paymentErc20TokenAddress,
            tokenId,
            duration,
            price,
            offerInErc20
        );
    }

    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer memory offer = offersById[offerId];
        if (offer.bidder != _msgSender()) revert InvalidOffer();

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
        // sale happened

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
            _msgSender(),
            offer.bidder,
            offer.paymentErc20TokenAddress
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

    function _placeOffer(
        address nftContract,
        address paymentErc20TokenAddress,
        uint256 tokenId,
        uint256 duration,
        uint256 price,
        uint256 priceWithTakerFee
    ) internal {
        IERC721 nft = IERC721(nftContract);
        address nftOwner = nft.ownerOf(tokenId);

        if (nftOwner == _msgSender()) revert InvalidTokenOwner();
        if (duration < MIN_OFFER_DURATION) revert DurationTooShort();
        if (_bidderHasOffer(nftContract, tokenId, _msgSender()))
            revert OfferExists();

        uint256 offerId = nextOfferId++;

        uint256 expiresAt = block.timestamp + duration;

        offerIdsByBidder[nftContract][tokenId][_msgSender()] = offerId;
        offersById[offerId] = Offer({
            id: offerId,
            bidder: _msgSender(),
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            priceWithTakerFee: priceWithTakerFee,
            expiresAt: expiresAt,
            paymentErc20TokenAddress: paymentErc20TokenAddress
        });

        emit OfferCreated(
            offerId,
            nftContract,
            tokenId,
            _msgSender(),
            price,
            expiresAt,
            paymentErc20TokenAddress
        );
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

        if (offer.paymentErc20TokenAddress == ZERO_ADDRESS) {
            (bool success, ) = payable(offer.bidder).call{
                value: offer.priceWithTakerFee
            }("");

            if (!success) revert RefundFailed();
        }

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
