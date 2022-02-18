// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "./TransferManager.sol";

import "./LibNFT.sol";

abstract contract MarketplaceCore is
    PausableUpgradeable,
    OwnableUpgradeable,
    TransferManager
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
    ) external whenNotPaused {
        bytes32 auctionId = createAuctionId(nftContract, tokenId, _msgSender());

        LibAuction.Auction memory auction = LibAuction.Auction(
            auctionId,
            nftContract,
            tokenId,
            msg.sender,
            startingPrice,
            endingPrice,
            duration,
            amount,
            block.timestamp,
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

        LibNFT.requireTokenApproval(
            auction.assetClass,
            auction.contractId,
            auction.tokenId,
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
        whenNotPaused
    {
        LibAuction.Auction storage auction = idToAuction[id];

        require(LibAuction.isOnAuction(auction), "NFT is not on auction");
        require(auction.seller != _msgSender(), "Cant buy from self");
        require(
            auction.amount >= tokenAmount && tokenAmount >= 0,
            "Amount incorrect"
        );

        LibNFT.requireTokenOwnership(
            auction.assetClass,
            auction.contractId,
            auction.tokenId,
            tokenAmount,
            auction.seller
        );

        LibNFT.requireTokenApproval(
            auction.assetClass,
            auction.contractId,
            auction.tokenId,
            auction.seller
        );

        uint256 price = LibAuction.currentPrice(auction) * tokenAmount;
        require(
            msg.value >= price,
            "Bid amount can not be lower then auction price"
        );

        address seller = auction.seller;
        bytes32 auctionId = auction.id;
        address contractId = auction.contractId;
        uint256 tokenId = auction.tokenId;
        bytes4 assetClass = auction.assetClass;

        if (auction.assetClass == LibAuction.ERC721_ASSET_CLASS) {
            _removeAuction(auction);
        } else if (auction.assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            _deductFromAuction(auction, tokenAmount);
        } else {
            revert("Invalid asset class");
        }

        uint256 totalFees = _transferFunds(
            contractId,
            tokenId,
            seller,
            _msgSender(),
            price
        );

        _transferNFT(
            seller,
            _msgSender(),
            contractId,
            tokenId,
            tokenAmount,
            assetClass
        );

        emit AuctionSuccessful(
            auctionId,
            price,
            _msgSender(),
            tokenAmount,
            totalFees
        );
    }

    function cancelAuction(bytes32 id) external {
        LibAuction.Auction storage auction = idToAuction[id];
        require(LibAuction.isOnAuction(auction), "Invalid auction");
        require(_msgSender() == auction.seller, "Sender is not seller");
        _cancelAuction(auction);
    }

    function cancelAuctionWhenPaused(bytes32 id) external whenPaused onlyOwner {
        LibAuction.Auction storage auction = idToAuction[id];
        require(LibAuction.isOnAuction(auction));
        _cancelAuction(auction);
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
        LibAuction.Auction storage auction = idToAuction[id];
        require(LibAuction.isOnAuction(auction), "Not on auction");
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
        LibAuction.Auction storage auction = idToAuction[id];
        require(LibAuction.isOnAuction(auction));
        return LibAuction.currentPrice(auction);
    }

    function createAuctionId(
        address nftContract,
        uint256 tokenId,
        address seller
    ) public pure returns (bytes32) {
        return
            keccak256(abi.encodePacked(nftContract, "-", tokenId, "-", seller));
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _cancelAuction(LibAuction.Auction storage auction) internal {
        bytes32 auctionId = auction.id;
        _removeAuction(auction);
        emit AuctionCancelled(auctionId);
    }

    function _removeAuction(LibAuction.Auction storage auction) internal {
        delete idToAuction[auction.id];
    }

    function _deductFromAuction(
        LibAuction.Auction storage auction,
        uint256 amount
    ) internal {
        idToAuction[auction.id].amount -= amount;
        if (idToAuction[auction.id].amount <= 0) {
            _removeAuction(auction);
        }
    }

    uint256[50] private __gap;
}
