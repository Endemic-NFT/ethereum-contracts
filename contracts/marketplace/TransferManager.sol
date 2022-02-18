// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "../erc-721/IERC721.sol";
import "../erc-1155/IERC1155.sol";
import "../erc-721/IEndemicMasterNFT.sol";
import "../fee/IFeeProvider.sol";
import "../royalties/IRoyaltiesProvider.sol";
import "./LibAuction.sol";

abstract contract TransferManager is OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;

    uint256 public masterNftShares;
    address public feeClaimAddress;

    IFeeProvider feeProvider;
    IEndemicMasterNFT masterNFT;
    IRoyaltiesProvider royaltiesProvider;

    function __TransferManager___init_unchained(
        IFeeProvider _feeProvider,
        IEndemicMasterNFT _masterNFT,
        IRoyaltiesProvider _royaltiesProvider,
        address _feeClaimAddress
    ) internal initializer {
        feeProvider = _feeProvider;
        masterNFT = _masterNFT;
        royaltiesProvider = _royaltiesProvider;
        feeClaimAddress = _feeClaimAddress;
    }

    function setRoyaltiesProvider(IRoyaltiesProvider _royaltiesProvider)
        external
        onlyOwner
    {
        royaltiesProvider = _royaltiesProvider;
    }

    function _computeMakerCut(
        uint256 price,
        address seller,
        address nftContract,
        uint256 tokenId
    ) internal view returns (uint256) {
        uint256 makerFee = feeProvider.getMakerFee(
            seller,
            nftContract,
            tokenId
        );

        return (price.mul(makerFee)).div(10000);
    }

    function _computeTakerCut(uint256 price, address buyer)
        internal
        view
        returns (uint256)
    {
        uint256 takerFee = feeProvider.getTakerFee(buyer);
        return (price.mul(takerFee)).div(10000);
    }

    function claimETH() external onlyOwner {
        uint256 claimableETH = address(this).balance.sub(masterNftShares);
        (bool success, ) = payable(feeClaimAddress).call{value: claimableETH}(
            ""
        );
        require(success, "Transfer failed.");
    }

    function _transferFunds(
        address nftContract,
        uint256 tokenId,
        address seller,
        address buyer,
        uint256 price
    ) internal returns (uint256 totalFees) {
        if (price > 0) {
            uint256 takerCut = _computeTakerCut(price, buyer);

            require(msg.value >= price.add(takerCut), "Not enough funds sent");

            (
                address royaltiesRecipient,
                uint256 royaltiesCut
            ) = _calculateRoyalties(nftContract, tokenId, price);

            uint256 makerCut = _computeMakerCut(
                price,
                seller,
                nftContract,
                tokenId
            );

            uint256 fees = takerCut.add(makerCut);
            uint256 sellerProceeds = price.sub(makerCut).sub(royaltiesCut);

            feeProvider.onInitialSale(nftContract, tokenId);

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

    function _calculateRoyalties(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 price
    ) internal view returns (address recipient, uint256 royaltiesCut) {
        (address account, uint256 royaltiesFee) = royaltiesProvider
            .getRoyalties(_tokenAddress, _tokenId);

        return (account, price.mul(royaltiesFee).div(10000));
    }

    uint256[49] private __gap;
}
