# ArtOrder









## Methods

### CREATE_ORDER_TYPEHASH

```solidity
function CREATE_ORDER_TYPEHASH() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### EXTEND_ORDER_TYPEHASH

```solidity
function EXTEND_ORDER_TYPEHASH() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### administrator

```solidity
function administrator() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### cancelOrder

```solidity
function cancelOrder(ArtOrderEIP712.Order order) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| order | ArtOrderEIP712.Order | undefined |

### collectionFactory

```solidity
function collectionFactory() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### collectionPerArtist

```solidity
function collectionPerArtist(address) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### createOrder

```solidity
function createOrder(ArtOrderEIP712.Order order, ArtOrderEIP712.OrderSignature artistSignature) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| order | ArtOrderEIP712.Order | undefined |
| artistSignature | ArtOrderEIP712.OrderSignature | undefined |

### feeAmount

```solidity
function feeAmount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### feeRecipient

```solidity
function feeRecipient() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### finalizeExtendedOrder

```solidity
function finalizeExtendedOrder(ArtOrderEIP712.Order order, uint256 newTimestamp, string tokenCID, ArtOrderEIP712.OrderSignature extendSignature) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| order | ArtOrderEIP712.Order | undefined |
| newTimestamp | uint256 | undefined |
| tokenCID | string | undefined |
| extendSignature | ArtOrderEIP712.OrderSignature | undefined |

### finalizeOrder

```solidity
function finalizeOrder(ArtOrderEIP712.Order order, string tokenCID) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| order | ArtOrderEIP712.Order | undefined |
| tokenCID | string | undefined |

### initialize

```solidity
function initialize(uint256 _feeAmount, address _feeRecipient, address _administrator, address _collectionFactory) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _feeAmount | uint256 | undefined |
| _feeRecipient | address | undefined |
| _administrator | address | undefined |
| _collectionFactory | address | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### renounceAdministration

```solidity
function renounceAdministration() external nonpayable
```






### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### statusPerOrder

```solidity
function statusPerOrder(bytes32) external view returns (enum ArtOrder.OrderStatus)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | enum ArtOrder.OrderStatus | undefined |

### transferAdministration

```solidity
function transferAdministration(address newAdmin) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newAdmin | address | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### updateFees

```solidity
function updateFees(uint256 newFeeAmount, address newFeeRecipient) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newFeeAmount | uint256 | undefined |
| newFeeRecipient | address | undefined |



## Events

### AdministrationTransferred

```solidity
event AdministrationTransferred(address indexed previousAdmin, address indexed newAdmin)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousAdmin `indexed` | address | undefined |
| newAdmin `indexed` | address | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```



*Triggered when the contract has been initialized or reinitialized.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### OrderCancelled

```solidity
event OrderCancelled(address indexed orderer, address indexed artist, uint256 price, uint256 timestamp, address paymentErc20TokenAddress)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| orderer `indexed` | address | undefined |
| artist `indexed` | address | undefined |
| price  | uint256 | undefined |
| timestamp  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |

### OrderCreated

```solidity
event OrderCreated(address indexed orderer, address indexed artist, uint256 price, uint256 timestamp, address paymentErc20TokenAddress)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| orderer `indexed` | address | undefined |
| artist `indexed` | address | undefined |
| price  | uint256 | undefined |
| timestamp  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |

### OrderFinalized

```solidity
event OrderFinalized(address indexed orderer, address indexed artist, uint256 price, uint256 timestamp, address paymentErc20TokenAddress, string tokenCID)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| orderer `indexed` | address | undefined |
| artist `indexed` | address | undefined |
| price  | uint256 | undefined |
| timestamp  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |
| tokenCID  | string | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |



## Errors

### CreateOrderSignatureInvalid

```solidity
error CreateOrderSignatureInvalid()
```






### ExtendOrderSignatureInvalid

```solidity
error ExtendOrderSignatureInvalid()
```






### FundsTransferFailed

```solidity
error FundsTransferFailed()
```






### InvalidAdministratorAddress

```solidity
error InvalidAdministratorAddress()
```






### InvalidEtherAmount

```solidity
error InvalidEtherAmount()
```






### OnlyAdministrator

```solidity
error OnlyAdministrator()
```






### OnlyOwnerOrAdministrator

```solidity
error OnlyOwnerOrAdministrator()
```






### OrderAlreadyExists

```solidity
error OrderAlreadyExists()
```






### OrderNotActive

```solidity
error OrderNotActive()
```






### OrderTimestampExceeded

```solidity
error OrderTimestampExceeded()
```






### OrderTimestampNotExceeded

```solidity
error OrderTimestampNotExceeded()
```






### UnauthorizedCaller

```solidity
error UnauthorizedCaller()
```







