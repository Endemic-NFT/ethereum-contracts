// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

error AddressNotContract();
error CallerNotCollectionFactory();

abstract contract CollectionFactory {
    using AddressUpgradeable for address;

    address public immutable collectionFactory;

    modifier onlyCollectionFactory() {
        if (msg.sender != address(collectionFactory))
            revert CallerNotCollectionFactory();
        _;
    }

    constructor(address _collectionFactory) {
        if (!_collectionFactory.isContract()) revert AddressNotContract();
        collectionFactory = _collectionFactory;
    }
}
