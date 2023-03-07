// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

import {AdministratedUpgradable} from "../access/AdministratedUpgradable.sol";

abstract contract MintApproval is EIP712Upgradeable, AdministratedUpgradable {
    address public mintApprover;

    event MintApproverUpdated(address indexed newMintApprover);

    error MintApproverCannotBeZeroAddress();
    error MintNotApproved();

    function updateMintApprover(address newMintApprover)
        external
        onlyAdministrator
    {
        if (newMintApprover == address(0)) {
            revert MintApproverCannotBeZeroAddress();
        }

        mintApprover = newMintApprover;

        emit MintApproverUpdated(newMintApprover);
    }

    function _checkMintApproval(
        address minter,
        string calldata tokenCID,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 nonce
    ) internal view {
        if (
            ecrecover(_prepareMessage(minter, tokenCID, nonce), v, r, s) !=
            mintApprover
        ) {
            revert MintNotApproved();
        }
    }

    function _prepareMessage(address minter, string calldata tokenCID, uint256 nonce)
        private
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256("MintApproval(address minter,string tokenCID,uint256 nonce)"),
                    minter,
                    keccak256(abi.encodePacked(tokenCID)),
                    nonce
                )
            )
        );
    }
}
