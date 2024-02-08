const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployArtOrderWithFactory } = require('../helpers/deploy');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const {
  createCreateOrderSignature,
  createCancelOrderSignature,
  createFinalizeOrderSignature,
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

  let orderEth;
  let orderErc20;

  beforeEach(async function () {
    [administrator, orderer, artist, feeRecipient] = await ethers.getSigners();
    timestampNow = (await ethers.provider.getBlock('latest')).timestamp;
    timestampDayAfter = timestampNow + ONE_DAY;

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
    it('creates a new order and transfers ether', async function () {
      const {
        v: vOrderer,
        r: rOrderer,
        s: sOrderer,
      } = await createCreateOrderSignature(artOrderContract, orderer, orderEth);

      const {
        v: vArtist,
        r: rArtist,
        s: sArtist,
      } = await createCreateOrderSignature(artOrderContract, artist, orderEth);

      await artOrderContract
        .connect(orderer)
        .createOrder(
          orderEth,
          vOrderer,
          rOrderer,
          sOrderer,
          vArtist,
          rArtist,
          sArtist,
          { value: PRICE }
        );

      const orderHash = getOrderHash(orderEth).toString();

      expect(await artOrderContract.statusPerOrder(orderHash)).to.equal(1);
      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(PRICE);
    });

    it('creates a new order and transfers erc20', async function () {
      const {
        v: vOrderer,
        r: rOrderer,
        s: sOrderer,
      } = await createCreateOrderSignature(
        artOrderContract,
        orderer,
        orderErc20
      );

      const {
        v: vArtist,
        r: rArtist,
        s: sArtist,
      } = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(
          orderErc20,
          vOrderer,
          rOrderer,
          sOrderer,
          vArtist,
          rArtist,
          sArtist
        );

      const orderHash = getOrderHash(orderErc20).toString();

      expect(await artOrderContract.statusPerOrder(orderHash)).to.equal(1);
      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        PRICE
      );
    });

    it('emits OrderCreated event', async function () {
      const {
        v: vOrderer,
        r: rOrderer,
        s: sOrderer,
      } = await createCreateOrderSignature(artOrderContract, orderer, orderEth);

      const {
        v: vArtist,
        r: rArtist,
        s: sArtist,
      } = await createCreateOrderSignature(artOrderContract, artist, orderEth);

      const tx = await artOrderContract
        .connect(orderer)
        .createOrder(
          orderEth,
          vOrderer,
          rOrderer,
          sOrderer,
          vArtist,
          rArtist,
          sArtist,
          { value: PRICE }
        );

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

    it('reverts if orderer signature is not valid', async function () {
      const {
        v: vArtist,
        r: rArtist,
        s: sArtist,
      } = await createCreateOrderSignature(artOrderContract, artist, orderEth);

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(
            orderEth,
            0,
            rArtist,
            sArtist,
            vArtist,
            rArtist,
            sArtist,
            {
              value: PRICE,
            }
          )
      ).to.be.reverted;
    });

    it('reverts if artist signature is not valid', async function () {
      const {
        v: vOrderer,
        r: rOrderer,
        s: sOrderer,
      } = await createCreateOrderSignature(artOrderContract, orderer, orderEth);

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(
            orderEth,
            vOrderer,
            rOrderer,
            sOrderer,
            0,
            rOrderer,
            sOrderer,
            {
              value: PRICE,
            }
          )
      ).to.be.reverted;
    });

    it('reverts if order already exists', async function () {
      const {
        v: vOrderer,
        r: rOrderer,
        s: sOrderer,
      } = await createCreateOrderSignature(artOrderContract, orderer, orderEth);

      const {
        v: vArtist,
        r: rArtist,
        s: sArtist,
      } = await createCreateOrderSignature(artOrderContract, artist, orderEth);

      await artOrderContract
        .connect(orderer)
        .createOrder(
          orderEth,
          vOrderer,
          rOrderer,
          sOrderer,
          vArtist,
          rArtist,
          sArtist,
          { value: PRICE }
        );

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(
            orderEth,
            vOrderer,
            rOrderer,
            sOrderer,
            vArtist,
            rArtist,
            sArtist,
            { value: PRICE }
          )
      ).to.be.reverted;
    });

    it('reverts if invalid ether amount sent', async function () {
      const {
        v: vOrderer,
        r: rOrderer,
        s: sOrderer,
      } = await createCreateOrderSignature(artOrderContract, orderer, orderEth);

      const {
        v: vArtist,
        r: rArtist,
        s: sArtist,
      } = await createCreateOrderSignature(artOrderContract, artist, orderEth);

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(
            orderEth,
            vOrderer,
            rOrderer,
            sOrderer,
            vArtist,
            rArtist,
            sArtist,
            { value: PRICE - 1 }
          )
      ).to.be.reverted;
    });
  });

  describe('cancelOrder', () => {
    beforeEach(async function () {
      const {
        v: vOrdererEth,
        r: rOrdererEth,
        s: sOrdererEth,
      } = await createCreateOrderSignature(artOrderContract, orderer, orderEth);

      const {
        v: vArtistEth,
        r: rArtistEth,
        s: sArtistEth,
      } = await createCreateOrderSignature(artOrderContract, artist, orderEth);

      await artOrderContract
        .connect(orderer)
        .createOrder(
          orderEth,
          vOrdererEth,
          rOrdererEth,
          sOrdererEth,
          vArtistEth,
          rArtistEth,
          sArtistEth,
          { value: PRICE }
        );

      const {
        v: vOrdererErc20,
        r: rOrdererErc20,
        s: sOrdererErc20,
      } = await createCreateOrderSignature(
        artOrderContract,
        orderer,
        orderErc20
      );

      const {
        v: vArtistErc20,
        r: rArtistErc20,
        s: sArtistErc20,
      } = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(
          orderErc20,
          vOrdererErc20,
          rOrdererErc20,
          sOrdererErc20,
          vArtistErc20,
          rArtistErc20,
          sArtistErc20
        );
    });

    it('cancels an order and transfers ether', async function () {
      await time.increase(ONE_DAY);

      const { v, r, s } = await createCancelOrderSignature(
        artOrderContract,
        orderer,
        orderEth
      );

      await artOrderContract.connect(orderer).cancelOrder(orderEth, v, r, s);

      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
    });

    it('cancels an order and transfers erc20', async function () {
      await time.increase(ONE_DAY);

      const { v, r, s } = await createCancelOrderSignature(
        artOrderContract,
        orderer,
        orderErc20
      );

      await artOrderContract.connect(orderer).cancelOrder(orderErc20, v, r, s);

      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
      );
    });

    it('emits OrderCancelled event', async function () {
      await time.increase(ONE_DAY);

      const { v, r, s } = await createCancelOrderSignature(
        artOrderContract,
        orderer,
        orderEth
      );

      const tx = await artOrderContract
        .connect(orderer)
        .cancelOrder(orderEth, v, r, s);

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

    it('reverts if signature is not valid', async function () {
      await time.increase(ONE_DAY);

      const { v, r, s } = await createCancelOrderSignature(
        artOrderContract,
        orderer,
        orderEth
      );

      await expect(
        artOrderContract.connect(orderer).cancelOrder(orderEth, 0, r, s)
      ).to.be.reverted;
    });

    it('reverts if order is still valid', async function () {
      const { v, r, s } = await createCancelOrderSignature(
        artOrderContract,
        orderer,
        orderEth
      );

      await expect(
        artOrderContract.connect(orderer).cancelOrder(orderEth, v, r, s)
      ).to.be.reverted;
    });

    it('reverts if order is not active', async function () {
      const orderEth2 = {
        ...orderEth,
        price: PRICE * 2,
      };

      await time.increase(ONE_DAY);

      const { v, r, s } = await createCancelOrderSignature(
        artOrderContract,
        orderer,
        orderEth2
      );

      await expect(
        artOrderContract.connect(orderer).cancelOrder(orderEth2, v, r, s)
      ).to.be.reverted;
    });
  });

  describe('finalizeOrder', () => {
    beforeEach(async function () {
      const {
        v: vOrdererEth,
        r: rOrdererEth,
        s: sOrdererEth,
      } = await createCreateOrderSignature(artOrderContract, orderer, orderEth);

      const {
        v: vArtistEth,
        r: rArtistEth,
        s: sArtistEth,
      } = await createCreateOrderSignature(artOrderContract, artist, orderEth);

      await artOrderContract
        .connect(orderer)
        .createOrder(
          orderEth,
          vOrdererEth,
          rOrdererEth,
          sOrdererEth,
          vArtistEth,
          rArtistEth,
          sArtistEth,
          { value: PRICE }
        );

      const {
        v: vOrdererErc20,
        r: rOrdererErc20,
        s: sOrdererErc20,
      } = await createCreateOrderSignature(
        artOrderContract,
        orderer,
        orderErc20
      );

      const {
        v: vArtistErc20,
        r: rArtistErc20,
        s: sArtistErc20,
      } = await createCreateOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(
          orderErc20,
          vOrdererErc20,
          rOrdererErc20,
          sOrdererErc20,
          vArtistErc20,
          rArtistErc20,
          sArtistErc20
        );
    });

    it('finalizes an order and distributes ether', async function () {
      await time.increase(ONE_DAY);

      const { v, r, s } = await createFinalizeOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      const prevArtistBalance = await ethers.provider.getBalance(
        artist.address
      );
      const prevFeeRecipientBalance = await ethers.provider.getBalance(
        feeRecipient.address
      );

      const tx = await artOrderContract
        .connect(artist)
        .finalizeOrder(orderEth, 'token CID', v, r, s);
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
      await time.increase(ONE_DAY);

      const { v, r, s } = await createFinalizeOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      const prevArtistBalance = await tokenContract.balanceOf(artist.address);
      const prevFeeRecipientBalance = await tokenContract.balanceOf(
        feeRecipient.address
      );

      await artOrderContract
        .connect(artist)
        .finalizeOrder(orderErc20, 'token CID', v, r, s);

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
      const { v, r, s } = await createFinalizeOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      const tx = await artOrderContract
        .connect(artist)
        .finalizeOrder(orderEth, 'token CID', v, r, s);

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
      await time.increase(ONE_DAY);

      const { v, r, s } = await createFinalizeOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      await artOrderContract
        .connect(artist)
        .finalizeOrder(orderEth, 'token CID', v, r, s);

      const {
        v: v2,
        r: r2,
        s: s2,
      } = await createFinalizeOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(artist)
        .finalizeOrder(orderErc20, 'token CID', v2, r2, s2);

      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
      );
    });

    it('reverts if signature is not valid', async function () {
      const { v, r, s } = await createFinalizeOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      await expect(
        artOrderContract
          .connect(artist)
          .finalizeOrder(orderEth, 'token CID', 0, r, s)
      ).to.be.reverted;
    });

    it('reverts if order does not exist', async function () {
      const orderEth2 = {
        ...orderEth,
        price: PRICE * 2,
      };

      const { v, r, s } = await createFinalizeOrderSignature(
        artOrderContract,
        artist,
        orderEth2
      );

      await expect(
        artOrderContract
          .connect(artist)
          .finalizeOrder(orderEth2, 'token CID', v, r, s)
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
