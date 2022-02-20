// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";

import "../erc-721/interfaces/IERC2981Royalties.sol";

error InvalidOwner();

abstract contract RoyaltiesProviderCore is OwnableUpgradeable {
    bytes4 public constant ERC2981_INTERFACE_ID = 0x2a55205a;

    mapping(address => mapping(uint256 => Royalties)) royaltiesPerTokenId;
    mapping(address => Royalties) royaltiesPerCollection;

    event RoyaltiesSetForToken(
        address indexed nftContract,
        uint256 indexed tokenId,
        address feeRecipient,
        uint256 fee
    );

    event RoyaltiesSetForCollection(
        address indexed nftContract,
        address feeRecipient,
        uint256 fee
    );

    struct Royalties {
        address account;
        uint256 fee;
    }

    function calculateRoyaltiesAndGetRecipient(
        address nftContract,
        uint256 tokenId,
        uint256 amount
    ) external view returns (address, uint256) {
        Royalties memory royaltiesForToken = royaltiesPerTokenId[nftContract][
            tokenId
        ];
        if (
            royaltiesForToken.account != address(0) && royaltiesForToken.fee > 0
        ) {
            return (
                royaltiesForToken.account,
                calculateFeeForAmount(amount, royaltiesForToken.fee)
            );
        }

        Royalties memory royaltiesForCollection = royaltiesPerCollection[
            nftContract
        ];
        if (
            royaltiesForCollection.account != address(0) &&
            royaltiesForCollection.fee > 0
        ) {
            return (
                royaltiesForCollection.account,
                calculateFeeForAmount(amount, royaltiesForCollection.fee)
            );
        }

        if (IERC165(nftContract).supportsInterface(ERC2981_INTERFACE_ID)) {
            return IERC2981Royalties(nftContract).royaltyInfo(tokenId, amount);
        }

        return (address(0), 0);
    }

    function setRoyaltiesForToken(
        address nftContract,
        uint256 tokenId,
        address feeRecipient,
        uint256 fee
    ) external {
        require(fee <= 5000, "Royalties must be up to 50%");

        checkOwner(nftContract);

        royaltiesPerTokenId[nftContract][tokenId] = Royalties(
            feeRecipient,
            fee
        );

        emit RoyaltiesSetForToken(nftContract, tokenId, feeRecipient, fee);
    }

    function setRoyaltiesForCollection(
        address nftContract,
        address feeRecipient,
        uint256 fee
    ) external {
        require(fee <= 5000, "Royalties must be up to 50%");

        checkOwner(nftContract);

        royaltiesPerCollection[nftContract] = Royalties(feeRecipient, fee);

        emit RoyaltiesSetForCollection(nftContract, feeRecipient, fee);
    }

    function checkOwner(address nftContract) internal view {
        if (
            (owner() != _msgSender()) &&
            (OwnableUpgradeable(nftContract).owner() != _msgSender())
        ) {
            revert InvalidOwner();
        }
    }

    function calculateFeeForAmount(uint256 amount, uint256 fee)
        internal
        pure
        returns (uint256)
    {
        return (amount * (fee)) / 10000;
    }

    uint256[50] private __gap;
}
