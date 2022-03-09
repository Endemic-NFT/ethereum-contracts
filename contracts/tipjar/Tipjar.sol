// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

error AmountSentToSmall();

contract Tipjar {
    event TipReceived(address recipient, uint256 amount);

    function sendTip(address payable _to) public payable {
        if (msg.value < 100000000000000) revert AmountSentToSmall();

        (bool sent, ) = _to.call{value: msg.value}("");
        require(sent, "Failed to send Ether");

        emit TipReceived(_to, msg.value);
    }
}
