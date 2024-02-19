// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IOrderCollection {
    function initialize(
        address creator,
        string memory name,
        string memory symbol,
        uint256 royalties,
        address administrator,
        address operator
    ) external;

    function mint(address recipient, string calldata tokenCID) external;

    function batchMint(address recipient, string[] calldata tokenCIDs) external;
}
