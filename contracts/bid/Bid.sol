// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./BidCore.sol";
import "../erc-721/IEndemicMasterNFT.sol";
import "../fee/IFeeProvider.sol";
import "../royalties/IRoyaltiesProvider.sol";

contract Bid is BidCore {
    /// @param _feeProvider - fee provider contract
    /// @param _masterNFT - master NFT contract
    /// @param _feeClaimAddress - address to claim fee
    ///  between 0-10,000.
    function __Bid_init(
        IFeeProvider _feeProvider,
        IEndemicMasterNFT _masterNFT,
        IRoyaltiesProvider _royaltiesProvider,
        address _feeClaimAddress
    ) external initializer {
        require(_feeClaimAddress != address(0));

        __Context_init_unchained();
        __Pausable_init_unchained();
        __Ownable_init_unchained();
        __BidCore___init_unchained(
            _feeProvider,
            _masterNFT,
            _royaltiesProvider,
            _feeClaimAddress
        );
    }

    uint256[50] private __gap;
}
