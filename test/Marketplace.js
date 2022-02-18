const { expect } = require('chai');
const { ethers, network, upgrades } = require('hardhat');
const BN = require('bignumber.js');
const {
  deployEndemicNFT,
  deployMarketplaceWithDeps,
  deployEndemicMasterNFT,
  deployEndemicERC1155,
  deployContractRegistry,
  deployFeeProvider,
} = require('./helpers/deploy');
const { ERC1155_ASSET_CLASS, ERC721_ASSET_CLASS } = require('./helpers/ids');

describe('Marketplace', function () {
  let marketplace,
    masterNftContract,
    nftContract,
    erc1155Contract,
    feeProviderContract,
    royaltiesProviderContract,
    contractRegistryContract;

  let owner, user1, user2, user3, minter, signer, feeRecipient;

  async function mint(id, recipient) {
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

  const createAuctionId = (contractId, tokenId, seller) => {
    return `${contractId}-${tokenId}-${seller}`;
  };

  async function deploy(makerFee = 0, takerFee, initialFee = 0) {
    [
      owner,
      user1,
      user2,
      user3,
      minter,
      signer,
      feeRecipient,
      ...otherSigners
    ] = await ethers.getSigners();

    const result = await deployMarketplaceWithDeps(
      owner,
      makerFee,
      takerFee,
      initialFee
    );

    contractRegistryContract = result.contractRegistryContract;
    masterNftContract = result.masterNftContract;
    feeProviderContract = result.feeProviderContract;
    royaltiesProviderContract = result.royaltiesProviderContract;
    marketplace = result.marketplace;

    nftContract = await deployEndemicNFT(owner);

    await contractRegistryContract.addSaleContract(marketplace.address);

    erc1155Contract = await deployEndemicERC1155(owner);

    await mint(1, user1.address);
    await mintERC1155(user1.address, 3);
  }

  describe('Initial State', function () {
    beforeEach(deploy);

    it('should start with owner and NFT address set', async function () {
      const ownerAddr = await marketplace.owner();
      expect(ownerAddr).to.equal(owner.address);
    });
  });

  describe('Create auction', function () {
    beforeEach(async function () {
      await deploy();
    });

    it("should fail to create auction for NFT you don't own", async function () {
      await expect(
        marketplace
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
      ).to.be.revertedWith('Seller is not owner of the asset');

      await expect(
        marketplace
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
      ).to.be.revertedWith('Seller is not owner of the asset');
    });

    it('should fail to create auction for invalid duration', async function () {
      await nftContract.connect(user1).approve(marketplace.address, 1);

      await expect(
        marketplace
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
        marketplace
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
      ).to.be.revertedWith('Auction too short');
    });

    it('should fail to create auction for nonexistant NFT', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(marketplace.address, 1);

      await expect(
        marketplace
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
      ).to.be.revertedWith('ERC721: owner query for nonexistent token');

      await expect(
        marketplace
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
      ).to.be.revertedWith('Seller is not owner of the asset amount');
    });

    it('should fail to create auction without first approving auction contract', async function () {
      await expect(
        marketplace
          .connect(user1)
          .createAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('Marketplace is not approved for the asset');

      await expect(
        marketplace
          .connect(user1)
          .createAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith('Marketplace is not approved for the asset');
    });

    it('should be able to recreate ERC721 auction', async function () {
      // Create the auction
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await marketplace
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

      await marketplace
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

      const auction1Id = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );
      const auction1 = await marketplace.getAuction(auction1Id);

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
        .setApprovalForAll(marketplace.address, true);

      await marketplace
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

      await marketplace
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

      const auction1Id = await marketplace.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
      const auction1 = await marketplace.getAuction(auction1Id);

      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
    });

    it('should be able to create auctions for multiple NFTs', async function () {
      await mint(2, user1.address);

      await nftContract.connect(user1).approve(marketplace.address, 1);
      await nftContract.connect(user1).approve(marketplace.address, 2);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(marketplace.address, true);

      await marketplace
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

      await marketplace
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

      await marketplace
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

      const auction1Id = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      const auction2Id = await marketplace.createAuctionId(
        nftContract.address,
        2,
        user1.address
      );

      const auction3Id = await marketplace.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );

      const auction1 = await marketplace.getAuction(auction1Id);
      const auction2 = await marketplace.getAuction(auction2Id);
      const auction3 = await marketplace.getAuction(auction3Id);

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
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(marketplace.address, true);

      await expect(
        marketplace
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
      ).to.be.revertedWith('Invalid amount');

      await expect(
        marketplace
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
      ).to.be.revertedWith('Invalid amount');
    });

    it('should fail to create auction for incorrect asset class', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(marketplace.address, 1);

      await expect(
        marketplace
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
      ).to.be.revertedWith(
        "function selector was not recognized and there's no fallback function"
      );
    });
  });

  describe('Bidding', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(marketplace.address, true);

      const startingPrice = ethers.utils.parseUnits('0.1');
      const endingPrice = ethers.utils.parseUnits('0.1');
      const duration = 120;

      await marketplace
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

      await marketplace
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

      erc721AuctionId = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      erc1155AuctionId = await marketplace.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
    });

    it('should fail to bid with insufficient value', async function () {
      await expect(
        marketplace.connect(user2).bid(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.01'),
        })
      ).to.be.revertedWith('Bid amount can not be lower then auction price');

      await expect(
        marketplace.connect(user2).bid(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.01'),
        })
      ).to.be.revertedWith('Bid amount can not be lower then auction price');

      await expect(
        marketplace.connect(user2).bid(erc1155AuctionId, 2, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith('Bid amount can not be lower then auction price');
    });

    it('should fail to bid if auction has been concluded', async function () {
      await marketplace.connect(user1).cancelAuction(erc721AuctionId);
      await marketplace.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(
        marketplace.connect(user2).bid(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith('NFT is not on auction');

      await expect(
        marketplace.connect(user2).bid(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith('NFT is not on auction');
    });

    it('should be able to bid on ERC721', async function () {
      const user1Bal1 = await user1.getBalance();

      await marketplace.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      // User1 should receive 100 wei, fee is zero

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.1'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);

      await expect(marketplace.getAuction(erc721AuctionId)).to.be.revertedWith(
        'Not on auction'
      );
    });

    it('should be able to bid on ERC1155', async function () {
      const user1Bal1 = await user1.getBalance();

      await marketplace.connect(user2).bid(erc1155AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      // Bidder should own NFT
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      // Auction is still on because all amount has not been sold
      const erc1155Auction = await marketplace.getAuction(erc1155AuctionId);
      expect(erc1155Auction.amount).to.equal('2');

      // Buy two more
      await marketplace.connect(user2).bid(erc1155AuctionId, 2, {
        value: ethers.utils.parseUnits('0.206'),
      });

      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(3);

      // Auction is now complete
      await expect(marketplace.getAuction(erc1155AuctionId)).to.be.revertedWith(
        'Not on auction'
      );

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.3'));
    });

    it('should be able to bid at endingPrice if auction has passed duration', async function () {
      const user1Bal1 = await user1.getBalance();
      await network.provider.send('evm_increaseTime', [200]);

      await marketplace.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      await marketplace.connect(user2).bid(erc1155AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.2'));
    });

    it('should fail to bid after someone else has bid', async function () {
      await marketplace.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });
      await expect(
        marketplace.connect(user3).bid(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith('NFT is not on auction');

      await marketplace.connect(user2).bid(erc1155AuctionId, 3, {
        value: ethers.utils.parseUnits('0.309'),
      });
      await expect(
        marketplace.connect(user3).bid(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith('NFT is not on auction');
    });

    it('should be able to bid in middle of auction', async function () {
      const user1Bal1 = await user1.getBalance();
      await network.provider.send('evm_increaseTime', [60]);
      await marketplace.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });
      await marketplace.connect(user2).bid(erc1155AuctionId, 2, {
        value: ethers.utils.parseUnits('0.206'),
      });

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(2);
    });

    it('should trigger an event after successful bid', async function () {
      const bid1 = marketplace.connect(user2).bid(erc721AuctionId, 1, {
        value: ethers.utils.parseUnits('0.103'),
      });

      await expect(bid1)
        .to.emit(marketplace, 'AuctionSuccessful')
        .withArgs(
          erc721AuctionId,
          ethers.utils.parseUnits('0.1'),
          user2.address,
          1,
          ethers.utils.parseUnits('0')
        );

      await expect(bid1)
        .to.emit(nftContract, 'Transfer')
        .withArgs(user1.address, user2.address, 1);

      const bid2 = marketplace.connect(user2).bid(erc1155AuctionId, 2, {
        value: ethers.utils.parseUnits('0.206'),
      });

      await expect(bid2)
        .to.emit(marketplace, 'AuctionSuccessful')
        .withArgs(
          erc1155AuctionId,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          2,
          ethers.utils.parseUnits('0')
        );
    });
  });

  describe('Conclude auction', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(marketplace.address, true);

      await marketplace
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

      await marketplace
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

      erc721AuctionId = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      erc1155AuctionId = await marketplace.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
    });

    it('should fail to conclude if NFT not on auction', async function () {
      await expect(
        marketplace.connect(user1).cancelAuction(
          await marketplace.createAuctionId(
            erc1155Contract.address,
            2, //invalid
            user1.address
          )
        )
      ).to.be.revertedWith('Invalid auction');
    });

    it('should fail to conclude auction if not seller', async function () {
      await expect(
        marketplace.connect(user2).cancelAuction(erc721AuctionId)
      ).to.be.revertedWith('Sender is not seller');

      await expect(
        marketplace.connect(user2).cancelAuction(erc1155AuctionId)
      ).to.be.revertedWith('Sender is not seller');
    });

    it('should be able to conclude auction', async function () {
      await network.provider.send('evm_increaseTime', [60]);
      await marketplace.connect(user1).cancelAuction(erc721AuctionId);
      await marketplace.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(marketplace.getAuction(erc721AuctionId)).to.be.revertedWith(
        'Not on auction'
      );
      await expect(marketplace.getAuction(erc1155AuctionId)).to.be.revertedWith(
        'Not on auction'
      );
    });

    it('should trigger event after canceling auction', async function () {
      const cancleAuction1 = await marketplace
        .connect(user1)
        .cancelAuction(erc721AuctionId);

      const cancleAuction2 = await marketplace
        .connect(user1)
        .cancelAuction(erc1155AuctionId);

      await expect(cancleAuction1)
        .to.emit(marketplace, 'AuctionCancelled')
        .withArgs(erc721AuctionId);

      await expect(cancleAuction2)
        .to.emit(marketplace, 'AuctionCancelled')
        .withArgs(erc1155AuctionId);
    });
  });

  describe('Fee', function () {
    beforeEach(async function () {
      await deploy(250, 300, 2200);
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(marketplace.address, true);
    });

    it('should take cut on initial sale', async function () {
      // saves current contract and user1 balances and creates auction
      const claimEthBalance1 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      await marketplace
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
      const auctionid = await marketplace.createAuctionId(
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
      const bidTx = await marketplace.connect(user2).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('0.206'),
      });

      await expect(bidTx)
        .to.emit(marketplace, 'AuctionSuccessful')
        .withArgs(
          auctionid,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.05')
        );

      const claimEthBalance2 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user1Bal2 = await user1.getBalance();
      const token2Owner = await nftContract.ownerOf(1);
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 22% of 0.2 + 3% fee
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.05')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);
      // 0.2 minus 22% fee (220)
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.156'));
      expect(token2Owner).to.equal(user2.address);
    });

    it('should take cut on sequential sales', async function () {
      // Creates auction and bid it
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await marketplace
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

      const auctionid = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      // Buy with user 2
      await marketplace.connect(user2).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('1.03'),
      });

      // Auction again with user 2
      await nftContract.connect(user2).approve(marketplace.address, 1);
      await marketplace
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

      const auctionid2 = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user2.address
      );

      // Grab current balance
      const user2Bal1 = await user2.getBalance();
      const claimEthBalance1 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );

      // Buy with user 3
      const bidTx = await marketplace.connect(user3).bid(auctionid2, 1, {
        value: ethers.utils.parseUnits('0.515'),
      });

      await expect(bidTx)
        .to.emit(marketplace, 'AuctionSuccessful')
        .withArgs(
          auctionid2,
          ethers.utils.parseUnits('0.5'),
          user3.address,
          1,
          ethers.utils.parseUnits('0.0275')
        );

      //Grab updated balances
      const claimEthBalance2 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user2Bal2 = await user2.getBalance();

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);
      const user2Diff = user2Bal2.sub(user2Bal1);

      // Checks if marketplace gets 2.5% maker fee + 3% taker fee
      // 2.5% of 0.5 + 0.015 taker fee
      expect(claimEthBalanceDiff).to.equal(ethers.utils.parseUnits('0.0275'));
      expect(user2Diff.toString()).to.equal(ethers.utils.parseUnits('0.4875'));

      // New owner
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user3.address);
    });

    it('should calculate seller fee correctly', async () => {
      await masterNftContract.connect(owner).mintNFT(user1.address);
      const masterNftFee = await feeProviderContract.getMakerFee(
        user1.address,
        nftContract.address,
        1
      );
      expect(masterNftFee).to.equal(0);

      const initialFee = await feeProviderContract.getMakerFee(
        user2.address,
        nftContract.address,
        2
      );
      expect(initialFee).to.equal(2200);

      await marketplace
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

      const auctionid = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await marketplace.connect(user2).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('1.03'),
      });

      // Initial sale completed, now fee should be 2.5%
      const marketplaceFee = await feeProviderContract.getMakerFee(
        user2.address,
        nftContract.address,
        1
      );
      expect(marketplaceFee).to.equal(250);
    });
    it('should calculate taker fee correctly', async () => {
      await masterNftContract.connect(owner).mintNFT(user1.address);
      const masterNftFee = await feeProviderContract.getTakerFee(user1.address);
      expect(masterNftFee).to.equal(0);

      const marketplaceFee = await feeProviderContract.getTakerFee(
        user2.address
      );
      expect(marketplaceFee).to.equal(300);
    });

    it('should handle fee change', async function () {
      // Update fees
      await feeProviderContract.connect(owner).updateFee(500, 1000, 2000, 500); // 5% maker fee, 10% taker fee, 20% initial sale cut
      // Creates auction and bid it
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await marketplace
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('2'),
          ethers.utils.parseUnits('2'),
          60,
          1,
          ERC721_ASSET_CLASS
        );

      const auctionid = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      const claimEthBalance1 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );

      await marketplace.connect(user2).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('2.2'),
      });

      // Contract now has 0.4 + 0.2 = 0.6 ETH
      // Create another auction
      await nftContract.connect(user2).approve(marketplace.address, 1);
      await marketplace
        .connect(user2)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1'),
          ethers.utils.parseUnits('1'),
          60,
          1,
          ERC721_ASSET_CLASS
        );

      const auctionid2 = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user2.address
      );

      // Grab current balance of seller
      const user2Bal1 = await user2.getBalance();

      // Bid it
      await marketplace.connect(user3).bid(auctionid2, 1, {
        value: ethers.utils.parseUnits('1.1'),
      });

      // Contract nw has 0.1 + 0.05
      //Grab updated balances of seller and contract

      const claimEthBalance2 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user2Bal2 = await user2.getBalance();

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);
      const user2Diff = user2Bal2.sub(user2Bal1);

      // Checks if marketplace gets 5% maker and 10% taker
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.75')
      );
      expect(user2Diff.toString()).to.equal(ethers.utils.parseUnits('0.95'));

      // New owner
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user3.address);
    });

    it('should not charge maker fee if seller is owner of master NFT', async function () {
      // creates master NFT for user1, creates auction
      await masterNftContract.connect(owner).mintNFT(user1.address);
      await marketplace
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          ERC721_ASSET_CLASS
        );

      // Grab balances
      const claimEthBalance1 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user1Bal1 = await user1.getBalance();

      const auctionid = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      // Buy NFT
      await marketplace.connect(user3).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('0.206'),
      });

      // Grab updated balances
      const claimEthBalance2 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user1Bal2 = await user1.getBalance();

      // Only taker fee is taken (3%)
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.006')
      );

      // Seller got full amount
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.2'));
    });

    it('should not charge taker fee if buyer is owner of master NFT', async function () {
      await masterNftContract.connect(owner).mintNFT(user3.address);
      await marketplace
        .connect(user1)
        .createAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          ERC721_ASSET_CLASS
        );

      await marketplace
        .connect(user1)
        .createAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          ERC1155_ASSET_CLASS
        );

      // Grab balances
      const claimEthBalance1 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user1Bal1 = await user1.getBalance();

      const auctionid = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      const auctionid2 = await marketplace.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );

      // Buy NFT
      await marketplace.connect(user3).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('0.2'),
      });
      await marketplace.connect(user3).bid(auctionid2, 1, {
        value: ethers.utils.parseUnits('0.2'),
      });

      // Grab updated balances
      const claimEthBalance2 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      const user1Bal2 = await user1.getBalance();

      // Fee shouldn't be taken, diff is zero
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.088')
      );

      // Seller got full amount
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.312'));
    });
  });

  describe('Cancel auctions while paused', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(marketplace.address, true);

      await marketplace
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

      await marketplace
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

      erc721AuctionId = await marketplace.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      erc1155AuctionId = await marketplace.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
    });

    it('should fail to cancel auction when not paused', async function () {
      await expect(
        marketplace.connect(owner).cancelAuctionWhenPaused(erc721AuctionId)
      ).to.be.revertedWith('Pausable: not paused');

      await expect(
        marketplace.connect(owner).cancelAuctionWhenPaused(erc1155AuctionId)
      ).to.be.revertedWith('Pausable: not paused');
    });

    it('should fail to cancel auction when not owner', async function () {
      await marketplace.connect(owner).pause();
      await expect(
        marketplace.connect(user2).cancelAuctionWhenPaused(erc721AuctionId)
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        marketplace.connect(user2).cancelAuctionWhenPaused(erc1155AuctionId)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should be able to cancel auction as owner when paused', async function () {
      await marketplace.connect(owner).pause();
      await marketplace.connect(owner).cancelAuctionWhenPaused(erc721AuctionId);
      await marketplace
        .connect(owner)
        .cancelAuctionWhenPaused(erc1155AuctionId);

      await expect(marketplace.getAuction(erc721AuctionId)).to.be.revertedWith(
        'Not on auction'
      );

      await expect(marketplace.getAuction(erc1155AuctionId)).to.be.revertedWith(
        'Not on auction'
      );
    });

    it('should be able to cancel auction as auction owner when paused', async function () {
      await marketplace.connect(owner).pause();
      await marketplace.connect(user1).cancelAuction(erc721AuctionId);
      await marketplace.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(marketplace.getAuction(erc721AuctionId)).to.be.revertedWith(
        'Not on auction'
      );

      await expect(marketplace.getAuction(erc1155AuctionId)).to.be.revertedWith(
        'Not on auction'
      );
    });
  });

  describe('Royalties', function () {
    beforeEach(async function () {
      await deploy(250, 300, 2200);
      await nftContract.connect(user1).approve(marketplace.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(marketplace.address, true);

      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        feeRecipient.address,
        1000
      );
    });

    it('should distribute royalties', async () => {
      await marketplace
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
      const auctionid = await marketplace.createAuctionId(
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

      const claimEthBalance1 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );

      const feeRecipientBalance1 = await feeRecipient.getBalance();
      const user1Bal1 = await user1.getBalance();

      await marketplace.connect(user2).bid(auctionid, 1, {
        value: ethers.utils.parseUnits('0.206'),
      });

      const user1Bal2 = await user1.getBalance();
      const feeRecipientBalance2 = await feeRecipient.getBalance();
      const claimEthBalance2 = await marketplace.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 22% of 0.2 + 3% fee
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.05')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);
      // 0.2 minus 22% fee minus 10% royalties
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.136'));

      const feeRecipientDiff = feeRecipientBalance2.sub(feeRecipientBalance1);
      expect(feeRecipientDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.02')
      );
    });
  });
});
