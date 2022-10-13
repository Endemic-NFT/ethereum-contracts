// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../EndemicExchangeCore.sol";
import "./EndemicDutchAuction.sol";
import "./EndemicReserveAuction.sol";

abstract contract EndemicAuction is
    OwnableUpgradeable,
    EndemicDutchAuction,
    EndemicReserveAuction
{
    using AddressUpgradeable for address;

    /**
     * @notice Read active auction by id
     * @dev Reverts if auction doesn't exist
     * @param id id of the auction to read
     */
    function getAuction(bytes32 id)
        external
        view
        returns (
            address seller,
            address paymentErc20TokenAddress,
            uint256 startingPrice,
            uint256 endingPrice,
            uint256 startedAt,
            uint256 endingAt,
            uint256 amount
        )
    {
        Auction memory auction = idToAuction[id];
        if (!_isActiveAuction(auction)) revert InvalidAuction();
        return (
            auction.seller,
            auction.paymentErc20TokenAddress,
            auction.startingPrice,
            auction.endingPrice,
            auction.startedAt,
            auction.endingAt,
            auction.amount
        );
    }

    /**
     * @notice Cancels active auction
     * @dev Reverts if auction doesn't exist or if is listed as reserve and in progress
     * @param id - id of the auction to cancel
     */
    function cancelAuction(bytes32 id) external nonReentrant {
        Auction memory auction = idToAuction[id];
        if (_msgSender() != auction.seller) revert Unauthorized();
        if (auction.auctionType == AuctionType.RESERVE && auction.endingAt != 0)
            revert AuctionInProgress();

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

    /**
     * @notice Creates auction id based on provided params
     * @param nftContract contract address of the collection
     * @param tokenId NFT token ID
     * @param seller address of the NFT seller
     */
    function createAuctionId(
        address nftContract,
        uint256 tokenId,
        address seller
    ) public pure returns (bytes32) {
        return _createAuctionId(nftContract, tokenId, seller);
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
