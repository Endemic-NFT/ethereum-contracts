# EndemicExchangeCore









## Methods

### approvedSigner

```solidity
function approvedSigner() external view returns (address)
```






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



## Errors

### AuctionNotStarted

```solidity
error AuctionNotStarted()
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






### InvalidPaymentMethod

```solidity
error InvalidPaymentMethod()
```






### InvalidPrice

```solidity
error InvalidPrice()
```






### UnsufficientCurrencySupplied

```solidity
error UnsufficientCurrencySupplied()
```







