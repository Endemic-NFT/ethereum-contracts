// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../EndemicExchangeCore.sol";
import "./EndemicAuctionCore.sol";

error InsufficientBid();
error NoPendingWithdrawals();
error ReservePriceAlreadySet();

abstract contract EndemicReserveAuction is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicAuctionCore
{
    uint256 private constant EXTENSION_DURATION = 15 minutes;
    uint256 private constant RESERVE_AUCTION_DURATION = 24 hours;

    mapping(bytes32 => address) internal idToHighestBidder;

    event ReserveBidPlaced(
        bytes32 indexed id,
        address indexed bidder,
        uint256 reservePriceWithFees,
        uint256 reservePrice
    );

    function createReserveAuction(
        address nftContract,
        uint256 tokenId,
        uint256 reservePrice,
        address paymentErc20TokenAddress
    ) external nonReentrant {
        //reserve auction can only be sold in ERC20 tokens
        if (paymentErc20TokenAddress == ZERO_ADDRESS)
            revert InvalidPaymentMethod();

        _requireValidAuctionRequest(
            paymentErc20TokenAddress,
            nftContract,
            tokenId,
            1,
            ERC721_ASSET_CLASS
        );

        bytes32 auctionId = _createAuctionId(
            nftContract,
            tokenId,
            _msgSender()
        );

        //seller cannot recreate auction if it is already in progress
        _requireAuctionNotStartedYet(auctionId);

        Auction memory auction = Auction({
            id: auctionId,
            nftContract: nftContract,
            seller: _msgSender(),
            paymentErc20TokenAddress: paymentErc20TokenAddress,
            tokenId: tokenId,
            duration: RESERVE_AUCTION_DURATION, //always 24hrs
            amount: 1, //only supports ERC721 assets => tokenAmount always 1
            startingPrice: 0,
            endingPrice: 0,
            reservePrice: reservePrice,
            reservePriceWithFees: 0, // initial 0
            startedAt: block.timestamp,
            endingAt: 0, //timer is not started yet
            assetClass: ERC721_ASSET_CLASS //only supported ERC721 assets
        });

        if (auction.reservePrice < MIN_PRICE) {
            revert InvalidPriceConfiguration();
        }

        idToAuction[auctionId] = auction;

        emit AuctionCreated(
            nftContract,
            tokenId,
            auctionId,
            0,
            0,
            reservePrice,
            RESERVE_AUCTION_DURATION,
            _msgSender(),
            1,
            paymentErc20TokenAddress,
            ERC721_ASSET_CLASS
        );
    }

    function bidForReserveAuctionInErc20(bytes32 id, uint256 bidPriceWithFees)
        external
        nonReentrant
    {
        Auction memory auction = idToAuction[id];

        _requireValidBidRequest(auction, 1);

        uint256 bidPrice = (bidPriceWithFees * MAX_FEE) / (takerFee + MAX_FEE);

        if (auction.endingAt != 0) {
            _outBidPreviousBidder(auction, bidPriceWithFees, bidPrice);
        } else {
            // Auction hasn't started yet
            _placeBidAndStartTimer(auction, bidPriceWithFees, bidPrice);
        }

        emit ReserveBidPlaced(
            auction.id,
            _msgSender(),
            bidPriceWithFees,
            bidPrice
        );
    }

    function finalizeReserveAuction(bytes32 id) external {
        Auction memory auction = idToAuction[id];

        address highestBidder = idToHighestBidder[id];

        if ((auction.seller != _msgSender()) && (highestBidder != _msgSender()))
            revert Unauthorized();

        if (auction.endingAt >= block.timestamp) revert AuctionInProgress();

        _removeAuction(id);

        (
            uint256 makerCut,
            ,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(
                auction.nftContract,
                auction.tokenId,
                auction.reservePrice
            );

        _transferNFT(
            auction.seller,
            highestBidder,
            auction.nftContract,
            auction.tokenId,
            auction.amount,
            auction.assetClass
        );

        _distributeFunds(
            auction.reservePrice,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            auction.seller,
            highestBidder,
            auction.paymentErc20TokenAddress
        );

        emit AuctionSuccessful(
            auction.id,
            auction.reservePrice,
            highestBidder,
            auction.amount,
            totalCut
        );
    }

    function getHighestBidder(bytes32 id) external view returns (address) {
        return idToHighestBidder[id];
    }

    function _placeBidAndStartTimer(
        Auction memory auction,
        uint256 bidPriceWithFees,
        uint256 bidPrice
    ) internal {
        uint256 takerCut = _calculateCut(takerFee, auction.reservePrice);

        if (auction.reservePrice + takerCut > bidPriceWithFees)
            revert InvalidValueProvided();

        _requireCorrectErc20ValueProvided(
            auction.reservePrice + takerCut,
            auction.paymentErc20TokenAddress,
            _msgSender()
        );

        //auction will last until 24hours from now
        auction.endingAt = block.timestamp + RESERVE_AUCTION_DURATION;
        auction.reservePriceWithFees = bidPriceWithFees;
        auction.reservePrice = bidPrice;

        idToHighestBidder[auction.id] = _msgSender();

        idToAuction[auction.id] = auction;
    }

    function _outBidPreviousBidder(
        Auction memory auction,
        uint256 bidPriceWithFees,
        uint256 bidPrice
    ) internal {
        if (auction.endingAt < block.timestamp) revert AuctionEnded();
        // Bidder cannot outbid themself
        if (idToHighestBidder[auction.id] == _msgSender())
            revert Unauthorized();

        _requireSufficientOutBid(
            auction.paymentErc20TokenAddress,
            auction.reservePrice,
            bidPriceWithFees
        );

        auction.reservePriceWithFees = bidPriceWithFees;
        auction.reservePrice = bidPrice;
        idToHighestBidder[auction.id] = _msgSender();

        // If bidder outbids another bidder in last 15min of auction extend auction by 15mins
        uint256 extendedEndingTime = block.timestamp + EXTENSION_DURATION;
        if (auction.endingAt < extendedEndingTime) {
            auction.endingAt = extendedEndingTime;
        }

        idToAuction[auction.id] = auction;
    }

    function _requireSufficientOutBid(
        address paymentErc20TokenAddress,
        uint256 currentReservePrice,
        uint256 bidPriceWithFees
    ) internal view {
        uint256 minIncrement = currentReservePrice / 10;

        uint256 minRequiredBid = currentReservePrice + minIncrement;

        if (minRequiredBid > bidPriceWithFees) revert InsufficientBid();

        _requireCorrectErc20ValueProvided(
            minRequiredBid,
            paymentErc20TokenAddress,
            _msgSender()
        );
    }

    uint256[1000] private __gap;
}
