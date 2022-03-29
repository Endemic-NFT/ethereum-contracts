// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./EndemicExchangeCore.sol";

error InvalidAuction();
error Unauthorized();
error InvalidPrice();
error InvalidValueProvided();
error InvalidDuration();
error InvalidPriceConfiguration();
error InvalidAmount();

abstract contract EndemicAuction is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    uint256 private constant MAX_DURATION = 1000 days;
    uint256 private constant MIN_DURATION = 1 minutes;
    uint256 private constant MIN_PRICE = 0.0001 ether;

    mapping(bytes32 => Auction) internal idToAuction;

    struct Auction {
        bytes32 id;
        uint256 tokenId;
        uint256 startingPrice;
        uint256 endingPrice;
        uint256 duration;
        uint256 amount;
        uint256 startedAt;
        address contractId;
        address seller;
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

    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 endingPrice,
        uint256 duration,
        uint256 amount,
        bytes4 assetClass
    ) external nonReentrant {
        _requireCorrectNftInterface(assetClass, nftContract);
        _requireTokenOwnership(
            assetClass,
            nftContract,
            tokenId,
            amount,
            _msgSender()
        );

        bytes32 auctionId = createAuctionId(nftContract, tokenId, _msgSender());

        Auction memory auction = Auction(
            auctionId,
            tokenId,
            startingPrice,
            endingPrice,
            duration,
            amount,
            block.timestamp,
            nftContract,
            msg.sender,
            assetClass
        );

        _validateAuction(auction);

        idToAuction[auctionId] = auction;

        emit AuctionCreated(
            nftContract,
            tokenId,
            auction.id,
            auction.startingPrice,
            auction.endingPrice,
            auction.duration,
            auction.seller,
            amount,
            assetClass
        );
    }

    function bid(bytes32 id, uint256 tokenAmount)
        external
        payable
        nonReentrant
    {
        Auction memory auction = idToAuction[id];

        if (!_isActiveAuction(auction)) revert InvalidAuction();
        if (auction.seller == _msgSender()) revert Unauthorized();
        if (auction.amount < tokenAmount) revert InvalidAmount();

        uint256 currentPrice = _calculateCurrentPrice(auction) * tokenAmount;
        if (currentPrice == 0) revert InvalidPrice();

        if (auction.assetClass == ERC721_ASSET_CLASS) {
            _removeAuction(auction.id);
        } else if (auction.assetClass == ERC1155_ASSET_CLASS) {
            _deductFromAuction(auction, tokenAmount);
        } else {
            revert InvalidAssetClass();
        }

        (
            uint256 makerCut,
            uint256 takerCut,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(auction.contractId, auction.tokenId, currentPrice);

        if (msg.value < (currentPrice + takerCut))
            revert InvalidValueProvided();

        _transferNFT(
            auction.seller,
            _msgSender(),
            auction.contractId,
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
            auction.seller
        );

        emit AuctionSuccessful(
            auction.id,
            currentPrice,
            _msgSender(),
            tokenAmount,
            totalCut
        );
    }

    function cancelAuction(bytes32 id) external nonReentrant {
        Auction memory auction = idToAuction[id];
        if (_msgSender() != auction.seller) revert Unauthorized();

        _removeAuction(auction.id);

        emit AuctionCancelled(auction.id);
    }

    /**
     * @notice Allows owner to cancel auctions
     * @dev This should only be used for extreme cases
     */
    function adminCancelAuctions(bytes32[] calldata ids)
        external
        nonReentrant
        onlyOwner
    {
        for (uint256 i = 0; i < ids.length; i++) {
            Auction memory auction = idToAuction[ids[i]];
            if (_isActiveAuction(auction)) {
                _removeAuction(auction.id);
                emit AuctionCancelled(auction.id);
            }
        }
    }

    function getAuction(bytes32 id)
        external
        view
        returns (
            address seller,
            uint256 startingPrice,
            uint256 endingPrice,
            uint256 duration,
            uint256 startedAt,
            uint256 amount
        )
    {
        Auction memory auction = idToAuction[id];
        if (!_isActiveAuction(auction)) revert InvalidAuction();
        return (
            auction.seller,
            auction.startingPrice,
            auction.endingPrice,
            auction.duration,
            auction.startedAt,
            auction.amount
        );
    }

    function getCurrentPrice(bytes32 id) external view returns (uint256) {
        Auction memory auction = idToAuction[id];
        if (!_isActiveAuction(auction)) revert InvalidAuction();
        return _calculateCurrentPrice(auction);
    }

    function createAuctionId(
        address nftContract,
        uint256 tokenId,
        address seller
    ) public pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(nftContract, "-", tokenId, "-", seller));
    }

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

    function _validateAuction(Auction memory auction) internal pure {
        if (auction.duration < MIN_DURATION || MAX_DURATION < auction.duration)
            revert InvalidDuration();

        if (
            auction.startingPrice < MIN_PRICE ||
            auction.endingPrice < MIN_PRICE ||
            auction.startingPrice < auction.endingPrice
        ) revert InvalidPriceConfiguration();

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

    function _calculateCurrentPrice(Auction memory auction)
        internal
        view
        returns (uint256)
    {
        uint256 secondsPassed = 0;

        if (block.timestamp > auction.startedAt) {
            secondsPassed = block.timestamp - auction.startedAt;
        }

        // NOTE: We don't use SafeMath (or similar) in this function because
        //  all of our public functions carefully cap the maximum values for
        //  time (at 64-bits) and currency (at 128-bits). _duration is
        //  also known to be non-zero (see the require() statement in
        //  _addAuction())
        if (secondsPassed >= auction.duration) {
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
                int256(secondsPassed)) / int256(auction.duration);

            // currentPriceChange can be negative, but if so, will have a magnitude
            // less that _startingPrice. Thus, this result will always end up positive.
            return uint256(int256(auction.startingPrice) + currentPriceChange);
        }
    }

    uint256[1000] private __gap;
}
