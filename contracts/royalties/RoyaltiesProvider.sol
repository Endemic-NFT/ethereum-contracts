// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./RoyaltiesProviderCore.sol";

contract RoyaltiesProvider is RoyaltiesProviderCore {
    function __RoyaltiesProvider_init(uint256 royaltiesLimit)
        external
        initializer
    {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __RoyaltiesProviderCore_init(royaltiesLimit);
    }

    uint256[50] private __gap;
}
