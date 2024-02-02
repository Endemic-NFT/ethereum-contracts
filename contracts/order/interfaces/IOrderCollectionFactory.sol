// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IOrderCollectionFactory {
    function createCollection(
        address owner,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) external returns (address);
}
