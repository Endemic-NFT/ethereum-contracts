// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "./ERC1155Base.sol";

// TODO https://github.com/Endemic-NFT/endemic-ethereum-contracts/issues/5
contract EndemicERC1155 is ERC1155Base {
    using CountersUpgradeable for CountersUpgradeable.Counter;
    CountersUpgradeable.Counter private _tokenIdCounter;

    function __EndemicERC1155_init(
        string memory name,
        string memory symbol,
        string memory baseTokenURI
    ) external initializer {
        __Context_init_unchained();
        __ERC165_init_unchained();
        __ERC1155_init_unchained("");
        __ERC1155Base_init_unchained(name, symbol);
        __ERC1155Burnable_init_unchained();
        __Ownable_init_unchained();

        _setBaseURI(baseTokenURI);
    }

    event Create(uint256 indexed tokenId, address artistId, uint256 supply);

    struct MintData {
        address recipient;
        uint256 tokenId;
        uint256 amount;
    }

    struct CreateData {
        address artist;
        uint256 supply;
        string tokenURI;
    }

    function mint(MintData calldata data) external {
        require(
            _msgSender() == owner() || isApprovedForAll(owner(), _msgSender()),
            "mint caller is not owner nor approved"
        );
        require(data.amount > 0, "amount incorrect");
        require(supply[data.tokenId] > 0, "supply incorrect");

        _mint(data.recipient, data.tokenId, data.amount, "");
    }

    function create(CreateData calldata data) external onlyOwner {
        _tokenIdCounter.increment();
        uint256 newTokenId = _tokenIdCounter.current();
        require(data.supply > 0, "supply incorrect");

        _saveSupply(newTokenId, data.supply);
        _setTokenURI(newTokenId, data.tokenURI);

        emit Create(newTokenId, data.artist, data.supply);
    }

    uint256[50] private __gap;
}
