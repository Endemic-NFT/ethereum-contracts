// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./erc-721/OrderCollection.sol";
import "./erc-721/OrderCollectionFactory.sol";
import "./mixins/ArtOrderFundsDistributor.sol";
import "./mixins/ArtOrderEIP712.sol";

/**
 * TODO:
 * natspec comments
 */
contract ArtOrder is
    Initializable,
    ReentrancyGuardUpgradeable,
    ArtOrderFundsDistributor,
    ArtOrderEIP712,
    OrderCollectionFactory
{
    enum OrderStatus {
        Inactive,
        Active,
        Cancelled,
        Finalized
    }

    mapping(bytes32 => OrderStatus) private _statusPerOrder;
    mapping(address => address) private _collectionPerArtist;

    error OrderAlreadyExists();
    error OrderNotActive();
    error OrderTimestampNotExceeded();
    error InvalidEtherAmount();

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
        address administrator
    ) external initializer {
        __ReentrancyGuard_init_unchained();
        __ArtOrderFundsDistributor_init(_feeRecipient, _feeAmount);
        __ArtOrderEIP712_init();
        __OrderCollectionFactory_init(administrator);
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

        if (_statusPerOrder[orderHash] != OrderStatus.Inactive)
            revert OrderAlreadyExists();

        if (order.paymentErc20TokenAddress == address(0)) {
            if (msg.value != order.price) revert InvalidEtherAmount();
        } else {
            if (msg.value != 0) revert InvalidEtherAmount();
            _transferErc20Funds(
                IERC20(order.paymentErc20TokenAddress),
                order.orderer,
                address(this),
                order.price
            );
        }

        _statusPerOrder[orderHash] = OrderStatus.Active;

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

        if (_statusPerOrder[orderHash] != OrderStatus.Active) {
            revert OrderNotActive();
        }

        _statusPerOrder[orderHash] = OrderStatus.Cancelled;

        if (order.paymentErc20TokenAddress == address(0)) {
            _transferEtherFunds(order.orderer, order.price);
        } else {
            _transferErc20Funds(
                IERC20(order.paymentErc20TokenAddress),
                address(this),
                order.orderer,
                order.price
            );
        }

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
        bytes32 s,
        uint256 nonce
    ) external nonReentrant {
        _checkFinalizeOrderSignature(order, tokenCID, v, r, s);

        address collectionAddr = _collectionPerArtist[order.artist];

        if (collectionAddr == address(0)) {
            collectionAddr = _deployCollectionContract(
                order.artist,
                "Order Collection",
                "OC",
                1000
            );

            _collectionPerArtist[order.artist] = collectionAddr;
        }

        IOrderCollection(collectionAddr).mint(
            order.orderer,
            tokenCID,
            v,
            r,
            s,
            nonce
        );

        bytes32 orderHash = _getOrderHash(order);

        _statusPerOrder[orderHash] = OrderStatus.Finalized;

        _distributeOrderFunds(
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

    function updateCollectionImplementation(address newImplementation)
        external
        onlyAdministrator
    {
        _updateCollectionImplementation(newImplementation);
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
