// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

abstract contract ArtOrderEIP712 is EIP712Upgradeable {
    using ECDSA for bytes32;

    bytes32 public constant CREATE_ORDER_TYPEHASH =
        keccak256(
            "CreateOrder(uint256 nonce,address orderer,address artist,uint256 price,uint256 timeframe,address paymentErc20TokenAddress)"
        );
    bytes32 public constant EXTEND_ORDER_TYPEHASH =
        keccak256(
            "ExtendOrder(uint256 nonce,address orderer,address artist,uint256 price,uint256 timeframe,address paymentErc20TokenAddress,uint256 newDeadline)"
        );

    struct Order {
        uint256 nonce;
        address orderer;
        address artist;
        uint256 price;
        uint256 timeframe;
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
        bytes32 digest = _prepareCreateOrderMessage(order);
        address signer = digest.recover(signature.v, signature.r, signature.s);

        if (signer != order.artist) {
            revert CreateOrderSignatureInvalid();
        }
    }

    function _checkExtendOrderSignature(
        Order calldata order,
        uint256 newDeadline,
        OrderSignature calldata signature
    ) internal view {
        bytes32 digest = _prepareExtendOrderMessage(order, newDeadline);
        address signer = digest.recover(signature.v, signature.r, signature.s);

        if (signer != order.orderer) {
            revert ExtendOrderSignatureInvalid();
        }
    }

    function _prepareCreateOrderMessage(
        Order calldata order
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(abi.encode(CREATE_ORDER_TYPEHASH, order))
            );
    }

    function _prepareExtendOrderMessage(
        Order calldata order,
        uint256 newDeadline
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(abi.encode(EXTEND_ORDER_TYPEHASH, order, newDeadline))
            );
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[500] private __gap;
}
