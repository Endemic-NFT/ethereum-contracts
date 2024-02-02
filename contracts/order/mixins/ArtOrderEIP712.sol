// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ArtOrderEIP712 is EIP712Upgradeable {
    bytes32 public constant LOCK_FUNDS_TYPEHASH =
        keccak256(
            "CreateOrder(address orderer,address artist,uint256 price,uint256 timestamp,address paymentErc20TokenAddress)"
        );

    bytes32 public constant CANCEL_ORDER_TYPEHASH =
        keccak256(
            "CancelOrder(address orderer,address artist,uint256 price,uint256 timestamp,address paymentErc20TokenAddress)"
        );

    bytes32 public constant FINALIZE_ORDER_TYPEHASH =
        keccak256(
            "FinalizeOrder(address orderer,address artist,uint256 price,uint256 timestamp,address paymentErc20TokenAddress)"
        );

    struct Order {
        address orderer;
        address artist;
        uint256 price;
        uint256 timestamp;
        address paymentErc20TokenAddress;
    }

    error CreateOrderSignerInvalid();
    error CancelOrderSignerInvalid();
    error FinalizeOrderSignerInvalid();

    function __ArtOrderEIP712_init() internal onlyInitializing {
        __EIP712_init("ArtOrder", "1");
    }

    function _checkCreateOrderSignature(
        Order calldata order,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address expectedSigner
    ) internal view {
        address signer = ecrecover(_prepareCreateOrderMessage(order), v, r, s);

        if (signer != expectedSigner) {
            revert CreateOrderSignerInvalid();
        }
    }

    function _checkCancelOrderSignature(
        Order calldata order,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        address signer = ecrecover(_prepareCancelOrderMessage(order), v, r, s);

        if (signer != order.orderer) {
            revert CancelOrderSignerInvalid();
        }
    }

    function _checkFinalizeOrderSignature(
        Order calldata order,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        address signer = ecrecover(
            _prepareFinalizeOrderMessage(order),
            v,
            r,
            s
        );

        if (signer != order.artist) {
            revert FinalizeOrderSignerInvalid();
        }
    }

    function _prepareCreateOrderMessage(Order calldata order)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        LOCK_FUNDS_TYPEHASH,
                        order.orderer,
                        order.artist,
                        order.price,
                        order.timestamp,
                        order.paymentErc20TokenAddress
                    )
                )
            );
    }

    function _prepareCancelOrderMessage(Order calldata order)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        CANCEL_ORDER_TYPEHASH,
                        order.orderer,
                        order.artist,
                        order.price,
                        order.timestamp,
                        order.paymentErc20TokenAddress
                    )
                )
            );
    }

    function _prepareFinalizeOrderMessage(Order calldata order)
        internal
        view
        returns (bytes32)
    {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        FINALIZE_ORDER_TYPEHASH,
                        order.orderer,
                        order.artist,
                        order.price,
                        order.timestamp,
                        order.paymentErc20TokenAddress
                    )
                )
            );
    }
}
