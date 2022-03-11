// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../royalties/interfaces/IRoyaltiesProvider.sol";

error FeeTransferFailed();
error RoyaltiesTransferFailed();
error FundsTransferFailed();
error InvalidAddress();
error InvalidFees();
error InvalidInterface();
error SellerNotAssetOwner();
error InvalidAssetClass();

abstract contract EndemicExchangeCore {
    bytes4 public constant ERC721_INTERFACE = bytes4(0x80ac58cd);
    bytes4 public constant ERC1155_INTERFACE = bytes4(0xd9b67a26);

    bytes4 public constant ERC721_ASSET_CLASS = bytes4(keccak256("ERC721"));
    bytes4 public constant ERC1155_ASSET_CLASS = bytes4(keccak256("ERC1155"));

    IRoyaltiesProvider public royaltiesProvider;

    address public feeClaimAddress;
    uint256 public makerFee;
    uint256 public takerFee;

    uint256 internal constant FEE_BASIS_POINTS = 10000;
    address internal constant ZERO_ADDRESS = address(0);

    function __EndemicExchangeCore_init(
        address _royaltiesProvider,
        address _feeClaimAddress,
        uint256 _makerFee,
        uint256 _takerFee
    ) internal {
        if (
            _royaltiesProvider == ZERO_ADDRESS ||
            _feeClaimAddress == ZERO_ADDRESS
        ) revert InvalidAddress();

        if (_makerFee >= FEE_BASIS_POINTS || _takerFee >= FEE_BASIS_POINTS) {
            revert InvalidFees();
        }

        royaltiesProvider = IRoyaltiesProvider(_royaltiesProvider);
        feeClaimAddress = _feeClaimAddress;

        makerFee = _makerFee;
        takerFee = _takerFee;
    }

    function _calculateFees(
        address nftContract,
        uint256 tokenId,
        uint256 price
    )
        internal
        view
        returns (
            uint256 makerCut,
            uint256 takerCut,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        )
    {
        takerCut = _calculateCut(takerFee, price);
        makerCut = _calculateCut(makerFee, price);

        (royaltiesRecipient, royaltieFee) = royaltiesProvider
            .calculateRoyaltiesAndGetRecipient(nftContract, tokenId, price);

        totalCut = takerCut + makerCut;
    }

    function _distributeFunds(
        uint256 price,
        uint256 makerCut,
        uint256 totalCut,
        uint256 royaltieFee,
        address royaltiesRecipient,
        address seller
    ) internal {
        uint256 sellerProceeds = price - makerCut - royaltieFee;

        if (royaltieFee > 0) {
            _transferRoyalties(royaltiesRecipient, royaltieFee);
        }

        if (totalCut > 0) {
            _transferFees(totalCut);
        }

        _transferFunds(seller, sellerProceeds);
    }

    function _calculateCut(uint256 fee, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        return (amount * fee) / FEE_BASIS_POINTS;
    }

    function _transferFees(uint256 value) internal {
        (bool success, ) = payable(feeClaimAddress).call{value: value}("");
        if (!success) revert FeeTransferFailed();
    }

    function _transferRoyalties(
        address royaltiesRecipient,
        uint256 royaltiesCut
    ) internal {
        (bool success, ) = payable(royaltiesRecipient).call{
            value: royaltiesCut
        }("");
        if (!success) revert RoyaltiesTransferFailed();
    }

    function _transferFunds(address recipient, uint256 value) internal {
        (bool success, ) = payable(recipient).call{value: value}("");
        if (!success) revert FundsTransferFailed();
    }

    function _requireCorrectNftInterface(
        bytes4 _assetClass,
        address _nftContract
    ) internal view {
        if (_assetClass == ERC721_ASSET_CLASS) {
            if (!IERC721(_nftContract).supportsInterface(ERC721_INTERFACE))
                revert InvalidInterface();
        } else if (_assetClass == ERC1155_ASSET_CLASS) {
            if (!IERC1155(_nftContract).supportsInterface(ERC1155_INTERFACE))
                revert InvalidInterface();
        } else {
            revert InvalidAssetClass();
        }
    }

    function _requireTokenOwnership(
        bytes4 assetClass,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        address seller
    ) internal view {
        if (assetClass == ERC721_ASSET_CLASS) {
            if (IERC721(nftContract).ownerOf(tokenId) != seller)
                revert SellerNotAssetOwner();
        } else if (assetClass == ERC1155_ASSET_CLASS) {
            if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount)
                revert SellerNotAssetOwner();
        } else {
            revert InvalidAssetClass();
        }
    }

    uint256[1000] private __gap;
}
