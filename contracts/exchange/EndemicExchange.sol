// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "./mixins/auction/EndemicAuction.sol";
import "./mixins/EndemicOffer.sol";
import "./mixins/EndemicSale.sol";

contract EndemicExchange is EndemicAuction, EndemicOffer, EndemicSale {
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
        address _feeRecipientAddress,
        address _approvedSettler
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();

        _updateDistributorConfiguration(_feeRecipientAddress);
        _updateExchangeConfiguration(_royaltiesProvider, _paymentManager);
        _updateApprovedSettler(_approvedSettler);
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
        _updateApprovedSettler(address(0));
    }
}
