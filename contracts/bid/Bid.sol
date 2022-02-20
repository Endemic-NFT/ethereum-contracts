// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./BidCore.sol";

contract Bid is BidCore {
    /// @param _feeProvider - fee provider contract
    /// @param _feeClaimAddress - address to claim fee
    ///  between 0-10,000.
    function __Bid_init(
        address _feeProvider,
        address _royaltiesProvider,
        address _feeClaimAddress
    ) external initializer {
        require(_feeProvider != address(0));
        require(_royaltiesProvider != address(0));
        require(_feeClaimAddress != address(0));

        __Context_init_unchained();
        __Pausable_init_unchained();
        __Ownable_init_unchained();
        __BidCore___init_unchained(
            _feeProvider,
            _royaltiesProvider,
            _feeClaimAddress
        );
    }

    uint256[50] private __gap;
}
