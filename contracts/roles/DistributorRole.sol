// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract DistributorRole is OwnableUpgradeable {
    mapping(address => bool) distributors;

    modifier onlyDistributor() {
        require(distributors[_msgSender()], "Caller is not the distributor");
        _;
    }

    function addDistributor(address distributor) external onlyOwner {
        distributors[distributor] = true;
    }

    function removeDistributor(address distributor) external onlyOwner {
        distributors[distributor] = false;
    }
}
