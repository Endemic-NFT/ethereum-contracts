// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";

import "./interfaces/ICollectionInitializer.sol";

import "../NoDelegateCall.sol";
import "./Collection.sol";

contract OpenspaceCollectionFactory is AccessControl, NoDelegateCall {
    using Address for address;
    using Clones for address;

    address public implementation;

    event NFTContractCreated(
        address indexed nftContract,
        address indexed owner,
        string name,
        string symbol,
        string category,
        uint256 royalties
    );
    event ImplementationUpdated(address indexed implementation);

    struct DeployParams {
        string name;
        string symbol;
        string category;
        uint256 royalties;
    }

    struct OwnedDeployParams {
        address owner;
        string name;
        string symbol;
        string category;
        uint256 royalties;
    }

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function createToken(DeployParams calldata params) external noDelegateCall {
        _deployContract(
            msg.sender,
            params.name,
            params.symbol,
            params.category,
            params.royalties
        );
    }

    function updateImplementation(address newImplementation)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            newImplementation.isContract(),
            "EndemicCollectionFactory: Implementation is not a contract"
        );
        implementation = newImplementation;

        ICollectionInitializer(implementation).initialize(
            msg.sender,
            "Collection Template",
            "CT",
            1000
        );

        emit ImplementationUpdated(newImplementation);
    }

    function _deployContract(
        address owner,
        string memory name,
        string memory symbol,
        string memory category,
        uint256 royalties
    ) internal {
        address proxy = implementation.cloneDeterministic(
            keccak256(abi.encodePacked(owner, block.timestamp))
        );

        ICollectionInitializer(proxy).initialize(
            owner,
            name,
            symbol,
            royalties
        );

        emit NFTContractCreated(
            proxy,
            owner,
            name,
            symbol,
            category,
            royalties
        );
    }
}
