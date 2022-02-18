// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./RoyaltiesProviderCore.sol";

contract RoyaltiesProvider is RoyaltiesProviderCore {
    function __RoyaltiesProvider_init() external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
    }

    uint256[50] private __gap;
}
