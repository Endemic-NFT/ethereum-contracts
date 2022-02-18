// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

abstract contract RoyaltiesProviderCore is OwnableUpgradeable {
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

    function getRoyalties(address nftContract, uint256 tokenId)
        external
        view
        returns (address account, uint256 fee)
    {
        Royalties memory royaltiesForToken = royaltiesPerTokenId[nftContract][
            tokenId
        ];
        if (royaltiesForToken.account != address(0)) {
            return (royaltiesForToken.account, royaltiesForToken.fee);
        }

        Royalties memory royaltiesForCollection = royaltiesPerCollection[
            nftContract
        ];
        return (royaltiesForCollection.account, royaltiesForCollection.fee);
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
            revert("Token owner not found");
        }
    }

    uint256[50] private __gap;
}
