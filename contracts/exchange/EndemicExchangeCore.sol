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
        address _royaltiesRecipient,
        uint256 _royaltiesCut
    ) internal {
        (bool royaltiesSuccess, ) = payable(_royaltiesRecipient).call{
            value: _royaltiesCut
        }("");
        require(royaltiesSuccess, "Royalties Transfer failed.");
    }

    function _transferFunds(address _recipient, uint256 _value) internal {
        (bool success, ) = payable(_recipient).call{value: _value}("");
        require(success, "Transfer funds failed.");
    }

    uint256[100] private __gap;
}
