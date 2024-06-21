// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ArtOrderFundsDistributor} from "./mixins/ArtOrderFundsDistributor.sol";
import {ArtOrderEIP712} from "./mixins/ArtOrderEIP712.sol";
import {IOrderCollectionFactory} from "./interfaces/IOrderCollectionFactory.sol";
import {IOrderCollection} from "./interfaces/IOrderCollection.sol";

contract ArtOrder is
    ReentrancyGuardUpgradeable,
    ArtOrderFundsDistributor,
    ArtOrderEIP712,
    OwnableUpgradeable
{
    using SafeCast for uint256;

    enum OrderStatus {
        Inactive,
        Active,
        Cancelled,
        Finalized
    }

    struct OrderState {
        OrderStatus status;
        uint248 deadline;
    }

    address public collectionFactory;

    mapping(bytes32 orderHash => OrderState order) public orders;
    mapping(address artist => address collection) public collectionPerArtist;

    event OrderCreated(
        uint256 nonce,
        address indexed orderer,
        address indexed artist,
        uint256 price,
        uint256 deadline,
        address paymentErc20TokenAddress
    );
    event OrderCancelled(
        uint256 nonce,
        address indexed orderer,
        address indexed artist,
        uint256 price,
        uint256 deadline,
        address paymentErc20TokenAddress
    );
    event OrderFinalized(
        uint256 nonce,
        address indexed orderer,
        address indexed artist,
        uint256 price,
        uint256 deadline,
        address paymentErc20TokenAddress,
        string tokenCID
    );

    error OrderAlreadyExists();
    error OrderNotActive();
    error OrderDeadlineNotExceeded();
    error OrderDeadlineExceeded();
    error UnauthorizedCaller();
    error InvalidTokenCID();
    error InvalidAddress();
    error InvalidPrice();

    modifier onlyCaller(address caller) {
        if (msg.sender != caller) revert UnauthorizedCaller();
        _;
    }

    function initialize(
        uint256 feeAmount_,
        address feeRecipient_,
        address collectionFactory_
    ) external initializer {
        if (collectionFactory_ == address(0)) {
            revert InvalidAddress();
        }

        __Ownable_init_unchained();
        __ReentrancyGuard_init_unchained();
        __ArtOrderFundsDistributor_init(feeRecipient_, feeAmount_);
        __ArtOrderEIP712_init();

        collectionFactory = collectionFactory_;
    }

    function createOrder(
        Order calldata order,
        OrderSignature calldata artistSignature
    ) external payable onlyCaller(order.orderer) {
        if (order.price == 0) revert InvalidPrice();

        _checkCreateOrderSignature(order, artistSignature);

        bytes32 orderHash = _getOrderHash(order);
        OrderState storage orderState = orders[orderHash];

        if (orderState.status != OrderStatus.Inactive) {
            revert OrderAlreadyExists();
        }

        uint256 deadline = block.timestamp + order.timeframe;

        orderState.status = OrderStatus.Active;
        orderState.deadline = deadline.toUint248();

        _lockOrderFunds(
            order.orderer,
            order.price,
            order.paymentErc20TokenAddress
        );

        emit OrderCreated(
            order.nonce,
            order.orderer,
            order.artist,
            order.price,
            deadline,
            order.paymentErc20TokenAddress
        );
    }

    function cancelOrder(
        Order calldata order
    ) external onlyCaller(order.orderer) {
        bytes32 orderHash = _getOrderHash(order);
        OrderState storage orderState = orders[orderHash];

        if (orderState.status != OrderStatus.Active) {
            revert OrderNotActive();
        }

        if (block.timestamp < orderState.deadline) {
            revert OrderDeadlineNotExceeded();
        }

        orderState.status = OrderStatus.Cancelled;

        _distributeCancelledOrderFunds(
            order.orderer,
            order.price,
            order.paymentErc20TokenAddress
        );

        emit OrderCancelled(
            order.nonce,
            order.orderer,
            order.artist,
            order.price,
            orderState.deadline,
            order.paymentErc20TokenAddress
        );
    }

    function finalizeOrder(
        Order calldata order,
        string calldata tokenCID
    ) external nonReentrant onlyCaller(order.artist) {
        bytes32 orderHash = _getOrderHash(order);
        OrderState storage orderState = orders[orderHash];

        _finalizeOrder(orderState, order, tokenCID, orderState.deadline);
    }

    function finalizeExtendedOrder(
        Order calldata order,
        uint256 newDeadline,
        string calldata tokenCID,
        OrderSignature calldata extendSignature
    ) external nonReentrant onlyCaller(order.artist) {
        _checkExtendOrderSignature(order, newDeadline, extendSignature);

        bytes32 orderHash = _getOrderHash(order);
        OrderState storage orderState = orders[orderHash];

        _finalizeOrder(orderState, order, tokenCID, newDeadline);
    }

    function updateFees(
        uint256 newFeeAmount,
        address newFeeRecipient
    ) external onlyOwner {
        _updateDistributorConfiguration(newFeeRecipient, newFeeAmount);
    }

    function updateCollectionFactory(
        address collectionFactory_
    ) external onlyOwner {
       collectionFactory = collectionFactory_;
    }

    function _finalizeOrder(
        OrderState storage orderState,
        Order calldata order,
        string calldata tokenCID,
        uint256 deadline
    ) internal {
        if (orderState.status != OrderStatus.Active) {
            revert OrderNotActive();
        }

        if (bytes(tokenCID).length == 0) revert InvalidTokenCID();

        if (block.timestamp > deadline) revert OrderDeadlineExceeded();

        orderState.status = OrderStatus.Finalized;

        _mintOrderNft(order.orderer, order.artist, tokenCID);

        _distributeFinalizedOrderFunds(
            order.artist,
            order.price,
            order.paymentErc20TokenAddress
        );

        emit OrderFinalized(
            order.nonce,
            order.orderer,
            order.artist,
            order.price,
            deadline,
            order.paymentErc20TokenAddress,
            tokenCID
        );
    }

    function _mintOrderNft(
        address orderer,
        address artist,
        string calldata tokenCID
    ) internal {
        address collectionAddr = collectionPerArtist[artist];

        if (collectionAddr == address(0)) {
            collectionAddr = IOrderCollectionFactory(collectionFactory)
                .createCollection(artist, "Order Collection", "OC", 1000);

            collectionPerArtist[artist] = collectionAddr;
        }

        IOrderCollection(collectionAddr).mint(orderer, tokenCID);
    }

    function _getOrderHash(
        Order calldata order
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    order.nonce,
                    order.orderer,
                    order.artist,
                    order.price,
                    order.timeframe,
                    order.paymentErc20TokenAddress
                )
            );
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[500] private __gap;
}
