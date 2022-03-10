// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../fee/interfaces/IFeeProvider.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";

error FeeTransferFailed();
error RoyaltiesTransferFailed();
error FundsTransferFailed();

abstract contract EndemicExchangeCore {
    address public feeClaimAddress;

    IFeeProvider public feeProvider;
    IRoyaltiesProvider public royaltiesProvider;

    function _calculateFees(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 price
    )
        internal
        view
        returns (
            uint256 makerFee,
            uint256 takerFee,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalFees
        )
    {
        takerFee = feeProvider.calculateTakerFee(price);

        (royaltiesRecipient, royaltieFee) = royaltiesProvider
            .calculateRoyaltiesAndGetRecipient(nftContract, tokenId, price);

        makerFee = feeProvider.calculateMakerFee(
            seller,
            nftContract,
            tokenId,
            price
        );

        totalFees = makerFee + takerFee;
    }

    function _distributeFunds(
        uint256 price,
        uint256 makerFee,
        uint256 totalFees,
        uint256 royaltieFee,
        address royaltiesRecipient,
        address seller
    ) internal {
        uint256 sellerProceeds = price - makerFee - royaltieFee;

        if (royaltieFee > 0) {
            _transferRoyalties(royaltiesRecipient, royaltieFee);
        }

        if (totalFees > 0) {
            _transferFees(totalFees);
        }

        _transferFunds(seller, sellerProceeds);
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

    uint256[1000] private __gap;
}
