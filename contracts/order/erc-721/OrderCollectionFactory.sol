// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IOrderCollection.sol";

contract OrderCollectionFactory is AccessControlUpgradeable {
    using AddressUpgradeable for address;
    using ClonesUpgradeable for address;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    address public implementation;
    address public collectionAdministrator;
    address public operator;

    error AddressCannotBeZeroAddress();

    event ImplementationUpdated(address indexed newImplementation);
    event CollectionAdministratorUpdated(address indexed newAdministrator);
    event OperatorUpdated(address indexed newApprover);
    event NFTContractCreated(
        address indexed nftContract,
        address indexed owner,
        string name,
        string symbol,
        string category,
        uint256 royalties
    );

    modifier onlyContract(address _implementation) {
        require(
            _implementation.isContract(),
            "ArtOrder: Address is not a contract"
        );
        _;
    }

    function initialize() external initializer {
        __AccessControl_init();
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function createCollection(
        address owner,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) external onlyRole(MINTER_ROLE) returns (address) {
        return _createCollection(owner, name, symbol, royalties);
    }

    function updateImplementation(address newImplementation)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        onlyContract(newImplementation)
    {
        _updateImplementation(newImplementation);
    }

    function updateCollectionAdministrator(address newCollectionAdministrator)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newCollectionAdministrator == address(0)) {
            revert AddressCannotBeZeroAddress();
        }

        collectionAdministrator = newCollectionAdministrator;

        emit CollectionAdministratorUpdated(newCollectionAdministrator);
    }

    function updateOperator(address newOperator)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newOperator == address(0)) {
            revert AddressCannotBeZeroAddress();
        }

        operator = newOperator;

        emit OperatorUpdated(newOperator);
    }

    function updateConfiguration(
        address newCollectionAdministrator,
        address newOperator
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (
            newCollectionAdministrator == address(0) ||
            newOperator == address(0)
        ) {
            revert AddressCannotBeZeroAddress();
        }

        collectionAdministrator = newCollectionAdministrator;
        operator = newOperator;
    }

    function _updateImplementation(address newImplementation) internal {
        implementation = newImplementation;

        IOrderCollection(implementation).initialize(
            msg.sender,
            "Order Collection Implementation",
            "OCI",
            1000,
            collectionAdministrator,
            operator
        );
    }

    function _createCollection(
        address owner,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) internal returns (address) {
        address proxy = implementation.clone();

        IOrderCollection(proxy).initialize(
            owner,
            name,
            symbol,
            royalties,
            collectionAdministrator,
            operator
        );

        emit NFTContractCreated(
            proxy,
            owner,
            name,
            symbol,
            "Art Order",
            royalties
        );

        return address(proxy);
    }
}
