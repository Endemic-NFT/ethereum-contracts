// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ArtOrderEIP712 is EIP712Upgradeable {
    bytes32 public constant CREATE_ORDER_TYPEHASH =
        keccak256(
            "CreateOrder(address orderer,address artist,uint256 price,uint256 timestamp,address paymentErc20TokenAddress)"
        );
    bytes32 public constant EXTEND_ORDER_TYPEHASH =
        keccak256(
            "ExtendOrder(address orderer,address artist,uint256 price,uint256 timestamp,address paymentErc20TokenAddress,uint256 newTimestamp)"
        );

    struct Order {
        address orderer;
        address artist;
        uint256 price;
        uint256 timestamp;
        address paymentErc20TokenAddress;
    }

    struct OrderSignature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    error CreateOrderSignatureInvalid();
    error ExtendOrderSignatureInvalid();

    function __ArtOrderEIP712_init() internal onlyInitializing {
        __EIP712_init("ArtOrder", "1");
    }

    function _checkCreateOrderSignature(
        Order calldata order,
        OrderSignature calldata signature
    ) internal view {
        address signer = ecrecover(
            _prepareCreateOrderMessage(order),
            signature.v,
            signature.r,
            signature.s
        );

        if (signer != order.artist) {
            revert CreateOrderSignatureInvalid();
        }
    }

    function _checkExtendOrderSignature(
        Order calldata order,
        uint256 newTimestamp,
        OrderSignature calldata signature
    ) internal view {
        address signer = ecrecover(
            _prepareExtendOrderMessage(order, newTimestamp),
            signature.v,
            signature.r,
            signature.s
        );

        if (signer != order.orderer) {
            revert ExtendOrderSignatureInvalid();
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
                        CREATE_ORDER_TYPEHASH,
                        order.orderer,
                        order.artist,
                        order.price,
                        order.timestamp,
                        order.paymentErc20TokenAddress
                    )
                )
            );
    }

    function _prepareExtendOrderMessage(
        Order calldata order,
        uint256 newTimestamp
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        EXTEND_ORDER_TYPEHASH,
                        order.orderer,
                        order.artist,
                        order.price,
                        order.timestamp,
                        order.paymentErc20TokenAddress,
                        newTimestamp
                    )
                )
            );
    }
}
