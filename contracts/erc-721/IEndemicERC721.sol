// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IEndemicERC721 is IERC721 {
    function mint(address recipient, string calldata tokenURI)
        external
        returns (bool);

    function initialize(
        address creator,
        string memory name,
        string memory symbol
    ) external;
}
