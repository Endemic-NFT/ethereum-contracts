// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "../fee/interfaces/IFeeProvider.sol";
import "../royalties/interfaces/IRoyaltiesProvider.sol";

abstract contract CollectionBidCore is PausableUpgradeable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address;

    uint256 public MAX_BID_DURATION;
    uint256 public MIN_BID_DURATION;
    bytes4 public ERC721_Received;

    // Bid count by token address => bid counts
    mapping(address => uint256) public bidCounterByCollection;
    // Index of the bid at bidsByToken mapping by bid id => bid index
    mapping(bytes32 => uint256) public bidIndexByBidId;
    // Bid id by token address => bidder address => bidId
    mapping(address => mapping(address => bytes32))
        public bidIdByCollectionAndBidder;
    // Bid by token address => bid index => bid
    mapping(address => mapping(uint256 => Bid)) internal bidsByCollection;

    address feeClaimAddress;

    IFeeProvider feeProvider;
    IRoyaltiesProvider royaltiesProvider;

    struct Bid {
        bytes32 id;
        address nftContract;
        address bidder;
        uint256 price;
        uint256 priceWithFee;
        uint256 expiresAt;
    }

    event BidCreated(
        bytes32 id,
        address indexed nftContract,
        address indexed bidder,
        uint256 price,
        uint256 expiresAt
    );

    event BidAccepted(
        bytes32 id,
        address indexed nftContract,
        uint256 indexed tokenId,
        address bidder,
        address indexed seller,
        uint256 price
    );

    event BidCancelled(
        bytes32 id,
        address indexed nftContract,
        address indexed bidder
    );

    function __CollectionBidCore___init_unchained(
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
    }

    function placeBid(address nftContract, uint256 duration)
        external
        payable
        whenNotPaused
    {
        require(msg.value > 0, "Invalid value sent");

        require(duration >= MIN_BID_DURATION, "Bid duration too short");
        require(duration <= MAX_BID_DURATION, "Bid duration too long");

        uint256 expiresAt = block.timestamp.add(duration);

        bytes32 bidId = keccak256(
            abi.encodePacked(
                block.timestamp,
                _msgSender(),
                nftContract,
                msg.value,
                duration
            )
        );

        uint256 takerFee = feeProvider.getTakerFee();

        uint256 priceWithFee = msg.value;
        uint256 price = msg.value.mul(10000).div(takerFee.add(10000));

        uint256 bidIndex;

        require(
            !_bidderHasBid(nftContract, _msgSender()),
            "Bid already exists"
        );

        bidIndex = bidCounterByCollection[nftContract];
        bidCounterByCollection[nftContract]++;

        bidIdByCollectionAndBidder[nftContract][_msgSender()] = bidId;
        bidIndexByBidId[bidId] = bidIndex;

        bidsByCollection[nftContract][bidIndex] = Bid({
            id: bidId,
            bidder: _msgSender(),
            nftContract: nftContract,
            price: price,
            priceWithFee: priceWithFee,
            expiresAt: expiresAt
        });

        emit BidCreated(bidId, nftContract, _msgSender(), price, expiresAt);
    }

    function getBidByBidder(address nftContract, address _bidder)
        public
        view
        returns (
            uint256 bidIndex,
            bytes32 bidId,
            address bidder,
            uint256 price,
            uint256 priceWithFee,
            uint256 expiresAt
        )
    {
        bidId = bidIdByCollectionAndBidder[nftContract][_bidder];
        bidIndex = bidIndexByBidId[bidId];
        (bidId, bidder, price, priceWithFee, expiresAt) = getBidByCollection(
            nftContract,
            bidIndex
        );
        if (_bidder != bidder) {
            revert("Bidder has not an active bid for this collection");
        }
    }

    function getBidByCollection(address nftContract, uint256 index)
        public
        view
        returns (
            bytes32,
            address,
            uint256,
            uint256,
            uint256
        )
    {
        Bid memory bid = _getBid(nftContract, index);
        return (bid.id, bid.bidder, bid.price, bid.priceWithFee, bid.expiresAt);
    }

    function cancelBid(address nftContract) external whenNotPaused {
        (
            uint256 bidIndex,
            bytes32 bidId,
            ,
            ,
            uint256 priceWithFee,

        ) = getBidByBidder(nftContract, _msgSender());

        _cancelBid(bidIndex, bidId, nftContract, _msgSender(), priceWithFee);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function onERC721Received(
        address _from,
        address, /*_to*/
        uint256 _tokenId,
        bytes memory _data
    ) public whenNotPaused returns (bytes4) {
        bytes32 bidId = _bytesToBytes32(_data);
        uint256 bidIndex = bidIndexByBidId[bidId];

        Bid memory bid = _getBid(_msgSender(), bidIndex);

        require(
            bid.id == bidId && bid.expiresAt >= block.timestamp,
            "Invalid bid"
        );

        address bidder = bid.bidder;
        uint256 price = bid.price;
        uint256 priceWithFee = bid.priceWithFee;

        _removeBid(bidIndex, bidId, _msgSender(), bidder);

        uint256 totalCut = _calculateCut(
            _msgSender(),
            _tokenId,
            _from,
            price,
            priceWithFee
        );

        (address royaltiesRecipient, uint256 royaltiesCut) = royaltiesProvider
            .calculateRoyaltiesAndGetRecipient(_msgSender(), _tokenId, price);

        // sale happened
        feeProvider.onSale(_msgSender(), _tokenId);

        // Transfer token to bidder
        IERC721(_msgSender()).safeTransferFrom(address(this), bidder, _tokenId);

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
            _from,
            priceWithFee.sub(totalCut).sub(royaltiesCut)
        );

        emit BidAccepted(bidId, _msgSender(), _tokenId, bidder, _from, price);

        return ERC721_Received;
    }

    function _calculateCut(
        address _tokenAddress,
        uint256 _tokenId,
        address _seller,
        uint256 price,
        uint256 priceWithFee
    ) internal view returns (uint256) {
        uint256 makerFee = feeProvider.calculateMakerFee(
            _seller,
            _tokenAddress,
            _tokenId,
            price
        );

        uint256 makerCut = price.mul(makerFee).div(10000);
        uint256 takerCut = priceWithFee.sub(price);

        return makerCut.add(takerCut);
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
        address[] memory _bidders
    ) public {
        uint256 loopLength = _tokenAddresses.length;

        require(
            loopLength == _bidders.length,
            "Parameter arrays should have the same length"
        );

        for (uint256 i = 0; i < loopLength; i++) {
            _removeExpiredBid(_tokenAddresses[i], _bidders[i]);
        }
    }

    function _removeExpiredBid(address nftContract, address bidder) internal {
        (
            uint256 bidIndex,
            bytes32 bidId,
            ,
            ,
            uint256 priceWithFee,
            uint256 expiresAt
        ) = getBidByBidder(nftContract, bidder);

        require(
            expiresAt < block.timestamp,
            "The bid to remove should be expired"
        );

        _cancelBid(bidIndex, bidId, nftContract, bidder, priceWithFee);
    }

    function _cancelBid(
        uint256 bidIndex,
        bytes32 bidId,
        address nftContract,
        address bidder,
        uint256 priceWithFee
    ) internal {
        _removeBid(bidIndex, bidId, nftContract, bidder);

        (bool success, ) = payable(bidder).call{value: priceWithFee}("");
        require(success, "Refund failed.");

        emit BidCancelled(bidId, nftContract, bidder);
    }

    function _removeBid(
        uint256 bidIndex,
        bytes32 bidId,
        address nftContract,
        address bidder
    ) internal {
        // Delete bid references
        delete bidIndexByBidId[bidId];
        delete bidIdByCollectionAndBidder[nftContract][bidder];

        // Check if the bid is at the end of the mapping
        uint256 lastBidIndex = bidCounterByCollection[nftContract].sub(1);
        if (lastBidIndex != bidIndex) {
            // Move last bid to the removed place
            Bid storage lastBid = bidsByCollection[nftContract][lastBidIndex];
            bidsByCollection[nftContract][bidIndex] = lastBid;
            bidIndexByBidId[lastBid.id] = bidIndex;
        }

        delete bidsByCollection[nftContract][lastBidIndex];
        bidCounterByCollection[nftContract]--;
    }

    function _getBid(address nftContract, uint256 index)
        internal
        view
        returns (Bid memory)
    {
        require(index < bidCounterByCollection[nftContract], "Invalid index");
        return bidsByCollection[nftContract][index];
    }

    function _bidderHasBid(address nftContract, address bidder)
        internal
        view
        returns (bool)
    {
        bytes32 bidId = bidIdByCollectionAndBidder[nftContract][bidder];
        uint256 bidIndex = bidIndexByBidId[bidId];

        if (bidIndex < bidCounterByCollection[nftContract]) {
            Bid memory bid = bidsByCollection[nftContract][bidIndex];
            return bid.bidder == bidder;
        }
        return false;
    }

    function _bytesToBytes32(bytes memory data)
        internal
        pure
        returns (bytes32)
    {
        require(data.length == 32, "The data should be 32 bytes length");

        bytes32 bidId;
        assembly {
            bidId := mload(add(data, 0x20))
        }

        return bidId;
    }

    uint256[50] private __gap;
}
