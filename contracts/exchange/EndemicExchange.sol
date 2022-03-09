// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./EndemicAuction.sol";
import "./EndemicOffer.sol";

error InvalidAddress();

address constant ZERO_ADDRESS = address(0);

contract EndemicExchange is EndemicAuction, EndemicOffer {
    /// @param _feeProvider - fee provider contract
    /// @param _feeClaimAddress - address to claim fee between 0-10,000.
    /// @param _royaltiesProvider - royalyies provider contract
    function __EndemicExchange_init(
        address _feeProvider,
        address _royaltiesProvider,
        address _feeClaimAddress
    ) external initializer {
        if (
            _feeProvider == ZERO_ADDRESS ||
            _royaltiesProvider == ZERO_ADDRESS ||
            _feeClaimAddress == ZERO_ADDRESS
        ) revert InvalidAddress();

        __Context_init_unchained();
        __Ownable_init_unchained();

        __EndemicOffer___init_unchained();

        feeProvider = IFeeProvider(_feeProvider);
        royaltiesProvider = IRoyaltiesProvider(_royaltiesProvider);
        feeClaimAddress = _feeClaimAddress;
    }

    function updateConfiguration(
        address _feeProvider,
        address _royaltiesProvider,
        address _feeClaimAddress
    ) external onlyOwner {
        feeProvider = IFeeProvider(_feeProvider);
        royaltiesProvider = IRoyaltiesProvider(_royaltiesProvider);
        feeClaimAddress = _feeClaimAddress;
    }
}
