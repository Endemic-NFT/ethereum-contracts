// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IRoyaltiesProvider {
    function getRoyalties(address nftContract, uint256 tokenId)
        external
        view
        returns (address account, uint256 fee);
}
