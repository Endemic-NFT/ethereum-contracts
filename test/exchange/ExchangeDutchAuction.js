const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const BN = require('bignumber.js');
const {
  deployEndemicCollectionWithFactory,
  deployEndemicExchangeWithDeps,
  deployEndemicERC1155,
  deployEndemicToken,
} = require('../helpers/deploy');

const { ZERO_ADDRESS, FEE_RECIPIENT } = require('../helpers/constants');
const { ERC1155_ASSET_CLASS, ERC721_ASSET_CLASS } = require('../helpers/ids');
const {
  weiToEther,
  calculateAuctionDuration,
  addTakerFee,
} = require('../helpers/token');

const INVALID_AUCTION_ERROR = 'InvalidAuction';
const INVALID_DURATION_ERROR = 'InvalidDuration';
const INVALID_AMOUNT_ERROR = 'InvalidAmount';
const INVALID_PAYMENT_METHOD = 'InvalidPaymentMethod';

const AUCTION_SUCCESFUL = 'AuctionSuccessful';
const AUCTION_CANCELED = 'AuctionCancelled';

const UNSUFFICIENT_CURRENCY_SUPPLIED = 'UnsufficientCurrencySupplied';

const UNAUTHORIZED_ERROR = 'Unauthorized';
const SELLER_NOT_ASSET_OWNER = 'SellerNotAssetOwner';

