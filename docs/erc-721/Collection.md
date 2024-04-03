# Collection









## Methods

### MAX_ROYALTIES

```solidity
function MAX_ROYALTIES() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### administrator

```solidity
function administrator() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### approve

```solidity
function approve(address to, uint256 tokenId) external nonpayable
```



*See {IERC721-approve}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | undefined |
| tokenId | uint256 | undefined |

### balanceOf

```solidity
function balanceOf(address owner) external view returns (uint256)
```



*See {IERC721-balanceOf}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### baseURI

```solidity
function baseURI() external view returns (string)
```

Base URI of the collection

*We always default to ipfs*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### batchMint

```solidity
function batchMint(address recipient, string[] tokenCIDs, uint8 v, bytes32 r, bytes32 s, uint256 nonce) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined |
| tokenCIDs | string[] | undefined |
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| nonce | uint256 | undefined |

### batchMintAndApprove

```solidity
function batchMintAndApprove(address recipient, string[] tokenCIDs, address operator, uint8 v, bytes32 r, bytes32 s, uint256 nonce) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined |
| tokenCIDs | string[] | undefined |
| operator | address | undefined |
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| nonce | uint256 | undefined |

### burn

```solidity
function burn(uint256 tokenId) external nonpayable
```



*Burns `tokenId`. See {ERC721-_burn}. Requirements: - The caller must own `tokenId` or be an approved operator.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | undefined |

### collectionFactory

```solidity
function collectionFactory() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### getApproved

```solidity
function getApproved(uint256 tokenId) external view returns (address)
```



*See {IERC721-getApproved}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### initialize

```solidity
function initialize(address creator, string name, string symbol, uint256 royalties, address administrator, address approver) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| creator | address | undefined |
| name | string | undefined |
| symbol | string | undefined |
| royalties | uint256 | undefined |
| administrator | address | undefined |
| approver | address | undefined |

### isApprovedForAll

```solidity
function isApprovedForAll(address owner, address operator) external view returns (bool)
```



*See {IERC721-isApprovedForAll}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined |
| operator | address | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined |

### latestTokenId

```solidity
function latestTokenId() external view returns (uint256)
```

The tokenId of the most recently minted NFT.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined |

### mint

```solidity
function mint(address recipient, string tokenCID, uint8 v, bytes32 r, bytes32 s, uint256 nonce) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined |
| tokenCID | string | undefined |
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| nonce | uint256 | undefined |

### mintAndApprove

```solidity
function mintAndApprove(address recipient, string tokenCID, address operator, uint8 v, bytes32 r, bytes32 s, uint256 nonce) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined |
| tokenCID | string | undefined |
| operator | address | undefined |
| v | uint8 | undefined |
| r | bytes32 | undefined |
| s | bytes32 | undefined |
| nonce | uint256 | undefined |

### mintApprover

```solidity
function mintApprover() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### name

```solidity
function name() external view returns (string)
```



*See {IERC721Metadata-name}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined |

### ownerOf

```solidity
function ownerOf(uint256 tokenId) external view returns (address)
```



*See {IERC721-ownerOf}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | undefined |

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

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId) external nonpayable
```



*See {IERC721-safeTransferFrom}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | undefined |
| to | address | undefined |
| tokenId | uint256 | undefined |

### safeTransferFrom

```solidity
function safeTransferFrom(address from, address to, uint256 tokenId, bytes data) external nonpayable
```



*See {IERC721-safeTransferFrom}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | undefined |
| to | address | undefined |
| tokenId | uint256 | undefined |
| data | bytes | undefined |

### setApprovalForAll

```solidity
function setApprovalForAll(address operator, bool approved) external nonpayable
```



*See {IERC721-setApprovalForAll}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| operator | address | undefined |
| approved | bool | undefined |

### setRoyalties

