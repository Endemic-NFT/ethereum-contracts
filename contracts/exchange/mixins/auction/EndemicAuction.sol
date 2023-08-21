// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./EndemicDutchAuction.sol";
import "./EndemicReserveAuction.sol";

abstract contract EndemicAuction is
    OwnableUpgradeable,
    EndemicDutchAuction,
    EndemicReserveAuction
{
    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
