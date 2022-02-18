// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./FeeProviderCore.sol";

contract FeeProvider is FeeProviderCore {
    /// @param _initialSaleFee - percent fee the masterplace takes on first sale
    /// @param _secondarySaleMakerFee - percent fee the marketplace takes on secondary sales for maker
    /// @param _takerFee - percent fee the marketplace takes on secondary sales for taker
    /// @param _contractRegistry - address of endemic contract registry
    ///  between 0-10,000.
    function __FeeProvider_init(
        uint256 _initialSaleFee,
        uint256 _secondarySaleMakerFee,
        uint256 _takerFee,
        IContractRegistry _contractRegistry
    ) external initializer {
        require(_initialSaleFee <= 10000);
        require(_secondarySaleMakerFee <= 10000);
        require(_takerFee <= 10000);

        __Context_init_unchained();
        __Pausable_init_unchained();
        __Ownable_init_unchained();

        __FeeProviderCore___init_unchained(
            _initialSaleFee,
            _secondarySaleMakerFee,
            _takerFee,
            _contractRegistry
        );
    }

    uint256[50] private __gap;
}
