// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {AdministratedUpgradable} from "../access/AdministratedUpgradable.sol";

abstract contract MintApproval is AdministratedUpgradable {
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
        bytes32 s
    ) internal view {
        if (
            _recoverSigner(_prepareMessage(minter, tokenCID), v, r, s) !=
            mintApprover
        ) {
            revert MintNotApproved();
        }
    }

    function _prepareMessage(address minter, string calldata tokenCID)
        private
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(address(this), minter, tokenCID));
    }

    function _recoverSigner(
        bytes32 message,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) private pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";

        bytes32 prefixedProof = keccak256(abi.encodePacked(prefix, message));
        return ecrecover(prefixedProof, v, r, s);
    }
}
