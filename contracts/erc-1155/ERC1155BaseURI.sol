// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";

contract ERC1155BaseURI is ERC1155Upgradeable {
    using StringsUpgradeable for uint256;

    mapping(uint256 => string) private _tokenURIs;

    string private _baseURI;

    function baseURI() public view virtual returns (string memory) {
        return _baseURI;
    }

    function uri(uint256 id)
        public
        view
        virtual
        override
        returns (string memory)
    {
        return _tokenURI(id);
    }

    function _tokenURI(uint256 tokenId)
        internal
        view
        virtual
        returns (string memory)
    {
        string memory tokenUri = _tokenURIs[tokenId];
        string memory base = baseURI();

        if (bytes(base).length == 0) {
            return tokenUri;
        }

        if (bytes(tokenUri).length > 0) {
            return string(abi.encodePacked(base, tokenUri));
        }

        return string(abi.encodePacked(base, tokenId.toString()));
    }

    function _setTokenURI(uint256 tokenId, string memory _uri)
        internal
        virtual
    {
        _tokenURIs[tokenId] = _uri;
        emit URI(_tokenURI(tokenId), tokenId);
    }

    function _setBaseURI(string memory baseURI_) internal virtual {
        _baseURI = baseURI_;
    }

    uint256[50] private __gap;
}
