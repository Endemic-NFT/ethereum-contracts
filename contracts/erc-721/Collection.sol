// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./ModifiedERC721A.sol";

import "./interfaces/IERC2981Royalties.sol";
import "./interfaces/ICollectionInitializer.sol";

error CallerNotOwner();
error AddressNotContract();
error CallerNotContractFactory();
error RoyaltiesTooHigh();
error CallerNotTokenOwner();

contract Collection is
    ModifiedERC721A,
    Initializable,
    IERC2981Royalties,
    ICollectionInitializer
{
    using AddressUpgradeable for address;

    address public immutable collectionFactory;

    string public constant baseURI = "ipfs://";

    address public royaltiesRecipient;
    uint256 public royaltiesAmount;
    address public owner;

    // Mapping from token ID to token URI
    mapping(uint256 => string) private _tokenCIDs;

    event RoyaltiesUpdated(address indexed recipient, uint256 indexed value);
    event Mint(uint256 indexed tokenId, address indexed artistId);

    modifier onlyOwner() {
        if (owner != _msgSender()) revert CallerNotOwner();
        _;
    }

    constructor(address _collectionFactory)
        ModifiedERC721A("Collection Template", "CT")
    {
        if (!_collectionFactory.isContract()) revert AddressNotContract();
        collectionFactory = _collectionFactory;
    }

    function initialize(
        address creator,
        string memory name,
        string memory symbol
    ) external override initializer {
        if (_msgSender() != address(collectionFactory))
            revert CallerNotContractFactory();

        owner = creator;

        royaltiesRecipient = creator;
        royaltiesAmount = 1000;

        _name = name;
        _symbol = symbol;
    }

    function mint(address recipient, string calldata tokenCID)
        external
        onlyOwner
        returns (uint256)
    {
        uint256 tokenId = _safeMint(recipient);
        _tokenCIDs[tokenId] = tokenCID;
        emit Mint(tokenId, owner);
        return tokenId;
    }

    function mintAndApprove(
        address recipient,
        string calldata tokenCID,
        address operator
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _safeMint(recipient);
        _tokenCIDs[tokenId] = tokenCID;
        setApprovalForAll(operator, true);
        return tokenId;
    }

    function setRoyalties(address recipient, uint256 value) external onlyOwner {
        if (value > 10000) revert RoyaltiesTooHigh();
        royaltiesRecipient = recipient;
        royaltiesAmount = value;

        emit RoyaltiesUpdated(recipient, value);
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

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        return string(abi.encodePacked(_baseURI(), _tokenCIDs[tokenId]));
    }

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
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

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}
