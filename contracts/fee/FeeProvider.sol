// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../erc-721/IEndemicMasterNFT.sol";
import "./FeeProviderCore.sol";

contract FeeProvider is FeeProviderCore {
    /// @param _initialSaleFee - percent fee the masterplace takes on first sale
    /// @param _secondarySaleMakerFee - percent fee the marketplace takes on secondary sales for maker
    /// @param _takerFee - percent fee the marketplace takes on secondary sales for taker
    /// @param _masterKeyCut - percet fee for master key holders
    /// @param _masterNFTContract - address of master nft contract
    /// @param _contractRegistry - address of endemic contract registry
    ///  between 0-10,000.
    function __FeeProvider_init(
        uint256 _initialSaleFee,
        uint256 _secondarySaleMakerFee,
        uint256 _takerFee,
        uint256 _masterKeyCut,
        IEndemicMasterNFT _masterNFTContract,
        IContractRegistry _contractRegistry
    ) external initializer {
        require(_initialSaleFee <= 10000);
        require(_secondarySaleMakerFee <= 10000);
        require(_takerFee <= 10000);
        require(_masterKeyCut <= 10000);

        __Context_init_unchained();
        __Pausable_init_unchained();
        __Ownable_init_unchained();

        __FeeProviderCore___init_unchained(
            _initialSaleFee,
            _secondarySaleMakerFee,
            _takerFee,
            _masterKeyCut,
            _masterNFTContract,
            _contractRegistry
        );
    }

    uint256[50] private __gap;
}
