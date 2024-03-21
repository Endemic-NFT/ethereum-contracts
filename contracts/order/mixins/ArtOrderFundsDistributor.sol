// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract ArtOrderFundsDistributor is Initializable {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE = 10_000;

    address public feeRecipient;
    uint96 public feeAmount;

    error FundsTransferFailed();
    error InvalidEtherAmount();
    error InvalidFeeAmount();

    function __ArtOrderFundsDistributor_init(
        address _feeRecipientAddress,
        uint256 _feeAmount
    ) internal onlyInitializing {
        _updateDistributorConfiguration(_feeRecipientAddress, _feeAmount);
    }

    function _lockOrderFunds(
        address orderer,
        uint256 price,
        address paymentErc20TokenAddress
    ) internal {
        if (paymentErc20TokenAddress == address(0)) {
            if (msg.value != price) revert InvalidEtherAmount();
        } else {
            if (msg.value != 0) revert InvalidEtherAmount();
            IERC20(paymentErc20TokenAddress).safeTransferFrom(
                orderer,
                address(this),
                price
            );
        }
    }

    function _distributeCancelledOrderFunds(
        address orderer,
        uint256 price,
        address paymentErc20TokenAddress
    ) internal {
        if (paymentErc20TokenAddress == address(0)) {
            _transferEtherFunds(orderer, price);
        } else {
            _transferErc20Funds(
                IERC20(paymentErc20TokenAddress),
                orderer,
                price
            );
        }
    }

    function _distributeFinalizedOrderFunds(
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
        uint256 fee = (amount * feeAmount) / MAX_FEE;

        _transferEtherFunds(feeRecipient, fee);
        _transferEtherFunds(artist, amount - fee);
    }

    function _distributeErc20Funds(
        address artist,
        uint256 amount,
        address token
    ) internal {
        uint256 fee = (amount * feeAmount) / MAX_FEE;

        _transferErc20Funds(IERC20(token), feeRecipient, fee);
        _transferErc20Funds(IERC20(token), artist, amount - fee);
    }

    function _transferEtherFunds(address recipient, uint256 value) internal {
        (bool success, ) = payable(recipient).call{value: value}("");

        if (!success) revert FundsTransferFailed();
    }

    function _transferErc20Funds(
        IERC20 ERC20PaymentToken,
        address recipient,
        uint256 value
    ) internal {
        ERC20PaymentToken.safeTransfer(recipient, value);
    }

    function _updateDistributorConfiguration(
        address _feeRecipientAddress,
        uint256 _feeAmount
    ) internal {
        if (_feeAmount > MAX_FEE) revert InvalidFeeAmount();

        feeRecipient = _feeRecipientAddress;
        feeAmount = uint96(_feeAmount);
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[500] private __gap;
}
