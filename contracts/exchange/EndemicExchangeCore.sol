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
