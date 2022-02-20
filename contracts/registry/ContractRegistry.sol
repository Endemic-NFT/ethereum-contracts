// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./interfaces/IContractRegistry.sol";

contract ContractRegistry is OwnableUpgradeable, IContractRegistry {
    mapping(address => bool) exchangeContracts;

    function __ContractRegistry_init() external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
    }

    function isExchangeContract(address contractAddress)
        external
        view
        override
        returns (bool)
    {
        return exchangeContracts[contractAddress];
    }

    function addExchangeContract(address exchangeContract) external onlyOwner {
        exchangeContracts[exchangeContract] = true;
    }

    function removeExchangeContract(address exchangeContract)
        external
        onlyOwner
    {
        exchangeContracts[exchangeContract] = false;
    }

    uint256[50] private __gap;
}