```solidity
function setRoyalties(address recipient, uint256 value) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined |
| value | uint256 | undefined |

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

### symbol

```solidity
function symbol() external view returns (string)
```



*See {IERC721Metadata-symbol}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### toggleMintApproval

```solidity
function toggleMintApproval() external nonpayable
```






### tokenURI

```solidity
function tokenURI(uint256 tokenId) external view returns (string)
```



*See {IERC721Metadata-tokenURI}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId | uint256 | undefined |

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined |

### totalSupply

```solidity
function totalSupply() external view returns (uint256 supply)
```

Returns the total amount of tokens

*From the ERC-721 enumerable standard*


#### Returns

| Name | Type | Description |
|---|---|---|
| supply | uint256 | undefined |

### transferAdministration

```solidity
function transferAdministration(address newAdmin) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newAdmin | address | undefined |

### transferFrom

```solidity
function transferFrom(address from, address to, uint256 tokenId) external nonpayable
```



*See {IERC721-transferFrom}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from | address | undefined |
| to | address | undefined |
| tokenId | uint256 | undefined |

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined |

### updateMintApprover

```solidity
function updateMintApprover(address newMintApprover) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newMintApprover | address | undefined |



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

### Approval

```solidity
event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)
```



*Emitted when `owner` enables `approved` to manage the `tokenId` token.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner `indexed` | address | undefined |
| approved `indexed` | address | undefined |
| tokenId `indexed` | uint256 | undefined |

### ApprovalForAll

```solidity
event ApprovalForAll(address indexed owner, address indexed operator, bool approved)
```



*Emitted when `owner` enables or disables (`approved`) `operator` to manage all of its assets.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner `indexed` | address | undefined |
| operator `indexed` | address | undefined |
| approved  | bool | undefined |

### BatchMinted

```solidity
event BatchMinted(uint256 indexed startTokenId, uint256 indexed endTokenId, address indexed artistId, string[] tokenCIDs)
```

Emitted when batch of NFTs is minted



#### Parameters

| Name | Type | Description |
|---|---|---|
| startTokenId `indexed` | uint256 | The tokenId of the first minted NFT in the batch |
| endTokenId `indexed` | uint256 | The tokenId of the last minted NFT in the batch |
| artistId `indexed` | address | The address of the creator |
| tokenCIDs  | string[] | Token CIDs |

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
event MintApproverUpdated(address indexed newMintApprover)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newMintApprover `indexed` | address | undefined |

### Minted

```solidity
event Minted(uint256 indexed tokenId, address indexed artistId, string indexed tokenCID)
```

Emitted when NFT is minted



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenId `indexed` | uint256 | The tokenId of the newly minted NFT. |
| artistId `indexed` | address | The address of the creator |
| tokenCID `indexed` | string | Token CID |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### RoyaltiesUpdated

```solidity
event RoyaltiesUpdated(address indexed recipient, uint256 indexed value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient `indexed` | address | undefined |
| value `indexed` | uint256 | undefined |

### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
```



*Emitted when `tokenId` token is transferred from `from` to `to`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| tokenId `indexed` | uint256 | undefined |



## Errors

### AddressNotContract

```solidity
error AddressNotContract()
```






### CallerNotCollectionFactory

```solidity
error CallerNotCollectionFactory()
```






### CallerNotTokenOwner

```solidity
error CallerNotTokenOwner()
```






### InvalidAdministratorAddress

```solidity
error InvalidAdministratorAddress()
```






### MintApproverCannotBeZeroAddress

```solidity
error MintApproverCannotBeZeroAddress()
```






### MintNotApproved

```solidity
error MintNotApproved()
```






### NonceUsed

```solidity
error NonceUsed()
```






### OnlyAdministrator

```solidity
error OnlyAdministrator()
```






### OnlyOwnerOrAdministrator

```solidity
error OnlyOwnerOrAdministrator()
```






### RoyaltiesTooHigh

```solidity
error RoyaltiesTooHigh()
```






### URIQueryForNonexistentToken

```solidity
error URIQueryForNonexistentToken()
```







