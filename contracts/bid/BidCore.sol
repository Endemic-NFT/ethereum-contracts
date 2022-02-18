// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "../erc-721/IEndemicERC721.sol";
import "../fee/IFeeProvider.sol";
import "../royalties/IRoyaltiesProvider.sol";

abstract contract BidCore is PausableUpgradeable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address;

    uint256 public MAX_BID_DURATION;
    uint256 public MIN_BID_DURATION;
    bytes4 public ERC721_Received;

    // Bid count by token address => token id => bid counts
    mapping(address => mapping(uint256 => uint256)) public bidCounterByToken;
    // Index of the bid at bidsByToken mapping by bid id => bid index
    mapping(bytes32 => uint256) public bidIndexByBidId;
    // Bid id by token address => token id => bidder address => bidId
    mapping(address => mapping(uint256 => mapping(address => bytes32)))
        public bidIdByTokenAndBidder;
    // Bid by token address => token id => bid index => bid
    mapping(address => mapping(uint256 => mapping(uint256 => Bid)))
        internal bidsByToken;

    address feeClaimAddress;

    IFeeProvider feeProvider;
    IRoyaltiesProvider royaltiesProvider;

    struct Bid {
        bytes32 id;
        address nftContract;
        uint256 tokenId;
        address bidder;
        uint256 price;
        uint256 priceWithFee;
        uint256 expiresAt;
    }

    event BidCreated(
        bytes32 id,
        address indexed nftContract,
        uint256 indexed tokenId,
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
        uint256 indexed tokenId,
        address indexed bidder
    );

    function __BidCore___init_unchained(
        IFeeProvider _feeProvider,
        IRoyaltiesProvider _royaltiesProvider,
        address _feeClaimAddress
    ) internal initializer {
        feeProvider = _feeProvider;
        royaltiesProvider = _royaltiesProvider;
        feeClaimAddress = _feeClaimAddress;

        ERC721_Received = 0x150b7a02;
        MAX_BID_DURATION = 182 days;
        MIN_BID_DURATION = 1 minutes;
    }

    function placeBid(
        address nftContract,
        uint256 tokenId,
        uint256 duration
    ) external payable whenNotPaused {
        require(msg.value > 0, "Invalid value sent");

        IERC721 nft = IERC721(nftContract);
        address nftOwner = nft.ownerOf(tokenId);

        require(
            nftOwner != address(0) && nftOwner != _msgSender(),
            "Token is burned or owned by the sender"
        );

        require(duration >= MIN_BID_DURATION, "Bid duration too short");
        require(duration <= MAX_BID_DURATION, "Bid duration too long");

        uint256 expiresAt = block.timestamp.add(duration);

        bytes32 bidId = keccak256(
            abi.encodePacked(
                block.timestamp,
                _msgSender(),
                nftContract,
                tokenId,
                msg.value,
                duration
            )
        );

        uint256 takerFee = feeProvider.getTakerFee(_msgSender());

        uint256 priceWithFee = msg.value;
        uint256 price = msg.value.mul(10000).div(takerFee.add(10000));

        uint256 bidIndex;

        require(
            !_bidderHasBid(nftContract, tokenId, _msgSender()),
            "Bid already exists"
        );

        bidIndex = bidCounterByToken[nftContract][tokenId];
        bidCounterByToken[nftContract][tokenId]++;

        bidsByToken[nftContract][tokenId][bidIndex] = Bid({
            id: bidId,
            bidder: _msgSender(),
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            priceWithFee: priceWithFee,
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

    function getBidByBidder(
        address nftContract,
        uint256 tokenId,
        address _bidder
    )
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
        bidId = bidIdByTokenAndBidder[nftContract][tokenId][_bidder];
        bidIndex = bidIndexByBidId[bidId];
        (bidId, bidder, price, priceWithFee, expiresAt) = getBidByToken(
            nftContract,
            tokenId,
            bidIndex
        );
        if (_bidder != bidder) {
            revert("Bidder has not an active bid for this token");
        }
    }

    function getBidByToken(
        address nftContract,
        uint256 tokenId,
        uint256 index
    )
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
        Bid memory bid = _getBid(nftContract, tokenId, index);
        return (bid.id, bid.bidder, bid.price, bid.priceWithFee, bid.expiresAt);
    }

    function cancelBid(address nftContract, uint256 tokenId)
        external
        whenNotPaused
    {
        (
            uint256 bidIndex,
            bytes32 bidId,
            ,
            ,
            uint256 priceWithFee,

        ) = getBidByBidder(nftContract, tokenId, _msgSender());

        _cancelBid(
            bidIndex,
            bidId,
            nftContract,
            tokenId,
            _msgSender(),
            priceWithFee
        );
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

        Bid memory bid = _getBid(_msgSender(), _tokenId, bidIndex);

        require(
            bid.id == bidId && bid.expiresAt >= block.timestamp,
            "Invalid bid"
        );

        address bidder = bid.bidder;
        uint256 price = bid.price;
        uint256 priceWithFee = bid.priceWithFee;

        delete bidsByToken[_msgSender()][_tokenId][bidIndex];
        delete bidIndexByBidId[bidId];
        delete bidIdByTokenAndBidder[_msgSender()][_tokenId][bidder];

        delete bidCounterByToken[_msgSender()][_tokenId];

        uint256 totalCut = _calculateCut(
            _msgSender(),
            _tokenId,
            _from,
            price,
            priceWithFee
        );

        (
            address royaltiesRecipient,
            uint256 royaltiesCut
        ) = _calculateRoyalties(_msgSender(), _tokenId, price);

        // sale happened
        feeProvider.onInitialSale(_msgSender(), _tokenId);

        // Transfer token to bidder
        IEndemicERC721(_msgSender()).safeTransferFrom(
            address(this),
            bidder,
            _tokenId
        );

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
        uint256 makerFee = feeProvider.getMakerFee(
            _seller,
            _tokenAddress,
            _tokenId
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

    function _calculateRoyalties(
        address _tokenAddress,
        uint256 _tokenId,
        uint256 price
    ) internal view returns (address recipient, uint256 royaltiesCut) {
        (address account, uint256 royaltiesFee) = royaltiesProvider
            .getRoyalties(_tokenAddress, _tokenId);

        return (account, price.mul(royaltiesFee).div(10000));
    }

    function removeExpiredBids(
        address[] memory _tokenAddresses,
        uint256[] memory _tokenIds,
        address[] memory _bidders
    ) public {
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
        (
            uint256 bidIndex,
            bytes32 bidId,
            ,
            ,
            uint256 priceWithFee,
            uint256 expiresAt
        ) = getBidByBidder(nftContract, tokenId, bidder);

        require(
            expiresAt < block.timestamp,
            "The bid to remove should be expired"
        );

        _cancelBid(bidIndex, bidId, nftContract, tokenId, bidder, priceWithFee);
    }

    function _cancelBid(
        uint256 bidIndex,
        bytes32 bidId,
        address nftContract,
        uint256 tokenId,
        address bidder,
        uint256 priceWithFee
    ) internal {
        // Delete bid references
        delete bidIndexByBidId[bidId];
        delete bidIdByTokenAndBidder[nftContract][tokenId][bidder];

        // Check if the bid is at the end of the mapping
        uint256 lastBidIndex = bidCounterByToken[nftContract][tokenId].sub(1);
        if (lastBidIndex != bidIndex) {
            // Move last bid to the removed place
            Bid storage lastBid = bidsByToken[nftContract][tokenId][
                lastBidIndex
            ];
            bidsByToken[nftContract][tokenId][bidIndex] = lastBid;
            bidIndexByBidId[lastBid.id] = bidIndex;
        }

        delete bidsByToken[nftContract][tokenId][lastBidIndex];
        bidCounterByToken[nftContract][tokenId]--;

        (bool success, ) = payable(bidder).call{value: priceWithFee}("");
        require(success, "Refund failed.");

        emit BidCancelled(bidId, nftContract, tokenId, bidder);
    }

    function _getBid(
        address nftContract,
        uint256 tokenId,
        uint256 index
    ) internal view returns (Bid memory) {
        require(
            index < bidCounterByToken[nftContract][tokenId],
            "Invalid index"
        );
        return bidsByToken[nftContract][tokenId][index];
    }

    function _bidderHasBid(
        address nftContract,
        uint256 tokenId,
        address bidder
    ) internal view returns (bool) {
        bytes32 bidId = bidIdByTokenAndBidder[nftContract][tokenId][bidder];
        uint256 bidIndex = bidIndexByBidId[bidId];

        if (bidIndex < bidCounterByToken[nftContract][tokenId]) {
            Bid memory bid = bidsByToken[nftContract][tokenId][bidIndex];
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
