// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "./mixins/auction/EndemicAuction.sol";
import "./mixins/EndemicOffer.sol";
import "./mixins/EndemicPrivateSale.sol";

contract EndemicExchange is EndemicAuction, EndemicOffer, EndemicPrivateSale {
    /**
     * @notice Initialized Endemic exchange contract
     * @dev Only called once
     * @param _royaltiesProvider - royalyies provider contract
     * @param _paymentManager - payment manager contract address
     * @param _feeRecipientAddress - address to receive exchange fees
     */
    function __EndemicExchange_init(
        address _royaltiesProvider,
        address _paymentManager,
        address _feeRecipientAddress
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();

        __EndemicOffer___init_unchained();
        __EndemicPrivateSale___init_unchained();

        _updateDistributorConfiguration(_feeRecipientAddress);
        _updateExchangeConfiguration(_royaltiesProvider, _paymentManager);
    }

    /**
     * @notice Updated contract internal configuration, callable by exchange owner
     * @param _royaltiesProvider - royalyies provider contract
     * @param _paymentManager - payment manager contract address
     * @param _feeRecipientAddress - address to receive exchange fees
     */
    function updateConfiguration(
        address _royaltiesProvider,
        address _paymentManager,
        address _feeRecipientAddress
    ) external onlyOwner {
        _updateDistributorConfiguration(_feeRecipientAddress);
        _updateExchangeConfiguration(_royaltiesProvider, _paymentManager);
    }
}
