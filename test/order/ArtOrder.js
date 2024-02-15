const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployArtOrderWithFactory } = require('../helpers/deploy');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const {
  createCreateOrderSignature,
  createExtendOrderSignature,
} = require('../helpers/sign');

function getOrderHash(order) {
  return ethers.utils.solidityKeccak256(
    ['address', 'address', 'uint256', 'uint256', 'address'],
    [
      order.orderer,
      order.artist,
      order.price,
      order.timestamp,
      order.paymentErc20TokenAddress,
    ]
  );
}

describe('ArtOrder', function () {
  const PRICE = 1000000000;
  const ONE_DAY = 60 * 60 * 24;
  const FEE = 250;

  let artOrderContract;
  let tokenContract;
  let administrator, orderer, artist, feeRecipient;
  let timestampNow;
  let timestampDayAfter;
  let timestamp2DaysAfter;

  let orderEth;
  let orderErc20;

  beforeEach(async function () {
    [administrator, orderer, artist, feeRecipient] = await ethers.getSigners();
    timestampNow = (await ethers.provider.getBlock('latest')).timestamp;
    timestampDayAfter = timestampNow + ONE_DAY;
    timestamp2DaysAfter = timestampNow + ONE_DAY * 2;

    const EndemicToken = await ethers.getContractFactory('EndemicToken');
    tokenContract = await EndemicToken.deploy(orderer.address);
    await tokenContract.deployed();

    orderEth = {
      orderer: orderer.address,
      artist: artist.address,
      price: PRICE,
      timestamp: timestampDayAfter,
      paymentErc20TokenAddress: ethers.constants.AddressZero,
    };

    orderErc20 = {
      orderer: orderer.address,
      artist: artist.address,
      price: PRICE,
      timestamp: timestampDayAfter,
      paymentErc20TokenAddress: tokenContract.address,
    };

    artOrderContract = await deployArtOrderWithFactory(
      FEE,
      feeRecipient.address,
      administrator.address
    );

    await tokenContract
      .connect(orderer)
      .approve(artOrderContract.address, PRICE);
  });

  it('deploys with correct initial setup', async function () {
    const _feeAmount = await artOrderContract.feeAmount();
    const _feeRecipient = await artOrderContract.feeRecipient();
    const _administrator = await artOrderContract.administrator();

    expect(_feeAmount).to.equal(FEE);
    expect(_feeRecipient).to.equal(feeRecipient.address);
    expect(_administrator).to.equal(administrator.address);
  });

  describe('createOrder', function () {
    let artistSignature;

    beforeEach(async function () {
      artistSignature = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );
    });

    it('creates a new order and transfers ether', async function () {
      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSignature, { value: PRICE });

      const orderHash = getOrderHash(orderEth).toString();

      expect(await artOrderContract.statusPerOrder(orderHash)).to.equal(1);
      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(PRICE);
    });

    it('creates a new order and transfers erc20', async function () {
      const artistSignatureErc20 = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderErc20, artistSignatureErc20);

      const orderHash = getOrderHash(orderErc20).toString();

      expect(await artOrderContract.statusPerOrder(orderHash)).to.equal(1);
      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        PRICE
      );
    });

    it('emits OrderCreated event', async function () {
      const tx = await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSignature, { value: PRICE });

      const receipt = await tx.wait();
      const eventData = receipt.events.find(
        ({ event }) => event === 'OrderCreated'
      );

      expect(orderer.address).to.equal(eventData.args.orderer);
      expect(artist.address).to.equal(eventData.args.artist);
      expect(PRICE).to.equal(eventData.args.price);
      expect(timestampDayAfter).to.equal(eventData.args.timestamp);
      expect(ethers.constants.AddressZero).to.equal(
        eventData.args.paymentErc20TokenAddress
      );
    });

    it('reverts if caller not the orderer', async function () {
      await expect(
        artOrderContract
          .connect(administrator)
          .createOrder(orderEth, artistSignature, { value: PRICE })
      ).to.be.reverted;
    });

    it('reverts if artist signature is not valid', async function () {
      const ordererSignature = await createCreateOrderSignature(
        artOrderContract,
        orderer,
        orderEth
      );

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(orderEth, ordererSignature, {
            value: PRICE,
          })
      ).to.be.reverted;
    });

    it('reverts if order already exists', async function () {
      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSignature, { value: PRICE });

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(orderEth, artistSignature, { value: PRICE })
      ).to.be.reverted;
    });

    it('reverts if invalid ether amount sent', async function () {
      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(orderEth, artistSignature, { value: PRICE - 1 })
      ).to.be.reverted;
    });
  });

  describe('cancelOrder', () => {
    beforeEach(async function () {
      const artistSigEth = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSigEth, { value: PRICE });

      const artistSigErc20 = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderErc20, artistSigErc20);
    });

    it('cancels an order and transfers ether', async function () {
      await time.increase(ONE_DAY);

      await artOrderContract.connect(orderer).cancelOrder(orderEth);

      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
    });

    it('cancels an order and transfers erc20', async function () {
      await time.increase(ONE_DAY);

      await artOrderContract.connect(orderer).cancelOrder(orderErc20);

      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
      );
    });

    it('emits OrderCancelled event', async function () {
      await time.increase(ONE_DAY);

      const tx = await artOrderContract.connect(orderer).cancelOrder(orderEth);

      const receipt = await tx.wait();
      const eventData = receipt.events.find(
        ({ event }) => event === 'OrderCancelled'
      );

      expect(orderer.address).to.equal(eventData.args.orderer);
      expect(artist.address).to.equal(eventData.args.artist);
      expect(PRICE).to.equal(eventData.args.price);
      expect(timestampDayAfter).to.equal(eventData.args.timestamp);
      expect(ethers.constants.AddressZero).to.equal(
        eventData.args.paymentErc20TokenAddress
      );
    });

    it('reverts if caller not the orderer', async function () {
      await time.increase(ONE_DAY);

      await expect(
        artOrderContract.connect(administrator).cancelOrder(orderEth)
      ).to.be.reverted;
    });

    it('reverts if order is still valid', async function () {
      await expect(artOrderContract.connect(orderer).cancelOrder(orderEth)).to
        .be.reverted;
    });

    it('reverts if order is not active', async function () {
      await time.increase(ONE_DAY);

      await artOrderContract.connect(orderer).cancelOrder(orderEth);

      await expect(artOrderContract.connect(orderer).cancelOrder(orderEth)).to
        .be.reverted;
    });
  });

  describe('finalizeOrder', () => {
    beforeEach(async function () {
      const artistSigEth = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSigEth, { value: PRICE });

      const artistSigErc20 = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderErc20, artistSigErc20);
    });

    it('finalizes an order and distributes ether', async function () {
      const prevArtistBalance = await ethers.provider.getBalance(
        artist.address
      );
      const prevFeeRecipientBalance = await ethers.provider.getBalance(
        feeRecipient.address
      );

      const tx = await artOrderContract
        .connect(artist)
        .finalizeOrder(orderEth, 'token CID');
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
      expect(await ethers.provider.getBalance(artist.address)).to.equal(
        prevArtistBalance.add(PRICE * 0.975).sub(gasSpent)
      );
      expect(await ethers.provider.getBalance(feeRecipient.address)).to.equal(
        prevFeeRecipientBalance.add(PRICE * 0.025)
      );
    });

    it('finalizes an order and distributes erc20', async function () {
      const prevArtistBalance = await tokenContract.balanceOf(artist.address);
      const prevFeeRecipientBalance = await tokenContract.balanceOf(
        feeRecipient.address
      );

      await artOrderContract
        .connect(artist)
        .finalizeOrder(orderErc20, 'token CID');

      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
      );
      expect(await tokenContract.balanceOf(artist.address)).to.equal(
        prevArtistBalance.add(PRICE * 0.975)
      );
      expect(await tokenContract.balanceOf(feeRecipient.address)).to.equal(
        prevFeeRecipientBalance.add(PRICE * 0.025)
      );
    });

    it('emits OrderFinalized event', async function () {
      const tx = await artOrderContract
        .connect(artist)
        .finalizeOrder(orderEth, 'token CID');

      const receipt = await tx.wait();
      const eventData = receipt.events.find(
        ({ event }) => event === 'OrderFinalized'
      );

      expect(orderer.address).to.equal(eventData.args.orderer);
      expect(artist.address).to.equal(eventData.args.artist);
      expect(PRICE).to.equal(eventData.args.price);
      expect(timestampDayAfter).to.equal(eventData.args.timestamp);
      expect(ethers.constants.AddressZero).to.equal(
        eventData.args.paymentErc20TokenAddress
      );
      expect('token CID').to.equal(eventData.args.tokenCID);
    });

    it('finalizes multiple orders for same artist', async function () {
      await artOrderContract
        .connect(artist)
        .finalizeOrder(orderEth, 'token CID');

      await artOrderContract
        .connect(artist)
        .finalizeOrder(orderErc20, 'token CID');

      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
      );
    });

    it('reverts if order timestamp exceeded', async function () {
      await time.increase(ONE_DAY);

      await expect(
        artOrderContract.connect(artist).finalizeOrder(orderEth, 'token CID')
      ).to.be.reverted;
    });

    it('reverts if caller not the artist', async function () {
      await expect(
        artOrderContract.connect(orderer).finalizeOrder(orderErc20, 'token CID')
      ).to.be.reverted;
    });

    it('reverts if order does not exist', async function () {
      const order = {
        ...orderEth,
        price: PRICE + 1,
      };

      await expect(
        artOrderContract.connect(artist).finalizeOrder(order, 'token CID')
      ).to.be.reverted;
    });
  });

  describe('finalizeExtendedOrder', () => {
    beforeEach(async function () {
      await time.increase(ONE_DAY + 1);

      const artistSigEth = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSigEth, { value: PRICE });

      const artistSigErc20 = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderErc20, artistSigErc20);
    });

    it('finalizes an order and distributes ether', async function () {
      let extendSignatureEth = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderEth,
        timestamp2DaysAfter
      );

      const prevArtistBalance = await ethers.provider.getBalance(
        artist.address
      );
      const prevFeeRecipientBalance = await ethers.provider.getBalance(
        feeRecipient.address
      );

      const tx = await artOrderContract
        .connect(artist)
        .finalizeExtendedOrder(
          orderEth,
          timestamp2DaysAfter,
          'token CID',
          extendSignatureEth
        );
      const receipt = await tx.wait();
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
      expect(await ethers.provider.getBalance(artist.address)).to.equal(
        prevArtistBalance.add(PRICE * 0.975).sub(gasSpent)
      );
      expect(await ethers.provider.getBalance(feeRecipient.address)).to.equal(
        prevFeeRecipientBalance.add(PRICE * 0.025)
      );
    });

    it('finalizes an order and distributes erc20', async function () {
      let extendSignatureErc20 = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderErc20,
        timestamp2DaysAfter
      );

      const prevArtistBalance = await tokenContract.balanceOf(artist.address);
      const prevFeeRecipientBalance = await tokenContract.balanceOf(
        feeRecipient.address
      );

      await artOrderContract
        .connect(artist)
        .finalizeExtendedOrder(
          orderErc20,
          timestamp2DaysAfter,
          'token CID',
          extendSignatureErc20
        );

      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
      );
      expect(await tokenContract.balanceOf(artist.address)).to.equal(
        prevArtistBalance.add(PRICE * 0.975)
      );
      expect(await tokenContract.balanceOf(feeRecipient.address)).to.equal(
        prevFeeRecipientBalance.add(PRICE * 0.025)
      );
    });

    it('emits OrderFinalized event', async function () {
      let extendSignatureEth = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderEth,
        timestamp2DaysAfter
      );

      const tx = await artOrderContract
        .connect(artist)
        .finalizeExtendedOrder(
          orderEth,
          timestamp2DaysAfter,
          'token CID',
          extendSignatureEth
        );

      const receipt = await tx.wait();
      const eventData = receipt.events.find(
        ({ event }) => event === 'OrderFinalized'
      );

      expect(orderer.address).to.equal(eventData.args.orderer);
      expect(artist.address).to.equal(eventData.args.artist);
      expect(PRICE).to.equal(eventData.args.price);
      expect(timestampDayAfter).to.equal(eventData.args.timestamp);
      expect(ethers.constants.AddressZero).to.equal(
        eventData.args.paymentErc20TokenAddress
      );
      expect('token CID').to.equal(eventData.args.tokenCID);
    });

    it('finalizes multiple extended orders for same artist', async function () {
      let extendSignatureEth = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderEth,
        timestamp2DaysAfter
      );

      let extendSignatureErc20 = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderErc20,
        timestamp2DaysAfter
      );

      await artOrderContract
        .connect(artist)
        .finalizeExtendedOrder(
          orderEth,
          timestamp2DaysAfter,
          'token CID',
          extendSignatureEth
        );

      await artOrderContract
        .connect(artist)
        .finalizeExtendedOrder(
          orderErc20,
          timestamp2DaysAfter,
          'token CID',
          extendSignatureErc20
        );

      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
      );
    });

    it('reverts if new order timestamp exceeded', async function () {
      let extendSignatureEth = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderEth,
        timestamp2DaysAfter
      );

      await time.increase(ONE_DAY);

      await expect(
        artOrderContract
          .connect(artist)
          .finalizeExtendedOrder(
            orderEth,
            timestamp2DaysAfter,
            'token CID',
            extendSignatureEth
          )
      ).to.be.reverted;
    });

    it('reverts if caller not the artist', async function () {
      let extendSignatureErc20 = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderErc20,
        timestamp2DaysAfter
      );

      await expect(
        artOrderContract
          .connect(orderer)
          .finalizeExtendedOrder(
            orderErc20,
            timestamp2DaysAfter,
            'token CID',
            extendSignatureErc20
          )
      ).to.be.reverted;
    });

    it('reverts if order does not exist', async function () {
      let extendSignatureEth = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderEth,
        timestamp2DaysAfter
      );

      const order = {
        ...orderEth,
        price: PRICE + 1,
      };

      await expect(
        artOrderContract
          .connect(artist)
          .finalizeExtendedOrder(
            order,
            timestamp2DaysAfter,
            'token CID',
            extendSignatureEth
          )
      ).to.be.reverted;
    });
  });

  describe('updateFees', () => {
    it('updates fee configuration', async function () {
      await artOrderContract.updateFees(500, feeRecipient.address);

      const _feeAmount = await artOrderContract.feeAmount();
      const _feeRecipient = await artOrderContract.feeRecipient();

      expect(_feeAmount).to.equal(500);
      expect(_feeRecipient).to.equal(feeRecipient.address);
    });

    it('reverts if caller is not administrator', async function () {
      await expect(
        artOrderContract.connect(orderer).updateFees(500, feeRecipient.address)
      ).to.be.reverted;
    });
  });
});
