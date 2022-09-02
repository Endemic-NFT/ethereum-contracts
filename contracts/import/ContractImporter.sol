// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ContractImporter is OwnableUpgradeable {
    function __ContractImporter_init() external initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
    }

    event CollectionAdded(address contractAddress, string category);

    function addCollection(address contractAddress, string memory category)
        external
        onlyOwner
    {
        emit CollectionAdded(contractAddress, category);
    }

    uint256[50] private __gap;
}
