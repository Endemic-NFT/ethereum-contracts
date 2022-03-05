// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./LibAuction.sol";

library LibNFT {
    error InvalidImplementation();
    error ExchangeNotApprovedForAsset();
    error SellerNotAssetOwner();

    bytes4 public constant ERC721_Interface = bytes4(0x80ac58cd);
    bytes4 public constant ERC1155_Interface = bytes4(0xd9b67a26);

    function validate(
        bytes4 assetClass,
        address contractId,
        uint256 tokenId,
        uint256 amount,
        address seller
    ) internal view {
        requireCorrectInterface(assetClass, contractId);
        requireTokenOwnership(assetClass, contractId, tokenId, amount, seller);
        requireTokenApproval(assetClass, contractId, tokenId, seller);
    }

    function requireCorrectInterface(bytes4 _assetClass, address _nftContract)
        internal
        view
    {
        if (_assetClass == LibAuction.ERC721_ASSET_CLASS) {
            if (!IERC721(_nftContract).supportsInterface(ERC721_Interface))
                revert InvalidImplementation();
        } else if (_assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            if (!IERC1155(_nftContract).supportsInterface(ERC1155_Interface))
                revert InvalidImplementation();
        } else {
            revert LibAuction.InvalidAssetClass();
        }
    }

    function requireTokenOwnership(
        bytes4 assetClass,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        address seller
    ) internal view {
        if (assetClass == LibAuction.ERC721_ASSET_CLASS) {
            if (IERC721(nftContract).ownerOf(tokenId) != seller)
                revert SellerNotAssetOwner();
        } else if (assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount)
                revert SellerNotAssetOwner();
        } else {
            revert LibAuction.InvalidAssetClass();
        }
    }

    function requireTokenApproval(
        bytes4 assetClass,
        address nftContract,
        uint256 tokenId,
        address seller
    ) internal view {
        if (assetClass == LibAuction.ERC721_ASSET_CLASS) {
            IERC721 nft = IERC721(nftContract);
            if (
                nft.getApproved(tokenId) != address(this) &&
                !nft.isApprovedForAll(seller, address(this))
            ) revert ExchangeNotApprovedForAsset();
        } else if (assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            if (!IERC1155(nftContract).isApprovedForAll(seller, address(this)))
                revert ExchangeNotApprovedForAsset();
        } else {
            revert LibAuction.InvalidAssetClass();
        }
    }
}
