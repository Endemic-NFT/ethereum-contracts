// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

library LibAuction {
    bytes4 public constant ERC721_ASSET_CLASS = bytes4(keccak256("ERC721"));
    bytes4 public constant ERC1155_ASSET_CLASS = bytes4(keccak256("ERC1155"));

    uint256 private constant MAX_DURATION = 1000 days;
    uint256 private constant MIN_DURATION = 1 minutes;

    struct Auction {
        bytes32 id;
        address contractId;
        uint256 tokenId;
        address seller;
        uint256 startingPrice;
        uint256 endingPrice;
        uint256 duration;
        uint256 amount;
        uint256 startedAt;
        bytes4 assetClass;
    }

    function validate(Auction memory auction) internal pure {
        require(
            auction.duration >= MIN_DURATION &&
                auction.duration <= MAX_DURATION,
            "Invalid duration"
        );
        require(
            auction.startingPrice >= 0.0001 ether &&
                auction.endingPrice >= 0.0001 ether &&
                auction.startingPrice >= auction.endingPrice,
            "Invalid price configuration"
        );

        if (auction.assetClass == ERC721_ASSET_CLASS) {
            require(auction.amount == 1, "Invalid token amount");
        } else if (auction.assetClass == ERC1155_ASSET_CLASS) {
            require(auction.amount > 0, "Invalid token amount");
        } else {
            revert("Invalid asset class");
        }
    }

    function isActiveAuction(LibAuction.Auction memory auction)
        internal
        pure
        returns (bool)
    {
        return auction.startedAt > 0;
    }

    function getCurrentPrice(LibAuction.Auction memory auction)
        internal
        view
        returns (uint256)
    {
        uint256 secondsPassed = 0;

        if (block.timestamp > auction.startedAt) {
            secondsPassed = block.timestamp - auction.startedAt;
        }

        // NOTE: We don't use SafeMath (or similar) in this function because
        //  all of our public functions carefully cap the maximum values for
        //  time (at 64-bits) and currency (at 128-bits). _duration is
        //  also known to be non-zero (see the require() statement in
        //  _addAuction())
        if (secondsPassed >= auction.duration) {
            // We've reached the end of the dynamic pricing portion
            // of the auction, just return the end price.
            return auction.endingPrice;
        } else {
            // Starting price can be higher than ending price (and often is!), so
            // this delta can be negative.
            int256 totalPriceChange = int256(auction.endingPrice) -
                int256(auction.startingPrice);

            // This multiplication can't overflow, _secondsPassed will easily fit within
            // 64-bits, and totalPriceChange will easily fit within 128-bits, their product
            // will always fit within 256-bits.
            int256 currentPriceChange = (totalPriceChange *
                int256(secondsPassed)) / int256(auction.duration);

            // currentPriceChange can be negative, but if so, will have a magnitude
            // less that _startingPrice. Thus, this result will always end up positive.
            return uint256(int256(auction.startingPrice) + currentPriceChange);
        }
    }
}
