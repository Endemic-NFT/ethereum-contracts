// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./EndemicFundsDistributor.sol";
import "./EndemicExchangeCore.sol";
import "./EndemicEIP712.sol";
import "./EndemicNonceManager.sol";

error SignedSaleExpired();
error InvalidCaller();

abstract contract EndemicSignedSale2 is
    ReentrancyGuardUpgradeable,
    EndemicFundsDistributor,
    EndemicExchangeCore,
    EndemicEIP712,
    EndemicNonceManager
{
    bytes32 private constant SIGNED_SALE_TYPEHASH =
        keccak256(
            "SignedSale(uint256 orderNonce,address nftContract,uint256 tokenId,address paymentErc20TokenAddress,int256 price,address buyer,uint256 expiresAt)"
        );

    struct SignedSale {
        address seller;
        uint256 orderNonce;
        address nftContract;
        uint256 tokenId;
        address paymentErc20TokenAddress;
        uint256 price;
        address buyer;
        uint256 expiresAt;
    }

    event SignedSaleSuccess(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price,
        uint256 totalFees,
        address paymentErc20TokenAddress
    );

    function buyFromSignedSale(
        uint8 v,
        bytes32 r,
        bytes32 s,
        SignedSale calldata sale
    ) external payable nonReentrant {
        if (sale.expiresAt < block.timestamp) {
            revert SignedSaleExpired();
        }

        if (sale.buyer != address(0) && sale.buyer != msg.sender) {
            revert InvalidCaller();
        }

        _verifySignature(v, r, s, sale);

        uint256 takerCut = _calculateTakerCut(
            sale.paymentErc20TokenAddress,
            sale.price
        );

        _requireSupportedPaymentMethod(sale.paymentErc20TokenAddress);
        _requireSufficientCurrencySupplied(
            sale.price + takerCut,
            sale.paymentErc20TokenAddress,
            msg.sender
        );

        _invalidateNonce(sale.seller, sale.orderNonce);

        _finalizeSignedSale(
            sale.nftContract,
            sale.tokenId,
            sale.paymentErc20TokenAddress,
            sale.seller,
            sale.price
        );
    }

    function _finalizeSignedSale(
        address nftContract,
        uint256 tokenId,
        address paymentErc20TokenAddress,
        address seller,
        uint256 price
    ) internal {
        (
            uint256 makerCut,
            ,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        ) = _calculateFees(
                paymentErc20TokenAddress,
                nftContract,
                tokenId,
                price
            );

        IERC721(nftContract).transferFrom(seller, msg.sender, tokenId);

        _distributeFunds(
            price,
            makerCut,
            totalCut,
            royaltieFee,
            royaltiesRecipient,
            seller,
            msg.sender,
            paymentErc20TokenAddress
        );

        emit SignedSaleSuccess(
            nftContract,
            tokenId,
            seller,
            msg.sender,
            price,
            totalCut,
            paymentErc20TokenAddress
        );
    }

    function _verifySignature(
        uint8 v,
        bytes32 r,
        bytes32 s,
        SignedSale calldata sale
    ) internal view {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _buildDomainSeparator(),
                keccak256(
                    abi.encode(
                        SIGNED_SALE_TYPEHASH,
                        sale.orderNonce,
                        sale.nftContract,
                        sale.tokenId,
                        sale.paymentErc20TokenAddress,
                        sale.price,
                        sale.buyer,
                        sale.expiresAt
                    )
                )
            )
        );

        if (ecrecover(digest, v, r, s) != sale.seller) {
            revert InvalidSignature();
        }
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
