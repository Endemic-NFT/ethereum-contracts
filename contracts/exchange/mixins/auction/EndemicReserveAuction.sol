// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "../EndemicExchangeCore.sol";
import "../EndemicFundsDistributor.sol";
import "../EndemicEIP712.sol";
import "../EndemicNonceManager.sol";

abstract contract EndemicReserveAuction is
    EndemicFundsDistributor,
    EndemicExchangeCore,
    EndemicEIP712,
    EndemicNonceManager
{
    using ECDSA for bytes32;

    bytes32 private constant RESERVE_AUCTION_TYPEHASH =
        keccak256(
            "ReserveAuction(uint256 orderNonce,address nftContract,uint256 tokenId,address paymentErc20TokenAddress,uint256 price,uint256 makerFeePercentage,uint256 takerFeePercentage,uint256 royaltiesPercentage,address royaltiesRecipient)"
        );

    bytes32 private constant RESERVE_AUCTION_BID_TYPEHASH =
        keccak256(
            "ReserveAuctionBid(uint256 orderNonce,address nftContract,uint256 tokenId,address paymentErc20TokenAddress,uint256 price,uint256 makerFeePercentage,uint256 takerFeePercentage,uint256 royaltiesPercentage,address royaltiesRecipient)"
        );

    bytes32 private constant RESERVE_AUCTION_APPROVAL_TYPEHASH =
        keccak256(
            "ReserveAuctionApproval(address auctionSigner,address bidSigner,uint256 auctionNonce,uint256 bidNonce,address nftContract,uint256 tokenId,address paymentErc20TokenAddress,uint256 auctionPrice,uint256 bidPrice,uint256 makerFeePercentage,uint256 takerFeePercentage,uint256 royaltiesPercentage,address royaltiesRecipient)"
        );

    struct ReserveAuction {
        address signer;
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 orderNonce;
        uint256 price;
    }

    struct AuctionInfo {
        address nftContract;
        uint256 tokenId;
        address paymentErc20TokenAddress;
        uint256 makerFeePercentage;
        uint256 takerFeePercentage;
        uint256 royaltiesPercentage;
        address royaltiesRecipient;
    }

    function finalizeReserveAuction(
        uint8 v,
        bytes32 r,
        bytes32 s,
        ReserveAuction calldata auction,
        ReserveAuction calldata bid,
        AuctionInfo calldata info
    ) external onlySupportedERC20Payments(info.paymentErc20TokenAddress) {
        if (auction.signer == bid.signer) {
            revert InvalidConfiguration();
        }

        _verifyApprovalSignature(v, r, s, auction, bid, info);
        _verifySignature(auction, info, RESERVE_AUCTION_TYPEHASH);
        _verifySignature(bid, info, RESERVE_AUCTION_BID_TYPEHASH);

        uint256 bidPrice = (bid.price * MAX_FEE) /
            (info.takerFeePercentage + MAX_FEE);

        if (auction.price > bidPrice) {
            revert UnsufficientCurrencySupplied();
        }

        (
            uint256 makerCut,
            ,
            uint256 royaltiesCut,
            uint256 totalCut
        ) = _calculateFees(
                bidPrice,
                info.makerFeePercentage,
                info.takerFeePercentage,
                info.royaltiesPercentage
            );

        _invalidateNonce(auction.signer, auction.orderNonce);
        _invalidateNonce(bid.signer, bid.orderNonce);

        IERC721(info.nftContract).transferFrom(
            auction.signer,
            bid.signer,
            info.tokenId
        );

        _distributeFunds(
            bidPrice,
            makerCut,
            totalCut,
            royaltiesCut,
            info.royaltiesRecipient,
            auction.signer,
            bid.signer,
            info.paymentErc20TokenAddress
        );

        emit AuctionSuccessful(
            info.nftContract,
            info.tokenId,
            bidPrice,
            auction.signer,
            bid.signer,
            totalCut,
            info.paymentErc20TokenAddress
        );
    }

    function _verifySignature(
        ReserveAuction calldata data,
        AuctionInfo calldata info,
        bytes32 typehash
    ) internal view {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _buildDomainSeparator(),
                keccak256(
                    abi.encode(
                        typehash,
                        data.orderNonce,
                        info.nftContract,
                        info.tokenId,
                        info.paymentErc20TokenAddress,
                        data.price,
                        info.makerFeePercentage,
                        info.takerFeePercentage,
                        info.royaltiesPercentage,
                        info.royaltiesRecipient
                    )
                )
            )
        );

        if (digest.recover(data.v, data.r, data.s) != data.signer) {
            revert InvalidSignature();
        }
    }

    function _verifyApprovalSignature(
        uint8 v,
        bytes32 r,
        bytes32 s,
        ReserveAuction calldata auction,
        ReserveAuction calldata bid,
        AuctionInfo calldata info
    ) internal view {
        bytes32 approvalHash = keccak256(
            abi.encode(
                RESERVE_AUCTION_APPROVAL_TYPEHASH,
                auction.signer,
                bid.signer,
                auction.orderNonce,
                bid.orderNonce,
                info.nftContract,
                info.tokenId,
                info.paymentErc20TokenAddress,
                auction.price,
                bid.price,
                info.makerFeePercentage,
                info.takerFeePercentage,
                info.royaltiesPercentage,
                info.royaltiesRecipient
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _buildDomainSeparator(), approvalHash)
        );

        if (digest.recover(v, r, s) != approvedSigner) {
            revert InvalidSignature();
        }
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[500] private __gap;
}
