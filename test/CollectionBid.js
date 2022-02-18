const { expect } = require('chai');
const { ethers, network, upgrades } = require('hardhat');
const BN = require('bignumber.js');
const {
  deployEndemicNFT,
  deployCollectionBid,
  deployEndemicMasterNFT,
  deployContractRegistry,
  deployFeeProvider,
  deployRoyaltiesProvider,
} = require('./helpers/deploy');
const safeTransferWithBytes = require('./helpers/safeTransferWithBytes');

describe('CollectionBid', function () {
  let bidContract,
    masterNftContract,
    nftContract,
    nftContract2,
    feeProviderContract,
    royaltiesProviderContract,
    contractRegistryContract;

  let owner, user1, user2, user3, royaltiesRecipient;

  async function mint(id, recipient) {
    await nftContract
      .connect(owner)
      .mint(
        recipient,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
  }

  async function deploy(makerFee = 300, takerFee = 300, initialFee = 2200) {
    [
      owner,
      user1,
      user2,
      user3,
      minter,
      signer,
      royaltiesRecipient,
      ...otherSigners
    ] = await ethers.getSigners();

    contractRegistryContract = await deployContractRegistry(owner);
    masterNftContract = await deployEndemicMasterNFT(owner);

    royaltiesProviderContract = await deployRoyaltiesProvider(owner);
    feeProviderContract = await deployFeeProvider(
      owner,
      masterNftContract.address,
      contractRegistryContract.address,
      makerFee,
      takerFee,
      initialFee
    );

    bidContract = await deployCollectionBid(
      owner,
      feeProviderContract.address,
      royaltiesProviderContract.address,
      masterNftContract.address
    );

    nftContract = await deployEndemicNFT(owner);
    nftContract2 = await deployEndemicNFT(user1);

    await contractRegistryContract.addSaleContract(bidContract.address);

    await mint(1, user1.address);
    await mint(2, user1.address);
  }

  describe('Initial State', () => {
    beforeEach(deploy);

    it('should start with owner set', async () => {
      const ownerAddr = await bidContract.owner();
      expect(ownerAddr).to.equal(owner.address);
    });
  });

  describe('Create bid', () => {
    beforeEach(deploy);

    it('should successfully create a bid', async () => {
      const placeBidTx = await bidContract.placeBid(nftContract.address, 1000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      const activeBid = await bidContract.getBidByBidder(
        nftContract.address,
        owner.address
      );

      await expect(placeBidTx)
        .to.emit(bidContract, 'BidCreated')
        .withArgs(
          activeBid.bidId,
          nftContract.address,
          owner.address,
          activeBid.price,
          activeBid.expiresAt
        );

      expect(activeBid.bidIndex).to.equal(0);
      expect(activeBid.bidder).to.equal(owner.address);
      expect(activeBid.price).to.equal(ethers.utils.parseUnits('0.5'));
      expect(activeBid.priceWithFee).to.equal(ethers.utils.parseUnits('0.515'));
    });

    it('should fail to bid multiple times on same collection', async () => {
      await bidContract.placeBid(nftContract.address, 1000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      await expect(
        bidContract.placeBid(nftContract.address, 1000, {
          value: ethers.utils.parseUnits('0.616'),
        })
      ).to.be.revertedWith('Bid already exists');

      const activeBid = await bidContract.getBidByBidder(
        nftContract.address,
        owner.address
      );

      expect(activeBid.bidIndex).to.equal(0);
      expect(activeBid.bidder).to.equal(owner.address);
      expect(activeBid.price).to.equal(ethers.utils.parseUnits('0.5'));
      expect(activeBid.priceWithFee).to.equal(ethers.utils.parseUnits('0.515'));
    });

    it('should fail to create bid with no eth sent', async () => {
      await expect(
        bidContract.placeBid(nftContract.address, 1000, {
          value: 0,
        })
      ).to.be.revertedWith('Invalid value sent');
    });

    it('should fail to bid with invalid duration', async () => {
      await expect(
        bidContract.placeBid(nftContract.address, 1, {
          value: ethers.utils.parseUnits('0.5'),
        })
      ).to.be.revertedWith('Bid duration too short');

      await expect(
        bidContract.placeBid(nftContract.address, 9999999999, {
          value: ethers.utils.parseUnits('0.5'),
        })
      ).to.be.revertedWith('Bid duration too long');
    });

    it('should fail to create bid when paused', async () => {
      await bidContract.pause();

      await expect(
        bidContract.placeBid(nftContract.address, 1000, {
          value: ethers.utils.parseUnits('0.5'),
        })
      ).to.be.revertedWith('Pausable: paused');
    });
  });

  describe('Cancel bid', () => {
    beforeEach(deploy);

    it('should be able to cancel bid', async () => {
      await bidContract.placeBid(nftContract.address, 1000, {
        value: ethers.utils.parseUnits('0.5'),
      });

      const activeBid = await bidContract.getBidByBidder(
        nftContract.address,
        owner.address
      );

      const ownerBalance1 = await owner.getBalance();
      const cancelTx = await bidContract.cancelBid(nftContract.address);

      await expect(cancelTx)
        .to.emit(bidContract, 'BidCancelled')
        .withArgs(activeBid.bidId, nftContract.address, owner.address);

      const ownerBalance2 = await owner.getBalance();
      expect(ownerBalance2.sub(ownerBalance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.5'),
        ethers.utils.parseUnits('0.001') //gas fees
      );

      await expect(
        bidContract.getBidByBidder(nftContract.address, owner.address)
      ).to.be.revertedWith('Invalid index');
    });

    it('should not be able to cancel other bids', async () => {
      await bidContract.placeBid(nftContract.address, 1000, {
        value: ethers.utils.parseUnits('0.5'),
      });

      await bidContract.connect(user2).placeBid(nftContract.address, 1000, {
        value: ethers.utils.parseUnits('0.3'),
      });

      const ownerBalance1 = await owner.getBalance();
      await bidContract.cancelBid(nftContract.address);

      const ownerBalance2 = await owner.getBalance();
      expect(ownerBalance2.sub(ownerBalance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.5'),
        ethers.utils.parseUnits('0.001') //gas fees
      );

      await expect(
        bidContract.getBidByBidder(nftContract.address, owner.address)
      ).to.be.revertedWith('Bidder has not an active bid for this collection');

      const activeBid = await bidContract.getBidByBidder(
        nftContract.address,
        user2.address
      );

      expect(activeBid.bidIndex).to.equal(0);
    });

    it('should fail to cancel bid when paused', async () => {
      await bidContract.placeBid(nftContract.address, 1000, {
        value: ethers.utils.parseUnits('0.5'),
      });

      await bidContract.pause();

      await expect(
        bidContract.cancelBid(nftContract.address)
      ).to.be.revertedWith('Pausable: paused');
    });

    it('should remove expired bid', async () => {
      await bidContract.placeBid(nftContract.address, 100, {
        value: ethers.utils.parseUnits('0.5'),
      });

      await bidContract.connect(user2).placeBid(nftContract.address, 100, {
        value: ethers.utils.parseUnits('0.5'),
      });

      await bidContract.connect(user2).placeBid(nftContract2.address, 500, {
        value: ethers.utils.parseUnits('0.4'),
      });

      await network.provider.send('evm_increaseTime', [200]);
      await network.provider.send('evm_mine');

      await bidContract.removeExpiredBids(
        [nftContract.address, nftContract.address],
        [owner.address, user2.address]
      );

      await expect(
        bidContract.getBidByBidder(nftContract.address, owner.address)
      ).to.be.revertedWith('Invalid index');

      await expect(
        bidContract.getBidByBidder(nftContract.address, user2.address)
      ).to.be.revertedWith('Invalid index');

      const bid = await bidContract.getBidByBidder(
        nftContract2.address,
        user2.address
      );

      expect(bid.bidder).to.equal(user2.address);
      expect(bid.priceWithFee).to.equal(ethers.utils.parseUnits('0.4'));
    });
  });

  describe('Accept bid', () => {
    beforeEach(deploy);

    it('should be able to accept bid', async () => {
      // sending wants to bid 0.5 eth
      // taker fee is 3% = 0.015 eth
      // user sends 0.515 e th
      // owner of nft sees bid with 0.5 eth
      // maker initial sale fee is 22% = 0.11 eth
      // owner will get 0.39 eth
      // total fee is 0.125
      // total fee after master key cut is 0.11875
      await bidContract.placeBid(nftContract.address, 1000000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      const user1Balance1 = await user1.getBalance();
      const feeBalance1 = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );

      const bidId = (
        await bidContract.getBidByCollection(nftContract.address, 0)
      )[0];

      const transferTx = await safeTransferWithBytes(
        nftContract,
        user1,
        user1.address,
        bidContract.address,
        1,
        bidId
      );

      await expect(transferTx)
        .to.emit(bidContract, 'BidAccepted')
        .withArgs(
          bidId,
          nftContract.address,
          1,
          owner.address,
          user1.address,
          ethers.utils.parseUnits('0.5')
        );

      const user1Balance2 = await user1.getBalance();
      const feeBalance2 = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.39'),
        ethers.utils.parseUnits('0.001') //gas
      );

      expect(await nftContract.ownerOf(1)).to.equal(owner.address);

      expect(feeBalance2.sub(feeBalance1)).to.equal(
        ethers.utils.parseUnits('0.11875')
      );
    });

    it('should fail to accept bid for other collection', async () => {
      await bidContract.placeBid(nftContract.address, 1000000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      await bidContract.placeBid(nftContract2.address, 1000000, {
        value: ethers.utils.parseUnits('0.115'),
      });

      const bidId = (
        await bidContract.getBidByCollection(nftContract2.address, 0)
      )[0];

      await expect(
        safeTransferWithBytes(
          nftContract,
          user1,
          user1.address,
          bidContract.address,
          1,
          bidId
        )
      ).to.be.revertedWith('Invalid bid');
    });

    it('should not charge maker fee if seller is owner of master nft', async () => {
      await masterNftContract.mintNFT(user1.address);

      await bidContract.placeBid(nftContract.address, 1000000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      const user1Balance1 = await user1.getBalance();

      const bidId = (
        await bidContract.getBidByCollection(nftContract.address, 0)
      )[0];

      const feeBalanceBefore = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );

      await safeTransferWithBytes(
        nftContract,
        user1,
        user1.address,
        bidContract.address,
        1,
        bidId
      );

      expect(await nftContract.ownerOf(1)).to.equal(owner.address);

      const user1Balance2 = await user1.getBalance();
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.5'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalanceAfter = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );
      expect(feeBalanceAfter.sub(feeBalanceBefore)).to.equal(
        ethers.utils.parseUnits('0.01425') //0.5 - 5% master key cut
      );
    });

    it('should not charge taker fee if buyer is owner of master nft', async () => {
      await masterNftContract.mintNFT(owner.address);

      await bidContract.placeBid(nftContract.address, 1000000, {
        value: ethers.utils.parseUnits('0.5'),
      });

      const user1Balance1 = await user1.getBalance();

      const bidId = (
        await bidContract.getBidByCollection(nftContract.address, 0)
      )[0];

      const feeBalanceBefore = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );

      await safeTransferWithBytes(
        nftContract,
        user1,
        user1.address,
        bidContract.address,
        1,
        bidId
      );

      expect(await nftContract.ownerOf(1)).to.equal(owner.address);

      const user1Balance2 = await user1.getBalance();
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.39'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalanceAfter = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );
      expect(feeBalanceAfter.sub(feeBalanceBefore)).to.equal(
        ethers.utils.parseUnits('0.1045')
      );
    });

    it('should not charge fees if buyer and saler and owners of master nft', async () => {
      await masterNftContract.mintNFT(owner.address);
      await masterNftContract.mintNFT(user1.address);

      await bidContract.placeBid(nftContract.address, 1000000, {
        value: ethers.utils.parseUnits('0.5'),
      });

      const user1Balance1 = await user1.getBalance();
      const feeBalanceBefore = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );

      const bidId = (
        await bidContract.getBidByCollection(nftContract.address, 0)
      )[0];

      await safeTransferWithBytes(
        nftContract,
        user1,
        user1.address,
        bidContract.address,
        1,
        bidId
      );

      expect(await nftContract.ownerOf(1)).to.equal(owner.address);

      const user1Balance2 = await user1.getBalance();
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.5'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalanceAfter = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );
      expect(feeBalanceAfter.sub(feeBalanceBefore)).to.equal(
        ethers.utils.parseUnits('0')
      );
    });
  });

  describe('Distribute master', () => {
    beforeEach(deploy);

    it('should be able to distribute master nft shares', async function () {
      await masterNftContract
        .connect(owner)
        .addDistributor(bidContract.address);

      // Create auction and buy NFT
      await bidContract.placeBid(nftContract.address, 1000000, {
        value: ethers.utils.parseUnits('1.03'),
      });

      const bidId = (
        await bidContract.getBidByCollection(nftContract.address, 0)
      )[0];

      const transferTx = await safeTransferWithBytes(
        nftContract,
        user1,
        user1.address,
        bidContract.address,
        1,
        bidId
      );

      let currentBalances = [];

      for (let i = 0; i < 3; i++) {
        await masterNftContract.connect(owner).mintNFT(otherSigners[i].address);

        let balanceOfAccount = await otherSigners[i].getBalance();
        currentBalances.push(balanceOfAccount);
      }

      //Distribute fee, 5% of 22% of 1000 = 11
      await bidContract.connect(owner).distributeMasterNftShares();

      // Check update balances
      for (let i = 0; i < 3; i++) {
        let updatedBalance = await otherSigners[i].getBalance();
        expect(updatedBalance.sub(currentBalances[i]).toString()).to.equal(
          ethers.utils.parseUnits('0.004166666666666666')
        );
      }

      expect(
        (await bidContract.provider.getBalance(bidContract.address)).toString()
      ).to.equal('0');
    });
  });

  describe('Royalties', () => {
    beforeEach(async () => {
      await deploy();
      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        royaltiesRecipient.address,
        1000
      );
    });

    it('should distribute royalties', async () => {
      // sending wants to bid 0.5 eth
      // taker fee is 3% = 0.015 eth
      // user sends 0.515 e th
      // owner of nft sees bid with 0.5 eth
      // maker initial sale fee is 22% = 0.11 eth
      // royalties are 10% = 0.05 ETH
      // owner will get 0.34 eth
      // total fee is 0.125
      // total fee after master key cut is 0.11875
      await bidContract.placeBid(nftContract.address, 1000000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      const feeBalance1 = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );
      const user1Balance1 = await user1.getBalance();
      const royaltiesRecipientBalance1 = await royaltiesRecipient.getBalance();

      const bidId = (
        await bidContract.getBidByCollection(nftContract.address, 0)
      )[0];

      const transferTx = await safeTransferWithBytes(
        nftContract,
        user1,
        user1.address,
        bidContract.address,
        1,
        bidId
      );

      await expect(transferTx)
        .to.emit(bidContract, 'BidAccepted')
        .withArgs(
          bidId,
          nftContract.address,
          1,
          owner.address,
          user1.address,
          ethers.utils.parseUnits('0.5')
        );

      const user1Balance2 = await user1.getBalance();
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.34'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalance2 = await nftContract.provider.getBalance(
        '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD'
      );
      expect(feeBalance2.sub(feeBalance1)).to.equal(
        ethers.utils.parseUnits('0.11875')
      );

      const royaltiesRecipientBalance2 = await royaltiesRecipient.getBalance();
      expect(
        royaltiesRecipientBalance2.sub(royaltiesRecipientBalance1)
      ).to.equal(ethers.utils.parseUnits('0.05'));
    });
  });
});
