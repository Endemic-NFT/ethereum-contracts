// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./EndemicFundsDistributor.sol";
import "./EndemicExchangeCore.sol";

error InvalidTokenOwner();
error DurationTooShort();
error OfferExists();
error InvalidOffer();
error NotExpiredOffer();
error AcceptFromSelf();
error ParametersDiffInSize();
error RefundFailed();

abstract contract EndemicOffer is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicFundsDistributor,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    uint256 public constant MIN_OFFER_DURATION = 1 hours;

    uint256 private nextOfferId;

    mapping(uint256 => Offer) private offersById;

    // Offer by token address => token id => offer bidder => offerId
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        private nftOfferIdsByBidder;

    // Offer by token address => offer bidder => offerId
    mapping(address => mapping(address => uint256))
        private collectionOfferIdsByBidder;

    struct Offer {
        uint256 id;
        address nftContract;
        address paymentErc20TokenAddress;
        address bidder;
        uint256 tokenId;
        uint256 price;
        uint256 priceWithTakerFee;
        uint256 expiresAt;
        bool isForCollection;
    }

    event OfferCreated(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 price,
        uint256 expiresAt,
        address paymentErc20TokenAddress,
        bool isForCollection
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

    function placeNftOffer(
        address nftContract,
        uint256 tokenId,
        uint256 duration
    ) external payable nonReentrant {
        _requireSufficientEtherSupplied(MIN_PRICE);

        (uint256 takerFee, ) = paymentManager.getPaymentMethodFees(
            ZERO_ADDRESS //ether fees
        );

        uint256 price = (msg.value * MAX_FEE) / (takerFee + MAX_FEE);

        _placeNftOffer(
            nftContract,
            ZERO_ADDRESS,
            tokenId,
            duration,
            price,
            msg.value
        );
    }

    function placeNftOfferInErc20(
        address nftContract,
        address paymentErc20TokenAddress,
        uint256 offerInErc20,
        uint256 tokenId,
        uint256 duration
    )
        external
        nonReentrant
        onlySupportedERC20Payments(paymentErc20TokenAddress)
    {
        _requireSufficientErc20Supplied(
            offerInErc20,
            paymentErc20TokenAddress,
            _msgSender()
        );

        (uint256 takerFee, ) = paymentManager.getPaymentMethodFees(
            paymentErc20TokenAddress
        );

        uint256 price = (offerInErc20 * MAX_FEE) / (takerFee + MAX_FEE);

        _placeNftOffer(
            nftContract,
            paymentErc20TokenAddress,
            tokenId,
            duration,
            price,
            offerInErc20
        );
    }

    function placeCollectionOffer(address nftContract, uint256 duration)
        external
        payable
        nonReentrant
    {
        _requireSufficientEtherSupplied(MIN_PRICE);

        (uint256 takerFee, ) = paymentManager.getPaymentMethodFees(
            ZERO_ADDRESS //ether fees
        );

        uint256 price = (msg.value * MAX_FEE) / (takerFee + MAX_FEE);

        _placeCollectionOffer(
            nftContract,
            ZERO_ADDRESS,
            duration,
            price,
            msg.value
        );
    }

    function placeCollectionOfferInErc20(
        address nftContract,
        address paymentErc20TokenAddress,
        uint256 offerInErc20,
        uint256 duration
    )
        external
        nonReentrant
        onlySupportedERC20Payments(paymentErc20TokenAddress)
    {
        _requireSufficientErc20Supplied(
            offerInErc20,
            paymentErc20TokenAddress,
            _msgSender()
        );

        (uint256 takerFee, ) = paymentManager.getPaymentMethodFees(
            paymentErc20TokenAddress
        );

        uint256 price = (offerInErc20 * MAX_FEE) / (takerFee + MAX_FEE);

        _placeCollectionOffer(
            nftContract,
            paymentErc20TokenAddress,
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

    function acceptNftOffer(uint256 offerId) external nonReentrant {
        Offer memory offer = offersById[offerId];

        _acceptOffer(offer, offerId, offer.tokenId);
    }

    function acceptCollectionOffer(uint256 offerId, uint256 tokenId)
        external
        nonReentrant
    {
        Offer memory offer = offersById[offerId];

        _acceptOffer(offer, offerId, tokenId);
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

    function _placeNftOffer(
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
        if (_bidderHasNftOffer(nftContract, tokenId, _msgSender()))
            revert OfferExists();

        uint256 offerId = nextOfferId++;

        uint256 expiresAt = block.timestamp + duration;

        nftOfferIdsByBidder[nftContract][tokenId][_msgSender()] = offerId;
        offersById[offerId] = Offer({
            id: offerId,
            bidder: _msgSender(),
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            priceWithTakerFee: priceWithTakerFee,
            expiresAt: expiresAt,
            paymentErc20TokenAddress: paymentErc20TokenAddress,
            isForCollection: false
        });

        emit OfferCreated(
            offerId,
            nftContract,
            tokenId,
            _msgSender(),
            price,
            expiresAt,
            paymentErc20TokenAddress,
            false
        );
    }

    function _placeCollectionOffer(
        address nftContract,
        address paymentErc20TokenAddress,
        uint256 duration,
        uint256 price,
        uint256 priceWithTakerFee
    ) internal {
        if (duration < MIN_OFFER_DURATION) revert DurationTooShort();
        if (_bidderHasCollectionOffer(nftContract, _msgSender()))
            revert OfferExists();

        uint256 offerId = nextOfferId++;

        uint256 expiresAt = block.timestamp + duration;

        collectionOfferIdsByBidder[nftContract][_msgSender()] = offerId;
        offersById[offerId] = Offer({
            id: offerId,
            bidder: _msgSender(),
            nftContract: nftContract,
            tokenId: 0,
            price: price,
            priceWithTakerFee: priceWithTakerFee,
            expiresAt: expiresAt,
            paymentErc20TokenAddress: paymentErc20TokenAddress,
            isForCollection: true
        });

        emit OfferCreated(
            offerId,
            nftContract,
            0,
            _msgSender(),
            price,
            expiresAt,
            paymentErc20TokenAddress,
            true
        );
    }

    function _acceptOffer(
        Offer memory offer,
        uint256 offerId,
        uint256 tokenId
    ) internal {
        if (offer.id != offerId || offer.expiresAt < block.timestamp) {
            revert InvalidOffer();
        }
        if (offer.bidder == _msgSender()) revert AcceptFromSelf();

        _deleteOffer(offer);

        (
            uint256 makerCut,
            ,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(
                offer.paymentErc20TokenAddress,
                offer.nftContract,
                tokenId,
                offer.price
            );
        // sale happened

        // Transfer token to bidder
        IERC721(offer.nftContract).transferFrom(
            _msgSender(),
            offer.bidder,
            tokenId
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
            tokenId,
            offer.bidder,
            _msgSender(),
            offer.price,
            totalCut
        );
    }

    function _removeExpiredOffer(
        address nftContract,
        uint256 tokenId,
        address bidder
    ) internal {
        uint256 offerId = nftOfferIdsByBidder[nftContract][tokenId][bidder];
        Offer memory offer = offersById[offerId];

        if (offer.expiresAt >= block.timestamp) revert NotExpiredOffer();

        _cancelOffer(offer);
    }

    function _cancelOffer(Offer memory offer) internal {
        _deleteOffer(offer);

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

    function _deleteOffer(Offer memory offer) internal {
        delete offersById[offer.id];

        if (offer.isForCollection) {
            delete collectionOfferIdsByBidder[offer.nftContract][offer.bidder];
        } else {
            delete nftOfferIdsByBidder[offer.nftContract][offer.tokenId][
                offer.bidder
            ];
        }
    }

    function _bidderHasNftOffer(
        address nftContract,
        uint256 tokenId,
        address bidder
    ) internal view returns (bool) {
        uint256 offerId = nftOfferIdsByBidder[nftContract][tokenId][bidder];
        Offer memory offer = offersById[offerId];
        return offer.bidder == bidder;
    }

    function _bidderHasCollectionOffer(address nftContract, address bidder)
        internal
        view
        returns (bool)
    {
        uint256 offerId = collectionOfferIdsByBidder[nftContract][bidder];
        Offer memory offer = offersById[offerId];
        return offer.bidder == bidder;
    }

    uint256[1000] private __gap;
}
