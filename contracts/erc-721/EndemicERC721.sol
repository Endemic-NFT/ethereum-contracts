// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./ERC721A.sol";

import "./interfaces/IERC2981Royalties.sol";

error CallerNotOwner();
error AddressNotContract();
error CallerNotContractFactory();
error RoyaltiesTooHigh();
error CallerNotTokenOwner();

contract EndemicERC721 is ERC721A, Initializable, IERC2981Royalties {
    using AddressUpgradeable for address;

    address public royaltiesRecipient;
    uint256 public royaltiesAmount;

    string public baseURI = "ipfs://";
    address public owner;
    address public immutable erc721Factory;

    modifier onlyOwner() {
        if (owner != _msgSender()) revert CallerNotOwner();
        _;
    }

    constructor(address _erc721Factory)
        ERC721A("Endemic Collection Template", "ECT")
    {
        if (!_erc721Factory.isContract()) revert AddressNotContract();
        erc721Factory = _erc721Factory;
    }

    function initialize(
        address creator,
        string memory name,
        string memory symbol
    ) external initializer {
        if (_msgSender() != address(erc721Factory))
            revert CallerNotContractFactory();

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

    function setRoyalties(address recipient, uint256 value) external onlyOwner {
        if (value > 10000) revert RoyaltiesTooHigh();
        royaltiesRecipient = recipient;
        royaltiesAmount = value;
    }

    function royaltyInfo(uint256, uint256 value)
        external
        view
        override
        returns (address receiver, uint256 royaltyAmount)
    {
        return (royaltiesRecipient, (value * royaltiesAmount) / 10000);
    }

    function burn(uint256 tokenId) external {
        TokenOwnership memory prevOwnership = ownershipOf(tokenId);

        bool isOwner = _msgSender() == prevOwnership.addr;

        if (!isOwner) revert CallerNotTokenOwner();

        _burn(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override
        returns (bool)
    {
        if (interfaceId == type(IERC2981Royalties).interfaceId) {
            return true;
        }
        return super.supportsInterface(interfaceId);
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }
}
