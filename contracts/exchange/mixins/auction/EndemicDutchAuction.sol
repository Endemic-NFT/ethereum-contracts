// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./EndemicAuctionCore.sol";

abstract contract EndemicDutchAuction is
    ContextUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicAuctionCore
{
    using AddressUpgradeable for address;

    /**
     * @notice Creates fixed auction for an NFT
     * Fixed auction is variant of dutch auction where startingPrice is equal to endingPrice
     */
    function createFixedDutchAuction(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        uint256 amount,
        address paymentErc20TokenAddress,
        bytes4 assetClass
    ) external nonReentrant {
        _createAuction(
            nftContract,
            tokenId,
            price,
            price,
            0,
            amount,
            paymentErc20TokenAddress,
            assetClass
        );
    }

    /**
     * @notice Creates dutch auction for an NFT
     * Dutch auction is auction where price of NFT lineary drops from startingPrice to endingPrice
     */
    function createDutchAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration,
        uint256 amount,
        address paymentErc20TokenAddress,
        bytes4 assetClass
    ) external nonReentrant {
        if (duration < MIN_DURATION || duration > MAX_DURATION)
            revert InvalidDuration();

        if (startingPrice <= endingPrice) revert InvalidPriceConfiguration();

        _createAuction(
            nftContract,
            tokenId,
            startingPrice,
            endingPrice,
            duration,
            amount,
            paymentErc20TokenAddress,
            assetClass
        );
    }

    /**
     * @notice Purchase auction
     */
    function bidForDutchAuction(bytes32 id, uint256 tokenAmount)
        external
        payable
        nonReentrant
    {
        Auction memory auction = idToAuction[id];

        _requireAuctionType(auction, AuctionType.DUTCH);

        _requireValidBidRequest(auction, tokenAmount);

        _detractByAssetClass(auction, tokenAmount);

        uint256 currentPrice = _calculateCurrentPrice(auction) * tokenAmount;

        if (currentPrice == 0) revert InvalidPrice();

        (
            uint256 makerCut,
            uint256 takerCut,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(
                auction.paymentErc20TokenAddress,
                auction.nftContract,
                auction.tokenId,
                currentPrice
            );

        currentPrice = _determinePriceByPaymentMethod(
            auction.paymentErc20TokenAddress,
            currentPrice,
            takerCut
        );

        _requireSufficientCurrencySupplied(
            currentPrice + takerCut,
            auction.paymentErc20TokenAddress,
            _msgSender()
        );

        _transferNFT(
            auction.seller,
            _msgSender(),
            auction.nftContract,
            auction.tokenId,
            tokenAmount,
            auction.assetClass
        );

        _distributeFunds(
            currentPrice,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            auction.seller,
            _msgSender(),
            auction.paymentErc20TokenAddress
        );

        emit AuctionSuccessful(
            auction.id,
            currentPrice,
            _msgSender(),
            tokenAmount,
            totalCut
        );
    }

    /**
     * @notice Calculates current price for the auction
     */
    function getCurrentPrice(bytes32 id) external view returns (uint256) {
        Auction memory auction = idToAuction[id];

        if (
            !_isActiveAuction(auction) ||
            !_isAuctionType(auction, AuctionType.DUTCH)
        ) revert InvalidAuction();

        return _calculateCurrentPrice(auction);
    }

    /**
     * @notice Creates auction for an NFT
     */
    function _createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration,
        uint256 amount,
        address paymentErc20TokenAddress,
        bytes4 assetClass
    ) internal {
        if (startingPrice < MIN_PRICE || endingPrice < MIN_PRICE)
            revert InvalidPriceConfiguration();

        _requireValidAuctionRequest(
            paymentErc20TokenAddress,
            nftContract,
            tokenId,
            amount,
            assetClass
        );

        bytes32 auctionId = _createAuctionId(
            nftContract,
            tokenId,
            _msgSender()
        );

        // Seller cannot recreate auction
        // if it is already listed as reserve auction that is in progress or ended
        _requireIdleAuction(auctionId);

        uint256 endingAt = block.timestamp + duration;

        Auction memory auction = Auction({
            auctionType: AuctionType.DUTCH,
            id: auctionId,
            nftContract: nftContract,
            seller: _msgSender(),
            highestBidder: address(0),
            paymentErc20TokenAddress: paymentErc20TokenAddress,
            tokenId: tokenId,
            amount: amount,
            startingPrice: startingPrice,
            endingPrice: endingPrice,
            startedAt: block.timestamp,
            endingAt: endingAt,
            assetClass: assetClass
        });

        idToAuction[auctionId] = auction;

        emit AuctionCreated(
            nftContract,
            tokenId,
            auctionId,
            startingPrice,
            endingPrice,
            endingAt,
            _msgSender(),
            amount,
            paymentErc20TokenAddress,
            assetClass
        );
    }

    /**
     * @notice Determines auction price by payment method
     * @dev Because of the nature of dutch auction we precalculate auction price in moment of rendering it on UI.
     * When the user bids we calculate the price again at the moment of method execution.
     * This price will be slightly smaller than one rendered on UI, which results in retaining a small amount of ether.
     * Which is the difference between precalculated price and the price calculated in the moment of method execution.
     * This is not the problem in the case of ERC20 payments because the difference will not retain on the contract
     * due to the token allowance technique.
     *
     * With this method in case of ether payments we forward all supplied ethers with the check
     * that it's not supplied less than @param currentPriceWithoutFees.
     * Difference that would retain on the contract is forwarded to the seller, retaining zero ether on this contract.
     *
     * @param paymentErc20TokenAddress - determines payment method for the auction
     * @param currentPriceWithoutFees - auction price calculated in moment of method execution without buyer fees
     * @param takerCut - buyer fees calculated for @param currentPriceWithoutFees
     */
    function _determinePriceByPaymentMethod(
        address paymentErc20TokenAddress,
        uint256 currentPriceWithoutFees,
        uint256 takerCut
    ) internal view returns (uint256) {
        //if auction is in ERC20 we use price calculated in moment of method execution
        if (paymentErc20TokenAddress != ZERO_ADDRESS) {
            return currentPriceWithoutFees;
        }

        //auction is in ether so we use amount of supplied ethers without taker cut as auction price
        uint256 suppliedEtherWithoutFees = msg.value - takerCut;

        //amount of supplied ether without buyer fees must not be smaller than the current price without buyer fees
        if (suppliedEtherWithoutFees < currentPriceWithoutFees) {
            revert UnsufficientCurrencySupplied();
        }

        return suppliedEtherWithoutFees;
    }

    /**
     * @notice Calculates current price depending on block timestamp
     */
    function _calculateCurrentPrice(Auction memory auction)
        internal
        view
        returns (uint256)
    {
        uint256 secondsPassed = 0;
        uint256 duration = auction.endingAt - auction.startedAt;

        if (block.timestamp > auction.startedAt) {
            secondsPassed = block.timestamp - auction.startedAt;
        }

        // NOTE: We don't use SafeMath (or similar) in this function because
        //  all of our public functions carefully cap the maximum values for
        //  time (at 64-bits) and currency (at 128-bits). _duration is
        //  also known to be non-zero (see the require() statement in
        //  _addAuction())
        if (secondsPassed >= duration) {
            // We've reached the end of the dynamic pricing portion
            // of the auction, just return the end price.
            return auction.endingPrice;
        } else {
            // Starting price can be higher than ending price (and often is!), so
            // this delta can be negative.
            int256 totalPriceChange = int256(auction.endingPrice) -
                int256(auction.startingPrice);

            // This multiplication can't overflow, _secondsPassed will easily fit within
            // 64-bits, and totalPriceChange will easily fit within 128-bits, their product
            // will always fit within 256-bits.
            int256 currentPriceChange = (totalPriceChange *
                int256(secondsPassed)) / int256(duration);

            // currentPriceChange can be negative, but if so, will have a magnitude
            // less that _startingPrice. Thus, this result will always end up positive.
            return uint256(int256(auction.startingPrice) + currentPriceChange);
        }
    }

    /**
     * @notice Makes sure auction token amount is properly reduced for asset class
     */
    function _detractByAssetClass(Auction memory auction, uint256 tokenAmount)
        internal
    {
        if (auction.assetClass == ERC721_ASSET_CLASS) {
            _removeAuction(auction.id);
        } else if (auction.assetClass == ERC1155_ASSET_CLASS) {
            _deductFromAuction(auction, tokenAmount);
        } else {
            revert InvalidAssetClass();
        }
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
