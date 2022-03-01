// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./LibAuction.sol";

import "../fee/interfaces/IFeeProvider.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";

abstract contract TransferManager is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    address public feeClaimAddress;

    IFeeProvider public feeProvider;
    IRoyaltiesProvider public royaltiesProvider;

    function __TransferManager___init_unchained(
        address _feeProvider,
        address _royaltiesProvider,
        address _feeClaimAddress
    ) internal initializer {
        feeProvider = IFeeProvider(_feeProvider);
        royaltiesProvider = IRoyaltiesProvider(_royaltiesProvider);
        feeClaimAddress = _feeClaimAddress;
    }

    function _transferFunds(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 price
    ) internal returns (uint256 totalFees) {
        if (price > 0) {
            uint256 takerCut = feeProvider.calculateTakerFee(price);

            require(msg.value >= price.add(takerCut), "Not enough funds sent");

            (
                address royaltiesRecipient,
                uint256 royaltiesCut
            ) = royaltiesProvider.calculateRoyaltiesAndGetRecipient(
                    nftContract,
                    tokenId,
                    price
                );

            uint256 makerCut = feeProvider.calculateMakerFee(
                seller,
                nftContract,
                tokenId,
                price
            );

            uint256 fees = takerCut.add(makerCut);
            uint256 sellerProceeds = price.sub(makerCut).sub(royaltiesCut);

            feeProvider.onSale(nftContract, tokenId);

            if (royaltiesCut > 0) {
                (bool royaltiesSuccess, ) = payable(royaltiesRecipient).call{
                    value: royaltiesCut
                }("");
                require(royaltiesSuccess, "Royalties Transfer failed.");
            }

            if (fees > 0) {
                (bool feeTransferSuccess, ) = payable(feeClaimAddress).call{
                    value: fees
                }("");
                require(feeTransferSuccess, "Fee Transfer failed.");
            }

            (bool success, ) = payable(seller).call{value: sellerProceeds}("");
            require(success, "Transfer failed.");

            return fees;
        } else {
            revert("Invalid price");
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
            IERC721(nftContract).safeTransferFrom(owner, receiver, tokenId);
        } else if (assetClass == LibAuction.ERC1155_ASSET_CLASS) {
            IERC1155(nftContract).safeTransferFrom(
                owner,
                receiver,
                tokenId,
                amount,
                ""
            );
        } else {
            revert("Invalid asset class");
        }
    }

    uint256[50] private __gap;
}
