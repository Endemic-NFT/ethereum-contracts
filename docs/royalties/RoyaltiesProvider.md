# RoyaltiesProvider









## Methods

### ERC2981_INTERFACE_ID

```solidity
function ERC2981_INTERFACE_ID() external view returns (bytes4)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes4 | undefined |

### __RoyaltiesProvider_init

```solidity
function __RoyaltiesProvider_init(uint256 royaltiesLimit) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| royaltiesLimit | uint256 | - up to 9500 |

### calculateRoyaltiesAndGetRecipient

```solidity
function calculateRoyaltiesAndGetRecipient(address nftContract, uint256 tokenId, uint256 amount) external view returns (address, uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract | address | undefined |
| tokenId | uint256 | undefined |
| amount | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |
| _1 | uint256 | undefined |

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


### royaltyFeeLimit

```solidity
function royaltyFeeLimit() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### setRoyaltiesForCollection

```solidity
function setRoyaltiesForCollection(address nftContract, address feeRecipient, uint256 fee) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract | address | undefined |
| feeRecipient | address | undefined |
| fee | uint256 | undefined |

### setRoyaltiesForToken

```solidity
function setRoyaltiesForToken(address nftContract, uint256 tokenId, address feeRecipient, uint256 fee) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract | address | undefined |
| tokenId | uint256 | undefined |
| feeRecipient | address | undefined |
| fee | uint256 | undefined |

### setRoyaltiesLimit

```solidity
function setRoyaltiesLimit(uint256 newLimit) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newLimit | uint256 | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |



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

### NewRoyaltiesLimit

```solidity
event NewRoyaltiesLimit(uint256 limit)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| limit  | uint256 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### RoyaltiesSetForCollection

```solidity
event RoyaltiesSetForCollection(address indexed nftContract, address feeRecipient, uint256 fee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract `indexed` | address | undefined |
| feeRecipient  | address | undefined |
| fee  | uint256 | undefined |

### RoyaltiesSetForToken

```solidity
event RoyaltiesSetForToken(address indexed nftContract, uint256 indexed tokenId, address feeRecipient, uint256 fee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract `indexed` | address | undefined |
| tokenId `indexed` | uint256 | undefined |
| feeRecipient  | address | undefined |
| fee  | uint256 | undefined |



## Errors

### FeeOverTheLimit

```solidity
error FeeOverTheLimit()
```






### InvalidOwner

```solidity
error InvalidOwner()
```






### LimitTooHigh

```solidity
error LimitTooHigh()
```







