# EndemicExchange









## Methods

### __EndemicExchange_init

```solidity
function __EndemicExchange_init(address _paymentManager, address _feeRecipientAddress, address _approvedSigner) external nonpayable
```

Initialized Endemic exchange contract

*Only called once*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _paymentManager | address | - payment manager contract address |
| _feeRecipientAddress | address | - address to receive exchange fees |
| _approvedSigner | address | - address to sign reserve auction orders |

### acceptCollectionOffer

```solidity
function acceptCollectionOffer(uint8 v, bytes32 r, bytes32 s, EndemicOffer.Offer offer, uint256 tokenId) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| offer | EndemicOffer.Offer | undefined |
| tokenId | uint256 | undefined |

### acceptNftOffer

```solidity
function acceptNftOffer(uint8 v, bytes32 r, bytes32 s, EndemicOffer.Offer offer) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| offer | EndemicOffer.Offer | undefined |

### approvedSigner

```solidity
function approvedSigner() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### bidForDutchAuction

```solidity
function bidForDutchAuction(uint8 v, bytes32 r, bytes32 s, address seller, EndemicDutchAuction.DutchAuction auction) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| seller | address | undefined |
| auction | EndemicDutchAuction.DutchAuction | undefined |

### buyFromSale

```solidity
function buyFromSale(uint8 v, bytes32 r, bytes32 s, EndemicSale.Sale sale) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| sale | EndemicSale.Sale | undefined |

### cancelNonce

```solidity
function cancelNonce(uint256 nonce) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nonce | uint256 | undefined |

### feeRecipientAddress

```solidity
function feeRecipientAddress() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### finalizeReserveAuction

```solidity
function finalizeReserveAuction(uint8 v, bytes32 r, bytes32 s, EndemicReserveAuction.ReserveAuction auction, EndemicReserveAuction.ReserveAuction bid, EndemicReserveAuction.AuctionInfo info) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| auction | EndemicReserveAuction.ReserveAuction | undefined |
| bid | EndemicReserveAuction.ReserveAuction | undefined |
| info | EndemicReserveAuction.AuctionInfo | undefined |

### getCurrentPrice

```solidity
function getCurrentPrice(uint256 startingPrice, uint256 endingPrice, uint256 startingAt, uint256 duration) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| startingPrice | uint256 | undefined |
| endingPrice | uint256 | undefined |
| startingAt | uint256 | undefined |
| duration | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### paymentManager

```solidity
function paymentManager() external view returns (contract IPaymentManager)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IPaymentManager | undefined |

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

### updateConfiguration

```solidity
function updateConfiguration(address _paymentManager, address _feeRecipientAddress, address _approvedSigner) external nonpayable
```

Updated contract internal configuration, callable by exchange owner



#### Parameters

| Name | Type | Description |
|---|---|---|
| _paymentManager | address | - payment manager contract address |
| _feeRecipientAddress | address | - address to receive exchange fees |
| _approvedSigner | address | - address to sign reserve auction orders |



## Events

### AuctionSuccessful

```solidity
event AuctionSuccessful(address indexed nftContract, uint256 indexed tokenId, uint256 indexed totalPrice, address seller, address winner, uint256 totalFees, address paymentErc20TokenAddress)
```

Fired when auction is successfully completed



#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract `indexed` | address | undefined |
| tokenId `indexed` | uint256 | undefined |
| totalPrice `indexed` | uint256 | undefined |
| seller  | address | undefined |
| winner  | address | undefined |
| totalFees  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```



*Triggered when the contract has been initialized or reinitialized.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### NonceCanceled

```solidity
event NonceCanceled(address indexed user, uint256 nonce)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user `indexed` | address | undefined |
| nonce  | uint256 | undefined |

### OfferAccepted

```solidity
event OfferAccepted(address indexed nftContract, uint256 indexed tokenId, address bidder, address indexed seller, uint256 price, uint256 totalFees, address paymentErc20TokenAddress)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract `indexed` | address | undefined |
| tokenId `indexed` | uint256 | undefined |
| bidder  | address | undefined |
| seller `indexed` | address | undefined |
| price  | uint256 | undefined |
| totalFees  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### SaleSuccess

```solidity
event SaleSuccess(address indexed nftContract, uint256 indexed tokenId, address indexed seller, address buyer, uint256 price, uint256 totalFees, address paymentErc20TokenAddress)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract `indexed` | address | undefined |
| tokenId `indexed` | uint256 | undefined |
| seller `indexed` | address | undefined |
| buyer  | address | undefined |
| price  | uint256 | undefined |
| totalFees  | uint256 | undefined |
| paymentErc20TokenAddress  | address | undefined |



## Errors

### AuctionNotStarted

```solidity
error AuctionNotStarted()
```






### FeeTransferFailed

```solidity
error FeeTransferFailed()
```






### FundsTransferFailed

```solidity
error FundsTransferFailed()
```






### InvalidAddress

```solidity
error InvalidAddress()
```






### InvalidCaller

```solidity
error InvalidCaller()
```






### InvalidConfiguration

```solidity
error InvalidConfiguration()
```






### InvalidDuration

```solidity
error InvalidDuration()
```






### InvalidOffer

```solidity
error InvalidOffer()
```






### InvalidPaymentMethod

```solidity
error InvalidPaymentMethod()
```






### InvalidPrice

```solidity
error InvalidPrice()
```






### InvalidSignature

```solidity
error InvalidSignature()
```






### NonceUsed

```solidity
error NonceUsed()
```






### OfferExpired

```solidity
error OfferExpired()
```






### RoyaltiesTransferFailed

```solidity
error RoyaltiesTransferFailed()
```






### SaleExpired

```solidity
error SaleExpired()
```






### UnsufficientCurrencySupplied

```solidity
error UnsufficientCurrencySupplied()
```







