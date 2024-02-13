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

    error OrderAlreadyExists();
    error OrderNotActive();
    error OrderTimestampNotExceeded();
    error OrderTimestampExceeded();

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
        uint8 vOrderer,
        bytes32 rOrderer,
        bytes32 sOrderer,
        uint8 vArtist,
        bytes32 rArtist,
        bytes32 sArtist
    ) external payable {
        _checkCreateOrderSignature(
            order,
            vOrderer,
            rOrderer,
            sOrderer,
            order.orderer
        );
        _checkCreateOrderSignature(
            order,
            vArtist,
            rArtist,
            sArtist,
            order.artist
        );

        bytes32 orderHash = _getOrderHash(order);

        if (statusPerOrder[orderHash] != OrderStatus.Inactive)
            revert OrderAlreadyExists();

        _lockCreateOrderFunds(
            order.orderer,
            order.price,
            order.paymentErc20TokenAddress
        );

        statusPerOrder[orderHash] = OrderStatus.Active;

        emit OrderCreated(
            order.orderer,
            order.artist,
            order.price,
            order.timestamp,
            order.paymentErc20TokenAddress
        );
    }

    function cancelOrder(
        Order calldata order,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _checkCancelOrderSignature(order, v, r, s);

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

    function finalizeOrder(
        Order calldata order,
        string calldata tokenCID,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        _checkFinalizeOrderSignature(order, v, r, s);

        bytes32 orderHash = _getOrderHash(order);

        if (statusPerOrder[orderHash] != OrderStatus.Active) {
            revert OrderNotActive();
        }

        _mintOrderNft(order.orderer, order.artist, tokenCID);

        statusPerOrder[orderHash] = OrderStatus.Finalized;

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
