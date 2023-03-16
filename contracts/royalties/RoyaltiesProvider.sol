// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";

import "../erc-721/interfaces/IERC2981Royalties.sol";

error InvalidOwner();

contract RoyaltiesProvider is OwnableUpgradeable {
    bytes4 public constant ERC2981_INTERFACE_ID = 0x2a55205a;

    // (10,000 = 100%)
    uint256 public royaltyFeeLimit;

    mapping(address => mapping(uint256 => Royalties)) royaltiesPerTokenId;
    mapping(address => Royalties) royaltiesPerCollection;

    event NewRoyaltiesLimit(uint256 limit);

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

    error FeeOverTheLimit();
    error LimitTooHigh();

    struct Royalties {
        address account;
        uint256 fee;
    }

    /// @param royaltiesLimit - up to 9500
    function __RoyaltiesProvider_init(uint256 royaltiesLimit)
        external
        initializer
    {
        __Context_init_unchained();
        __Ownable_init_unchained();

        setRoyaltiesLimit(royaltiesLimit);
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
        if (fee > royaltyFeeLimit) {
            revert FeeOverTheLimit();
        }

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
        if (fee > royaltyFeeLimit) {
            revert FeeOverTheLimit();
        }

        checkOwner(nftContract);

        royaltiesPerCollection[nftContract] = Royalties(feeRecipient, fee);

        emit RoyaltiesSetForCollection(nftContract, feeRecipient, fee);
    }

    function setRoyaltiesLimit(uint256 newLimit) public onlyOwner {
        if (newLimit > 9500) {
            revert LimitTooHigh();
        }
        royaltyFeeLimit = newLimit;
        emit NewRoyaltiesLimit(newLimit);
    }

    function checkOwner(address nftContract) internal view {
        if (
            (owner() != msg.sender) &&
            (OwnableUpgradeable(nftContract).owner() != msg.sender)
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
}
