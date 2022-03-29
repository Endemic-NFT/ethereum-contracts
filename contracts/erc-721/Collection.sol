// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./base/ERC721A.sol";

import "./interfaces/IERC2981Royalties.sol";
import "./interfaces/ICollectionInitializer.sol";

error CallerNotOwner();
error AddressNotContract();
error CallerNotContractFactory();
error RoyaltiesTooHigh();
error CallerNotTokenOwner();

contract Collection is
    ERC721A,
    Initializable,
    IERC2981Royalties,
    ICollectionInitializer
{
    using AddressUpgradeable for address;

    address public immutable collectionFactory;

    string public constant baseURI = "ipfs://";
    uint256 public constant MAX_ROYALTIES = 10000;

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
        ERC721A("Collection Template", "CT")
    {
        if (!_collectionFactory.isContract()) revert AddressNotContract();
        collectionFactory = _collectionFactory;
    }

    function initialize(
        address creator,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) external override initializer {
        if (_msgSender() != address(collectionFactory))
            revert CallerNotContractFactory();

        if (royalties > MAX_ROYALTIES) revert RoyaltiesTooHigh();

        owner = creator;

        _name = name;
        _symbol = symbol;

        royaltiesRecipient = creator;
        royaltiesAmount = royalties;
    }

    function mint(address recipient, string calldata tokenCID)
        external
        onlyOwner
        returns (uint256)
    {
        uint256 tokenId = _currentIndex;
        _safeMint(recipient, 1);
        _tokenCIDs[tokenId] = tokenCID;
        emit Mint(tokenId, owner);
        return tokenId;
    }

    function mintAndApprove(
        address recipient,
        string calldata tokenCID,
        address operator
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = _currentIndex;
        _safeMint(recipient, 1);
        setApprovalForAll(operator, true);
        _tokenCIDs[tokenId] = tokenCID;
        return tokenId;
    }

    function setRoyalties(address recipient, uint256 value) public onlyOwner {
        if (value > MAX_ROYALTIES) revert RoyaltiesTooHigh();
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
        TokenOwnership memory prevOwnership = _ownershipOf(tokenId);

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
