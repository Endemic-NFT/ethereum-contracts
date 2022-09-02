// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "../roles/SignerRole.sol";

error InvalidSigner();
error NothingToClaim();
error TransferFailed();

contract EndemicRewards is SignerRole, Pausable {
    ERC20 public immutable endToken;

    mapping(address => uint256) public claimed;

    struct Balance {
        address recipient;
        uint256 value;
    }

    event Claim(address indexed owner, uint256 value);

    constructor(ERC20 _endToken) {
        endToken = _endToken;
    }

    function claim(
        Balance calldata balance,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused {
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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
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
