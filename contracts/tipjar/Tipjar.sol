// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

error InvalidAmount();
error FailedToSendEther();

contract Tipjar {
    uint256 public constant MINIMAL_TIP_AMOUNT = 0.0001 ether;
    event TipReceived(address indexed recipient, uint256 indexed amount);

    function sendTip(address payable to) external payable {
        if (msg.value < MINIMAL_TIP_AMOUNT) revert InvalidAmount();

        (bool sent, ) = to.call{value: msg.value}("");

        if (!sent) revert FailedToSendEther();

        emit TipReceived(to, msg.value);
    }
}
