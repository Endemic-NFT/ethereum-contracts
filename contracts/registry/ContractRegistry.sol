// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ContractRegistry is OwnableUpgradeable {
    mapping(address => bool) saleContracts;

    function __ContractRegistry_init() external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
    }

    function isSaleContract(address contractAddress)
        external
        view
        returns (bool)
    {
        return saleContracts[contractAddress];
    }

    function addSaleContract(address saleContract) external onlyOwner {
        saleContracts[saleContract] = true;
    }

    function removeSaleContract(address saleContract) external onlyOwner {
        saleContracts[saleContract] = false;
    }

    uint256[50] private __gap;
}
