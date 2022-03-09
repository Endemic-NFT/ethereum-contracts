// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../fee/interfaces/IFeeProvider.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";

error FeeTransferFailed();
error RoyaltiesTransferFailed();
error FundsTransferFailed();
error InvalidValueProvided();

abstract contract EndemicExchangeCore {
    address public feeClaimAddress;

    IFeeProvider public feeProvider;
    IRoyaltiesProvider public royaltiesProvider;

    function _distributeFunds(
        address nftContract,
        uint256 tokenId,
        address seller,
        uint256 price
    ) internal returns (uint256 totalFees) {
        uint256 takerFee = feeProvider.calculateTakerFee(price);
        // make sure enough funds are send once we calculate taker fee for price
        if (msg.value < (price + takerFee)) revert InvalidValueProvided();

        (address royaltiesRecipient, uint256 royaltieFee) = royaltiesProvider
            .calculateRoyaltiesAndGetRecipient(nftContract, tokenId, price);

        uint256 makerFee = feeProvider.calculateMakerFee(
            seller,
            nftContract,
            tokenId,
            price
        );

        totalFees = takerFee + makerFee;
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
