# CollectionRoyalties









## Methods

### MAX_ROYALTIES

```solidity
function MAX_ROYALTIES() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### royaltiesAmount

```solidity
function royaltiesAmount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### royaltiesRecipient

```solidity
function royaltiesRecipient() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### royaltyInfo

```solidity
function royaltyInfo(uint256, uint256 value) external view returns (address receiver, uint256 royaltyAmount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |
| value | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| receiver | address | undefined |
| royaltyAmount | uint256 | undefined |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| interfaceId | bytes4 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |



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

### RoyaltiesUpdated

```solidity
event RoyaltiesUpdated(address indexed recipient, uint256 indexed value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient `indexed` | address | undefined |
| value `indexed` | uint256 | undefined |



## Errors

### RoyaltiesTooHigh

```solidity
error RoyaltiesTooHigh()
```







