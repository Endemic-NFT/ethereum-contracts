// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {ERC721Base} from "./mixins/ERC721Base.sol";
import {CollectionRoyalties} from "./mixins/CollectionRoyalties.sol";
import {CollectionFactory} from "./mixins/CollectionFactory.sol";
import {MintApproval} from "./mixins/MintApproval.sol";

import {IERC2981Royalties} from "./interfaces/IERC2981Royalties.sol";
import {ICollectionInitializer} from "./interfaces/ICollectionInitializer.sol";

contract Collection is
    Initializable,
    ERC721Base,
    CollectionRoyalties,
    CollectionFactory,
    MintApproval
{
    /**
     * @notice Base URI of the collection
     * @dev We always default to ipfs
     */
    string public constant baseURI = "ipfs://";

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

    error CallerNotTokenOwner();
    error URIQueryForNonexistentToken();

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
        uint256 royalties,
        address administrator
    ) external onlyCollectionFactory initializer {
        _transferOwnership(creator);
        __ERC721_init_unchained(name, symbol);
        __Administrated_init(administrator);
        __CollectionRoyalties_init(creator, royalties);
    }

    function mint(
        address recipient,
        string calldata tokenCID,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external onlyOwner {
        // Make sure that mint is approved
        _checkMintApproval(owner(), tokenCID, v, r, s);

        // Mint token to the recipient
        _mintBase(recipient, tokenCID);
    }

    function mintAndApprove(
        address recipient,
        string calldata tokenCID,
        address operator,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external onlyOwner {
        // Make sure that mint is approved
        _checkMintApproval(owner(), tokenCID, v, r, s);

        // Mint token to the recipient
        _mintBase(recipient, tokenCID);

        // Approve operator to access tokens
        setApprovalForAll(operator, true);
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

    function _mintBase(address recipient, string calldata tokenCID) internal {
        // Create new token ID
        uint256 tokenId = ++latestTokenId;

        // Mint token ID to the recipient
        _mint(recipient, tokenId);

        // Save token URI
        _tokenCIDs[tokenId] = tokenCID;

        // Emit mint event
        emit Mint(tokenId, owner());
    }

    function _burn(uint256 tokenId) internal override {
        delete _tokenCIDs[tokenId];
        super._burn(tokenId);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}
