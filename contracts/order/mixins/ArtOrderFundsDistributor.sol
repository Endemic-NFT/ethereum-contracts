// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ArtOrderFundsDistributor is Initializable {
    address public feeRecipient;
    uint256 public feeAmount;

    error FundsTransferFailed();

    function __ArtOrderFundsDistributor_init(
        address _feeRecipientAddress,
        uint256 _feeAmount
    ) internal onlyInitializing {
        _updateDistributorConfiguration(_feeRecipientAddress, _feeAmount);
    }

    function _distributeOrderFunds(
        address artist,
        uint256 price,
        address paymentErc20TokenAddress
    ) internal {
        if (paymentErc20TokenAddress == address(0)) {
            _distributeEtherFunds(artist, price);
        } else {
            _distributeErc20Funds(artist, price, paymentErc20TokenAddress);
        }
    }

    function _distributeEtherFunds(address artist, uint256 amount) internal {
        uint256 fee = (amount * feeAmount) / 10_000;

        _transferEtherFunds(feeRecipient, fee);
        _transferEtherFunds(artist, amount - fee);
    }

    function _distributeErc20Funds(
        address artist,
        uint256 amount,
        address token
    ) internal {
        uint256 fee = (amount * feeAmount) / 10_000;

        _transferErc20Funds(IERC20(token), address(this), feeRecipient, fee);
        _transferErc20Funds(IERC20(token), address(this), artist, amount - fee);
    }

    function _transferEtherFunds(address recipient, uint256 value) internal {
        (bool success, ) = payable(recipient).call{value: value}("");

        if (!success) revert FundsTransferFailed();
    }

    function _transferErc20Funds(
        IERC20 ERC20PaymentToken,
        address sender,
        address recipient,
        uint256 value
    ) internal {
        bool success = ERC20PaymentToken.transferFrom(sender, recipient, value);

        if (!success) revert FundsTransferFailed();
    }

    function _updateDistributorConfiguration(
        address _feeRecipientAddress,
        uint256 _feeAmount
    ) internal {
        feeRecipient = _feeRecipientAddress;
        feeAmount = _feeAmount;
    }
}
