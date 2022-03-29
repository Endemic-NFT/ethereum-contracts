// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../roles/SignerRole.sol";

error InvalidSigner();
error NothingToClaim();
error TransferFailed();

contract EndemicRewards is SignerRole {
    ERC20 public immutable endToken;

    mapping(address => uint256) public claimed;

    struct Balance {
        address recipient;
        uint256 value;
    }

    event Claim(address indexed owner, uint256 value);
    event UpdatedClaim(address indexed owner, uint256 value);

    constructor(ERC20 _endToken) {
        endToken = _endToken;
    }

    function claim(
        Balance calldata balance,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        if (!isSigner(recoverSigner(prepareMessage(balance), v, r, s))) {
            revert InvalidSigner();
        }

        uint256 valueToClaim = balance.value - claimed[_msgSender()];
        if (valueToClaim == 0) {
            revert NothingToClaim();
        }

        claimed[_msgSender()] = balance.value;

        if (!endToken.transfer(_msgSender(), valueToClaim)) {
            revert TransferFailed();
        }

        emit Claim(_msgSender(), valueToClaim);
    }

    function updateClaimed(Balance[] memory balances) public onlyOwner {
        for (uint256 i = 0; i < balances.length; i++) {
            claimed[balances[i].recipient] = balances[i].value;
            emit UpdatedClaim(balances[i].recipient, balances[i].value);
        }
    }

    function prepareMessage(Balance memory balance)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(balance));
    }

    function recoverSigner(
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
