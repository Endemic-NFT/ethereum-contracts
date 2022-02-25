// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IEndemicERC1155 is IERC1155 {
    function initialize(
        address creator,
        string memory name,
        string memory symbol
    ) external;
}
