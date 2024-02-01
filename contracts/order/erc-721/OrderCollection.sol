// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../../erc-721/Collection.sol";

contract OrderCollection is Collection {
    address public mintOperator;

    error OnlyOwnerOrApproved();
    error InvalidMintOperatorAddress();

    modifier onlyOwnerOrApproved() {
        if (msg.sender != owner() && msg.sender != mintOperator) {
            revert OnlyOwnerOrApproved();
        }
        _;
    }

    constructor() Collection(address(0)) {}

    function initialize(
        address creator,
        string memory name,
        string memory symbol,
        uint256 royalties,
        address administrator,
        address operator
    ) external override initializer {
        _transferOwnership(creator);
        __ERC721_init_unchained(name, symbol);
        __EIP712_init_unchained(name, "1");
        __Administrated_init(administrator);
        __MintApproval_init(creator);
        __CollectionRoyalties_init(creator, royalties);

        mintOperator = operator;
    }

    function mint(
        address recipient,
        string calldata tokenCID,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 nonce
    ) external override onlyOwnerOrApproved {
        // Check if mint approval is required
        if (mintApprovalRequired) {
            // Make sure that mint is approved
            _checkMintApproval(mintApprover, tokenCID, v, r, s, nonce);
        }

        // Mint token to the recipient
        _mintBase(recipient, tokenCID);
    }

    function batchMint(
        address recipient,
        string[] calldata tokenCIDs,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 nonce
    ) external override onlyOwnerOrApproved {
        // Check if mint approval is required
        if (mintApprovalRequired) {
            // Make sure that mint is approved
            _checkBatchMintApproval(mintApprover, tokenCIDs, v, r, s, nonce);
        }

        // Mint tokens to the recipient
        _batchMintBase(recipient, tokenCIDs);
    }

    function updateMintOperator(address newMintOperator)
        external
        onlyAdministrator
    {
        if (newMintOperator == address(0)) {
            revert InvalidMintOperatorAddress();
        }

        mintOperator = newMintOperator;
    }
}
