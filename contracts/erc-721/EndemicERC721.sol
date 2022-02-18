// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./ERC721A.sol";

contract EndemicERC721 is ERC721A, Initializable {
    using AddressUpgradeable for address;

    string public baseURI = "ipfs://";
    address public owner;
    address public immutable erc721Factory;

    modifier onlyOwner() {
        require(
            owner == _msgSender(),
            "EndemicERC721: caller is not the owner"
        );
        _;
    }

    constructor(address _erc721Factory)
        ERC721A("Endemic Collection Template", "ECT")
    {
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
    ) external initializer {
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

    function burn(uint256 tokenId) external {
        TokenOwnership memory prevOwnership = ownershipOf(tokenId);

        bool isApprovedOrOwner = (_msgSender() == prevOwnership.addr ||
            isApprovedForAll(prevOwnership.addr, _msgSender()) ||
            getApproved(tokenId) == _msgSender());

        if (!isApprovedOrOwner) revert TransferCallerNotOwnerNorApproved();

        _burn(tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
