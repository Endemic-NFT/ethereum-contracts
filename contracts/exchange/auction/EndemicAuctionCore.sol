// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../EndemicExchangeCore.sol";

error Unauthorized();

error InvalidAuction();
error InvalidPrice();
error InvalidDuration();
error InvalidPriceConfiguration();
error InvalidAmount();

error AuctionNotStarted();
error AuctionInProgress();
error AuctionEnded();

abstract contract EndemicAuctionCore is EndemicExchangeCore {
    using AddressUpgradeable for address;

    uint256 internal constant MAX_DURATION = 1000 days;
    uint256 internal constant MIN_DURATION = 1 minutes;

    mapping(bytes32 => Auction) internal idToAuction;

    enum AuctionType {
        DUTCH,
        RESERVE
    }

    struct Auction {
        AuctionType auctionType;
        bytes32 id;
        address nftContract;
        address seller;
        address highestBidder;
        address paymentErc20TokenAddress;
        uint256 tokenId;
        uint256 duration;
        uint256 amount;
        uint256 startingPrice;
        uint256 endingPrice;
        uint256 startedAt;
        uint256 endingAt;
        bytes4 assetClass;
    }

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

    event AuctionSuccessful(
        bytes32 indexed id,
        uint256 indexed totalPrice,
        address winner,
        uint256 amount,
        uint256 totalFees
    );

    event AuctionCancelled(bytes32 indexed id);

    function _removeAuction(bytes32 auctionId) internal {
        delete idToAuction[auctionId];
    }

    function _deductFromAuction(Auction memory auction, uint256 amount)
        internal
    {
        idToAuction[auction.id].amount -= amount;
        if (idToAuction[auction.id].amount <= 0) {
            _removeAuction(auction.id);
        }
    }

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

    function _validateAssetClass(Auction memory auction) internal pure {
        if (auction.assetClass == ERC721_ASSET_CLASS) {
            if (auction.amount != 1) revert InvalidAmount();
        } else if (auction.assetClass == ERC1155_ASSET_CLASS) {
            if (auction.amount <= 0) revert InvalidAmount();
        } else {
            revert InvalidAssetClass();
        }
    }

    function _isActiveAuction(Auction memory auction)
        internal
        pure
        returns (bool)
    {
        return auction.startedAt > 0;
    }

    function _isAuctionType(Auction memory auction, AuctionType auctionType)
        internal
        pure
        returns (bool)
    {
        return auction.auctionType == auctionType;
    }

    function _requireIdleAuction(bytes32 id) internal view {
        Auction memory auction = idToAuction[id];

        if (auction.endingAt >= block.timestamp) revert AuctionInProgress();
        if (auction.endingAt != 0 && auction.endingAt < block.timestamp)
            revert AuctionEnded();
    }

    function _requireValidAuctionRequest(
        address paymentErc20TokenAddress,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        bytes4 assetClass
    ) internal view {
        _requireCorrectPaymentMethod(paymentErc20TokenAddress);

        _requireCorrectNftInterface(assetClass, nftContract);

        _requireTokenOwnership(
            assetClass,
            nftContract,
            tokenId,
            amount,
            msg.sender
        );
    }

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

    uint256[1000] private __gap;
}
