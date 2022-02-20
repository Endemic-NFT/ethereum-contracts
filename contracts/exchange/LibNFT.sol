// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../erc-721/interfaces/IEndemicERC721.sol";
import "../erc-1155/IERC1155.sol";
import "./LibAuction.sol";

library LibNFT {
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

    function isApproved(
        address _seller,
        address _nftContract,
        uint256 _tokenId
    ) internal view returns (bool) {}

    function requireCorrectInterface(bytes4 _assetClass, address _nftContract)
        internal
        view
    {
        if (_assetClass == LibAuction.ERC721_ASSET_CLASS) {
            require(
                IERC721(_nftContract).supportsInterface(ERC721_Interface),
                "Contract has an invalid ERC721 implementation"
            );
        } else if (_assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            require(
                IERC1155(_nftContract).supportsInterface(ERC1155_Interface),
                "Contract has an invalid ERC1155 implementation"
            );
        } else {
            revert("Invalid asset class");
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
            require(
                IERC721(nftContract).ownerOf(tokenId) == seller,
                "Seller is not owner of the asset"
            );
        } else if (assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            require(
                IERC1155(nftContract).balanceOf(seller, tokenId) >= amount,
                "Seller is not owner of the asset amount"
            );
        } else {
            revert("Invalid asset class");
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
            require(
                nft.getApproved(tokenId) == address(this) ||
                    nft.isApprovedForAll(seller, address(this)),
                "Marketplace is not approved for the asset"
            );
        } else if (assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            require(
                IERC1155(nftContract).isApprovedForAll(seller, address(this)),
                "Marketplace is not approved for the asset"
            );
        } else {
            revert("Invalid asset class");
        }
    }
}
