// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./FeeProviderCore.sol";

contract FeeProvider is FeeProviderCore {
    /// @param _primarySaleFee - percent fee the masterplace takes on first sale
    /// @param _secondarySaleFee - percent fee the endemicExchange takes on secondary sales for maker
    /// @param _takerFee - percent fee the endemicExchange takes on buy
    /// @param _contractRegistry - address of endemic contract registry
    ///  between 0-10,000.
    function __FeeProvider_init(
        uint256 _primarySaleFee,
        uint256 _secondarySaleFee,
        uint256 _takerFee,
        address _contractRegistry
    ) external initializer {
        require(_primarySaleFee <= 10000);
        require(_secondarySaleFee <= 10000);
        require(_takerFee <= 10000);

        __Context_init_unchained();
        __Ownable_init_unchained();

        __FeeProviderCore___init_unchained(
            _primarySaleFee,
            _secondarySaleFee,
            _takerFee,
            _contractRegistry
        );
    }

    uint256[50] private __gap;
}
