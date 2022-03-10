// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../royalties/interfaces/IRoyaltiesProvider.sol";

error FeeTransferFailed();
error RoyaltiesTransferFailed();
error FundsTransferFailed();
error InvalidAddress();
error InvalidFees();

abstract contract EndemicExchangeCore {
    IRoyaltiesProvider public royaltiesProvider;

    address public feeClaimAddress;
    uint256 public makerFee;
    uint256 public takerFee;

    uint256 internal constant MAX_FEE = 10000;
    address internal constant ZERO_ADDRESS = address(0);

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
        return (amount * fee) / MAX_FEE;
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

    function _updateConfiguration(
        address _royaltiesProvider,
        address _feeClaimAddress,
        uint256 _makerFee,
        uint256 _takerFee
    ) internal {
        if (
            _royaltiesProvider == ZERO_ADDRESS ||
            _feeClaimAddress == ZERO_ADDRESS
        ) revert InvalidAddress();

        if (_makerFee >= MAX_FEE || _takerFee >= MAX_FEE) {
            revert InvalidFees();
        }

        royaltiesProvider = IRoyaltiesProvider(_royaltiesProvider);
        feeClaimAddress = _feeClaimAddress;

        makerFee = _makerFee;
        takerFee = _takerFee;
    }

    uint256[1000] private __gap;
}
