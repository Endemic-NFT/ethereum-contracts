# PaymentManager









## Methods

### __PaymentManager_init

```solidity
function __PaymentManager_init(uint256 makerFee, uint256 takerFee) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| makerFee | uint256 | undefined |
| takerFee | uint256 | undefined |

### feesByPaymentMethod

```solidity
function feesByPaymentMethod(address paymentMethod) external view returns (address paymentMethodAddress, uint256 makerFee, uint256 takerFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentMethod | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| paymentMethodAddress | address | undefined |
| makerFee | uint256 | undefined |
| takerFee | uint256 | undefined |

### getPaymentMethodFees

```solidity
function getPaymentMethodFees(address paymentMethodAddress) external view returns (uint256 takerFee, uint256 makerFee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentMethodAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| takerFee | uint256 | undefined |
| makerFee | uint256 | undefined |

### isPaymentMethodSupported

```solidity
function isPaymentMethodSupported(address paymentMethodAddress) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentMethodAddress | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

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


### supportedPaymentMethods

```solidity
function supportedPaymentMethods(address paymentMethod) external view returns (bool enabled)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentMethod | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| enabled | bool | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### updatePaymentMethodFees

```solidity
function updatePaymentMethodFees(address paymentMethodAddress, uint256 makerFee, uint256 takerFee) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentMethodAddress | address | undefined |
| makerFee | uint256 | undefined |
| takerFee | uint256 | undefined |

### updateSupportedPaymentMethod

```solidity
function updateSupportedPaymentMethod(address paymentMethodAddress, bool isEnabled) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| paymentMethodAddress | address | undefined |
| isEnabled | bool | undefined |



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

### InvalidFees

```solidity
error InvalidFees()
```






### UnsupportedPaymentMethod

```solidity
error UnsupportedPaymentMethod()
```







