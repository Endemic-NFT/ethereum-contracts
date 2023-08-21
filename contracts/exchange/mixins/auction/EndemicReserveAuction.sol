// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import "./EndemicAuctionCore.sol";
import "../EndemicEIP712.sol";
import "../EndemicNonceManager.sol";

abstract contract EndemicReserveAuction is
    EndemicAuctionCore,
    EndemicEIP712,
    EndemicNonceManager
{
    using ECDSA for bytes32;

    address public approvedSettler;

    bytes32 private constant RESERVE_AUCTION_TYPEHASH =
        keccak256(
            "ReserveAuction(uint256 orderNonce,address nftContract,uint256 tokenId,address paymentErc20TokenAddress,uint256 price,bool isBid)"
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
        bool isBid;
    }

    struct AuctionFees {
        uint256 bidPrice;
        uint256 takerFee;
        uint256 takerCut;
        uint256 makerCut;
        uint256 totalCut;
        uint256 royaltieFee;
        address royaltiesRecipient;
    }

    function finalizeReserveAuction(
        ReserveAuction calldata auction,
        ReserveAuction calldata bid
    ) external onlySupportedERC20Payments(auction.paymentErc20TokenAddress) {
        if (msg.sender != approvedSettler) revert InvalidCaller();

        if (
            auction.isBid ||
            !bid.isBid ||
            auction.nftContract != bid.nftContract ||
            auction.tokenId != bid.tokenId ||
            auction.paymentErc20TokenAddress != bid.paymentErc20TokenAddress ||
            auction.signer == bid.signer
        ) revert InvalidConfiguration();

        _verifySignature(auction);
        _verifySignature(bid);

        AuctionFees memory data = _calculateAuctionFees(auction, bid);

        if (auction.price + data.takerCut > bid.price) {
            revert UnsufficientCurrencySupplied();
        }

        _invalidateNonce(auction.signer, auction.orderNonce);
        _invalidateNonce(bid.signer, bid.orderNonce);

        IERC721(auction.nftContract).transferFrom(
            auction.signer,
            bid.signer,
            auction.tokenId
        );

        _distributeFunds(
            data.bidPrice,
            data.makerCut,
            data.totalCut,
            data.royaltieFee,
            data.royaltiesRecipient,
            auction.signer,
            bid.signer,
            auction.paymentErc20TokenAddress
        );

        emit AuctionSuccessful(data.bidPrice, bid.signer, data.totalCut);
    }

    function _updateApprovedSettler(address _approvedSettler) internal {
        approvedSettler = _approvedSettler;
    }

    function _calculateAuctionFees(
        ReserveAuction calldata auction,
        ReserveAuction calldata bid
    ) internal view returns (AuctionFees memory data) {
        (data.takerFee, ) = paymentManager.getPaymentMethodFees(
            auction.paymentErc20TokenAddress
        );
        data.bidPrice = (bid.price * MAX_FEE) / (data.takerFee + MAX_FEE);
        data.takerCut = _calculateCut(data.takerFee, auction.price);

        (
            data.makerCut,
            ,
            data.royaltiesRecipient,
            data.royaltieFee,
            data.totalCut
        ) = _calculateFees(
            auction.paymentErc20TokenAddress,
            auction.nftContract,
            auction.tokenId,
            data.bidPrice
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
                        data.isBid
                    )
                )
            )
        );

        if (digest.recover(data.v, data.r, data.s) != data.signer) {
            revert InvalidSignature();
        }
    }
}
