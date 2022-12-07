// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./EndemicAuctionCore.sol";

error InsufficientBid();
error NoPendingWithdrawals();
error ReservePriceAlreadySet();

abstract contract EndemicReserveAuction is
    ContextUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicAuctionCore
{
    uint256 private constant EXTENSION_DURATION = 15 minutes;
    uint256 private constant RESERVE_AUCTION_DURATION = 24 hours;
    uint256 private constant MIN_BID_PERCENTAGE = 10;

    /// @notice Fired when reserve bid is placed
    event ReserveBidPlaced(
        bytes32 indexed id,
        address indexed bidder,
        uint256 indexed reservePrice,
        uint256 endingAt
    );

    /// @notice Creates reserve auction
    /// @dev Since we don't do escrow, only ERC20 payment is available
    function createReserveAuction(
        address nftContract,
        uint256 tokenId,
        uint256 reservePrice,
        address paymentErc20TokenAddress
    )
        external
        nonReentrant
        onlySupportedERC20Payments(paymentErc20TokenAddress)
    {
        _requireValidAuctionRequest(
            paymentErc20TokenAddress,
            nftContract,
            tokenId,
            1,
            ERC721_ASSET_CLASS
        );

        if (reservePrice < MIN_PRICE) {
            revert InvalidPriceConfiguration();
        }

        bytes32 auctionId = _createAuctionId(
            nftContract,
            tokenId,
            _msgSender()
        );

        //seller cannot recreate auction if it is already in progress
        _requireIdleAuction(auctionId);

        Auction memory auction = Auction({
            auctionType: AuctionType.RESERVE,
            id: auctionId,
            nftContract: nftContract,
            highestBidder: address(0),
            seller: _msgSender(),
            paymentErc20TokenAddress: paymentErc20TokenAddress,
            tokenId: tokenId,
            amount: 1,
            startingPrice: reservePrice,
            endingPrice: 0,
            startedAt: block.timestamp,
            endingAt: 0, //timer is not started yet
            assetClass: ERC721_ASSET_CLASS
        });

        idToAuction[auctionId] = auction;

        emit AuctionCreated(
            nftContract,
            tokenId,
            auctionId,
            reservePrice,
            0,
            RESERVE_AUCTION_DURATION,
            _msgSender(),
            1,
            paymentErc20TokenAddress,
            ERC721_ASSET_CLASS
        );
    }

    /// @notice Place bid for reseve auction
    /// @dev ERC20 allowance is required here
    function bidForReserveAuctionInErc20(bytes32 id, uint256 bidPriceWithFees)
        external
        nonReentrant
    {
        Auction memory auction = idToAuction[id];

        _requireAuctionType(auction, AuctionType.RESERVE);

        _requireValidBidRequest(auction, 1);

        (uint256 takerFee, ) = paymentManager.getPaymentMethodFees(
            auction.paymentErc20TokenAddress
        );

        uint256 bidPrice = (bidPriceWithFees * MAX_FEE) / (takerFee + MAX_FEE);

        if (auction.endingAt != 0) {
            // Auction already started which means it has a bid
            _outBidPreviousBidder(auction, bidPriceWithFees, bidPrice);
        } else {
            // Auction hasn't started yet
            _placeBidAndStartTimer(
                auction,
                bidPriceWithFees,
                bidPrice,
                takerFee
            );
        }

        idToAuction[auction.id] = auction;

        emit ReserveBidPlaced(
            auction.id,
            _msgSender(),
            bidPrice,
            auction.endingAt
        );
    }

    /// @notice Finalizes reserve auction, transfering currency and NFT
    function finalizeReserveAuction(bytes32 id) external nonReentrant {
        Auction memory auction = idToAuction[id];

        if (
            (auction.seller != _msgSender()) &&
            (auction.highestBidder != _msgSender())
        ) revert Unauthorized();

        if (auction.endingAt == 0) revert AuctionNotStarted();
        if (auction.endingAt >= block.timestamp) revert AuctionInProgress();

        _removeAuction(id);

        (
            uint256 makerCut,
            ,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(
                auction.paymentErc20TokenAddress,
                auction.nftContract,
                auction.tokenId,
                auction.endingPrice
            );

        _transferNFT(
            auction.seller,
            auction.highestBidder,
            auction.nftContract,
            auction.tokenId,
            auction.amount,
            auction.assetClass
        );

        _distributeFunds(
            auction.endingPrice,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            auction.seller,
            auction.highestBidder,
            auction.paymentErc20TokenAddress
        );

        emit AuctionSuccessful(
            auction.id,
            auction.endingPrice,
            auction.highestBidder,
            auction.amount,
            totalCut
        );
    }

    function getHighestBidder(bytes32 id) external view returns (address) {
        Auction storage auction = idToAuction[id];

        return auction.highestBidder;
    }

    function _placeBidAndStartTimer(
        Auction memory auction,
        uint256 bidPriceWithFees,
        uint256 bidPrice,
        uint256 takerFee
    ) internal view {
        uint256 takerCut = _calculateCut(takerFee, auction.startingPrice);

        if (auction.startingPrice + takerCut > bidPriceWithFees)
            revert UnsufficientCurrencySupplied();

        _requireSufficientErc20Allowance(
            auction.startingPrice + takerCut,
            auction.paymentErc20TokenAddress,
            _msgSender()
        );

        //auction will last until 24hours from now
        auction.endingAt = block.timestamp + RESERVE_AUCTION_DURATION;
        auction.endingPrice = bidPrice;

        auction.highestBidder = _msgSender();
    }

    function _outBidPreviousBidder(
        Auction memory auction,
        uint256 bidPriceWithFees,
        uint256 bidPrice
    ) internal view {
        if (auction.endingAt < block.timestamp) revert AuctionEnded();
        // Bidder cannot outbid themself
        if (auction.highestBidder == _msgSender()) revert Unauthorized();

        _requireSufficientOutBid(
            auction.paymentErc20TokenAddress,
            auction.endingPrice,
            bidPriceWithFees
        );

        auction.endingPrice = bidPrice;
        auction.highestBidder = _msgSender();

        // If bidder outbids another bidder in last 15min of auction extend auction by 15mins
        uint256 extendedEndingTime = block.timestamp + EXTENSION_DURATION;
        if (auction.endingAt < extendedEndingTime) {
            auction.endingAt = extendedEndingTime;
        }
    }

    function _requireSufficientOutBid(
        address paymentErc20TokenAddress,
        uint256 currentReservePrice,
        uint256 bidPriceWithFees
    ) internal view {
        //next bid in auction must be at least 10% higher than last one
        uint256 minIncrement = currentReservePrice / MIN_BID_PERCENTAGE;

        uint256 minRequiredBid = currentReservePrice + minIncrement;

        if (minRequiredBid > bidPriceWithFees) revert InsufficientBid();

        _requireSufficientErc20Allowance(
            bidPriceWithFees,
            paymentErc20TokenAddress,
            _msgSender()
        );
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
