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
            "ReserveAuction(uint256 orderNonce,address nftContract,uint256 tokenId,address paymentErc20TokenAddress,uint256 price,uint256 makerFeePercentage,uint256 takerFeePercentage,uint256 royaltiesPercentage,address royaltiesRecipient,bool isBid)"
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
        address nftContract;
        uint256 tokenId;
        address paymentErc20TokenAddress;
        uint256 price;
        uint256 makerFeePercentage;
        uint256 takerFeePercentage;
        uint256 royaltiesPercentage;
        address royaltiesRecipient;
        bool isBid;
    }

    function finalizeReserveAuction(
        uint8 v,
        bytes32 r,
        bytes32 s,
        ReserveAuction calldata auction,
        ReserveAuction calldata bid
    ) external onlySupportedERC20Payments(auction.paymentErc20TokenAddress) {
        if (
            auction.isBid ||
            !bid.isBid ||
            auction.nftContract != bid.nftContract ||
            auction.tokenId != bid.tokenId ||
            auction.paymentErc20TokenAddress != bid.paymentErc20TokenAddress ||
            auction.signer == bid.signer ||
            auction.makerFeePercentage != bid.makerFeePercentage ||
            auction.takerFeePercentage != bid.takerFeePercentage ||
            auction.royaltiesPercentage != bid.royaltiesPercentage ||
            auction.royaltiesRecipient != bid.royaltiesRecipient
        ) revert InvalidConfiguration();

        _verifyApprovalSignature(v, r, s, auction, bid);
        _verifySignature(auction);
        _verifySignature(bid);

        uint256 bidPrice = (bid.price * MAX_FEE) /
            (bid.takerFeePercentage + MAX_FEE);

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
                auction.makerFeePercentage,
                auction.takerFeePercentage,
                auction.royaltiesPercentage
            );

        _invalidateNonce(auction.signer, auction.orderNonce);
        _invalidateNonce(bid.signer, bid.orderNonce);

        IERC721(auction.nftContract).transferFrom(
            auction.signer,
            bid.signer,
            auction.tokenId
        );

        _distributeFunds(
            bidPrice,
            makerCut,
            totalCut,
            royaltiesCut,
            auction.royaltiesRecipient,
            auction.signer,
            bid.signer,
            auction.paymentErc20TokenAddress
        );

        emit AuctionSuccessful(
            auction.nftContract,
            auction.tokenId,
            bidPrice,
            auction.signer,
            bid.signer,
            totalCut,
            auction.paymentErc20TokenAddress
        );
    }

    function _verifySignature(ReserveAuction calldata data) internal view {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _buildDomainSeparator(),
                keccak256(
                    abi.encode(
                        RESERVE_AUCTION_TYPEHASH,
                        data.orderNonce,
                        data.nftContract,
                        data.tokenId,
                        data.paymentErc20TokenAddress,
                        data.price,
                        data.makerFeePercentage,
                        data.takerFeePercentage,
                        data.royaltiesPercentage,
                        data.royaltiesRecipient,
                        data.isBid
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
        ReserveAuction calldata bid
    ) internal view {
        bytes32 approvalHash = keccak256(
            abi.encode(
                RESERVE_AUCTION_APPROVAL_TYPEHASH,
                auction.signer,
                bid.signer,
                auction.orderNonce,
                bid.orderNonce,
                auction.nftContract,
                auction.tokenId,
                auction.paymentErc20TokenAddress,
                auction.price,
                bid.price,
                auction.makerFeePercentage,
                auction.takerFeePercentage,
                auction.royaltiesPercentage,
                auction.royaltiesRecipient
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
