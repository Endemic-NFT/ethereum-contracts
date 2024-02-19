// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./interfaces/IOrderCollectionFactory.sol";
import "./interfaces/IOrderCollection.sol";
import "../erc-721/access/AdministratedUpgradable.sol";
import "./erc-721/OrderCollection.sol";
import "./erc-721/OrderCollectionFactory.sol";
import "./mixins/ArtOrderFundsDistributor.sol";
import "./mixins/ArtOrderEIP712.sol";

contract ArtOrder is
    Initializable,
    ReentrancyGuardUpgradeable,
    ArtOrderFundsDistributor,
    ArtOrderEIP712,
    AdministratedUpgradable
{
    enum OrderStatus {
        Inactive,
        Active,
        Cancelled,
        Finalized
    }

    address public collectionFactory;

    mapping(bytes32 => OrderStatus) public statusPerOrder;
    mapping(address => address) public collectionPerArtist;

    event OrderCreated(
        address indexed orderer,
        address indexed artist,
        uint256 price,
        uint256 timestamp,
        address paymentErc20TokenAddress
    );
    event OrderCancelled(
        address indexed orderer,
        address indexed artist,
        uint256 price,
        uint256 timestamp,
        address paymentErc20TokenAddress
    );
    event OrderFinalized(
        address indexed orderer,
        address indexed artist,
        uint256 price,
        uint256 timestamp,
        address paymentErc20TokenAddress,
        string tokenCID
    );

    error OrderAlreadyExists();
    error OrderNotActive();
    error OrderTimestampNotExceeded();
    error OrderTimestampExceeded();
    error UnauthorizedCaller();

    modifier onlyCaller(address caller) {
        if (msg.sender != caller) revert UnauthorizedCaller();
        _;
    }

    function initialize(
        uint256 _feeAmount,
        address _feeRecipient,
        address _administrator,
        address _collectionFactory
    ) external initializer {
        __ReentrancyGuard_init_unchained();
        __ArtOrderFundsDistributor_init(_feeRecipient, _feeAmount);
        __ArtOrderEIP712_init();
        __Administrated_init(_administrator);

        collectionFactory = _collectionFactory;
    }

    function createOrder(
        Order calldata order,
        OrderSignature calldata artistSignature
    ) external payable onlyCaller(order.orderer) {
        _checkCreateOrderSignature(order, artistSignature);

        bytes32 orderHash = _getOrderHash(order);

        if (statusPerOrder[orderHash] != OrderStatus.Inactive)
            revert OrderAlreadyExists();

        statusPerOrder[orderHash] = OrderStatus.Active;

        _lockOrderFunds(
            order.orderer,
            order.price,
            order.paymentErc20TokenAddress
        );

        emit OrderCreated(
            order.orderer,
            order.artist,
            order.price,
            order.timestamp,
            order.paymentErc20TokenAddress
        );
    }

    function cancelOrder(Order calldata order)
        external
        onlyCaller(order.orderer)
    {
        if (block.timestamp < order.timestamp) {
            revert OrderTimestampNotExceeded();
        }

        bytes32 orderHash = _getOrderHash(order);

        if (statusPerOrder[orderHash] != OrderStatus.Active) {
            revert OrderNotActive();
        }

        statusPerOrder[orderHash] = OrderStatus.Cancelled;

        _distributeCancelledOrderFunds(
            order.orderer,
            order.price,
            order.paymentErc20TokenAddress
        );

        emit OrderCancelled(
            order.orderer,
            order.artist,
            order.price,
            order.timestamp,
            order.paymentErc20TokenAddress
        );
    }

    function finalizeOrder(Order calldata order, string calldata tokenCID)
        external
        nonReentrant
        onlyCaller(order.artist)
    {
        if (block.timestamp > order.timestamp) {
            revert OrderTimestampExceeded();
        }

        _finalizeOrder(order, tokenCID);
    }

    function finalizeExtendedOrder(
        Order calldata order,
        uint256 newTimestamp,
        string calldata tokenCID,
        OrderSignature calldata extendSignature
    ) external nonReentrant onlyCaller(order.artist) {
        _checkExtendOrderSignature(order, newTimestamp, extendSignature);

        if (block.timestamp > newTimestamp) {
            revert OrderTimestampExceeded();
        }

        _finalizeOrder(order, tokenCID);
    }

    function _finalizeOrder(Order calldata order, string calldata tokenCID)
        internal
    {
        bytes32 orderHash = _getOrderHash(order);

        if (statusPerOrder[orderHash] != OrderStatus.Active) {
            revert OrderNotActive();
        }

        statusPerOrder[orderHash] = OrderStatus.Finalized;

        _mintOrderNft(order.orderer, order.artist, tokenCID);

        _distributeFinalizedOrderFunds(
            order.artist,
            order.price,
            order.paymentErc20TokenAddress
        );

        emit OrderFinalized(
            order.orderer,
            order.artist,
            order.price,
            order.timestamp,
            order.paymentErc20TokenAddress,
            tokenCID
        );
    }

    function updateFees(uint256 newFeeAmount, address newFeeRecipient)
        external
        onlyAdministrator
    {
        _updateDistributorConfiguration(newFeeRecipient, newFeeAmount);
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

    function _getOrderHash(Order calldata order)
        internal
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    order.orderer,
                    order.artist,
                    order.price,
                    order.timestamp,
                    order.paymentErc20TokenAddress
                )
            );
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[500] private __gap;
}
