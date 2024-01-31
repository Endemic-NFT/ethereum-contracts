// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./access/AdministratedUpgradable.sol";
import "./interfaces/IOrderCollection.sol";
import "./OrderCollection.sol";

/**
 * TODO:
 * events
 * handling decimals for ERC20?
 * natspec comments
 * factory contract
 * endemic order721 (for eip712)
 * order funds distributer
 * calldata & memory
 * reentrancy guard init??
 * move to order folder
 * no approvals only transfers
 */
contract ArtOrder is
    Initializable,
    AdministratedUpgradable,
    EIP712Upgradeable,
    ReentrancyGuardUpgradeable
{
    using AddressUpgradeable for address;
    using ClonesUpgradeable for address;

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
            "FinalizeOrder(address orderer,address artist,uint256 price,uint256 timestamp,address paymentErc20TokenAddress,string tokenCID)"
        );

    address public collectionImplementation;
    address public feeRecipient;
    uint256 public feeAmount;

    enum OrderStatus {
        Inactive,
        Active,
        Cancelled,
        Finalized
    }

    mapping(bytes32 => OrderStatus) private _statusPerOrder;
    mapping(address => address) private _collectionPerArtist;

    struct Order {
        address orderer;
        address artist;
        uint256 price;
        uint256 timestamp;
        address paymentErc20TokenAddress;
    }

    error CreateOrderNotApproved();
    error CancelOrderNotApproved();
    error FinalizeOrderNotApproved();

    error OrderAlreadyExists();
    error OrderNotActive();
    error OrderTimestampNotExceeded();

    error CreateOrderTransferFailed();
    error FinalizeOrderTransferFailed();
    error FeeTransferFailed();

    modifier onlyContract(address implementation) {
        require(
            implementation.isContract(),
            "ArtOrder: Address is not a contract"
        );
        _;
    }

    function initialize(
        uint256 _feeAmount,
        address _feeRecipient,
        address administrator
    ) external initializer {
        __Administrated_init(administrator);
        __EIP712_init_unchained("ArtOrder", "1");
        __ReentrancyGuard_init_unchained();

        feeRecipient = _feeRecipient;
        feeAmount = _feeAmount;
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
        _checkCreateOrderApproval(
            order,
            vOrderer,
            rOrderer,
            sOrderer,
            order.orderer
        );
        _checkCreateOrderApproval(
            order,
            vArtist,
            rArtist,
            sArtist,
            order.artist
        );

        bytes32 orderHash = keccak256(
            abi.encodePacked(
                order.orderer,
                order.artist,
                order.price,
                order.timestamp,
                order.paymentErc20TokenAddress
            )
        );

        if (_statusPerOrder[orderHash] != OrderStatus.Inactive)
            revert OrderAlreadyExists();

        if (order.paymentErc20TokenAddress == address(0)) {
            (bool success, ) = address(this).call{value: order.price}("");
            if (!success) revert CreateOrderTransferFailed();
        } else {
            IERC20(order.paymentErc20TokenAddress).approve(
                address(this),
                order.price
            );
        }

        _statusPerOrder[orderHash] = OrderStatus.Active;
    }

    function cancelOrder(
        Order calldata order,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _checkCancelOrderApproval(order, v, r, s);

        if (block.timestamp < order.timestamp) {
            revert OrderTimestampNotExceeded();
        }

        bytes32 orderHash = keccak256(
            abi.encodePacked(
                order.orderer,
                order.artist,
                order.price,
                order.timestamp,
                order.paymentErc20TokenAddress
            )
        );

        if (_statusPerOrder[orderHash] != OrderStatus.Active) {
            revert OrderNotActive();
        }

        _statusPerOrder[orderHash] = OrderStatus.Cancelled;

        if (order.paymentErc20TokenAddress == address(0)) {
            (bool success, ) = address(order.orderer).call{value: order.price}(
                ""
            );
            if (!success) revert CreateOrderTransferFailed();
        } else {
            IERC20(order.paymentErc20TokenAddress).transferFrom(
                address(this),
                order.orderer,
                order.price
            );
        }
    }

    function finalizeOrder(
        Order calldata order,
        string memory tokenCID,
        uint8 v,
        bytes32 r,
        bytes32 s,
        uint256 nonce
    ) external nonReentrant {
        _checkFinalizeOrderApproval(order, tokenCID, v, r, s);

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

        bytes32 orderHash = keccak256(
            abi.encodePacked(
                order.orderer,
                order.artist,
                order.price,
                order.timestamp,
                order.paymentErc20TokenAddress
            )
        );

        _statusPerOrder[orderHash] = OrderStatus.Finalized;

        _distributeOrderFunds(order);
    }

    function updateFees(uint256 newFeeAmount, address newFeeRecipient)
        external
        onlyAdministrator
    {
        feeAmount = newFeeAmount;
        feeRecipient = newFeeRecipient;
    }

    /* factory */

    function updateCollectionImplementation(address newImplementation)
        external
        onlyContract(newImplementation)
        onlyAdministrator
    {
        collectionImplementation = newImplementation;

        IOrderCollection(collectionImplementation).initialize(
            msg.sender,
            "Order Collection",
            "OC",
            1000,
            administrator,
            address(this)
        );
    }

    function _deployCollectionContract(
        address owner,
        string memory name,
        string memory symbol,
        uint256 royalties
    ) internal returns (address) {
        address proxy = collectionImplementation.clone();

        ICollectionInitializer(proxy).initialize(
            owner,
            name,
            symbol,
            royalties,
            administrator,
            address(this)
        );

        return address(proxy);
    }

    /* Funds distribution */

    function _distributeOrderFunds(Order calldata order) internal {
        if (order.paymentErc20TokenAddress == address(0)) {
            _distributeEtherFunds(order.orderer, order.price);
        } else {
            _distributeErc20Funds(
                order.orderer,
                order.orderer,
                order.price,
                order.paymentErc20TokenAddress
            );
        }
    }

    function _distributeEtherFunds(address artist, uint256 amount) internal {
        uint256 fee = (amount * feeAmount) / 10_000;

        (bool successFee, ) = address(feeRecipient).call{value: fee}("");
        if (!successFee) revert FeeTransferFailed();

        (bool successTotal, ) = address(artist).call{value: amount - fee}("");
        if (!successTotal) revert FinalizeOrderTransferFailed();
    }

    function _distributeErc20Funds(
        address orderer,
        address artist,
        uint256 amount,
        address token
    ) internal {
        uint256 fee = (amount * feeAmount) / 10_000;

        IERC20(token).transferFrom(orderer, feeRecipient, fee);

        IERC20(token).transferFrom(orderer, artist, amount - fee);
    }

    /* EIP712 signature validations */

    function _checkCreateOrderApproval(
        Order calldata order,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address expectedSigner
    ) internal view {
        address signer = ecrecover(_prepareCreateOrderMessage(order), v, r, s);

        if (signer != expectedSigner) {
            revert CreateOrderNotApproved();
        }
    }

    function _checkCancelOrderApproval(
        Order calldata order,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        address signer = ecrecover(_prepareCancelOrderMessage(order), v, r, s);

        if (signer != order.orderer) {
            revert CancelOrderNotApproved();
        }
    }

    function _checkFinalizeOrderApproval(
        Order calldata order,
        string memory tokenCID,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        address signer = ecrecover(
            _prepareFinalizeOrderMessage(order, tokenCID),
            v,
            r,
            s
        );

        if (signer != order.artist) {
            revert FinalizeOrderNotApproved();
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

    function _prepareFinalizeOrderMessage(
        Order calldata order,
        string memory tokenCID
    ) internal view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        FINALIZE_ORDER_TYPEHASH,
                        order.orderer,
                        order.artist,
                        order.price,
                        order.timestamp,
                        order.paymentErc20TokenAddress,
                        tokenCID
                    )
                )
            );
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[500] private __gap;
}
