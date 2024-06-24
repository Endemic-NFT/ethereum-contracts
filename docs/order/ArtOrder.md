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

### MAX_FEE

```solidity
function MAX_FEE() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

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
function collectionPerArtist(address artist) external view returns (address collection)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| artist | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| collection | address | undefined |

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
function feeAmount() external view returns (uint96)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint96 | undefined |

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
function finalizeExtendedOrder(ArtOrderEIP712.Order order, uint256 newDeadline, string tokenCID, ArtOrderEIP712.OrderSignature extendSignature) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| order | ArtOrderEIP712.Order | undefined |
| newDeadline | uint256 | undefined |
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
function initialize(uint256 feeAmount_, address feeRecipient_, address collectionFactory_) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| feeAmount_ | uint256 | undefined |
| feeRecipient_ | address | undefined |
| collectionFactory_ | address | undefined |

### orders

```solidity
function orders(bytes32 orderHash) external view returns (enum ArtOrder.OrderStatus status, uint248 deadline)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| orderHash | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| status | enum ArtOrder.OrderStatus | undefined |
| deadline | uint248 | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### updateCollectionFactory

```solidity
function updateCollectionFactory(address collectionFactory_) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| collectionFactory_ | address | undefined |

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
event OrderCancelled(uint256 nonce, address indexed orderer, address indexed artist, uint256 price, uint256 deadline, address paymentErc20TokenAddress)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nonce  | uint256 | undefined |
| orderer `indexed` | address | undefined |
| artist `indexed` | address | undefined |
| price  | uint256 | undefined |
| deadline  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |

### OrderCreated

```solidity
event OrderCreated(uint256 nonce, address indexed orderer, address indexed artist, uint256 price, uint256 deadline, address paymentErc20TokenAddress)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nonce  | uint256 | undefined |
| orderer `indexed` | address | undefined |
| artist `indexed` | address | undefined |
| price  | uint256 | undefined |
| deadline  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |

### OrderFinalized

```solidity
<<<<<<< HEAD
event OrderFinalized(uint256 nonce, address indexed orderer, address indexed artist, uint256 price, uint256 deadline, address paymentErc20TokenAddress, string tokenCID)
=======
event OrderFinalized(uint256 nonce, address indexed orderer, address indexed artist, uint256 price, uint256 deadline, address paymentErc20TokenAddress, address collectionAddress, uint256 tokenId)
>>>>>>> 45c5ddd (add nftId to art order finalize event)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nonce  | uint256 | undefined |
| orderer `indexed` | address | undefined |
| artist `indexed` | address | undefined |
| price  | uint256 | undefined |
| deadline  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |
| collectionAddress  | address | undefined |
| tokenId  | uint256 | undefined |

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






### InvalidAddress

```solidity
error InvalidAddress()
```






### InvalidEtherAmount

```solidity
error InvalidEtherAmount()
```






### InvalidFeeAmount

```solidity
error InvalidFeeAmount()
```






### InvalidPrice

```solidity
error InvalidPrice()
```






### InvalidTokenCID

```solidity
error InvalidTokenCID()
```






### OrderAlreadyExists

```solidity
error OrderAlreadyExists()
```






### OrderDeadlineExceeded

```solidity
error OrderDeadlineExceeded()
```






### OrderDeadlineNotExceeded

```solidity
error OrderDeadlineNotExceeded()
```






### OrderNotActive

```solidity
error OrderNotActive()
```






### UnauthorizedCaller

```solidity
error UnauthorizedCaller()
```







