// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IFeeProvider {
    function getMakerFee(
        address seller,
        address nftContract,
        uint256 tokenId
    ) external view returns (uint256);

    function getTakerFee(address buyer) external view returns (uint256);

    function onInitialSale(address nftContract, uint256 tokenId) external;
}
