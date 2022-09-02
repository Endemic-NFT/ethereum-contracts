// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetFixedSupply.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract EndemicTokenPausable is ERC20PresetFixedSupply, Pausable, Ownable {
    constructor(address owner)
        ERC20PresetFixedSupply(
            "Endemic",
            "END",
            50000000 * 10**decimals(),
            owner
        )
    {}

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        require(!paused(), "ERC20Pausable: token transfer while paused");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
