// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./EndemicExchangeCore.sol";

error PrivateSaleExpired();
error InvalidSignature();
error InvalidPrivateSale();
error PriceNotMatchWithProvidedEther();

contract EndemicPrivateSale is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EndemicExchangeCore
{
    using AddressUpgradeable for address;

    bytes32 private constant PRIVATE_SALE_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "PrivateSale(address nftContract,uint256 tokenId,address seller,address buyer,uint256 price,uint256 deadline)"
        );

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"
        );

    bytes32 private constant SALT_HASH = keccak256("Endemic Exchange Salt");

    string private constant DOMAIN_NAME = "Endemic Exchange";

    bytes32 public DOMAIN_SEPARATOR;

    // Maps nftContract -> tokenId -> seller -> buyer -> invalidated.
    mapping(address => mapping(uint256 => mapping(address => mapping(address => bool))))
        private privateSaleInvalidated;

    event PrivateSaleSuccess(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price,
        uint256 totalFees
    );

    function __EndemicPrivateSale___init_unchained() internal {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes("1")),
                block.chainid,
                address(this),
                SALT_HASH
            )
        );
    }

    function buyFromPrivateSale(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external payable nonReentrant {
        if (deadline < block.timestamp) {
            revert PrivateSaleExpired();
        }

        if (msg.value < price) {
            revert PriceNotMatchWithProvidedEther();
        }

        address payable seller = payable(IERC721(nftContract).ownerOf(tokenId));
        address buyer = _msgSender();

        if (privateSaleInvalidated[nftContract][tokenId][seller][buyer]) {
            revert InvalidPrivateSale();
        }

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        PRIVATE_SALE_TYPEHASH,
                        nftContract,
                        tokenId,
                        seller,
                        buyer,
                        price,
                        deadline
                    )
                )
            )
        );

        if (ecrecover(digest, v, r, s) != seller) {
            revert InvalidSignature();
        }

        _finalizePrivateSale(nftContract, tokenId, buyer, seller, price);
    }

    function _finalizePrivateSale(
        address nftContract,
        uint256 tokenId,
        address buyer,
        address payable seller,
        uint256 price
    ) internal {
        privateSaleInvalidated[nftContract][tokenId][seller][buyer] = true;

        (
            uint256 makerCut,
            ,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(nftContract, tokenId, price);

        IERC721(nftContract).transferFrom(seller, buyer, tokenId);

        _distributeFunds(
            price,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            seller
        );

        emit PrivateSaleSuccess(
            nftContract,
            tokenId,
            seller,
            buyer,
            price,
            totalCut
        );
    }

    uint256[1000] private __gap;
}
