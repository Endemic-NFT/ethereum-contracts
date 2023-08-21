// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../EndemicExchangeCore.sol";
import "../EndemicFundsDistributor.sol";

abstract contract EndemicAuctionCore is
    EndemicFundsDistributor,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    uint256 internal constant MAX_DURATION = 1000 days;
    uint256 internal constant MIN_DURATION = 1 minutes;

    mapping(bytes32 => Auction) internal idToAuction;

    error Unauthorized();

    error InvalidAuction();
    error InvalidPrice();
    error InvalidDuration();
    error InvalidPriceConfiguration();
    error InvalidConfiguration();
    error InvalidAmount();

    error AuctionNotStarted();
    error AuctionInProgress();
    error AuctionEnded();

    /// @notice We support two auction types.
    /// Dutch auction has falling price.
    //  Reseve auction triggeres ascending price after the reserve price has been deposited
    enum AuctionType {
        DUTCH,
        RESERVE
    }

    /// @notice Active auction configuration
    struct Auction {
        /// @notice Type of this auction
        AuctionType auctionType;
        /// @notice Id created for this auction.
        /// @dev Auction for same contract, token ID and seller will always have the same ID
        bytes32 id;
        /// @notice The address of the smart contract
        address nftContract;
        /// @notice The address of the seller
        address seller;
        /// @notice The address of the curretn highst bidder when auction is of type RESERVE
        address highestBidder;
        /// @notice The address of the supported ERC20 smart contract used for payments
        address paymentErc20TokenAddress;
        /// @notice The ID of the NFT
        uint256 tokenId;
        /// @notice Starting price of the dutch auction
        uint256 startingPrice;
        /// @notice Ending price of the dutch auction
        uint256 endingPrice;
        /// @notice Timestamp when auction started
        uint256 startedAt;
        /// @notice Timestamp when auction will end
        uint256 endingAt;
    }

    /// @notice Fired when auction is created
    event AuctionCreated(
        address indexed nftContract,
        uint256 indexed tokenId,
        bytes32 indexed id,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 endingAt,
        address seller,
        address paymentErc20TokenAddress
    );

    /// @notice Fired when auction is sucessfuly complated
    event AuctionSuccessful(
        uint256 indexed totalPrice,
        address winner,
        uint256 totalFees
    );

    /// @notice Fired when auction is sucessfuly canceled
    event AuctionCancelled(bytes32 indexed id);

    /// @notice Deletes auction from the storage
    /// @param auctionId ID of the auction to delete
    function _removeAuction(bytes32 auctionId) internal {
        delete idToAuction[auctionId];
    }

    /// @notice Checks if auction is currently active
    function _isActiveAuction(Auction memory auction)
        internal
        pure
        returns (bool)
    {
        return auction.startedAt > 0;
    }

    /// @notice Checks if auction has a desired type
    function _isAuctionType(Auction memory auction, AuctionType auctionType)
        internal
        pure
        returns (bool)
    {
        return auction.auctionType == auctionType;
    }

    /// @notice Checks if auction is listed as reserve and has started or ended
    function _requireIdleAuction(bytes32 id) internal view {
        Auction memory auction = idToAuction[id];

        if (auction.auctionType == AuctionType.DUTCH) return;

        if (auction.endingAt >= block.timestamp) revert AuctionInProgress();
        if (auction.endingAt != 0 && auction.endingAt < block.timestamp)
            revert AuctionEnded();
    }

    /// @notice Overloaded function that validates is requested auction valid
    function _requireValidAuctionRequest(
        address paymentErc20TokenAddress,
        address nftContract,
        uint256 tokenId
    ) internal view {
        _requireSupportedPaymentMethod(paymentErc20TokenAddress);

        if (IERC721(nftContract).ownerOf(tokenId) != msg.sender)
            revert SellerNotAssetOwner();
    }

    /// @notice Validates bid request for an auction
    function _requireValidBidRequest(Auction memory auction) internal view {
        if (!_isActiveAuction(auction)) {
            revert InvalidAuction();
        }

        if (auction.seller == msg.sender) {
            revert Unauthorized();
        }
    }

    /// @notice Validates is desired auction type
    function _requireAuctionType(
        Auction memory auction,
        AuctionType auctionType
    ) internal pure {
        if (!_isAuctionType(auction, auctionType)) {
            revert InvalidAuction();
        }
    }

    function _createAuctionId(
        address nftContract,
        uint256 tokenId,
        address seller
    ) internal pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(nftContract, "-", tokenId, "-", seller));
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
