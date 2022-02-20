// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IContractRegistry {
    function isExchangeContract(address contractAddress)
        external
        view
        returns (bool);
}
