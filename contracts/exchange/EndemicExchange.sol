// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./mixins/auction/EndemicDutchAuction.sol";
import "./mixins/auction/EndemicReserveAuction.sol";
import "./mixins/EndemicOffer.sol";
import "./mixins/EndemicSale.sol";

contract EndemicExchange is
    EndemicDutchAuction,
    EndemicReserveAuction,
    EndemicOffer,
    EndemicSale,
    OwnableUpgradeable
{
    /**
     * @notice Initialized Endemic exchange contract
     * @dev Only called once
     * @param _paymentManager - payment manager contract address
     * @param _feeRecipientAddress - address to receive exchange fees
     * @param _approvedSigner - address to sign reserve auction orders
     */
    function __EndemicExchange_init(
        address _paymentManager,
        address _feeRecipientAddress,
        address _approvedSigner
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();

        _updateDistributorConfiguration(_feeRecipientAddress);
        _updateExchangeConfiguration(_paymentManager, _approvedSigner);
    }

    /**
     * @notice Updated contract internal configuration, callable by exchange owner
     * @param _paymentManager - payment manager contract address
     * @param _feeRecipientAddress - address to receive exchange fees
     * @param _approvedSigner - address to sign reserve auction orders
     */
    function updateConfiguration(
        address _paymentManager,
        address _feeRecipientAddress,
        address _approvedSigner
    ) external onlyOwner {
        _updateDistributorConfiguration(_feeRecipientAddress);
        _updateExchangeConfiguration(_paymentManager, _approvedSigner);
    }
}
