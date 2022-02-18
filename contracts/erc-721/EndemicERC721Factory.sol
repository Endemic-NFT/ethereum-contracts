// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "../NoDelegateCall.sol";
import "./EndemicERC721.sol";
import "./IEndemicERC721.sol";

contract EndemicERC721Factory is AccessControl, NoDelegateCall {
    using Address for address;
    using Clones for address;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    address public implementation;

    event NFTContractCreated(
        address indexed nftContract,
        address indexed owner,
        string name,
        string symbol,
        string category
    );

    struct DeployParams {
        string name;
        string symbol;
        string category;
    }

    struct OwnedDeployParams {
        address owner;
        string name;
        string symbol;
        string category;
    }

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function createToken(DeployParams calldata params)
        external
        noDelegateCall
        onlyRole(MINTER_ROLE)
    {
        _deployContract(
            msg.sender,
            params.name,
            params.symbol,
            params.category
        );
    }

    function createTokenForOwner(OwnedDeployParams calldata params)
        external
        noDelegateCall
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _deployContract(
            params.owner,
            params.name,
            params.symbol,
            params.category
        );
    }

    function updateImplementation(address newImplementation)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            newImplementation.isContract(),
            "EndemicERC721Factory: Implementation is not a contract"
        );
        implementation = newImplementation;

        IEndemicERC721(implementation).initialize(
            msg.sender,
            "Endemic Collection Template",
            "ECT"
        );
    }

    function _deployContract(
        address owner,
        string memory name,
        string memory symbol,
        string memory category
    ) internal {
        address proxy = implementation.cloneDeterministic(
            keccak256(abi.encodePacked(owner, block.timestamp))
        );

        IEndemicERC721(proxy).initialize(owner, name, symbol);

        emit NFTContractCreated(proxy, owner, name, symbol, category);
    }
}
