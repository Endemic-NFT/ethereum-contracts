// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./EndemicAuction.sol";
import "./EndemicOffer.sol";
import "./EndemicPrivateSale.sol";

contract EndemicExchange is EndemicAuction, EndemicOffer, EndemicPrivateSale {
    /// @param _feeClaimAddress - address to claim fee between 0-10,000.
    /// @param _royaltiesProvider - royalyies provider contract
    function __EndemicExchange_init(
        address _royaltiesProvider,
        address _feeClaimAddress,
        uint256 _makerFee,
        uint256 _takerFee
    ) external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();

        __EndemicOffer___init_unchained();
        __EndemicPrivateSale___init_unchained();

        _updateConfiguration(
            _royaltiesProvider,
            _feeClaimAddress,
            _makerFee,
            _takerFee
        );
    }

    function updateConfiguration(
        address _royaltiesProvider,
        address _feeClaimAddress,
        uint256 _makerFee,
        uint256 _takerFee
    ) external onlyOwner {
        _updateConfiguration(
            _royaltiesProvider,
            _feeClaimAddress,
            _makerFee,
            _takerFee
        );
    }
}
