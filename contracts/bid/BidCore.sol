// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../fee/interfaces/IFeeProvider.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";

error InvalidValueSent();
error InvalidTokenOwner();
error DurationTooShort();
error DurationTooLong();
error BidExists();
error NoActiveBid();

abstract contract BidCore is
    PausableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using AddressUpgradeable for address;

    uint256 public MAX_BID_DURATION;
    uint256 public MIN_BID_DURATION;
    bytes4 public ERC721_Received;

    uint256 private nextBidId;

    mapping(uint256 => Bid) internal bidsById;

    // Bid by token address => token id => bidder => bidId
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        internal bidIdsByBidder;

    address feeClaimAddress;

    IFeeProvider feeProvider;
    IRoyaltiesProvider royaltiesProvider;

    struct Bid {
        uint256 id;
        address nftContract;
        uint256 tokenId;
        address bidder;
        uint256 price;
        uint256 priceWithFee;
        uint256 expiresAt;
    }

    event BidCreated(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 price,
        uint256 expiresAt
    );

    event BidAccepted(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address bidder,
        address indexed seller,
        uint256 price
    );

    event BidCancelled(
        uint256 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed bidder
    );

    function __BidCore___init_unchained(
        address _feeProvider,
        address _royaltiesProvider,
        address _feeClaimAddress
    ) internal initializer {
        feeProvider = IFeeProvider(_feeProvider);
        royaltiesProvider = IRoyaltiesProvider(_royaltiesProvider);
        feeClaimAddress = _feeClaimAddress;

        ERC721_Received = 0x150b7a02;
        MAX_BID_DURATION = 182 days;
        MIN_BID_DURATION = 1 minutes;

        nextBidId = 1;
    }

    function placeBid(
        address nftContract,
        uint256 tokenId,
        uint256 duration
    ) external payable whenNotPaused nonReentrant {
        if (msg.value <= 0) {
            revert InvalidValueSent();
        }

        IERC721 nft = IERC721(nftContract);
        address nftOwner = nft.ownerOf(tokenId);

        if (nftOwner == address(0) || nftOwner == _msgSender()) {
            revert InvalidTokenOwner();
        }

        if (duration < MIN_BID_DURATION) {
            revert DurationTooShort();
        }

        if (duration > MAX_BID_DURATION) {
            revert DurationTooLong();
        }

        uint256 bidId = nextBidId++;
        uint256 takerFee = feeProvider.getTakerFee();

        if (_bidderHasBid(nftContract, tokenId, _msgSender())) {
            revert BidExists();
        }

        uint256 price = (msg.value * (10000)) / (takerFee + 10000);
        uint256 expiresAt = block.timestamp + duration;

        bidIdsByBidder[nftContract][tokenId][_msgSender()] = bidId;
        bidsById[bidId] = Bid({
            id: bidId,
            bidder: _msgSender(),
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            priceWithFee: msg.value,
            expiresAt: expiresAt
        });

        emit BidCreated(
            bidId,
            nftContract,
            tokenId,
            _msgSender(),
            price,
            expiresAt
        );
    }

    function cancelBid(uint256 bidId) external whenNotPaused nonReentrant {
        Bid memory bid = bidsById[bidId];
        _cancelBid(bid);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function acceptBid(uint256 bidId) external whenNotPaused nonReentrant {
        Bid memory bid = bidsById[bidId];

        require(
            bid.id == bidId && bid.expiresAt >= block.timestamp,
            "Invalid bid"
        );

        address bidder = bid.bidder;
        uint256 tokenId = bid.tokenId;
        address contractId = bid.nftContract;
        uint256 price = bid.price;
        uint256 priceWithFee = bid.priceWithFee;

        delete bidsById[bidId];
        delete bidIdsByBidder[contractId][tokenId][bidder];

        uint256 totalCut = _calculateCut(
            contractId,
            tokenId,
            _msgSender(),
            price,
            priceWithFee
        );

        (address royaltiesRecipient, uint256 royaltiesCut) = royaltiesProvider
            .calculateRoyaltiesAndGetRecipient(contractId, tokenId, price);

        // sale happened
        feeProvider.onSale(contractId, tokenId);

        // Transfer token to bidder
        IERC721(contractId).safeTransferFrom(_msgSender(), bidder, tokenId);

        // transfer fees
        if (totalCut > 0) {
            _transferFees(totalCut);
        }

        // transfer rolayties
        if (royaltiesCut > 0) {
            _transferRoyalties(royaltiesRecipient, royaltiesCut);
        }

        // Transfer ETH from bidder to seller
        _transferFundsToSeller(
            _msgSender(),
            priceWithFee - totalCut - royaltiesCut
        );

        emit BidAccepted(
            bidId,
            contractId,
            tokenId,
            bidder,
            _msgSender(),
            price
        );
    }

    function getBid(uint256 bidId) external view returns (Bid memory) {
        Bid memory bid = bidsById[bidId];
        if (bid.id != bidId) {
            revert NoActiveBid();
        }
        return bid;
    }

    function _calculateCut(
        address _tokenAddress,
        uint256 _tokenId,
        address _seller,
        uint256 price,
        uint256 priceWithFee
    ) internal view returns (uint256) {
        uint256 makerCut = feeProvider.calculateMakerFee(
            _seller,
            _tokenAddress,
            _tokenId,
            price
        );
        uint256 takerCut = priceWithFee - price;

        return makerCut + takerCut;
    }

    function _transferFees(uint256 _totalCut) internal {
        (bool feeSuccess, ) = payable(feeClaimAddress).call{value: _totalCut}(
            ""
        );
        require(feeSuccess, "Fee Transfer failed.");
    }

    function _transferRoyalties(
        address _royaltiesRecipient,
        uint256 _royaltiesCut
    ) internal {
        (bool royaltiesSuccess, ) = payable(_royaltiesRecipient).call{
            value: _royaltiesCut
        }("");
        require(royaltiesSuccess, "Royalties Transfer failed.");
    }

    function _transferFundsToSeller(address _seller, uint256 _total) internal {
        (bool success, ) = payable(_seller).call{value: _total}("");
        require(success, "Transfer failed.");
    }

    function removeExpiredBids(
        address[] memory _tokenAddresses,
        uint256[] memory _tokenIds,
        address[] memory _bidders
    ) public onlyOwner nonReentrant {
        uint256 loopLength = _tokenAddresses.length;

        require(
            loopLength == _tokenIds.length,
            "Parameter arrays should have the same length"
        );
        require(
            loopLength == _bidders.length,
            "Parameter arrays should have the same length"
        );

        for (uint256 i = 0; i < loopLength; i++) {
            _removeExpiredBid(_tokenAddresses[i], _tokenIds[i], _bidders[i]);
        }
    }

    function _removeExpiredBid(
        address nftContract,
        uint256 tokenId,
        address bidder
    ) internal {
        uint256 bidId = bidIdsByBidder[nftContract][tokenId][bidder];
        Bid memory bid = bidsById[bidId];

        require(
            bid.expiresAt < block.timestamp,
            "The bid to remove should be expired"
        );

        _cancelBid(bid);
    }

    function _cancelBid(Bid memory bid) internal {
        delete bidsById[bid.id];
        delete bidIdsByBidder[bid.nftContract][bid.tokenId][bid.bidder];

        (bool success, ) = payable(bid.bidder).call{value: bid.priceWithFee}(
            ""
        );
        require(success, "Refund failed.");

        emit BidCancelled(bid.id, bid.nftContract, bid.tokenId, bid.bidder);
    }

    function _bidderHasBid(
        address nftContract,
        uint256 tokenId,
        address bidder
    ) internal view returns (bool) {
        uint256 bidId = bidIdsByBidder[nftContract][tokenId][bidder];
        Bid memory bid = bidsById[bidId];
        return bid.bidder == bidder;
    }

    uint256[50] private __gap;
}
