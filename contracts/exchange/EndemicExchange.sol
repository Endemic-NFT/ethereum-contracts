// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./EndemicExchangeCore.sol";

contract EndemicExchange is EndemicExchangeCore {
    /// @param _feeProvider - fee provider contract
    /// @param _feeClaimAddress - address to claim fee between 0-10,000.
    /// @param _royaltiesProvider - royalyies provider contract
    function __EndemicExchange_init(
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
        __TransferManager___init_unchained(
            _feeProvider,
            _royaltiesProvider,
            _feeClaimAddress
        );
    }

    uint256[50] private __gap;
}
