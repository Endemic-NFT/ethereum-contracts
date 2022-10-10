// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../EndemicExchangeCore.sol";
import "../EndemicFundsDistributor.sol";

error Unauthorized();

error InvalidAuction();
error InvalidPrice();
error InvalidDuration();
error InvalidPriceConfiguration();
error InvalidAmount();

error AuctionNotStarted();
error AuctionInProgress();
error AuctionEnded();

abstract contract EndemicAuctionCore is
    EndemicFundsDistributor,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    uint256 internal constant MAX_DURATION = 1000 days;
    uint256 internal constant MIN_DURATION = 1 minutes;

    mapping(bytes32 => Auction) internal idToAuction;

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
        /// @notice Auction duration
        uint256 duration;
        /// @notice Amount of tokens to auction. Useful for ERC-1155
        uint256 amount;
        /// @notice Starting price of the dutch auction
        uint256 startingPrice;
        /// @notice Ending price of the dutch auction
        uint256 endingPrice;
        /// @notice Timestamp when auction started
        uint256 startedAt;
        /// @notice Timestamp when auction will end. Used for reserve auction.
        uint256 endingAt;
        /// @notice Type of NFT contract, ERC-721 or ERC-1155
        bytes4 assetClass;
    }

    /// @notice Fired when auction is created
    event AuctionCreated(
        address indexed nftContract,
        uint256 indexed tokenId,
        bytes32 indexed id,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration,
        address seller,
        uint256 amount,
        address paymentErc20TokenAddress,
        bytes4 assetClass
    );

    /// @notice Fired when auction is sucessfuly complated
    event AuctionSuccessful(
        bytes32 indexed id,
        uint256 indexed totalPrice,
        address winner,
        uint256 amount,
        uint256 totalFees
    );

    /// @notice Fired when auction is sucessfuly canceled
    event AuctionCancelled(bytes32 indexed id);

    /// @notice Deletes auction from the storage
    /// @param auctionId ID of the auction to delete
    function _removeAuction(bytes32 auctionId) internal {
        delete idToAuction[auctionId];
    }

    /// @notice Calculates remaining auction token amount.
    /// @dev It will delete auction for ERC-721 since amount is always 1
    function _deductFromAuction(Auction memory auction, uint256 amount)
        internal
    {
        idToAuction[auction.id].amount -= amount;
        if (idToAuction[auction.id].amount <= 0) {
            _removeAuction(auction.id);
        }
    }

    /// @notice Transfers NFT from seller to buyer
    function _transferNFT(
        address from,
        address receiver,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        bytes4 assetClass
    ) internal {
        if (assetClass == ERC721_ASSET_CLASS) {
            IERC721(nftContract).transferFrom(from, receiver, tokenId);
        } else if (assetClass == ERC1155_ASSET_CLASS) {
            IERC1155(nftContract).safeTransferFrom(
                from,
                receiver,
                tokenId,
                amount,
                ""
            );
        } else {
            revert InvalidAssetClass();
        }
    }

    /// @notice Validates if asset class and token amount match
    function _validateAssetClass(bytes4 assetClass, uint256 amount)
        internal
        pure
    {
        if (assetClass == ERC721_ASSET_CLASS) {
            if (amount != 1) revert InvalidAmount();
        } else if (assetClass == ERC1155_ASSET_CLASS) {
            if (amount <= 0) revert InvalidAmount();
        } else {
            revert InvalidAssetClass();
        }
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

    /// @notice Checks if auction has not been started or completed
    function _requireIdleAuction(bytes32 id) internal view {
        Auction memory auction = idToAuction[id];

        if (auction.endingAt >= block.timestamp) revert AuctionInProgress();
        if (auction.endingAt != 0 && auction.endingAt < block.timestamp)
            revert AuctionEnded();
    }

    /// @notice Validates auction request
    function _requireValidAuctionRequest(
        address paymentErc20TokenAddress,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        bytes4 assetClass
    ) internal view {
        _requireSupportedPaymentMethod(paymentErc20TokenAddress);

        _requireCorrectNftInterface(assetClass, nftContract);

        _requireTokenOwnership(
            assetClass,
            nftContract,
            tokenId,
            amount,
            msg.sender
        );

        _validateAssetClass(assetClass, amount);
    }

    /// @notice Validates bid request for an auction
    function _requireValidBidRequest(
        Auction memory auction,
        AuctionType auctionType,
        uint256 tokenAmount
    ) internal view {
        if (!_isActiveAuction(auction) || !_isAuctionType(auction, auctionType))
            revert InvalidAuction();
        if (auction.seller == msg.sender) revert Unauthorized();
        if (auction.amount < tokenAmount) revert InvalidAmount();
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
