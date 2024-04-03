# EndemicCollectionFactory









## Methods

### DEFAULT_ADMIN_ROLE

```solidity
function DEFAULT_ADMIN_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### MINTER_ROLE

```solidity
function MINTER_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### collectionAdministrator

```solidity
function collectionAdministrator() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### createToken

```solidity
function createToken(EndemicCollectionFactory.DeployParams params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | EndemicCollectionFactory.DeployParams | undefined |

### createTokenForOwner

```solidity
function createTokenForOwner(EndemicCollectionFactory.OwnedDeployParams params) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| params | EndemicCollectionFactory.OwnedDeployParams | undefined |

### getRoleAdmin

```solidity
function getRoleAdmin(bytes32 role) external view returns (bytes32)
```



*Returns the admin role that controls `role`. See {grantRole} and {revokeRole}. To change a role&#39;s admin, use {_setRoleAdmin}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined |

### grantRole

```solidity
function grantRole(bytes32 role, address account) external nonpayable
```



*Grants `role` to `account`. If `account` had not been already granted `role`, emits a {RoleGranted} event. Requirements: - the caller must have ``role``&#39;s admin role. May emit a {RoleGranted} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### hasRole

```solidity
function hasRole(bytes32 role, address account) external view returns (bool)
```



*Returns `true` if `account` has been granted `role`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### implementation

```solidity
function implementation() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### initialize

```solidity
function initialize() external nonpayable
```






### mintApprover

```solidity
function mintApprover() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### renounceRole

```solidity
function renounceRole(bytes32 role, address account) external nonpayable
```



*Revokes `role` from the calling account. Roles are often managed via {grantRole} and {revokeRole}: this function&#39;s purpose is to provide a mechanism for accounts to lose their privileges if they are compromised (such as when a trusted device is misplaced). If the calling account had been revoked `role`, emits a {RoleRevoked} event. Requirements: - the caller must be `account`. May emit a {RoleRevoked} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### revokeRole

```solidity
function revokeRole(bytes32 role, address account) external nonpayable
```



*Revokes `role` from `account`. If `account` had been granted `role`, emits a {RoleRevoked} event. Requirements: - the caller must have ``role``&#39;s admin role. May emit a {RoleRevoked} event.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined |
| account | address | undefined |

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```



*See {IERC165-supportsInterface}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| interfaceId | bytes4 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### updateCollectionAdministrator

```solidity
function updateCollectionAdministrator(address newCollectionAdministrator) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newCollectionAdministrator | address | undefined |

### updateConfiguration

```solidity
function updateConfiguration(address newCollectionAdministrator, address newMintApprover) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newCollectionAdministrator | address | undefined |
| newMintApprover | address | undefined |

### updateImplementation

```solidity
function updateImplementation(address newImplementation) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newImplementation | address | undefined |

### updateMintApprover

```solidity
function updateMintApprover(address newMintApprover) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newMintApprover | address | undefined |



## Events

### CollectionAdministratorUpdated

```solidity
event CollectionAdministratorUpdated(address indexed newAdministrator)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newAdministrator `indexed` | address | undefined |

### ImplementationUpdated

```solidity
event ImplementationUpdated(address indexed newImplementation)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newImplementation `indexed` | address | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```



*Triggered when the contract has been initialized or reinitialized.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |

### MintApproverUpdated

```solidity
event MintApproverUpdated(address indexed newApprover)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newApprover `indexed` | address | undefined |

### NFTContractCreated

```solidity
event NFTContractCreated(address indexed nftContract, address indexed owner, string name, string symbol, string category, uint256 royalties)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nftContract `indexed` | address | undefined |
| owner `indexed` | address | undefined |
| name  | string | undefined |
| symbol  | string | undefined |
| category  | string | undefined |
| royalties  | uint256 | undefined |

### RoleAdminChanged

```solidity
event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
```



*Emitted when `newAdminRole` is set as ``role``&#39;s admin role, replacing `previousAdminRole` `DEFAULT_ADMIN_ROLE` is the starting admin for all roles, despite {RoleAdminChanged} not being emitted signaling this. _Available since v3.1._*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| previousAdminRole `indexed` | bytes32 | undefined |
| newAdminRole `indexed` | bytes32 | undefined |

### RoleGranted

```solidity
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
```



*Emitted when `account` is granted `role`. `sender` is the account that originated the contract call, an admin role bearer except when using {AccessControl-_setupRole}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |

### RoleRevoked

```solidity
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
```



*Emitted when `account` is revoked `role`. `sender` is the account that originated the contract call:   - if using `revokeRole`, it is the admin role bearer   - if using `renounceRole`, it is the role bearer (i.e. `account`)*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |



## Errors

### AddressCannotBeZeroAddress

```solidity
error AddressCannotBeZeroAddress()
```







