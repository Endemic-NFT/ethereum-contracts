// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IFeeProvider {
    function calculateMakerFee(
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) external view returns (uint256);

    function calculateTakerFee(uint256 amount) external view returns (uint256);

    function onSale(address nftContract, uint256 tokenId) external;

    function getTakerFee() external view returns (uint256);
}
