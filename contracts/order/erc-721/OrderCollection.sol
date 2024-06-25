// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {ERC721Base} from "../../erc-721/mixins/ERC721Base.sol";
import {CollectionRoyalties} from "../../erc-721/mixins/CollectionRoyalties.sol";
import {CollectionFactory} from "../../erc-721/mixins/CollectionFactory.sol";
import {AdministratedUpgradable} from "../../erc-721/access/AdministratedUpgradable.sol";

contract OrderCollection is
    ERC721Upgradeable,
    ERC721Base,
    CollectionRoyalties,
    CollectionFactory,
    AdministratedUpgradable
{
    address public mintOperator;
    string public constant baseURI = "ipfs://";

    mapping(uint256 => string) private _tokenCIDs;

    error OnlyOperator();
    error InvalidAddress();
    error URIQueryForNonexistentToken();

    event Minted(
        uint256 indexed tokenId,
        address indexed artistId,
        string indexed tokenCID
    );
    event BatchMinted(
        uint256 indexed startTokenId,
        uint256 indexed endTokenId,
        address indexed artistId,
        string[] tokenCIDs
    );

    modifier onlyOperator() {
        if (msg.sender != mintOperator) revert OnlyOperator();
        _;
    }

    constructor(
        address _collectionFactory
    ) CollectionFactory(_collectionFactory) {}

    function initialize(
        address creator,
        string memory name,
        string memory symbol,
        uint256 royalties,
        address administrator,
        address operator
    ) external initializer onlyCollectionFactory {
        _transferOwnership(creator);
        __ERC721_init_unchained(name, symbol);
        __Administrated_init(administrator);
        __CollectionRoyalties_init(creator, royalties);

        mintOperator = operator;
    }

    function mint(
        address recipient,
        string calldata tokenCID
    ) external onlyOperator returns (uint256) {
        return _mintBase(recipient, tokenCID);
    }

    function batchMint(
        address recipient,
        string[] calldata tokenCIDs
    ) external onlyOperator {
        _batchMintBase(recipient, tokenCIDs);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(CollectionRoyalties, ERC721Upgradeable)
        returns (bool)
    {
        return
            super.supportsInterface(interfaceId) ||
            type(IERC165Upgradeable).interfaceId == interfaceId ||
            type(IERC721Upgradeable).interfaceId == interfaceId ||
            type(IERC721MetadataUpgradeable).interfaceId == interfaceId;
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        return string(abi.encodePacked(_baseURI(), _tokenCIDs[tokenId]));
    }

    function setRoyalties(address recipient, uint256 value) external onlyOwner {
        _setRoyalties(recipient, value);
    }

    function updateMintOperator(
        address newMintOperator
    ) external onlyAdministrator {
        if (newMintOperator == address(0)) {
            revert InvalidAddress();
        }

        mintOperator = newMintOperator;
    }

    function _mintBase(
        address recipient,
        string calldata tokenCID
    ) internal returns (uint256) {
        // Create new token ID
        uint256 tokenId = ++latestTokenId;

        // Mint token ID to the recipient
        _mint(recipient, tokenId);

        // Save token URI
        _tokenCIDs[tokenId] = tokenCID;

        // Emit mint event
        emit Minted(tokenId, owner(), tokenCID);

        return tokenId;
    }

    function _batchMintBase(
        address recipient,
        string[] calldata tokenCIDs
    ) internal {
        // Retrieve latest token ID
        uint256 currentTokenId = latestTokenId;
        // Calculate start token ID for the batch
        uint256 startTokenId = currentTokenId + 1;

        for (uint256 i = 0; i < tokenCIDs.length; ) {
            // Mint current token ID to the recipient
            _mint(recipient, ++currentTokenId);

            // Save token URI
            _tokenCIDs[currentTokenId] = tokenCIDs[i];

            unchecked {
                ++i;
            }
        }

        // Update latest token ID
        latestTokenId = currentTokenId;

        // Emit batch mint event
        emit BatchMinted(startTokenId, currentTokenId, owner(), tokenCIDs);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721Base) {
        delete _tokenCIDs[tokenId];
        super._burn(tokenId);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
}
