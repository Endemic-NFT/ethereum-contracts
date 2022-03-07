// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "../registry/interfaces/IContractRegistry.sol";
import "./interfaces/IFeeProvider.sol";

error CallerNotExchangeContract();
error NullAddress();

abstract contract FeeProviderCore is OwnableUpgradeable, IFeeProvider {
    using AddressUpgradeable for address;

    IContractRegistry public contractRegistry;

    uint256 public primarySaleFee;
    uint256 public secondarySaleFee;
    uint256 public takerFee;

    // Contract Address => (Token Id => Did primary sale happen)
    mapping(address => mapping(uint256 => bool)) primarySales;

    struct AccountFee {
        address account;
        uint256 fee;
    }

    mapping(address => AccountFee) primarySaleFeePerAccount;
    mapping(address => bool) collectionsWithoutPrimarySaleFee;

    function __FeeProviderCore___init_unchained(
        uint256 _primarySaleFee,
        uint256 _secondarySaleFee,
        uint256 _takerFee,
        address _contractRegistry
    ) internal initializer {
        if (_contractRegistry == address(0)) revert NullAddress();

        updateFee(_primarySaleFee, _secondarySaleFee, _takerFee);
        contractRegistry = IContractRegistry(_contractRegistry);
    }

    function updateFee(
        uint256 _primarySaleFee,
        uint256 _secondarySaleFee,
        uint256 _takerFee
    ) public onlyOwner {
        require(_primarySaleFee <= 10000);
        require(_secondarySaleFee <= 10000);
        require(_takerFee <= 10000);

        primarySaleFee = _primarySaleFee;
        secondarySaleFee = _secondarySaleFee;
        takerFee = _takerFee;
    }

    function getMakerFee(
        address seller,
        address nftContract,
        uint256 tokenId
    ) public view returns (uint256) {
        if (seller == address(0)) revert NullAddress();
        if (nftContract == address(0)) revert NullAddress();

        bool isPrimarySale = !primarySales[nftContract][tokenId];
        bool hasPrimarySaleFee = !collectionsWithoutPrimarySaleFee[nftContract];
        if (isPrimarySale && hasPrimarySaleFee) {
            if (primarySaleFeePerAccount[seller].account == seller) {
                return primarySaleFeePerAccount[seller].fee;
            }

            return primarySaleFee;
        }

        return secondarySaleFee;
    }

    function getTakerFee() external view override returns (uint256) {
        return takerFee;
    }

    function calculateMakerFee(
        address seller,
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) external view override returns (uint256) {
        uint256 makerFee = getMakerFee(seller, nftContract, tokenId);
        return (amount * makerFee) / 10000;
    }

    function calculateTakerFee(uint256 amount)
        external
        view
        override
        returns (uint256)
    {
        return (amount * takerFee) / 10000;
    }

    function onSale(address nftContract, uint256 tokenId) external override {
        if (!contractRegistry.isExchangeContract(_msgSender()))
            revert CallerNotExchangeContract();

        primarySales[nftContract][tokenId] = true;
    }

    function setPrimarySaleFeePerAccount(address account, uint256 fee)
        external
        onlyOwner
    {
        require(fee <= 10000);

        primarySaleFeePerAccount[account] = AccountFee(account, fee);
    }

    function setCollectionWithoutPrimarySaleFee(
        address nftContract,
        bool isWithoutPrimarySaleFee
    ) external onlyOwner {
        collectionsWithoutPrimarySaleFee[nftContract] = isWithoutPrimarySaleFee;
    }

    uint256[50] private __gap;
}
