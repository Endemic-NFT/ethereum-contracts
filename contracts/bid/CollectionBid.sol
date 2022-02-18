// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./CollectionBidCore.sol";
import "../fee/IFeeProvider.sol";
import "../royalties/IRoyaltiesProvider.sol";

contract CollectionBid is CollectionBidCore {
    /// @param _feeProvider - fee provider contract
    /// @param _feeClaimAddress - address to claim fee
    ///  between 0-10,000.
    function __CollectionBid_init(
        IFeeProvider _feeProvider,
        IRoyaltiesProvider _royaltiesProvider,
        address _feeClaimAddress
    ) external initializer {
        require(_feeClaimAddress != address(0));

        __Context_init_unchained();
        __Pausable_init_unchained();
        __Ownable_init_unchained();
        __CollectionBidCore___init_unchained(
            _feeProvider,
            _royaltiesProvider,
            _feeClaimAddress
        );
    }

    uint256[50] private __gap;
}