describe('ExchangeDutchAuction', function () {
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

  describe('Create dutch auction with Ether', function () {
    beforeEach(async function () {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it("should fail to create dutch auction for NFT you don't own", async function () {
      await expect(
        endemicExchange
          .connect(user2)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);

      await expect(
        endemicExchange
          .connect(user2)
          .createDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            ZERO_ADDRESS,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create dutch auction for invalid duration', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            new BN(99).pow(99),
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.reverted;

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            1,
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_DURATION_ERROR);
    });

    it('should fail to create dutch auction for invalid price configuration', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.00001'),
            120,
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.00001'),
            ethers.utils.parseUnits('0.000001'),
            120,
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.2'),
            120,
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            120,
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');
    });

    it('should fail to create dutch auction for nonexistant NFT', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('OwnerQueryForNonexistentToken');

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            erc1155Contract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            1,
            ZERO_ADDRESS,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should be able to recreate ERC721 dutch auction', async function () {
      // Create the auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
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
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.2'),
          1200,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [1050]);
      await network.provider.send('evm_mine');

      const auction1Id = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );
      const auction1 = await endemicExchange.getAuction(auction1Id);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        auction1Id
      );

      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.0')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      //   totalPriceChange = 0.2 - 1 = -0.8
      //   currentPriceChange = (totalPriceChange * 1050) / 1200 = -0.7
      //   currentPrice = 1.0 + currentPriceChange
      expect(auction1CurrentPrice).to.equal(ethers.utils.parseUnits('0.3'));
      expect(auction1.paymentErc20TokenAddress).to.equal(endemicToken.address);
    });

    it('should be able to recreate ERC1155 dutch auction', async function () {
      // Create the auction
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          ZERO_ADDRESS,
          ERC1155_ASSET_CLASS
        );

      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.1'),
          1200,
          1,
          endemicToken.address,
          ERC1155_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [700]);
      await network.provider.send('evm_mine');

      const auction1Id = await endemicExchange.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
      const auction1 = await endemicExchange.getAuction(auction1Id);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        auction1Id
      );

      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.0')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      //   totalPriceChange = 0.1 - 1 = -0.9
      //   currentPriceChange = (totalPriceChange * 700) / 1200 = -0.525
      //   currentPrice = 1.0 + currentPriceChange
      expect(auction1CurrentPrice).to.equal(ethers.utils.parseUnits('0.475'));
      expect(auction1.paymentErc20TokenAddress).to.equal(endemicToken.address);
    });

    it('should be able to create dutch auctions for multiple NFTs', async function () {
      await mintERC721(user1.address);

      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await nftContract.connect(user1).approve(endemicExchange.address, 2);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

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

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          2,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.1'),
          2000,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.1'),
          3000,
          2,
          ZERO_ADDRESS,
          ERC1155_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [1500]);
      await network.provider.send('evm_mine');

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

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        auction1Id
      );
      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        auction2Id
      );
      const auction3CurrentPrice = await endemicExchange.getCurrentPrice(
        auction3Id
      );

      // First
      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.0')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(calculateAuctionDuration(auction1)).to.equal('1000');

      expect(auction1CurrentPrice).to.equal(auction1.endingPrice.toString()); //auction has passed => ending price

      // Second
      expect(auction2.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.0')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(calculateAuctionDuration(auction2)).to.equal('2000');
      //   totalPriceChange = 0.2 - 1 = -0.9
      //   currentPriceChange = (totalPriceChange * 1500) / 2000 = -0.675
      //   currentPrice = 1.0 + currentPriceChange
      expect(auction2CurrentPrice).to.equal(ethers.utils.parseUnits('0.32455'));

      // third
      expect(auction3.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.0')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(calculateAuctionDuration(auction3)).to.equal('3000');

      //   totalPriceChange = 0.1 - 1 = -0.8
      //   currentPriceChange = (totalPriceChange * 1500) / 2000 = -0.45
      //   currentPrice = 1.0 + currentPriceChange
      expect(auction3CurrentPrice).to.equal(ethers.utils.parseUnits('0.55'));
    });

    it('should fail to create dutch auction for incorrect amount', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            2,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            0,
            ZERO_ADDRESS,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);
    });

    it('should fail to create dutch auction for incorrect asset class', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            2,
            ZERO_ADDRESS,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidInterface');
    });
  });

  describe('Create dutch auction with ERC20', function () {
    beforeEach(async function () {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it("should fail to create dutch auction for NFT you don't own", async function () {
      await expect(
        endemicExchange
          .connect(user2)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);

      await expect(
        endemicExchange
          .connect(user2)
          .createDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            endemicToken.address,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create dutch auction for invalid duration', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            new BN(99).pow(99),
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.reverted;

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            1,
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_DURATION_ERROR);
    });

    it('should fail to create dutch auction for invalid price configuration', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.2'),
            120,
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            120,
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');
    });

    it('should fail to create dutch auction for nonexistant NFT', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('OwnerQueryForNonexistentToken');

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            erc1155Contract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            1,
            endemicToken.address,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create dutch auction for not supported ERC20 token payment', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            '0x0000000000000000000000000000000000000001',
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_PAYMENT_METHOD);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            60,
            1,
            '0x0000000000000000000000000000000000000001',
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_PAYMENT_METHOD);
    });

    it('should be able to recreate ERC721 dutch auction', async function () {
      // Create the auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.1'),
          1000,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.2'),
          1200,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [750]);
      await network.provider.send('evm_mine');

      const auction1Id = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );
      const auction1 = await endemicExchange.getAuction(auction1Id);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        auction1Id
      );

      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.0')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      //   totalPriceChange = 0.2 - 1 = -0.9
      //   currentPriceChange = (totalPriceChange * 750) / 1200 = -0.5
      //   currentPrice = 1.0 + currentPriceChange
      expect(auction1CurrentPrice).to.equal(ethers.utils.parseUnits('0.5'));

      expect(auction1.paymentErc20TokenAddress).to.equal(ZERO_ADDRESS);
    });

    it('should be able to recreate ERC1155 dutch auction', async function () {
      // Create the auction
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.5'),
          ethers.utils.parseUnits('0.4'),
          1000,
          1,
          endemicToken.address,
          ERC1155_ASSET_CLASS
        );
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1100,
          1,
          ZERO_ADDRESS,
          ERC1155_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [850]);
      await network.provider.send('evm_mine');

      const auction1Id = await endemicExchange.createAuctionId(
        erc1155Contract.address,
        1,
        user1.address
      );
      const auction1 = await endemicExchange.getAuction(auction1Id);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        auction1Id
      );

      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.4')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 850) / 1100 = -0.927272
      //   currentPrice = 1.0 + currentPriceChange
      expect(auction1CurrentPrice).to.equal(
        ethers.utils.parseUnits('0.472727272727272728')
      );
      expect(auction1.paymentErc20TokenAddress).to.equal(ZERO_ADDRESS);
    });

    it('should be able to create dutch auctions for multiple NFTs with ERC20 token payment', async function () {
      await mintERC721(user1.address);

      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await nftContract.connect(user1).approve(endemicExchange.address, 2);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.2'),
          ethers.utils.parseUnits('0.3'),
          1500,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          2,
          ethers.utils.parseUnits('2.0'),
          ethers.utils.parseUnits('0.4'),
          2000,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.8'),
          3000,
          2,
          endemicToken.address,
          ERC1155_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [1750]);
      await network.provider.send('evm_mine');

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

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        auction1Id
      );
      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        auction2Id
      );
      const auction3CurrentPrice = await endemicExchange.getCurrentPrice(
        auction3Id
      );

      // First
      expect(auction1.seller).to.equal(user1.address);
      expect(auction1.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.2')
      );
      expect(auction1.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.3')
      );
      expect(calculateAuctionDuration(auction1)).to.equal('1500');

      expect(auction1CurrentPrice).to.equal(ethers.utils.parseUnits('0.3')); //auction has passed => ending price

      // Second
      expect(auction2.seller).to.equal(user1.address);
      expect(auction2.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('2.0')
      );
      expect(auction2.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.4')
      );
      expect(calculateAuctionDuration(auction2)).to.equal('2000');

      //   totalPriceChange = 0.4 - 2.0 = -1.6
      //   currentPriceChange = (totalPriceChange * 1750) / 2000 = --1.399999999999999911182158029987
      //   currentPrice = 2.0 + currentPriceChange
      expect(auction2CurrentPrice).to.equal(ethers.utils.parseUnits('0.5992'));

      // third
      expect(auction3.seller).to.equal(user1.address);
      expect(auction3.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.4')
      );
      expect(auction3.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.8')
      );
      expect(calculateAuctionDuration(auction3)).to.equal('3000');

      //   totalPriceChange = 0.8 - 1.4 = -0.6
      //   currentPriceChange = (totalPriceChange * 1750) / 1200 = --0.349
      //   currentPrice = 1.4 + currentPriceChange
      expect(auction3CurrentPrice).to.equal(ethers.utils.parseUnits('1.05'));
    });

    it('should fail to recreate ERC721 dutch auction because reserve auction is in progress', async function () {
      // Create the reserve auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

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

      const erc721AuctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

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

      //Try to recreate reserve auction to become dutch
      await expect(
        endemicExchange
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
          )
      ).to.be.revertedWith('AuctionInProgress');
    });

    it('should be able to recreate ERC721 dutch auction because reserve auction did not start yet', async function () {
      // Create the reserve auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

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

      const auction1Id = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      const auctionBefore = await endemicExchange.getAuction(auction1Id);

      expect(auctionBefore.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auctionBefore.endingPrice.toString()).to.equal('0');

      //Try to recreate reserve auction to become dutch
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

      const auctionAfter = await endemicExchange.getAuction(auction1Id);

      expect(auctionAfter.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('1.0')
      );
      expect(auctionAfter.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
    });

    it('should fail to create dutch auction for incorrect amount', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            2,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            0,
            endemicToken.address,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);
    });

    it('should fail to create dutch auction for incorrect asset class', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createDutchAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.3'),
            ethers.utils.parseUnits('0.2'),
            60,
            2,
            endemicToken.address,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidInterface');
    });
  });

  describe('Create fixed auction with Ether', function () {
    beforeEach(async function () {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it("should fail to create fixed auction for NFT you don't own", async function () {
      await expect(
        endemicExchange
          .connect(user2)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);

      await expect(
        endemicExchange
          .connect(user2)
          .createFixedDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            1,
            ZERO_ADDRESS,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create fixed auction for nonexistant NFT', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('OwnerQueryForNonexistentToken');

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            erc1155Contract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            1,
            ZERO_ADDRESS,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create fixed auction for invalid price configuration', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.2'),
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');
    });

    it('should be able to recreate ERC721 fixed auction', async function () {
      // Create the auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          endemicToken.address,
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
      expect(auction1.paymentErc20TokenAddress).to.equal(endemicToken.address);
    });

    it('should be able to recreate ERC1155 fixed auction', async function () {
      // Create the auction
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          ZERO_ADDRESS,
          ERC1155_ASSET_CLASS
        );
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          endemicToken.address,
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
      expect(auction1.paymentErc20TokenAddress).to.equal(endemicToken.address);
    });

    it('should be able to create fixed auctions for multiple NFTs', async function () {
      await mintERC721(user1.address);

      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await nftContract.connect(user1).approve(endemicExchange.address, 2);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          2,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          2,
          ZERO_ADDRESS,
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
      expect(calculateAuctionDuration(auction1)).to.equal('0');

      // Second
      expect(auction2.seller).to.equal(user1.address);
      expect(auction2.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auction2.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(calculateAuctionDuration(auction2)).to.equal('0');

      // third
      expect(auction3.seller).to.equal(user1.address);
      expect(auction3.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(auction3.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(calculateAuctionDuration(auction3)).to.equal('0');
    });

    it('should fail to create fixed auction for incorrect amount', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            2,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            0,
            ZERO_ADDRESS,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);
    });

    it('should fail to create fixed auction for incorrect asset class', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            2,
            ZERO_ADDRESS,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidInterface');
    });
  });

  describe('Create fixed auction with ERC20', function () {
    beforeEach(async function () {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it("should fail to create fixed auction for NFT you don't own", async function () {
      await expect(
        endemicExchange
          .connect(user2)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);

      await expect(
        endemicExchange
          .connect(user2)
          .createFixedDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            1,
            endemicToken.address,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create fixed auction for nonexistant NFT', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('OwnerQueryForNonexistentToken');

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            erc1155Contract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            1,
            endemicToken.address,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(SELLER_NOT_ASSET_OWNER);
    });

    it('should fail to create fixed auction for invalid price configuration', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.2'),
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.1'),
            1,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidPriceConfiguration');
    });

    it('should fail to create auction for not supported ERC20 token payment', async function () {
      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            1,
            '0x0000000000000000000000000000000000000001',
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_PAYMENT_METHOD);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            1,
            '0x0000000000000000000000000000000000000001',
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_PAYMENT_METHOD);
    });

    it('should be able to recreate ERC721 fixed auction', async function () {
      // Create the auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          ZERO_ADDRESS,
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

      expect(auction1.paymentErc20TokenAddress).to.equal(ZERO_ADDRESS);
    });

    it('should be able to recreate ERC1155 fixed auction', async function () {
      // Create the auction
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          endemicToken.address,
          ERC1155_ASSET_CLASS
        );
      // Try to create the auction again

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          ZERO_ADDRESS,
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
      expect(auction1.paymentErc20TokenAddress).to.equal(ZERO_ADDRESS);
    });

    it('should be able to create fixed auctions for multiple NFTs with ERC20 token payment', async function () {
      await mintERC721(user1.address);

      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await nftContract.connect(user1).approve(endemicExchange.address, 2);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          2,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          2,
          endemicToken.address,
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
      expect(calculateAuctionDuration(auction1)).to.equal('0');

      // Second
      expect(auction2.seller).to.equal(user1.address);
      expect(auction2.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auction2.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(calculateAuctionDuration(auction2)).to.equal('0');

      // third
      expect(auction3.seller).to.equal(user1.address);
      expect(auction3.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(auction3.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.2')
      );
      expect(calculateAuctionDuration(auction3)).to.equal('0');
    });

    it('should fail to recreate ERC721 fixed auction because reserve auction is in progress', async function () {
      // Create the reserve auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

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

      const erc721AuctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

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

      //Try to recreate reserve auction to become dutch
      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.1'),
            ethers.utils.parseUnits('0.1'),
            1,
            ZERO_ADDRESS,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith('AuctionInProgress');
    });

    it('should be able to recreate ERC721 fixed auction because reserve auction did not start yet', async function () {
      // Create the reserve auction
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

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

      const auction1Id = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      const auctionBefore = await endemicExchange.getAuction(auction1Id);

      expect(auctionBefore.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auctionBefore.endingPrice.toString()).to.equal('0');

      //Try to recreate reserve auction to become dutch
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      const auctionAfter = await endemicExchange.getAuction(auction1Id);

      expect(auctionAfter.startingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
      expect(auctionAfter.endingPrice.toString()).to.equal(
        ethers.utils.parseUnits('0.1')
      );
    });

    it('should fail to create fixed auction for incorrect amount', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            2,
            endemicToken.address,
            ERC721_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            erc1155Contract.address,
            1,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            0,
            endemicToken.address,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith(INVALID_AMOUNT_ERROR);
    });

    it('should fail to create fixed auction for incorrect asset class', async function () {
      const noSuchTokenId = '22';
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user1)
          .createFixedDutchAuction(
            nftContract.address,
            noSuchTokenId,
            ethers.utils.parseUnits('0.2'),
            ethers.utils.parseUnits('0.2'),
            2,
            endemicToken.address,
            ERC1155_ASSET_CLASS
          )
      ).to.be.revertedWith('InvalidInterface');
    });
  });

  describe('Bidding with Ether on dutch auction', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      const startingPrice = ethers.utils.parseUnits('0.1');
      const endingPrice = ethers.utils.parseUnits('0.01');
      const duration = 120;

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          startingPrice,
          endingPrice,
          duration,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          startingPrice,
          endingPrice,
          duration,
          3,
          ZERO_ADDRESS,
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
        endemicExchange.connect(user2).bidForDutchAuction(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.01'),
        })
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.01'),
        })
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 2, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);
    });

    it('should fail to bid if auction has been concluded', async function () {
      await endemicExchange.connect(user1).cancelAuction(erc721AuctionId);
      await endemicExchange.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should fail to bid on dutch auction because auction is listed as reserved', async function () {
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

      const auctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(auctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on dutch ERC721 auction', async function () {
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      const user1Bal1 = await user1.getBalance();

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43999999999999995
      //   fee = (currentPrice * 300) / 10000
      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );
      const fee = ethers.utils.parseUnits('0.0132');
      const totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits(totalPrice.toString()),
        });

      // User1 should receive 0.396156 ether, 80% of auction has passed

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(
        ethers.utils.parseUnits('0.396156')
      );

      // 0.39492 = seller proceeds if we don't forward all sent ethers to seller and fee receipients
      // now we forward all funds in case of ether payments => seller get few percent more than before in case of ether
      expect(user1Diff).to.be.gt(ethers.utils.parseUnits('0.39492'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);

      await expect(
        endemicExchange.getAuction(erc721AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on dutch ERC1155 auction', async function () {
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.2'),
          1000,
          3,
          ZERO_ADDRESS,
          ERC1155_ASSET_CLASS
        );

      const user1Bal1 = await user1.getBalance();

      await network.provider.send('evm_increaseTime', [850]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.2 - 1.0 = -0.8
      //   currentPriceChange = (totalPriceChange * 850) / 1000 = -0.68
      //   currentPrice = 1.0 + currentPriceChange = 0.32
      //   fee = (currentPrice * 300) / 10000
      let auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      let fee = ethers.utils.parseUnits('0.0096');

      let totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits(totalPrice.toString()),
        });

      // Bidder should own NFT
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      await network.provider.send('evm_increaseTime', [20]);
      await network.provider.send('evm_mine');

      auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      //   totalPriceChange = 0.2 - 1.0 = -0.8
      //   currentPriceChange = (totalPriceChange * 870) / 1000 = -0.608
      //   currentPrice = 1.0 + currentPriceChange = 2 * 0.304
      //   fee = (currentPrice * 300) / 10000

      // Auction is still on because all amount has not been sold
      const erc1155Auction = await endemicExchange.getAuction(erc1155AuctionId);
      expect(erc1155Auction.amount).to.equal('2');

      fee = ethers.utils.parseUnits('0.01824');

      totalPrice = 2 * +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      // Buy two more
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2, {
          value: ethers.utils.parseUnits(totalPrice.toString()),
        });

      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(3);

      // Auction is now complete
      await expect(
        endemicExchange.getAuction(erc1155AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);

      //85% auction duration has passed when bought first one + 87% when bought two more
      expect(user1Diff.toString()).to.equal(
        ethers.utils.parseUnits('0.9265200000000001')
      );

      // 0.924 = seller proceeds if we don't forward all sent ethers to seller and fee receipients
      // now we forward all funds in case of ether payments => seller get few percent more than before in case of ether
      expect(user1Diff).to.be.gt(ethers.utils.parseUnits('0.924'));
    });

    it('should be able to bid at endingPrice if auction has passed duration', async function () {
      const user1Bal1 = await user1.getBalance();
      await network.provider.send('evm_increaseTime', [200]);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );

      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1, {
          value: auction1CurrentPrice,
        });

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 1, {
          value: auction2CurrentPrice,
        });

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.19765'));

      // 0.19 = seller proceeds if we don't forward all sent ethers to seller and fee receipients
      // now we forward all funds in case of ether payments => seller get few percent more than before in case of ether
      expect(user1Diff).to.be.gt(ethers.utils.parseUnits('0.19'));
    });

    it('should fail to bid after someone else has bid', async function () {
      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );

      const auction1TotalPrice = addTakerFee(auction1CurrentPrice);

      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      const auction2TotalPrice = addTakerFee(auction2CurrentPrice);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1, {
          value: auction1TotalPrice,
        });
      await expect(
        endemicExchange.connect(user3).bidForDutchAuction(erc721AuctionId, 1, {
          value: auction1TotalPrice,
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 3, {
          value: (3 * +auction2TotalPrice).toString(),
        });
      await expect(
        endemicExchange.connect(user3).bidForDutchAuction(erc1155AuctionId, 1, {
          value: auction2TotalPrice,
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid in middle of auction', async function () {
      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );

      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      await network.provider.send('evm_increaseTime', [60]);
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1, {
          value: auction1CurrentPrice,
        });
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2, {
          value: (2 * +auction2CurrentPrice).toString(),
        });

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(2);
    });

    it('should trigger an event after successful bid', async function () {
      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );

      const totalPrice = addTakerFee(auction1CurrentPrice);

      const bid1 = endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1, {
          value: totalPrice,
        });

      await expect(bid1)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          erc721AuctionId,
          ethers.utils.parseUnits('0.0992725'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.002955')
        );

      await expect(bid1)
        .to.emit(nftContract, 'Transfer')
        .withArgs(user1.address, user2.address, 1);

      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      const auction2TotalPrice = addTakerFee(auction2CurrentPrice);

      const bid2 = endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2, {
          value: (2 * +auction2TotalPrice).toString(),
        });

      await expect(bid2)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          erc1155AuctionId,
          ethers.utils.parseUnits('0.198545'),
          user2.address,
          2,
          ethers.utils.parseUnits('0.00591')
        );
    });
  });

  describe('Bidding with ERC20 on dutch auction', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );

      const startingPrice = ethers.utils.parseUnits('0.1');
      const endingPrice = ethers.utils.parseUnits('0.01');
      const duration = 120;

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          startingPrice,
          endingPrice,
          duration,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          startingPrice,
          endingPrice,
          duration,
          3,
          endemicToken.address,
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
        endemicExchange.connect(user2).bidForDutchAuction(erc721AuctionId, 1)
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 1)
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 2)
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);
    });

    it('should fail to bid if auction has been concluded', async function () {
      await endemicExchange.connect(user1).cancelAuction(erc721AuctionId);
      await endemicExchange.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc721AuctionId, 1)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 1)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on dutch ERC721 auction', async function () {
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43999999999999995
      //   fee = (currentPrice * 300) / 10000

      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );
      const fee = ethers.utils.parseUnits('0.0132');
      const totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(totalPrice.toString())
      );

      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(totalPrice.toString())
        );

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1);

      // User1 should receive 0.39492 ether, 80% of auction has passed

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.39276'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);

      await expect(
        endemicExchange.getAuction(erc721AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on dutch ERC1155 auction', async function () {
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.2'),
          1000,
          3,
          endemicToken.address,
          ERC1155_ASSET_CLASS
        );

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await network.provider.send('evm_increaseTime', [850]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.2 - 1.0 = -0.8
      //   currentPriceChange = (totalPriceChange * 850) / 1000 = -0.68
      //   currentPrice = 1.4 + currentPriceChange = 0.31999999999999995
      //   fee = (currentPrice * 300) / 10000

      let auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );
      let fee = ethers.utils.parseUnits('0.02879999');

      let totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(totalPrice.toString())
      );

      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(totalPrice.toString())
        );

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 1);

      // Bidder should own NFT
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      await network.provider.send('evm_increaseTime', [20]);
      await network.provider.send('evm_mine');

      auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      //   totalPriceChange = 0.2 - 1.0 = -0.8
      //   currentPriceChange = (totalPriceChange * 870) / 1000 = -0.696
      //   currentPrice = 1.4 + currentPriceChange = 0.304
      //   fee = 2 * (currentPrice * 300) / 10000

      // Auction is still on because all amount has not been sold
      const erc1155Auction = await endemicExchange.getAuction(erc1155AuctionId);
      expect(erc1155Auction.amount).to.equal('2');

      fee = ethers.utils.parseUnits('0.01824');

      totalPrice = 2 * +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(totalPrice.toString())
      );

      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(totalPrice.toString())
        );

      // Buy two more
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2);

      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(3);

      // Auction is now complete
      await expect(
        endemicExchange.getAuction(erc1155AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);

      //85% auction duration has passed when bought first one + 87% when bought two more
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.916'));
    });

    it('should be able to bid on dutch ERC1155 auction with different fees for specific ERC20', async function () {
      await paymentManagerContract.updatePaymentMethodFees(
        endemicToken.address,
        500,
        500
      );

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.2'),
          1000,
          3,
          endemicToken.address,
          ERC1155_ASSET_CLASS
        );

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await network.provider.send('evm_increaseTime', [850]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.2 - 1.0 = -0.8
      //   currentPriceChange = (totalPriceChange * 850) / 1000 = -0.68
      //   currentPrice = 1.4 + currentPriceChange = 0.31999999999999995
      //   fee = (currentPrice * 500) / 10000

      let auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );
      let fee = ethers.utils.parseUnits('0.016');

      let totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(totalPrice.toString())
      );

      //price => 0.3176
      //makerCut => 0.01588 (5% of price)
      //royalties = 0
      //seller gets => price - (makerCut - royalties)
      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(totalPrice.toString())
        );

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 1);

      // Bidder should own NFT
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      await network.provider.send('evm_increaseTime', [20]);
      await network.provider.send('evm_mine');

      auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      //   totalPriceChange = 0.2 - 1.0 = -0.8
      //   currentPriceChange = (totalPriceChange * 870) / 1000 = -0.696
      //   currentPrice = 1.4 + currentPriceChange = 0.304
      //   fee = 2 * (currentPrice * 500) / 10000

      // Auction is still on because all amount has not been sold
      const erc1155Auction = await endemicExchange.getAuction(erc1155AuctionId);
      expect(erc1155Auction.amount).to.equal('2');

      fee = ethers.utils.parseUnits('0.032');

      totalPrice = 2 * +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(totalPrice.toString())
      );

      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(totalPrice.toString())
        );

      // Buy two more
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2);

      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(3);

      // Auction is now complete
      await expect(
        endemicExchange.getAuction(erc1155AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);

      //85% auction duration has passed when bought first one + 87% when bought two more
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.8702'));
    });

    it('should be able to bid at endingPrice if auction has passed duration', async function () {
      const user1Bal1 = await endemicToken.balanceOf(user1.address);
      await network.provider.send('evm_increaseTime', [200]);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );

      await endemicToken.transfer(
        user2.address,
        (2 * +auction1CurrentPrice).toString()
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, auction1CurrentPrice);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 1);

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.019'));
    });

    it('should fail to bid after someone else has bid', async function () {
      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );

      const auction1TotalPrice = addTakerFee(auction1CurrentPrice);

      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      const auction2TotalPrice = addTakerFee(auction2CurrentPrice);

      const totalPrice = +auction1TotalPrice + 3 * auction2TotalPrice;

      await endemicToken.transfer(user2.address, totalPrice.toString());

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, totalPrice.toString());

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1);
      await expect(
        endemicExchange.connect(user3).bidForDutchAuction(erc721AuctionId, 1)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 3);
      await expect(
        endemicExchange.connect(user3).bidForDutchAuction(erc1155AuctionId, 1)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid in middle of auction', async function () {
      await network.provider.send('evm_increaseTime', [60]);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );
      const auction1TotalPrice = addTakerFee(auction1CurrentPrice);
      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );
      const auction2TotalPrice = addTakerFee(auction2CurrentPrice);

      const totalPrice = +auction1TotalPrice + 2 * +auction2TotalPrice;

      await endemicToken.transfer(user2.address, totalPrice.toString());

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, totalPrice.toString());

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1);
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2);

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(2);
    });

    it('should trigger an event after successful bid', async function () {
      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );
      const auction1TotalPrice = addTakerFee(auction1CurrentPrice);
      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );
      const auction2TotalPrice = addTakerFee(auction2CurrentPrice);

      const totalPrice = +auction1TotalPrice + 2 * +auction2TotalPrice;

      await endemicToken
        .connect(owner)
        .transfer(user2.address, totalPrice.toString());

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, auction1TotalPrice);

      const bid1 = endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1);

      await expect(bid1)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          erc721AuctionId,
          ethers.utils.parseUnits('0.097'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.00291')
        );

      await expect(bid1)
        .to.emit(nftContract, 'Transfer')
        .withArgs(user1.address, user2.address, 1);

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, (2 * +auction2TotalPrice).toString());

      const bid2 = endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2, {
          value: (2 * +auction2TotalPrice).toString(),
        });

      await expect(bid2)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          erc1155AuctionId,
          ethers.utils.parseUnits('0.1925'),
          user2.address,
          2,
          ethers.utils.parseUnits('0.005775')
        );
    });
  });

  describe('Bidding with Ether on fixed auction', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          3,
          ZERO_ADDRESS,
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
        endemicExchange.connect(user2).bidForDutchAuction(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.01'),
        })
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.01'),
        })
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 2, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);
    });

    it('should fail to bid if auction has been concluded', async function () {
      await endemicExchange.connect(user1).cancelAuction(erc721AuctionId);
      await endemicExchange.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on fixed ERC721 auction', async function () {
      const user1Bal1 = await user1.getBalance();

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1, {
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

    it('should fail to bid on dutch auction because auction is listed as reserved', async function () {
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

      const auctionId = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(auctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on fixed ERC1155 auction', async function () {
      const user1Bal1 = await user1.getBalance();

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        });

      // Bidder should own NFT
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      // Auction is still on because all amount has not been sold
      const erc1155Auction = await endemicExchange.getAuction(erc1155AuctionId);
      expect(erc1155Auction.amount).to.equal('2');

      // Buy two more
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2, {
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

    it('should fail to bid after someone else has bid', async function () {
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        });
      await expect(
        endemicExchange.connect(user3).bidForDutchAuction(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 3, {
          value: ethers.utils.parseUnits('0.309'),
        });
      await expect(
        endemicExchange.connect(user3).bidForDutchAuction(erc1155AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        })
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should trigger an event after successful bid', async function () {
      const bid1 = endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1, {
          value: ethers.utils.parseUnits('0.103'),
        });

      await expect(bid1)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
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

      const bid2 = endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2, {
          value: ethers.utils.parseUnits('0.206'),
        });

      await expect(bid2)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          erc1155AuctionId,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          2,
          ethers.utils.parseUnits('0.006')
        );
    });
  });

  describe('Bidding with ERC20 on fixed auction', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          3,
          endemicToken.address,
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
        endemicExchange.connect(user2).bidForDutchAuction(erc721AuctionId, 1)
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 1)
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 2)
      ).to.be.revertedWith(UNSUFFICIENT_CURRENCY_SUPPLIED);
    });

    it('should fail to bid if auction has been concluded', async function () {
      await endemicExchange.connect(user1).cancelAuction(erc721AuctionId);
      await endemicExchange.connect(user1).cancelAuction(erc1155AuctionId);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc721AuctionId, 1)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await expect(
        endemicExchange.connect(user2).bidForDutchAuction(erc1155AuctionId, 1)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on fixed ERC721 auction', async function () {
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
        .bidForDutchAuction(erc721AuctionId, 1);

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

    it('should be able to bid on fixed ERC721 auction with different fees for specific ERC20', async function () {
      await paymentManagerContract.updatePaymentMethodFees(
        endemicToken.address,
        500,
        500
      );

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        erc721AuctionId
      );

      const auction1TotalPrice = addTakerFee(auction1CurrentPrice, 500);

      await endemicToken.transfer(user2.address, auction1TotalPrice);

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, auction1TotalPrice);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);

      //price => 0.1
      //makerCut => 0.005 (5% of price)
      //royalties => 0,01
      //seller gets => price - (makerCut + royalties) = 0.085
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.085'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);

      await expect(
        endemicExchange.getAuction(erc721AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should be able to bid on fixed ERC1155 auction', async function () {
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
        .bidForDutchAuction(erc1155AuctionId, 1);

      // Bidder should own NFT
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      // Auction is still on because all amount has not been sold
      const erc1155Auction = await endemicExchange.getAuction(erc1155AuctionId);
      expect(erc1155Auction.amount).to.equal('2');

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.206')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.206'));

      // Buy two more
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2);

      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(3);

      // Auction is now complete
      await expect(
        endemicExchange.getAuction(erc1155AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.3'));
    });

    it('should be able to bid on fixed ERC1155 auction with different fees for specific ERC20', async function () {
      await paymentManagerContract.updatePaymentMethodFees(
        endemicToken.address,
        500,
        500
      );

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        erc1155AuctionId
      );

      const auction2TotalPrice = addTakerFee(auction2CurrentPrice, '500');

      await endemicToken.transfer(user2.address, auction2TotalPrice);

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, auction2TotalPrice);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 1);

      // Bidder should own NFT
      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(1);

      // Auction is still on because all amount has not been sold
      const erc1155Auction = await endemicExchange.getAuction(erc1155AuctionId);
      expect(erc1155Auction.amount).to.equal('2');

      await endemicToken.transfer(
        user2.address,
        (2 * auction2TotalPrice).toString()
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, (2 * auction2TotalPrice).toString());

      // Buy two more
      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2);

      expect(await erc1155Contract.balanceOf(user2.address, 1)).to.equal(3);

      //price => 0.1
      //makerCut => 3 * 0.005 (5% of price)
      //royalties => 0
      //seller gets => 3 * price - (makerCut + royalties) = 0.285

      // Auction is now complete
      await expect(
        endemicExchange.getAuction(erc1155AuctionId)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);

      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.285'));
    });

    it('should fail to bid after someone else has bid', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1);
      await expect(
        endemicExchange.connect(user3).bidForDutchAuction(erc721AuctionId, 1)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.309')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.309'));

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 3);
      await expect(
        endemicExchange.connect(user3).bidForDutchAuction(erc1155AuctionId, 1)
      ).to.be.revertedWith(INVALID_AUCTION_ERROR);
    });

    it('should trigger an event after successful bid', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      const bid1 = endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc721AuctionId, 1);

      await expect(bid1)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
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

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.206')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.206'));

      const bid2 = endemicExchange
        .connect(user2)
        .bidForDutchAuction(erc1155AuctionId, 2);

      await expect(bid2)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          erc1155AuctionId,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          2,
          ethers.utils.parseUnits('0.006')
        );
    });
  });

  describe('Conclude dutch auction', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.1'),
          60,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.3'),
          ethers.utils.parseUnits('0.2'),
          60,
          3,
          ZERO_ADDRESS,
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
        .to.emit(endemicExchange, AUCTION_CANCELED)
        .withArgs(erc721AuctionId);

      await expect(cancleAuction2)
        .to.emit(endemicExchange, AUCTION_CANCELED)
        .withArgs(erc1155AuctionId);
    });
  });

  describe('Conclude fixed auction', function () {
    let erc721AuctionId, erc1155AuctionId;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.1'),
          ethers.utils.parseUnits('0.1'),
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          erc1155Contract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          3,
          ZERO_ADDRESS,
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
        .to.emit(endemicExchange, AUCTION_CANCELED)
        .withArgs(erc721AuctionId);

      await expect(cancleAuction2)
        .to.emit(endemicExchange, AUCTION_CANCELED)
        .withArgs(erc1155AuctionId);
    });
  });

  describe('Ether Fee', function () {
    beforeEach(async function () {
      await deploy(250, 300);
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);
    });

    it('should take cut on primary sale on fixed auction', async function () {
      const claimEthBalance1 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
      );
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          ZERO_ADDRESS,
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
      const bidTx = await endemicExchange
        .connect(user2)
        .bidForDutchAuction(auctionid, 1, {
          value: ethers.utils.parseUnits('0.206'),
        });

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.011')
        );

      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
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

    it('should take cut on primary sale on dutch auction', async function () {
      const claimEthBalance1 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
      );
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );
      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      const user1Bal1 = await user1.getBalance();

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43999999999999995
      //   fee = (currentPrice * 300) / 10000

      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid
      );
      const fee = ethers.utils.parseUnits('0.0131999');
      const totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      // buys NFT and calculates price diff on contract and user1 wallet
      const bidTx = await endemicExchange
        .connect(user2)
        .bidForDutchAuction(auctionid, 1, {
          value: ethers.utils.parseUnits(totalPrice.toString()),
        });

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid,
          ethers.utils.parseUnits('0.4400359'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.024134')
        );

      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
      );
      const user1Bal2 = await user1.getBalance();
      const token2Owner = await nftContract.ownerOf(1);
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.024134')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);

      expect(user1Diff.toString()).to.equal(
        ethers.utils.parseUnits('0.3851859')
      );

      // 0.38395 = seller proceeds if we don't forward all sent ethers to seller and fee receipients
      // now we forward all funds in case of ether payments => seller get few percent more than before in case of ether
      expect(user1Diff).to.be.gt(ethers.utils.parseUnits('0.38395'));

      expect(token2Owner).to.equal(user2.address);
    });

    it('should take cut on sequential sales on fixed', async function () {
      // Creates auction and bid it
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1'),
          ethers.utils.parseUnits('1'),
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      // Buy with user 2
      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1, {
        value: ethers.utils.parseUnits('1.03'),
      });

      // Auction again with user 2
      await nftContract.connect(user2).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user2)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.5'),
          ethers.utils.parseUnits('0.5'),
          1,
          ZERO_ADDRESS,
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
        FEE_RECIPIENT
      );

      // Buy with user 3
      const bidTx = await endemicExchange
        .connect(user3)
        .bidForDutchAuction(auctionid2, 1, {
          value: ethers.utils.parseUnits('0.515'),
        });

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid2,
          ethers.utils.parseUnits('0.5'),
          user3.address,
          1,
          ethers.utils.parseUnits('0.0275')
        );

      //Grab updated balances
      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
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

    it('should take cut on sequential sales on dutch auction', async function () {
      // Creates auction and bid it
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43999999999999995
      //   fee = (currentPrice * 300) / 10000

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid
      );
      const auction1Fee = ethers.utils.parseUnits('0.0131999');
      const auction1TotalPrice =
        +weiToEther(auction1CurrentPrice) + +weiToEther(auction1Fee);

      // Buy with user 2
      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1, {
        value: ethers.utils.parseUnits(auction1TotalPrice.toString()),
      });

      // Auction again with user 2
      await nftContract.connect(user2).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user2)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.5'),
          1200,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );

      await network.provider.send('evm_increaseTime', [1140]);
      await network.provider.send('evm_mine');

      const auctionid2 = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user2.address
      );

      // Grab current balance
      const user2Bal1 = await user2.getBalance();
      const claimEthBalance1 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
      );

      //   totalPriceChange = 0.5 - 1.0 = -0.5
      //   currentPriceChange = (totalPriceChange * 1100) / 1200 = -0.45
      //   currentPrice = 1.0 + currentPriceChange = 0.5416
      //   fee = (currentPrice * 300) / 10000

      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid2
      );
      const auction2Fee = ethers.utils.parseUnits('0.01625');
      const auction2TotalPrice =
        +weiToEther(auction2CurrentPrice) + +weiToEther(auction2Fee);

      // Buy with user 3
      const bidTx = await endemicExchange
        .connect(user3)
        .bidForDutchAuction(auctionid2, 1, {
          value: ethers.utils.parseUnits(auction2TotalPrice.toString()),
        });

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid2,
          ethers.utils.parseUnits('0.5255125'),
          user3.address,
          1,
          ethers.utils.parseUnits('0.028852083333333333')
        );

      //Grab updated balances
      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
      );
      const user2Bal2 = await user2.getBalance();

      // Checks if endemicExchange gets 2.5% maker fee + 3% taker fee

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);
      const user2Diff = user2Bal2.sub(user2Bal1);

      expect(claimEthBalanceDiff).to.equal(
        ethers.utils.parseUnits('0.028852083333333333')
      );
      expect(user2Diff.toString()).to.equal(
        ethers.utils.parseUnits('0.459939583333333334')
      );

      // New owner
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user3.address);
    });
  });

  describe('ERC20 Fee', function () {
    beforeEach(async function () {
      await deploy(250, 300);
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await erc1155Contract
        .connect(user1)
        .setApprovalForAll(endemicExchange.address, true);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it('should take cut on primary sale on fixed auction', async function () {
      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          endemicToken.address,
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

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.206')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.206'));

      // buys NFT and calculates price diff on contract and user1 wallet
      const bidTx = await endemicExchange
        .connect(user2)
        .bidForDutchAuction(auctionid, 1);

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.011')
        );

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

    it('should take cut on primary sale on dutch auction', async function () {
      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );
      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43999999999999995
      //   fee = (currentPrice * 300) / 10000

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid
      );
      const fee = ethers.utils.parseUnits('0.01319');
      const totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(totalPrice.toString())
      );

      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(totalPrice.toString())
        );

      // buys NFT and calculates price diff on contract and user1 wallet
      const bidTx = await endemicExchange
        .connect(user2)
        .bidForDutchAuction(auctionid, 1);

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid,
          ethers.utils.parseUnits('0.4364'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.024002')
        );

      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const token2Owner = await nftContract.ownerOf(1);
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 3% of 0.4364 + 3% fee
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.024002')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.38185'));
      expect(token2Owner).to.equal(user2.address);
    });

    it('should take cut on primary sale on fixed auction with different fees to specific ERC20', async function () {
      await paymentManagerContract.updatePaymentMethodFees(
        endemicToken.address,
        500,
        500
      );

      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );
      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.21')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.21'));

      // buys NFT and calculates price diff on contract and user1 wallet
      const bidTx = await endemicExchange
        .connect(user2)
        .bidForDutchAuction(auctionid, 1);

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid,
          ethers.utils.parseUnits('0.2'),
          user2.address,
          1,
          ethers.utils.parseUnits('0.02')
        );

      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const token2Owner = await nftContract.ownerOf(1);
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 5% of 0.2 + 5% fee
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.02')
      );

      //price => 0.2
      //makerCut => 0.01 (5% of price)
      //royalties => 0.02
      //seller gets => price - (makerCut + royalties) = 0.170

      const user1Diff = user1Bal2.sub(user1Bal1);

      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.170'));
      expect(token2Owner).to.equal(user2.address);
    });

    it('should take cut on primary sale on dutch auction with different fees for specific ERC20', async function () {
      await paymentManagerContract.updatePaymentMethodFees(
        endemicToken.address,
        500,
        500
      );

      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );
      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43999999999999995
      //   fee = (currentPrice * 300) / 10000

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid
      );
      const fee = ethers.utils.parseUnits('0.032');
      const totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(totalPrice.toString())
      );

      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(totalPrice.toString())
        );

      // buys NFT and calculates price diff on contract and user1 wallet

      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1);

      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const token2Owner = await nftContract.ownerOf(1);
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 10% of 0.4364
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.04364')
      );

      //price => 0.4364
      //makerCut => 0.02182 (5% of price)
      //royalties => 0.04364
      //seller gets => price - (makerCut + royalties) = 0.37094

      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.37094'));
      expect(token2Owner).to.equal(user2.address);
    });

    it('should take cut on sequential sales on fixed auction', async function () {
      // Creates auction and bid it
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1'),
          ethers.utils.parseUnits('1'),
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('1.03')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('1.03'));

      // Buy with user 2
      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1);

      // Auction again with user 2
      await nftContract.connect(user2).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user2)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.5'),
          ethers.utils.parseUnits('0.5'),
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      const auctionid2 = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user2.address
      );

      // Grab current balance
      const user2Bal1 = await endemicToken.balanceOf(user2.address);
      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      // Buy with user 3
      const bidTx = await endemicExchange
        .connect(user3)
        .bidForDutchAuction(auctionid2, 1);

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid2,
          ethers.utils.parseUnits('0.5'),
          user3.address,
          1,
          ethers.utils.parseUnits('0.0275')
        );

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

    it('should take cut on sequential sales dutch auction', async function () {
      // Creates auction and bid it
      await nftContract.connect(user1).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43999999999999995
      //   fee = (currentPrice * 300) / 10000

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid
      );
      const auction1Fee = ethers.utils.parseUnits('0.01319');
      const auction1TotalPrice =
        +weiToEther(auction1CurrentPrice) + +weiToEther(auction1Fee);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(auction1TotalPrice.toString())
      );

      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(auction1TotalPrice.toString())
        );

      // Buy with user 2
      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1);

      // Auction again with user 2
      await nftContract.connect(user2).approve(endemicExchange.address, 1);
      await endemicExchange
        .connect(user2)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.0'),
          ethers.utils.parseUnits('0.5'),
          1200,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );

      const auctionid2 = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user2.address
      );

      // Grab current balance
      const user2Bal1 = await endemicToken.balanceOf(user2.address);
      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      await network.provider.send('evm_increaseTime', [1125]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.5 - 1.0 = -0.5
      //   currentPriceChange = (totalPriceChange * 950) / 1200 = -0.4166/
      //   currentPrice = 1.0 + currentPriceChange = 0.583333
      //   fee = (currentPrice * 300) / 10000

      const auction2CurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid2
      );
      const auction2Fee = ethers.utils.parseUnits('0.0175');
      const auction2TotalPrice =
        +weiToEther(auction2CurrentPrice) + +weiToEther(auction2Fee);

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits(auction2TotalPrice.toString())
      );

      await endemicToken
        .connect(user3)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(auction2TotalPrice.toString())
        );

      // Buy with user 3
      const bidTx = await endemicExchange
        .connect(user3)
        .bidForDutchAuction(auctionid2, 1);

      await expect(bidTx)
        .to.emit(endemicExchange, AUCTION_SUCCESFUL)
        .withArgs(
          auctionid2,
          ethers.utils.parseUnits('0.53'),
          user3.address,
          1,
          ethers.utils.parseUnits('0.02915')
        );

      //Grab updated balances
      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      const user2Bal2 = await endemicToken.balanceOf(user2.address);

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);
      const user2Diff = user2Bal2.sub(user2Bal1);

      // Checks if endemicExchange gets 2.5% maker fee + 3% taker fee
      expect(claimEthBalanceDiff).to.equal(ethers.utils.parseUnits('0.02915'));
      expect(user2Diff.toString()).to.equal(ethers.utils.parseUnits('0.46375'));

      // New owner
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user3.address);
    });
  });

  describe('Ether Royalties', function () {
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

    it('should distribute royalties on fixed auction', async () => {
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          ZERO_ADDRESS,
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
        FEE_RECIPIENT
      );

      const feeRecipientBalance1 = await feeRecipient.getBalance();
      const user1Bal1 = await user1.getBalance();

      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1, {
        value: ethers.utils.parseUnits('0.206'),
      });

      const user1Bal2 = await user1.getBalance();
      const feeRecipientBalance2 = await feeRecipient.getBalance();
      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
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

    it('should distribute royalties on dutch auction', async () => {
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          ZERO_ADDRESS,
          ERC721_ASSET_CLASS
        );
      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43995
      //   fee = (currentPrice * 300) / 10000

      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid
      );
      const fee = ethers.utils.parseUnits('0.013199');
      const totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      // buys NFT and calculates price diff on contract and user1 wallet

      const claimEthBalance1 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
      );

      const feeRecipientBalance1 = await feeRecipient.getBalance();
      const user1Bal1 = await user1.getBalance();

      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1, {
        value: ethers.utils.parseUnits(totalPrice.toString()),
      });

      const user1Bal2 = await user1.getBalance();
      const feeRecipientBalance2 = await feeRecipient.getBalance();
      const claimEthBalance2 = await endemicExchange.provider.getBalance(
        FEE_RECIPIENT
      );

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.024134')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);
      // 0.4395 minus 3% fee minus 10% royalties
      expect(user1Diff.toString()).to.equal(
        ethers.utils.parseUnits('0.385185')
      );

      // 0.38395 = seller proceeds if we don't forward all sent ethers to seller and fee receipients
      // now we forward all funds in case of ether payments => seller get few percent more than before in case of ether
      expect(user1Diff).to.be.gt(ethers.utils.parseUnits('0.38395'));

      const feeRecipientDiff = feeRecipientBalance2.sub(feeRecipientBalance1);
      expect(feeRecipientDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.04388')
      );
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

    it('should distribute royalties on fixed auction', async () => {
      await endemicExchange
        .connect(user1)
        .createFixedDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('0.2'),
          ethers.utils.parseUnits('0.2'),
          1,
          endemicToken.address,
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

      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1);

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

    it('should distribute royalties on dutch auction', async () => {
      await endemicExchange
        .connect(user1)
        .createDutchAuction(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1.4'),
          ethers.utils.parseUnits('0.2'),
          1000,
          1,
          endemicToken.address,
          ERC721_ASSET_CLASS
        );
      const auctionid = await endemicExchange.createAuctionId(
        nftContract.address,
        1,
        user1.address
      );

      await network.provider.send('evm_increaseTime', [800]);
      await network.provider.send('evm_mine');

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.43995
      //   fee = (currentPrice * 300) / 10000

      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        auctionid
      );
      const fee = ethers.utils.parseUnits('0.013199');
      const totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      // buys NFT and calculates price diff on contract and user1 wallet

      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      const feeRecipientBalance1 = await endemicToken.balanceOf(
        feeRecipient.address
      );
      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits(totalPrice.toString())
      );

      await endemicToken
        .connect(user2)
        .approve(
          endemicExchange.address,
          ethers.utils.parseUnits(totalPrice.toString())
        );

      await endemicExchange.connect(user2).bidForDutchAuction(auctionid, 1);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const feeRecipientBalance2 = await endemicToken.balanceOf(
        feeRecipient.address
      );
      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 3% of 0.4395 + 3% fee
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.024002')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);
      // 0.4395 minus 3% fee minus 10% royalties
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.38185'));

      const feeRecipientDiff = feeRecipientBalance2.sub(feeRecipientBalance1);
      expect(feeRecipientDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.04364')
      );
    });
  });
});
