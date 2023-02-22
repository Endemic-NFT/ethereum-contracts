// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

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

    /// @dev Offer by token address => token id => offer bidder => offerId
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        private nftOfferIdsByBidder;

    /// @dev Offer by token address => offer bidder => offerId
    mapping(address => mapping(address => uint256))
        private collectionOfferIdsByBidder;

    /// @notice Active offer configuration
    struct Offer {
        /// @notice Id created for this offer
        uint256 id;
        /// @notice The address of the smart contract
        address nftContract;
        /// @notice The address of the supported ERC20 smart contract used for payments
        address paymentErc20TokenAddress;
        /// @notice The address of the offer bidder
        address bidder;
        /// @notice The ID of the NFT
        uint256 tokenId;
        /// @notice Amount bidded
        uint256 price;
        /// @notice Amount bidded including fees
        uint256 priceWithTakerFee;
        /// @notice Timestamp when offer expires
        uint256 expiresAt;
        /// @notice Flag if offer is for collection or for an NFT
        bool isForCollection;
    }

    /// @notice Fired when offer is created
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

    /// @notice Fired when offer is accepted by the NFT owner
    event OfferAccepted(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address bidder,
        address indexed seller,
        uint256 price,
        uint256 totalFees
    );

    /// @notice Fired when offer is canceled
    event OfferCancelled(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed bidder
    );

    /// @notice Create an offer in ETH for an NFT
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

    /// @notice Create an offer in ERC20 token for an NFT
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
        _requireSufficientErc20Allowance(
            offerInErc20,
            paymentErc20TokenAddress,
            msg.sender
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

    /// @notice Create a collection offer in ETH for an NFT
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

    /// @notice Create a collection offer in ERC20 token for an NFT
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
        _requireSufficientErc20Allowance(
            offerInErc20,
            paymentErc20TokenAddress,
            msg.sender
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

    /// @notice Cancels offer for ID
    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer memory offer = offersById[offerId];
        if (offer.bidder != msg.sender) revert InvalidOffer();

        _cancelOffer(offer);
    }

    /// @notice Cancels multiple offers
    function cancelOffers(uint256[] calldata offerIds) external nonReentrant {
        for (uint256 i = 0; i < offerIds.length; i++) {
            Offer memory offer = offersById[offerIds[i]];
            if (offer.bidder != msg.sender) revert InvalidOffer();
            _cancelOffer(offer);
        }
    }

    /// @notice Accept an offer for NFT
    function acceptNftOffer(uint256 offerId) external nonReentrant {
        Offer memory offer = offersById[offerId];

        if (offer.isForCollection) revert InvalidOffer();

        _acceptOffer(offer, offerId, offer.tokenId);
    }

    /// @notice Accept a collection offer
    function acceptCollectionOffer(uint256 offerId, uint256 tokenId)
        external
        nonReentrant
    {
        Offer memory offer = offersById[offerId];

        if (!offer.isForCollection) revert InvalidOffer();

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

        if (nftOwner == msg.sender) revert InvalidTokenOwner();
        if (duration < MIN_OFFER_DURATION) revert DurationTooShort();
        if (_bidderHasNftOffer(nftContract, tokenId, msg.sender))
            revert OfferExists();

        uint256 offerId = ++nextOfferId;

        uint256 expiresAt = block.timestamp + duration;

        nftOfferIdsByBidder[nftContract][tokenId][msg.sender] = offerId;
        offersById[offerId] = Offer({
            id: offerId,
            bidder: msg.sender,
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
            msg.sender,
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
        if (_bidderHasCollectionOffer(nftContract, msg.sender))
            revert OfferExists();

        uint256 offerId = ++nextOfferId;

        uint256 expiresAt = block.timestamp + duration;

        collectionOfferIdsByBidder[nftContract][msg.sender] = offerId;
        offersById[offerId] = Offer({
            id: offerId,
            bidder: msg.sender,
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
            msg.sender,
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
        if (offer.bidder == msg.sender) revert AcceptFromSelf();

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

        // Transfer token to bidder
        IERC721(offer.nftContract).transferFrom(
            msg.sender,
            offer.bidder,
            tokenId
        );

        _distributeFunds(
            offer.price,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            msg.sender,
            offer.bidder,
            offer.paymentErc20TokenAddress
        );

        emit OfferAccepted(
            offerId,
            offer.nftContract,
            tokenId,
            offer.bidder,
            msg.sender,
            offer.price,
            totalCut
        );
    }

    function _cancelOffer(Offer memory offer) internal {
        _deleteOffer(offer);

        // Return ETH to bidder
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

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
