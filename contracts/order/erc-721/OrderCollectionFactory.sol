// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "../interfaces/IOrderCollection.sol";
import "../../erc-721/access/AdministratedUpgradable.sol";

contract OrderCollectionFactory is AdministratedUpgradable {
    using AddressUpgradeable for address;
    using ClonesUpgradeable for address;

    address public collectionImplementation;

    modifier onlyContract(address implementation) {
        require(
            implementation.isContract(),
            "ArtOrder: Address is not a contract"
        );
        _;
    }

    function __OrderCollectionFactory_init(address _administrator)
        internal
        onlyInitializing
    {
        __Administrated_init(_administrator);
    }

    function _updateCollectionImplementation(address newImplementation)
        internal
        onlyContract(newImplementation)
    {
        collectionImplementation = newImplementation;

        IOrderCollection(collectionImplementation).initialize(
            msg.sender,
            "Order Collection Implementation",
            "OCI",
            1000,
            administrator,
            address(this)
        );
    }

    function _deployCollectionContract(
        address owner,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) internal returns (address) {
        address proxy = collectionImplementation.clone();

        IOrderCollection(proxy).initialize(
            owner,
            name,
            symbol,
            royalties,
            administrator,
            address(this)
        );

        return address(proxy);
    }
}
