# ArtOrderEIP712









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



## Errors

### CreateOrderSignatureInvalid

```solidity
error CreateOrderSignatureInvalid()
```






### ExtendOrderSignatureInvalid

```solidity
error ExtendOrderSignatureInvalid()
```







