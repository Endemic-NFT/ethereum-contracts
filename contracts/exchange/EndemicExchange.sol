// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "./auction/EndemicAuction.sol";
import "./EndemicOffer.sol";
import "./EndemicPrivateSale.sol";

contract EndemicExchange is EndemicAuction, EndemicOffer, EndemicPrivateSale {
    /// @param _feeClaimAddress - address to claim fee between 0-10,000.
    /// @param _royaltiesProvider - royalyies provider contract
    function __EndemicExchange_init(
        address _royaltiesProvider,
        address _paymentManager,
        address _feeClaimAddress
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();

        __EndemicOffer___init_unchained();
        __EndemicPrivateSale___init_unchained();

        _updateDistributorConfiguration(_feeClaimAddress);
        _updateExchangeConfiguration(_royaltiesProvider, _paymentManager);
    }

    function updateConfiguration(
        address _royaltiesProvider,
        address _paymentManager,
        address _feeClaimAddress
    ) external onlyOwner {
        _updateDistributorConfiguration(_feeClaimAddress);
        _updateExchangeConfiguration(_royaltiesProvider, _paymentManager);
    }
}
