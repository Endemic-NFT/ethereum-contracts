// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

interface ICollectionInitializer {
    function initialize(
        address creator,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) external;
}
