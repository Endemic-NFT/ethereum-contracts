const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const BN = require('bignumber.js');
const {
  deployEndemicCollectionWithFactory,
  deployEndemicExchangeWithDeps,
  deployEndemicERC1155,
} = require('../helpers/deploy');

const { FEE_RECIPIENT } = require('../helpers/constants');
const { ERC1155_ASSET_CLASS, ERC721_ASSET_CLASS } = require('../helpers/ids');

const INVALID_AUCTION_ERROR = 'InvalidAuction';
const INVALID_VALUE_PROVIDED_ERROR = 'InvalidValueProvided';
const UNAUTHORIZED_ERROR = 'Unauthorized';
const INVALID_DURATION_ERROR = 'InvalidDuration';
const INVALID_AMOUNT_ERROR = 'InvalidAmount';
const EXCHANGE_NOT_APPROVED_FOR_ASSET_ERROR = 'ExchangeNotApprovedForAsset';
const SELLER_NOT_ASSET_OWNER = 'SellerNotAssetOwner';

describe('ExchangeAuction', function () {
  let endemicExchange, nftContract, erc1155Contract, royaltiesProviderContract;

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

    nftContract = (await deployEndemicCollectionWithFactory()).nftContract;
    erc1155Contract = await deployEndemicERC1155();

    await mintERC721(user1.address);
    await mintERC721(user1.address);

    await mintERC1155(user1.address, 3);
  }

  describe('Create auction', function () {
    beforeEach(async function () {
      await deploy();
    });

    it("should fail to create auction for NFT you don't own", async function () {
      await expect(
        endemicExchange
          .connect(user2)
          .createAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);

      await expect(
        endemicExchange
          .connect(user2)
          .createAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create auction for invalid duration', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            new BN(99).pow(99),
            1,
            ERC721_ASSET_CLASS
          )
      ).to.be.reverted;

      await expect(
        endemicExchange
          .connect(user1)
          .createAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            1,
            1,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_DURATION_ERROR);
    });

    it('should fail to create auction for nonexistant NFT', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            1,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('OwnerQueryForNonexistentToken');

      await expect(
        endemicExchange
          .connect(user1)
          .createAuction(
            erc1155Contract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            1,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should be able to recreate ERC721 auction', async function () {
      // Create the auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          60,
          1,
          ERC721_ASSET_CLASS
        );
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          60,
          1,
          ERC721_ASSET_CLASS
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
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
    });

    it('should be able to recreate ERC1155 auction', async function () {
      // Create the auction
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          60,
          1,
          ERC1155_ASSET_CLASS
        );
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          60,
          1,
          ERC1155_ASSET_CLASS
        );

      const auction1Id = await endemicExchange.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
      const auction1 = await endemicExchange.getAuction(auction1Id);

      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
    });

    it('should be able to create auctions for multiple NFTs', async function () {
      await mintERC721(user1.address);

      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await nftContract.connect(user1).approve(endemicExchange.address, 2);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          60,
          1,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          2,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          120,
          1,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          150,
          2,
          ERC1155_ASSET_CLASS
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

      const auction3Id = await endemicExchange.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );

      const auction1 = await endemicExchange.getAuction(auction1Id);
      const auction2 = await endemicExchange.getAuction(auction2Id);
      const auction3 = await endemicExchange.getAuction(auction3Id);

      // First
      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auction1.duration.toString()).to.equal('60');

      // Second
      expect(auction2.seller).to.equal(user1.address);
      expect(auction2.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auction2.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auction2.duration.toString()).to.equal('120');

      // third
      expect(auction3.seller).to.equal(user1.address);
      expect(auction3.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(auction3.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(auction3.duration.toString()).to.equal('150');
    });

    it('should fail to create auction for incorrect amount', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await expect(
        endemicExchange
          .connect(user1)
          .createAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            2,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);

      await expect(
        endemicExchange
          .connect(user1)
          .createAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            0,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);
    });

    it('should fail to create auction for incorrect asset class', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            2,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidInterface');
    });
  });

  describe('Bidding', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      const startingPrice = ethers.utils.parseUnits('0.1');
      const endingPrice = ethers.utils.parseUnits('0.1');
      const duration = 120;

      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          startingPrice,
          endingPrice,
          duration,
          1,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createAuction(
          erc1155Contract.address,
          1,
          startingPrice,
          endingPrice,
          duration,
          3,
          ERC1155_ASSET_CLASS
        );

      erc721AuctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      erc1155AuctionId = await endemicExchange.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
    });

    it('should fail to bid with insufficient value', async function () {
      await expect(
        endemicExchange.connect(user2).bid(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.01'),
        })
      ).to.be.revertedWith(INVALID_VALUE_PROVIDED_ERROR);

      await expect(
        endemicExchange.connect(user2).bid(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.01'),
        })
      ).to.be.revertedWith(INVALID_VALUE_PROVIDED_ERROR);

      await expect(
        endemicExchange.connect(user2).bid(erc1155AuctionId, 2, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_VALUE_PROVIDED_ERROR);
    });

    it('should fail to bid if auction has been concluded', async function () {
      await endemicExchange.connect(user1).cancelAuction(erc721AuctionId);
      await endemicExchange.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(
        endemicExchange.connect(user2).bid(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await expect(
        endemicExchange.connect(user2).bid(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on ERC721', async function () {
      const user1Bal1 = await user1.getBalance();

      await endemicExchange.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      // User1 should receive 100 wei, fee is zero

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.09'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);

      await expect(
        endemicExchange.getAuction(erc721AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on ERC1155', async function () {
      const user1Bal1 = await user1.getBalance();

      await endemicExchange.connect(user2).bid(erc1155AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      // Bidder should own NFT
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      // Auction is still on because all amount has not been sold
      const erc1155Auction = await endemicExchange.getAuction(erc1155AuctionId);
      expect(erc1155Auction.amount).to.equal('2');

      // Buy two more
      await endemicExchange.connect(user2).bid(erc1155AuctionId, 2, {
        value: ethers.utils.parseUnits('0.206'),
      });

      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(3);

      // Auction is now complete
      await expect(
        endemicExchange.getAuction(erc1155AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.3'));
    });

    it('should be able to bid at endingPrice if auction has passed duration', async function () {
      const user1Bal1 = await user1.getBalance();
      await network.provider.send('evm_increaseTime', [200]);

      await endemicExchange.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      await endemicExchange.connect(user2).bid(erc1155AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.19'));
    });

    it('should fail to bid after someone else has bid', async function () {
      await endemicExchange.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });
      await expect(
        endemicExchange.connect(user3).bid(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await endemicExchange.connect(user2).bid(erc1155AuctionId, 3, {
        value: ethers.utils.parseUnits('0.309'),
      });
      await expect(
        endemicExchange.connect(user3).bid(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid in middle of auction', async function () {
      await network.provider.send('evm_increaseTime', [60]);
      await endemicExchange.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });
      await endemicExchange.connect(user2).bid(erc1155AuctionId, 2, {
        value: ethers.utils.parseUnits('0.206'),
      });

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(2);
    });

    it('should trigger an event after successful bid', async function () {
      const bid1 = endemicExchange.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      await expect(bid1)
        .to.emit(endemicExchange, 'AuctionSuccessful')
        .withArgs(
          erc721AuctionId,
          ethers.utils.parseUnits('0.1'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.003')
        );

      await expect(bid1)
        .to.emit(nftContract, 'Transfer')
        .withArgs(user1.address, user2.address, 1);

      const bid2 = endemicExchange.connect(user2).bid(erc1155AuctionId, 2, {
        value: ethers.utils.parseUnits('0.206'),
      });

      await expect(bid2)
        .to.emit(endemicExchange, 'AuctionSuccessful')
        .withArgs(
          erc1155AuctionId,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          2,
          ethers.utils.parseUnits('0.006')
        );
    });
  });

  describe('Conclude auction', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          60,
          1,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          60,
          3,
          ERC1155_ASSET_CLASS
        );

      erc721AuctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      erc1155AuctionId = await endemicExchange.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
    });

    it('should fail to conclude if NFT not on auction', async function () {
      await expect(
        endemicExchange.connect(user1).cancelAuction(
          await endemicExchange.createAuctionId(
            erc1155Contract.address,
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

      await expect(
        endemicExchange.connect(user2).cancelAuction(erc1155AuctionId)
      ).to.be.revertedWith(UNAUTHORIZED_ERROR);
    });

    it('should be able to conclude auction', async function () {
      await network.provider.send('evm_increaseTime', [60]);
      await endemicExchange.connect(user1).cancelAuction(erc721AuctionId);
      await endemicExchange.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(
        endemicExchange.getAuction(erc721AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
      await expect(
        endemicExchange.getAuction(erc1155AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should trigger event after canceling auction', async function () {
      const cancleAuction1 = await endemicExchange
        .connect(user1)
        .cancelAuction(erc721AuctionId);

      const cancleAuction2 = await endemicExchange
        .connect(user1)
        .cancelAuction(erc1155AuctionId);

      await expect(cancleAuction1)
        .to.emit(endemicExchange, 'AuctionCancelled')
        .withArgs(erc721AuctionId);

      await expect(cancleAuction2)
        .to.emit(endemicExchange, 'AuctionCancelled')
        .withArgs(erc1155AuctionId);
    });
  });

  describe('Fee', function () {
    beforeEach(async function () {
      await deploy(250, 300);
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);
    });

    it('should take cut on primary sale', async function () {
      const claimEthBalance1 = await endemicExchange.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          60,
          1,
          ERC721_ASSET_CLASS
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

      const user1Bal1 = await user1.getBalance();

      // buys NFT and calculates price diff on contract and user1 wallet
      const bidTx = await endemicExchange.connect(user2).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('0.206'),
      });

      await expect(bidTx)
        .to.emit(endemicExchange, 'AuctionSuccessful')
        .withArgs(
          auctionid,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.011')
        );

      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user1Bal2 = await user1.getBalance();
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

    it('should take cut on sequential sales', async function () {
      // Creates auction and bid it
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1'),
          ethers.utils.parseUnits('1'),
          60,
          1,
          ERC721_ASSET_CLASS
        );

      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      // Buy with user 2
      await endemicExchange.connect(user2).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('1.03'),
      });

      // Auction again with user 2
      await nftContract.connect(user2).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user2)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.5'),
          ethers.utils.parseUnits('0.5'),
          60,
          1,
          ERC721_ASSET_CLASS
        );

      const auctionid2 = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user2.address
      );

      // Grab current balance
      const user2Bal1 = await user2.getBalance();
      const claimEthBalance1 = await endemicExchange.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );

      // Buy with user 3
      const bidTx = await endemicExchange.connect(user3).bid(auctionid2, 1, {
        value: ethers.utils.parseUnits('0.515'),
      });

      await expect(bidTx)
        .to.emit(endemicExchange, 'AuctionSuccessful')
        .withArgs(
          auctionid2,
          ethers.utils.parseUnits('0.5'),
          user3.address,
          1,
          ethers.utils.parseUnits('0.0275')
        );

      //Grab updated balances
      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user2Bal2 = await user2.getBalance();

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

  describe('Royalties', function () {
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
    });

    it('should distribute royalties', async () => {
      await endemicExchange
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          60,
          1,
          ERC721_ASSET_CLASS
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

      const claimEthBalance1 = await endemicExchange.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );

      const feeRecipientBalance1 = await feeRecipient.getBalance();
      const user1Bal1 = await user1.getBalance();

      await endemicExchange.connect(user2).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('0.206'),
      });

      const user1Bal2 = await user1.getBalance();
      const feeRecipientBalance2 = await feeRecipient.getBalance();
      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );

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
