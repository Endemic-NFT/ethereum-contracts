// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IContractRegistry {
    function isSaleContract(address contractAddress)
        external
        view
        returns (bool);
}
