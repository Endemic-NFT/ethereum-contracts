// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../fee/interfaces/IFeeProvider.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";

abstract contract EndemicExchangeCore {
    address public feeClaimAddress;

    IFeeProvider public feeProvider;
    IRoyaltiesProvider public royaltiesProvider;

    function _transferFees(uint256 value) internal {
        (bool feeSuccess, ) = payable(feeClaimAddress).call{value: value}("");
        require(feeSuccess, "Fee Transfer failed.");
    }

    function _transferRoyalties(
        address royaltiesRecipient,
        uint256 royaltiesCut
    ) internal {
        (bool royaltiesSuccess, ) = payable(royaltiesRecipient).call{
            value: royaltiesCut
        }("");
        require(royaltiesSuccess, "Royalties Transfer failed.");
    }

    function _transferFunds(address recipient, uint256 value) internal {
        (bool success, ) = payable(recipient).call{value: value}("");
        require(success, "Transfer funds failed.");
    }

    uint256[1000] private __gap;
}
