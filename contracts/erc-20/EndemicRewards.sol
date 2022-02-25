// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract EndemicRewards is Ownable {
    using SafeMath for uint256;

    event Claim(address indexed owner, uint256 value);
    event Value(address indexed owner, uint256 value);

    struct Balance {
        address recipient;
        uint256 value;
    }

    ERC20 public endToken;
    mapping(address => uint256) public claimed;

    constructor(ERC20 _endToken) {
        endToken = _endToken;
    }

    function claim(
        Balance[] memory balances,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(
            recoverSigner(prepareMessage(balances), v, r, s) == owner(),
            "Owner should sign message"
        );

        for (uint256 i = 0; i < balances.length; i++) {
            address recipient = balances[i].recipient;
            if (_msgSender() == recipient) {
                uint256 toClaim = balances[i].value.sub(claimed[recipient]);
                require(toClaim > 0, "nothing to claim");
                claimed[recipient] = balances[i].value;
                require(
                    endToken.transfer(_msgSender(), toClaim),
                    "transfer is not successful"
                );
                emit Claim(recipient, toClaim);
                emit Value(recipient, balances[i].value);
                return;
            }
        }
        revert("caller not found in recipients");
    }

    function updateClaimed(Balance[] memory balances) public onlyOwner {
        for (uint256 i = 0; i < balances.length; i++) {
            claimed[balances[i].recipient] = balances[i].value;
            emit Value(balances[i].recipient, balances[i].value);
        }
    }

    function prepareMessage(Balance[] memory balances)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(balances));
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
