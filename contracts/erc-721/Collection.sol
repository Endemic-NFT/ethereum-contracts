// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./mixins/ERC721Base.sol";
import "./mixins/CollectionRoyalties.sol";
import "./mixins/CollectionFactory.sol";

import "./interfaces/IERC2981Royalties.sol";
import "./interfaces/ICollectionInitializer.sol";

error CallerNotOwner();
error CallerNotTokenOwner();
error URIQueryForNonexistentToken();

contract Collection is
    Initializable,
    ERC721Base,
    CollectionRoyalties,
    CollectionFactory
{
    /**
     * @notice Base URI of the collection
     * @dev We always default to ipfs
     */
    string public constant baseURI = "ipfs://";

    /**
     * @notice Owner of the contract
     */
    address public owner;

    /**
     * @dev Stores a CID for each NFT.
     */
    mapping(uint256 => string) private _tokenCIDs;

    /**
     * @notice Emitted when NFT is minted
     * @param tokenId The tokenId of the newly minted NFT.
     * @param artistId The address of the creator
     */
    event Mint(uint256 indexed tokenId, address artistId);

    modifier onlyOwner() {
        if (owner != msg.sender) revert CallerNotOwner();
        _;
    }

    /**
     * @notice Initialize imutable variables
     * @param _collectionFactory The factory which is used to create new collections
     */
    constructor(address _collectionFactory)
        CollectionFactory(_collectionFactory)
    {}

    function initialize(
        address creator,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) external onlyCollectionFactory initializer {
        owner = creator;

        __ERC721_init_unchained(name, symbol);
        initializeCollectionRoyalties(creator, royalties);
    }

    function mint(address recipient, string calldata tokenCID)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        tokenId = ++latestTokenId;
        _safeMint(recipient, tokenId);
        _tokenCIDs[tokenId] = tokenCID;
        emit Mint(tokenId, owner);
    }

    function mintAndApprove(
        address recipient,
        string calldata tokenCID,
        address operator
    ) external onlyOwner returns (uint256 tokenId) {
        tokenId = ++latestTokenId;
        _safeMint(recipient, tokenId);
        setApprovalForAll(operator, true);
        _tokenCIDs[tokenId] = tokenCID;
        emit Mint(tokenId, owner);
        return tokenId;
    }

    function burn(uint256 tokenId) public override onlyOwner {
        super.burn(tokenId);
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

    function setRoyalties(address recipient, uint256 value) external onlyOwner {
        _setRoyalties(recipient, value);
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

    function _burn(uint256 tokenId) internal override {
        delete _tokenCIDs[tokenId];
        super._burn(tokenId);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}
