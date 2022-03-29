// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./ERC1155BaseURI.sol";

abstract contract ERC1155Base is
    Initializable,
    ERC1155BurnableUpgradeable,
    ERC1155BaseURI,
    OwnableUpgradeable
{
    using SafeMathUpgradeable for uint256;

    string public name;
    string public symbol;

    mapping(uint256 => uint256) internal supply;
    mapping(uint256 => uint256) internal minted;

    function __ERC1155Base_init_unchained(
        string memory _name,
        string memory _symbol
    ) internal initializer {
        name = _name;
        symbol = _symbol;
    }

    function _mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal virtual override {
        uint256 newMinted = amount.add(minted[id]);
        require(newMinted <= supply[id], "More than supply");
        minted[id] = newMinted;
        super._mint(account, id, amount, data);
    }

    function _saveSupply(uint256 tokenId, uint256 _supply) internal {
        require(supply[tokenId] == 0);
        supply[tokenId] = _supply;
    }

    function totalSupply(uint256 _id) public view returns (uint256) {
        return supply[_id];
    }

    function uri(uint256 id)
        public
        view
        virtual
        override(ERC1155BaseURI, ERC1155Upgradeable)
        returns (string memory)
    {
        return _tokenURI(id);
    }

    function setBaseTokenURI(string memory baseTokenURI) public onlyOwner {
        _setBaseURI(baseTokenURI);
    }

    uint256[50] private __gap;
}
