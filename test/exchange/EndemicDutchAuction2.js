const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const helpers = require('@nomicfoundation/hardhat-network-helpers');
const {
  deployInitializedCollection,
  deployEndemicExchangeWithDeps,
  deployEndemicToken,
} = require('../helpers/deploy');
const { getTypedMessage_dutch } = require('../helpers/eip712');

const {
  ZERO_ADDRESS,
  FEE_RECIPIENT,
  ZERO,
  ZERO_BYTES32,
  TOO_LONG_AUCTION_DURATION,
} = require('../helpers/constants');
const {
  weiToEther,
  calculateAuctionDuration,
  addTakerFee,
} = require('../helpers/token');

const INVALID_AUCTION_ERROR = 'InvalidAuction';
const INVALID_DURATION_ERROR = 'InvalidDuration';
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
    royaltiesProviderContract,
    paymentManagerContract;

  let owner,
    user1,
    user2,
    user3,
    feeRecipient,
    collectionAdministrator,
    mintApprover;

  const mintToken = async (recipient) => {
    return nftContract.mint(
      recipient,
      'bafybeigdyrzt5sfp7udm7hu76uh7y2anf3efuylqabf3oclgtqy55fbzdi',
      ZERO,
      ZERO_BYTES32,
      ZERO_BYTES32,
      ZERO
    );
  };

  async function deploy(makerFee = 0, takerFee) {
    [
      owner,
      user1,
      user2,
      user3,
      feeRecipient,
      collectionAdministrator,
      mintApprover,
    ] = await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps(makerFee, takerFee);

    royaltiesProviderContract = result.royaltiesProviderContract;
    endemicExchange = result.endemicExchangeContract;
    paymentManagerContract = result.paymentManagerContract;

    nftContract = await deployInitializedCollection(
      owner,
      collectionAdministrator,
      mintApprover
    );

    await mintToken(user1.address);
    await mintToken(user1.address);
  }

  const getDutchAuctionSignature = async (
    signer,
    tokenId,
    paymentErc20TokenAddress,
    startingPrice,
    endingPrice,
    startingAt,
    duration
  ) => {
    const typedMessage = getTypedMessage_dutch({
      chainId: network.config.chainId,
      verifierContract: endemicExchange.address,
      orderNonce: 1,
      nftContract: nftContract.address,
      tokenId: tokenId,
      paymentErc20TokenAddress: paymentErc20TokenAddress,
      startingPrice: startingPrice,
      endingPrice: endingPrice,
      startingAt: startingAt,
      duration: duration,
    });

    const signature = await signer._signTypedData(
      typedMessage.domain,
      typedMessage.types,
      typedMessage.values
    );

    const sig = signature.substring(2);
    const r = '0x' + sig.substring(0, 64);
    const s = '0x' + sig.substring(64, 128);
    const v = parseInt(sig.substring(128, 130), 16);

    return { v, r, s };
  };

  describe('Bidding with Ether on dutch auction', function () {
    let sig, defaultTimestamp;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      const startingPrice = ethers.utils.parseUnits('0.1');
      const endingPrice = ethers.utils.parseUnits('0.01');
      const duration = 120;

      defaultTimestamp = await helpers.time.latest();

      sig = await getDutchAuctionSignature(
        user1,
        1,
        ZERO_ADDRESS,
        startingPrice,
        endingPrice,
        defaultTimestamp,
        duration
      );
    });

    it('should be able to bid on dutch ERC721 auction', async function () {
      const timestamp = await helpers.time.latest();

      const { v, r, s } = await getDutchAuctionSignature(
        user1,
        1,
        ZERO_ADDRESS,
        ethers.utils.parseUnits('1.4'),
        ethers.utils.parseUnits('0.2'),
        timestamp,
        1000
      );

      await helpers.time.increase(800);

      const user1Bal1 = await user1.getBalance();

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.44
      //   fee = (currentPrice * 300) / 10000
      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        ethers.utils.parseUnits('1.4'),
        ethers.utils.parseUnits('0.2'),
        timestamp,
        1000
      );
      const fee = ethers.utils.parseUnits('0.0132');
      const totalPrice = +weiToEther(auctionCurrentPrice) + +weiToEther(fee);

      await endemicExchange.connect(user2).bidForDutchAuction(
        v,
        r,
        s,
        {
          seller: user1.address,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: ZERO_ADDRESS,
          startingPrice: ethers.utils.parseUnits('1.4'),
          endingPrice: ethers.utils.parseUnits('0.2'),
          startingAt: timestamp,
          duration: 1000,
        },
        {
          value: ethers.utils.parseUnits(totalPrice.toString()),
        }
      );

      // User1 should receive 0.373232 ether, 80% of auction has passed
      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.lte(ethers.utils.parseUnits('0.375'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);
    });

    it('should be able to bid at endingPrice if auction has passed duration', async function () {
      await helpers.time.increase(200);

      const user1Bal1 = await user1.getBalance();

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        ethers.utils.parseUnits('0.1'),
        ethers.utils.parseUnits('0.01'),
        defaultTimestamp,
        120
      );

      const totalPrice = addTakerFee(auction1CurrentPrice);

      await endemicExchange.connect(user2).bidForDutchAuction(
        sig.v,
        sig.r,
        sig.s,
        {
          seller: user1.address,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: ZERO_ADDRESS,
          startingPrice: ethers.utils.parseUnits('0.1'),
          endingPrice: ethers.utils.parseUnits('0.01'),
          startingAt: defaultTimestamp,
          duration: 120,
        },
        {
          value: totalPrice,
        }
      );

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);

      const user1Bal2 = await user1.getBalance();
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.0085'));

      // 0.1 = seller proceeds if we don't forward all sent ethers to seller and fee receipients
      // now we forward all funds in case of ether payments => seller get few percent more than before in case of ether

      expect(user1Diff).to.be.lt(ethers.utils.parseUnits('0.01'));
    });
  });

  describe('Bidding with ERC20 on dutch auction', function () {
    let sig, defaultTimestamp;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );

      const startingPrice = ethers.utils.parseUnits('0.1');
      const endingPrice = ethers.utils.parseUnits('0.01');
      const duration = 120;

      defaultTimestamp = await helpers.time.latest();

      sig = await getDutchAuctionSignature(
        user1,
        1,
        endemicToken.address,
        startingPrice,
        endingPrice,
        defaultTimestamp,
        duration
      );
    });

    it('should be able to bid on dutch ERC721 auction', async function () {
      const timestamp = await helpers.time.latest();

      const { v, r, s } = await getDutchAuctionSignature(
        user1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('1.4'),
        ethers.utils.parseUnits('0.2'),
        timestamp,
        1000
      );

      await helpers.time.increase(800);

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      //   totalPriceChange = 0.2 - 1.4 = -1.2
      //   currentPriceChange = (totalPriceChange * 800) / 1000 = -0.96
      //   currentPrice = 1.4 + currentPriceChange = 0.44
      //   fee = (currentPrice * 300) / 10000
      const auctionCurrentPrice = await endemicExchange.getCurrentPrice(
        ethers.utils.parseUnits('1.4'),
        ethers.utils.parseUnits('0.2'),
        timestamp,
        1000
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

      await endemicExchange.connect(user2).bidForDutchAuction(v, r, s, {
        seller: user1.address,
        orderNonce: 1,
        nftContract: nftContract.address,
        tokenId: 1,
        paymentErc20TokenAddress: endemicToken.address,
        startingPrice: ethers.utils.parseUnits('1.4'),
        endingPrice: ethers.utils.parseUnits('0.2'),
        startingAt: timestamp,
        duration: 1000,
      });

      // User1 should receive 0.39492 ether, 80% of auction has passed

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.37094'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);
    });

    it('should be able to bid at endingPrice if auction has passed duration', async function () {
      await helpers.time.increase(200);

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      const auction1CurrentPrice = await endemicExchange.getCurrentPrice(
        ethers.utils.parseUnits('0.1'),
        ethers.utils.parseUnits('0.01'),
        defaultTimestamp,
        120
      );

      await endemicToken.transfer(
        user2.address,
        (2 * +auction1CurrentPrice).toString()
      );

      const totalPrice = addTakerFee(auction1CurrentPrice);

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, totalPrice);

      await endemicExchange
        .connect(user2)
        .bidForDutchAuction(sig.v, sig.r, sig.s, {
          seller: user1.address,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          startingPrice: ethers.utils.parseUnits('0.1'),
          endingPrice: ethers.utils.parseUnits('0.01'),
          startingAt: defaultTimestamp,
          duration: 120,
        });

      expect(await nftContract.ownerOf(1)).to.equal(user2.address);

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.0085'));
    });
  });
});
