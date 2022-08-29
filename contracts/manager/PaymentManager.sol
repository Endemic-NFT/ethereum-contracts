// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

error UnsupportedPaymentMethod();
error InvalidFees();

contract PaymentManager is OwnableUpgradeable {
    address internal constant ZERO_ADDRESS = address(0);
    uint256 internal constant MAX_FEE = 10000;

    mapping(address => bool) public supportedPaymentMethods;

    mapping(address => PaymentMethodFees) public feesByPaymentMethod;

    struct PaymentMethodFees {
        address paymentMethodAddress;
        uint256 makerFee;
        uint256 takerFee;
    }

    function __PaymentManager_init(uint256 makerFee, uint256 takerFee)
        external
        initializer
    {
        __Ownable_init_unchained();

        //initial support and fees for ether payments
        supportedPaymentMethods[ZERO_ADDRESS] = true;

        feesByPaymentMethod[ZERO_ADDRESS] = PaymentMethodFees(
            ZERO_ADDRESS,
            makerFee,
            takerFee
        );
    }

    function getPaymentMethodFees(address paymentMethodAddress)
        external
        view
        returns (uint256 takerFee, uint256 makerFee)
    {
        PaymentMethodFees memory paymentFees = feesByPaymentMethod[
            paymentMethodAddress
        ];

        if (paymentFees.paymentMethodAddress != paymentMethodAddress) {
            //payment method is supported but fees are not configured => use default ether fees
            paymentFees = feesByPaymentMethod[ZERO_ADDRESS];
        }

        takerFee = paymentFees.takerFee;
        makerFee = paymentFees.makerFee;
    }

    function isPaymentMethodSupported(address paymentMethodAddress)
        external
        view
        returns (bool)
    {
        return supportedPaymentMethods[paymentMethodAddress];
    }

    function updateSupportedPaymentMethod(
        address paymentMethodAddress,
        bool isEnabled
    ) external onlyOwner {
        supportedPaymentMethods[paymentMethodAddress] = isEnabled;
    }

    function updatePaymentMethodFees(
        address paymentMethodAddress,
        uint256 makerFee,
        uint256 takerFee
    ) external onlyOwner {
        if (!supportedPaymentMethods[paymentMethodAddress]) {
            revert UnsupportedPaymentMethod();
        }

        if (makerFee >= MAX_FEE || takerFee >= MAX_FEE) {
            revert InvalidFees();
        }

        feesByPaymentMethod[paymentMethodAddress] = PaymentMethodFees(
            paymentMethodAddress,
            makerFee,
            takerFee
        );
    }
}
