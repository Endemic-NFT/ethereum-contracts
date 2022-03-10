// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./EndemicExchangeCore.sol";

import "./LibNFT.sol";

error InvalidAuction();
error Unauthorized();
error InvalidPrice();
error InvalidValueProvided();

abstract contract EndemicAuction is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    mapping(bytes32 => LibAuction.Auction) internal idToAuction;

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
        bytes32 auctionId = createAuctionId(nftContract, tokenId, _msgSender());

        LibAuction.Auction memory auction = LibAuction.Auction(
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

        LibAuction.validate(auction);

        LibNFT.requireTokenOwnership(
            auction.assetClass,
            auction.contractId,
            auction.tokenId,
            amount,
            auction.seller
        );

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
        LibAuction.Auction memory auction = idToAuction[id];

        if (!LibAuction.isActiveAuction(auction)) revert InvalidAuction();
        if (auction.seller == _msgSender()) revert Unauthorized();
        if (auction.amount < tokenAmount) revert LibAuction.InvalidAmount();

        LibNFT.requireTokenOwnership(
            auction.assetClass,
            auction.contractId,
            auction.tokenId,
            tokenAmount,
            auction.seller
        );

        uint256 currentPrice = LibAuction.getCurrentPrice(auction) *
            tokenAmount;
        if (currentPrice == 0) revert InvalidPrice();

        if (auction.assetClass == LibAuction.ERC721_ASSET_CLASS) {
            _removeAuction(auction.id);
        } else if (auction.assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            _deductFromAuction(auction, tokenAmount);
        } else {
            revert LibAuction.InvalidAssetClass();
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
        LibAuction.Auction memory auction = idToAuction[id];
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
            LibAuction.Auction memory auction = idToAuction[ids[i]];
            if (LibAuction.isActiveAuction(auction)) {
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
        LibAuction.Auction memory auction = idToAuction[id];
        if (!LibAuction.isActiveAuction(auction)) revert InvalidAuction();
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
        LibAuction.Auction memory auction = idToAuction[id];
        if (!LibAuction.isActiveAuction(auction)) revert InvalidAuction();
        return LibAuction.getCurrentPrice(auction);
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

    function _deductFromAuction(
        LibAuction.Auction memory auction,
        uint256 amount
    ) internal {
        idToAuction[auction.id].amount -= amount;
        if (idToAuction[auction.id].amount <= 0) {
            _removeAuction(auction.id);
        }
    }

    function _transferNFT(
        address owner,
        address receiver,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        bytes4 assetClass
    ) internal {
        if (assetClass == LibAuction.ERC721_ASSET_CLASS) {
            IERC721(nftContract).transferFrom(owner, receiver, tokenId);
        } else if (assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            IERC1155(nftContract).safeTransferFrom(
                owner,
                receiver,
                tokenId,
                amount,
                ""
            );
        } else {
            revert LibAuction.InvalidAssetClass();
        }
    }

    uint256[1000] private __gap;
}
