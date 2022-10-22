const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const {
  deployEndemicCollectionWithFactory,
  deployEndemicExchangeWithDeps,
  deployEndemicERC1155,
  deployEndemicToken,
} = require('../helpers/deploy');

const { ZERO_ADDRESS, FEE_RECIPIENT } = require('../helpers/constants');
const { ERC721_ASSET_CLASS } = require('../helpers/ids');

const INVALID_AUCTION_ERROR = 'InvalidAuction';
const INVALID_PAYMENT_METHOD = 'InvalidPaymentMethod';
const INVALID_PRICE_CONFIGURATION = 'InvalidPriceConfiguration';

const AUCTION_CANCELED = 'AuctionCancelled';
const RESERVE_BID_PLACED = 'ReserveBidPlaced';

const UNAUTHORIZED_ERROR = 'Unauthorized';
const SELLER_NOT_ASSET_OWNER = 'SellerNotAssetOwner';

const INSUFFICIENT_BID = 'InsufficientBid';
const UNSUFFICIENT_CURRENCY_SUPPLIED = 'UnsufficientCurrencySupplied';

const ONE_DAY = 86400;

describe('ExchangeReserveAuction', function () {
  let endemicExchange,
    endemicToken,
    nftContract,
    erc1155Contract,
    royaltiesProviderContract,
    paymentManagerContract;

  let owner, user1, user2, user3, feeRecipient;

  async function mintERC721(recipient) {
    await nftContract
      .connect(owner)
      .mint(
        recipient,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
  }

  async function mintERC1155(recipient, amount) {
    await erc1155Contract.connect(owner).create({
      artist: user2.address,
      supply: 10,
      tokenURI: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    });

    await erc1155Contract.connect(owner).mint({
      recipient,
      tokenId: 1,
      amount,
    });
  }

  async function deploy(makerFee = 0, takerFee) {
    [owner, user1, user2, user3, feeRecipient] = await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps(makerFee, takerFee);

    royaltiesProviderContract = result.royaltiesProviderContract;
    endemicExchange = result.endemicExchangeContract;
    paymentManagerContract = result.paymentManagerContract;

    nftContract = (await deployEndemicCollectionWithFactory()).nftContract;
    erc1155Contract = await deployEndemicERC1155();

    await mintERC721(user1.address);
    await mintERC721(user1.address);

    await mintERC1155(user1.address, 3);
  }

  async function getCurrentEvmTimestamp() {
    const blockNumBefore = await ethers.provider.getBlockNumber();

    const blockBefore = await ethers.provider.getBlock(blockNumBefore);

    return blockBefore.timestamp;
  }

  describe('Create reserve auction with ERC20', function () {
    beforeEach(async function () {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it("should fail to create reserve auction for NFT you don't own", async function () {
      await expect(
        endemicExchange
          .connect(user2)
          .createReserveAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            endemicToken.address
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create reserve auction for nonexistant NFT', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createReserveAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.2'),
            endemicToken.address
          )
      ).to.be.revertedWith('ERC721: invalid token ID');
    });

    it('should fail to create reserve auction for not supported ERC20 token payment', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createReserveAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            '0x0000000000000000000000000000000000000001'
          )
      ).to.be.revertedWith(INVALID_PAYMENT_METHOD);
    });

    it('should fail to create reserve auction for null erc20 address', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createReserveAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ZERO_ADDRESS
          )
      ).to.be.revertedWith(INVALID_PAYMENT_METHOD);
    });

    it('should fail to create reserve auction with invalid price configuration', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createReserveAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.00001'),
            endemicToken.address
          )
      ).to.be.revertedWith(INVALID_PRICE_CONFIGURATION);
    });

    it('should be able to recreate ERC721 reserve auction', async function () {
      // Create the auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          endemicToken.address
        );

      // Try to create the auction again
      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          endemicToken.address
        );

      const auction1Id = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );
      const auction1 = await endemicExchange.getAuction(auction1Id);

      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(auction1.paymentErc20TokenAddress).to.equal(endemicToken.address);
    });

    it('should be able to create reserve auctions for multiple NFTs with ERC20 token payment', async function () {
      await mintERC721(user1.address);

      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await nftContract.connect(user1).approve(endemicExchange.address, 2);

      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          endemicToken.address
        );

      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          2,
          ethers.utils.parseUnits('0.1'),
          endemicToken.address
        );

      const auction1Id = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      const auction2Id = await endemicExchange.createAuctionId(
        nftContract.address,
        2,
        user1.address
      );

      const auction1 = await endemicExchange.getAuction(auction1Id);
      const auction2 = await endemicExchange.getAuction(auction2Id);

      // First
      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auction1.endingAt.toString()).to.equal('0'); //not started yet

      // Second
      expect(auction2.seller).to.equal(user1.address);
      expect(auction2.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auction2.endingAt.toString()).to.equal('0'); //not started yet
    });
  });

  describe('Bidding with ERC20', function () {
    let erc721AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );

      const reservePrice = ethers.utils.parseUnits('0.1');

      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          1,
          reservePrice,
          endemicToken.address
        );

      erc721AuctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );
    });

    this.afterEach(async () => {
      await network.provider.send('hardhat_reset');
    });

    it('should fail to bid with insufficient value', async function () {
      await expect(
        endemicExchange
          .connect(user2)
          .bidForReserveAuctionInErc20(erc721AuctionId, 100)
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);
    });

    it('should fail to bid if auction has been concluded', async function () {
      await endemicExchange.connect(user1).cancelAuction(erc721AuctionId);

      await expect(
        endemicExchange
          .connect(user2)
          .bidForReserveAuctionInErc20(erc721AuctionId, 100)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid and finalize by buyer on ERC721 reserve auction', async function () {
      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.103')
        );

      const highestBidder = await endemicExchange
        .connect(user2)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user2.address);

      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await endemicExchange
        .connect(user2)
        .finalizeReserveAuction(erc721AuctionId);

      // User1 should receive 100 wei, fee is zero
      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.09'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);

      await expect(
        endemicExchange.getAuction(erc721AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid and finalize by seller on ERC721 reserve auction', async function () {
      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.103')
        );

      const highestBidder = await endemicExchange
        .connect(user2)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user2.address);

      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await endemicExchange
        .connect(user1)
        .finalizeReserveAuction(erc721AuctionId);

      // User1 should receive 100 wei, fee is zero
      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.09'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);

      await expect(
        endemicExchange.getAuction(erc721AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid in middle of auction and finalize after by buyer', async function () {
      await network.provider.send('evm_increaseTime', [ONE_DAY / 2]);
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.309')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.309'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.309')
        );

      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await endemicExchange
        .connect(user2)
        .finalizeReserveAuction(erc721AuctionId);

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
    });

    it('should fail to finalize if auction is dutch', async function () {
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.1'),
          1000,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      const auctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await expect(
        endemicExchange.connect(user1).finalizeReserveAuction(auctionId)
      ).to.be.revertedWith('AuctionInProgress');
    });

    it('should fail to bid if auction is dutch', async function () {
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.1'),
          1000,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      const auctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.309')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.309'));

      await expect(
        endemicExchange
          .connect(user2)
          .bidForReserveAuctionInErc20(
            auctionId,
            ethers.utils.parseUnits('0.309')
          )
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid in middle of auction and finalize after by seller', async function () {
      await network.provider.send('evm_increaseTime', [ONE_DAY / 2]);
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.309')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.309'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.309')
        );

      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await endemicExchange
        .connect(user1)
        .finalizeReserveAuction(erc721AuctionId);

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
    });

    it('should be able to bid in middle of auction but fail to finalize if user not seller nor buyer', async function () {
      await network.provider.send('evm_increaseTime', [ONE_DAY / 2]);
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.309')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.309'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.309')
        );

      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await expect(
        endemicExchange.connect(user3).finalizeReserveAuction(erc721AuctionId)
      ).to.be.revertedWith(UNAUTHORIZED_ERROR);
    });

    it('should be able to bid in last 15mins and extend auction by 15mins', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.309')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.309'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.309')
        );

      let highestBidder = await endemicExchange
        .connect(user2)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user2.address);

      const auctionBefore = await endemicExchange.getAuction(erc721AuctionId);

      await network.provider.send('evm_increaseTime', [85800]);
      await network.provider.send('evm_mine');

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.4')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.4'));

      await endemicExchange
        .connect(user3)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.4')
        );

      highestBidder = await endemicExchange
        .connect(user3)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user3.address);

      const auctionAfter = await endemicExchange.getAuction(erc721AuctionId);

      const endingAtDiff = auctionAfter.endingAt - auctionBefore.endingAt;
      //user2 bids endingAt is 24hrs from now
      //network time is increased to tomorrow at 10mins before relative to now
      //user3 bids => endingTime is increased by 15mins to chain time or 5mins relative to now
      expect(endingAtDiff).to.equal(303); //around 5mins relative to chain time
    });

    it('should fail to outbid previous bidder with too low bid provided', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.103')
        );

      const highestBidder = await endemicExchange
        .connect(user2)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user2.address);

      await expect(
        endemicExchange.connect(user3).bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.103') //not larger than 10% of previous bid
        )
      ).to.be.revertedWith(INSUFFICIENT_BID);
    });

    it('should fail to outbid previous bidder with too low allowance', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.103')
        );

      const highestBidder = await endemicExchange
        .connect(user2)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user2.address);

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103')); //not larger than 10% of previous bid

      await expect(
        endemicExchange
          .connect(user3)
          .bidForReserveAuctionInErc20(
            erc721AuctionId,
            ethers.utils.parseUnits('0.203')
          )
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);
    });

    it('should fail to outbid himself', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.4')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.103')
        );

      const highestBidder = await endemicExchange
        .connect(user2)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user2.address);

      await expect(
        endemicExchange
          .connect(user2)
          .bidForReserveAuctionInErc20(
            erc721AuctionId,
            ethers.utils.parseUnits('0.203')
          )
      ).to.be.revertedWith(UNAUTHORIZED_ERROR);
    });

    it('should outbid previous bidder', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.103')
        );

      let highestBidder = await endemicExchange
        .connect(user2)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user2.address);

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.203')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.203'));

      await endemicExchange
        .connect(user3)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.203')
        );

      highestBidder = await endemicExchange
        .connect(user3)
        .getHighestBidder(erc721AuctionId);

      expect(highestBidder.toString()).to.equal(user3.address);
    });

    it('should trigger an event after successful bid', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.309')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      const bid1 = endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          erc721AuctionId,
          ethers.utils.parseUnits('0.103')
        );

      const currentEvmTimestamp = await getCurrentEvmTimestamp();

      await expect(bid1)
        .to.emit(endemicExchange, RESERVE_BID_PLACED)
        .withArgs(
          erc721AuctionId,
          user2.address,
          ethers.utils.parseUnits('0.1'),
          currentEvmTimestamp + 86401 //24hrs
        );
    });
  });

  describe('Conclude auction', function () {
    let erc721AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );

      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          endemicToken.address
        );

      erc721AuctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );
    });

    this.afterEach(async () => {
      await network.provider.send('hardhat_reset');
    });

    it('should fail to conclude if NFT not on auction', async function () {
      await expect(
        endemicExchange.connect(user1).cancelAuction(
          await endemicExchange.createAuctionId(
            nftContract.address,
            2, //invalid
            user1.address
          )
        )
      ).to.be.revertedWith(UNAUTHORIZED_ERROR);
    });

    it('should fail to conclude auction if not seller', async function () {
      await expect(
        endemicExchange.connect(user2).cancelAuction(erc721AuctionId)
      ).to.be.revertedWith(UNAUTHORIZED_ERROR);
    });

    it('should be able to conclude auction', async function () {
      await network.provider.send('evm_increaseTime', [60]);
      await endemicExchange.connect(user1).cancelAuction(erc721AuctionId);

      await expect(
        endemicExchange.getAuction(erc721AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should trigger event after canceling auction', async function () {
      const cancleAuction1 = await endemicExchange
        .connect(user1)
        .cancelAuction(erc721AuctionId);

      await expect(cancleAuction1)
        .to.emit(endemicExchange, AUCTION_CANCELED)
        .withArgs(erc721AuctionId);
    });
  });

  describe('ERC20 Fee', function () {
    beforeEach(async function () {
      await deploy(250, 300);
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    this.afterEach(async () => {
      await network.provider.send('hardhat_reset');
    });

    it('should take cut on sale on reserve auction', async function () {
      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);
      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.02472'),
          endemicToken.address
        );
      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      // 22% of 0.2 + 3% fee
      // 22% of 0.2 maker fee= 0.044ETH
      // 0.2 + 3% taker fee = 0.006
      // fees = 0.05
      // seller gets 0.2 - 22% = 0.156
      // buyer pays 0.2 + 3% = 0.206

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      //bid with user3
      const bidTxWithUser3 = endemicExchange
        .connect(user3)
        .bidForReserveAuctionInErc20(
          auctionid,
          ethers.utils.parseUnits('0.103')
        );

      const currentEvmTimestamp = await getCurrentEvmTimestamp();

      await expect(bidTxWithUser3)
        .to.emit(endemicExchange, RESERVE_BID_PLACED)
        .withArgs(
          auctionid,
          user3.address,
          ethers.utils.parseUnits('0.1'),
          currentEvmTimestamp + 86401 //24hrs
        );

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.206')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.206'));

      //bid with user2
      const bidTxWithUser2 = endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          auctionid,
          ethers.utils.parseUnits('0.206')
        );

      await expect(bidTxWithUser2)
        .to.emit(endemicExchange, RESERVE_BID_PLACED)
        .withArgs(
          auctionid,
          user2.address,
          ethers.utils.parseUnits('0.2'),
          currentEvmTimestamp + 86401
        );

      //no new bids
      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await endemicExchange.connect(user2).finalizeReserveAuction(auctionid);

      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const token2Owner = await nftContract.ownerOf(1);
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 3% of 0.2 + 3% fee
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.011')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);
      // 0.2 minus 3% fee
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.175'));
      expect(token2Owner).to.equal(user2.address);
    });

    it('should take cut on sequential sales on reserve auction', async function () {
      // Creates auction and bid it
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.5'),
          endemicToken.address
        );

      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.7')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.7'));

      // bid with user 3
      await endemicExchange
        .connect(user3)
        .bidForReserveAuctionInErc20(auctionid, ethers.utils.parseUnits('0.7'));

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('1.03')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('1.03'));

      // bid with user 2
      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          auctionid,
          ethers.utils.parseUnits('1.03')
        );

      //no new bids
      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await endemicExchange.connect(user2).finalizeReserveAuction(auctionid);

      // Auction again with user 2
      await nftContract.connect(user2).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user2)
        .createReserveAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          endemicToken.address
        );

      const auctionid2 = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user2.address
      );

      await endemicToken.transfer(
        user1.address,
        ethers.utils.parseUnits('0.15')
      );

      await endemicToken
        .connect(user1)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.15'));

      // bid with user 1
      await endemicExchange
        .connect(user1)
        .bidForReserveAuctionInErc20(
          auctionid2,
          ethers.utils.parseUnits('0.15')
        );

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      const currentEvmTimestamp = await getCurrentEvmTimestamp();

      // // bid with user 3
      const bidTx = endemicExchange
        .connect(user3)
        .bidForReserveAuctionInErc20(
          auctionid2,
          ethers.utils.parseUnits('0.515')
        );

      await expect(bidTx)
        .to.emit(endemicExchange, RESERVE_BID_PLACED)
        .withArgs(
          auctionid2,
          user3.address,
          ethers.utils.parseUnits('0.5'),
          currentEvmTimestamp + 86398 //24hrs - few seconds that passes
        );

      // Grab current balance
      const user2Bal1 = await endemicToken.balanceOf(user2.address);
      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      //no new bids
      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await endemicExchange.connect(user3).finalizeReserveAuction(auctionid2);

      //Grab updated balances
      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      const user2Bal2 = await endemicToken.balanceOf(user2.address);

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);
      const user2Diff = user2Bal2.sub(user2Bal1);

      // Checks if endemicExchange gets 2.5% maker fee + 3% taker fee
      // 2.5% of 0.5 + 0.015 taker fee
      expect(claimEthBalanceDiff).to.equal(ethers.utils.parseUnits('0.0275'));
      expect(user2Diff.toString()).to.equal(ethers.utils.parseUnits('0.4375'));

      // New owner
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user3.address);
    });
  });

  describe('ERC20 Royalties', function () {
    beforeEach(async function () {
      await deploy(250, 300, 2200);
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        feeRecipient.address,
        1000
      );

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    this.afterEach(async () => {
      await network.provider.send('hardhat_reset');
    });

    it('should distribute royalties on reserve auction', async () => {
      await endemicExchange
        .connect(user1)
        .createReserveAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          endemicToken.address
        );
      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      // 22% of 0.2 + 3% fee
      // 22% of 0.2 maker fee= 0.044ETH
      // 10% of 0.2 royalties = 0.02ETH
      // 0.2 + 3% taker fee = 0.006
      // fees = 0.05
      // seller gets 0.2 - 22% -10% = 0.136
      // buyer pays 0.2 + 3% = 0.206

      // buys NFT and calculates price diff on contract and user1 wallet

      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      const feeRecipientBalance1 = await endemicToken.balanceOf(
        feeRecipient.address
      );
      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.206')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.206'));

      await endemicExchange
        .connect(user2)
        .bidForReserveAuctionInErc20(
          auctionid,
          ethers.utils.parseUnits('0.206')
        );

      //no new bids
      await network.provider.send('evm_increaseTime', [ONE_DAY]); //reserve auction needs to finish
      await network.provider.send('evm_mine');

      await endemicExchange.connect(user2).finalizeReserveAuction(auctionid);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const feeRecipientBalance2 = await endemicToken.balanceOf(
        feeRecipient.address
      );
      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 3% of 0.2 + 3% fee
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.011')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);
      // 0.2 minus 3% fee minus 10% royalties
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.175'));

      const feeRecipientDiff = feeRecipientBalance2.sub(feeRecipientBalance1);
      expect(feeRecipientDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.02')
      );
    });
  });
});
