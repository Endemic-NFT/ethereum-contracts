// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "../interfaces/IOrderCollection.sol";
import "../../erc-721/access/AdministratedUpgradable.sol";

contract OrderCollectionFactory is AdministratedUpgradable {
    using AddressUpgradeable for address;
    using ClonesUpgradeable for address;

    address public implementation;
    address public operator;

    modifier onlyContract(address _implementation) {
        require(
            _implementation.isContract(),
            "ArtOrder: Address is not a contract"
        );
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "ArtOrder: Caller is not the operator");
        _;
    }

    function initialize(address _administrator) internal initializer {
        __Administrated_init(_administrator);
    }

    function createCollection(
        address owner,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) external onlyOperator returns (address) {
        return _createCollection(owner, name, symbol, royalties);
    }

    function updateImplementation(address newImplementation)
        external
        onlyAdministrator
        onlyContract(newImplementation)
    {
        _updateImplementation(newImplementation);
    }

    function updateOperator(address newOperator) external onlyAdministrator {
        operator = newOperator;
    }

    function _updateImplementation(address newImplementation) internal {
        implementation = newImplementation;

        IOrderCollection(implementation).initialize(
            msg.sender,
            "Order Collection Implementation",
            "OCI",
            1000,
            administrator,
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
            administrator,
            operator
        );

        return address(proxy);
    }
}
