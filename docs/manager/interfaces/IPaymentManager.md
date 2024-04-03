# IPaymentManager









## Methods

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




