// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../registry/IContractRegistry.sol";

abstract contract FeeProviderCore is PausableUpgradeable, OwnableUpgradeable {
    using AddressUpgradeable for address;

    uint256 public secondarySaleMakerFee;
    uint256 public takerFee;
    uint256 public initialSaleFee;

    mapping(address => mapping(uint256 => bool)) initialSales;

    IContractRegistry contractRegistry;

    struct AccountFee {
        address account;
        uint256 fee;
    }

    mapping(address => AccountFee) initialSaleFeePerAccount;
    mapping(address => bool) collectionsWithoutInitialSaleFee;

    function __FeeProviderCore___init_unchained(
        uint256 _initialSaleFee,
        uint256 _secondarySaleMakerFee,
        uint256 _takerFee,
        IContractRegistry _contractRegistry
    ) internal initializer {
        initialSaleFee = _initialSaleFee;
        secondarySaleMakerFee = _secondarySaleMakerFee;
        takerFee = _takerFee;
        contractRegistry = _contractRegistry;
    }

    function updateFee(
        uint256 _secondarySaleMakerFee,
        uint256 _takerFee,
        uint256 _initialSaleFee
    ) external onlyOwner {
        require(_secondarySaleMakerFee <= 10000);
        require(_takerFee <= 10000);
        require(_initialSaleFee <= 10000);

        takerFee = _takerFee;
        secondarySaleMakerFee = _secondarySaleMakerFee;
        initialSaleFee = _initialSaleFee;
    }

    function getMakerFee(
        address seller,
        address nftContract,
        uint256 tokenId
    ) public view returns (uint256) {
        require(seller != address(0));
        require(nftContract != address(0));

        bool isInitialSale = !initialSales[nftContract][tokenId];
        bool hasInitialSaleFee = !collectionsWithoutInitialSaleFee[nftContract];
        if (isInitialSale && hasInitialSaleFee) {
            if (initialSaleFeePerAccount[seller].account == seller) {
                return initialSaleFeePerAccount[seller].fee;
            }

            return initialSaleFee;
        }

        return secondarySaleMakerFee;
    }

    function getTakerFee(address buyer) public view returns (uint256) {
        require(buyer != address(0));
        return takerFee;
    }

    function onInitialSale(address nftContract, uint256 tokenId) external {
        require(
            contractRegistry.isSaleContract(_msgSender()),
            "Invalid caller"
        );
        initialSales[nftContract][tokenId] = true;
    }

    function setInitialSaleFeePerAccount(address account, uint256 fee)
        external
        onlyOwner
    {
        require(fee <= 10000);

        initialSaleFeePerAccount[account] = AccountFee(account, fee);
    }

    function setCollectionWithoutInitialSaleFee(
        address nftContract,
        bool isWithoutInitialFee
    ) external onlyOwner {
        collectionsWithoutInitialSaleFee[nftContract] = isWithoutInitialFee;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    uint256[50] private __gap;
}
