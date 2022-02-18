// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Address.sol";
import "./ERC721A.sol";

contract EndemicERC721 is ERC721A {
    using Address for address;

    string private baseUri = "ipfs://";
    address public owner;
    address public immutable erc721Factory;

    modifier onlyOwner() {
        require(
            owner == _msgSender(),
            "EndemicERC721: caller is not the owner"
        );
        _;
    }

    constructor(address _erc721Factory) {
        require(
            _erc721Factory.isContract(),
            "EndemicERC721: _erc721Factory is not a contract"
        );
        erc721Factory = _erc721Factory;
    }

    function initialize(
        address creator,
        string memory name,
        string memory symbol
    ) external {
        require(
            msg.sender == address(erc721Factory),
            "EndemicERC721: Collection must be created via the factory"
        );

        owner = creator;
        _name = name;
        _symbol = symbol;
    }

    function mint(address recipient, string calldata tokenURI)
        external
        onlyOwner
        returns (bool)
    {
        _safeMint(recipient, tokenURI);
        return true;
    }

    function mintAndApprove(
        address recipient,
        string calldata tokenURI,
        address operator
    ) external onlyOwner returns (bool) {
        _safeMint(recipient, tokenURI);
        setApprovalForAll(operator, true);
        return true;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseUri;
    }
}
