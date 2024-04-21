const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { deployArtOrderWithFactory } = require('../helpers/deploy');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const {
  createOrderSignature,
  createExtendOrderSignature,
} = require('../helpers/sign');

function getOrderHash(order) {
  return ethers.utils.solidityKeccak256(
    ['uint256', 'address', 'address', 'uint256', 'uint256', 'address'],
    [
      order.nonce,
      order.orderer,
      order.artist,
      order.price,
      order.timeframe,
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
  let owner, orderer, artist, feeRecipient;
  let timestampNow;
  let timestamp2DaysAfter;

  let orderEth;
  let orderErc20;

  beforeEach(async function () {
    [owner, orderer, artist, feeRecipient] = await ethers.getSigners();
    timestampNow = (await ethers.provider.getBlock('latest')).timestamp;
    timestamp2DaysAfter = timestampNow + ONE_DAY * 2;

    const EndemicToken = await ethers.getContractFactory('EndemicToken');
    tokenContract = await EndemicToken.deploy(orderer.address);
    await tokenContract.deployed();

    orderEth = {
      nonce: 0,
      orderer: orderer.address,
      artist: artist.address,
      price: PRICE,
      timeframe: ONE_DAY,
      paymentErc20TokenAddress: ethers.constants.AddressZero,
    };

    orderErc20 = {
      nonce: 0,
      orderer: orderer.address,
      artist: artist.address,
      price: PRICE,
      timeframe: ONE_DAY,
      paymentErc20TokenAddress: tokenContract.address,
    };

    artOrderContract = await deployArtOrderWithFactory(
      FEE,
      feeRecipient.address
    );

    await tokenContract
      .connect(orderer)
      .approve(artOrderContract.address, PRICE);
  });

  describe('initialize', function () {
    it('deploys with correct initial setup', async function () {
      const _feeAmount = await artOrderContract.feeAmount();
      const _feeRecipient = await artOrderContract.feeRecipient();
      const _owner = await artOrderContract.owner();

      expect(_feeAmount).to.equal(FEE);
      expect(_feeRecipient).to.equal(feeRecipient.address);
      expect(_owner).to.equal(owner.address);
    });

    it('reverts if fee amount is too high', async function () {
      await expect(
        deployArtOrderWithFactory(10_001, feeRecipient.address)
      ).to.be.revertedWithCustomError(artOrderContract, 'InvalidFeeAmount');
    });

    it('reverts if collection factory is zero address', async function () {
      const ArtOrder = await ethers.getContractFactory('ArtOrder');
      await expect(
        upgrades.deployProxy(
          ArtOrder,
          [1_000, feeRecipient.address, ethers.constants.AddressZero],
          {
            initializer: 'initialize',
          }
        )
      ).to.be.revertedWithCustomError(artOrderContract, 'InvalidAddress');
    });
  });

  describe('createOrder', function () {
    let artistSignature;

    beforeEach(async function () {
      artistSignature = await createOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );
    });

    it('creates a new order and transfers ether', async function () {
      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSignature, { value: PRICE });

      const timestamp = await time.latest();

      const orderHash = getOrderHash(orderEth).toString();
      const order = await artOrderContract.orders(orderHash);

      expect(order.status).to.equal(1);
      expect(order.deadline).to.equal(timestamp + ONE_DAY);
      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(PRICE);
    });

    it('creates a new order and transfers erc20', async function () {
      const artistSignatureErc20 = await createOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderErc20, artistSignatureErc20);

      const timestamp = await time.latest();

      const orderHash = getOrderHash(orderErc20).toString();
      const order = await artOrderContract.orders(orderHash);

      expect(order.status).to.equal(1);
      expect(order.deadline).to.equal(timestamp + ONE_DAY);
      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        PRICE
      );
    });

    it('emits OrderCreated event', async function () {
      const tx = await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSignature, { value: PRICE });

      const timestamp = await time.latest();

      await expect(tx)
        .to.emit(artOrderContract, 'OrderCreated')
        .withArgs(
          0,
          orderer.address,
          artist.address,
          PRICE,
          timestamp + ONE_DAY,
          ethers.constants.AddressZero
        );
    });

    it('reverts if caller not the orderer', async function () {
      await expect(
        artOrderContract
          .connect(owner)
          .createOrder(orderEth, artistSignature, { value: PRICE })
      ).to.be.revertedWithCustomError(artOrderContract, 'UnauthorizedCaller');
    });

    it('reverts if artist signature is not valid', async function () {
      const ordererSignature = await createOrderSignature(
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
      ).to.be.revertedWithCustomError(
        artOrderContract,
        'CreateOrderSignatureInvalid'
      );
    });

    it('reverts if order already exists', async function () {
      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSignature, { value: PRICE });

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(orderEth, artistSignature, { value: PRICE })
      ).to.be.revertedWithCustomError(artOrderContract, 'OrderAlreadyExists');
    });

    it('reverts if invalid ether amount sent', async function () {
      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(orderEth, artistSignature, { value: PRICE - 1 })
      ).to.be.revertedWithCustomError(artOrderContract, 'InvalidEtherAmount');
    });

    it('reverts if ether is sent for erc20 order', async function () {
      const artistSignatureErc20 = await createOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(orderErc20, artistSignatureErc20, {
            value: 1,
          })
      ).to.be.revertedWithCustomError(artOrderContract, 'InvalidEtherAmount');
    });

    it('reverts if caller have insufficient erc20 allowance', async function () {
      const ordererSignature = await createOrderSignature(
        artOrderContract,
        artist,
        orderErc20
      );

      await tokenContract
        .connect(orderer)
        .approve(artOrderContract.address, PRICE - 1);

      await expect(
        artOrderContract
          .connect(orderer)
          .createOrder(orderErc20, ordererSignature)
      ).to.be.revertedWith('ERC20: insufficient allowance');
    });

    it('reverts if price is zero', async function () {
      await expect(
        artOrderContract.connect(orderer).createOrder(
          {
            nonce: 0,
            orderer: orderer.address,
            artist: artist.address,
            price: 0, // price is zero
            timeframe: ONE_DAY,
            paymentErc20TokenAddress: ethers.constants.AddressZero,
          },
          artistSignature
        )
      ).to.be.revertedWithCustomError(artOrderContract, 'InvalidPrice');
    });
  });

  describe('cancelOrder', () => {
    let ethOrderTimestamp;

    beforeEach(async function () {
      const artistSigEth = await createOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSigEth, { value: PRICE });

      ethOrderTimestamp = await time.latest();

      const artistSigErc20 = await createOrderSignature(
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

      const orderHash = getOrderHash(orderEth).toString();
      const order = await artOrderContract.orders(orderHash);

      expect(order.status).to.equal(2);
      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
    });

    it('cancels an order and transfers erc20', async function () {
      await time.increase(ONE_DAY);

      await artOrderContract.connect(orderer).cancelOrder(orderErc20);

      const orderHash = getOrderHash(orderErc20).toString();
      const order = await artOrderContract.orders(orderHash);

      expect(order.status).to.equal(2);
      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
      );
    });

    it('emits OrderCancelled event', async function () {
      await time.increase(ONE_DAY);

      const tx = await artOrderContract.connect(orderer).cancelOrder(orderEth);

      await expect(tx)
        .to.emit(artOrderContract, 'OrderCancelled')
        .withArgs(
          0,
          orderer.address,
          artist.address,
          PRICE,
          ethOrderTimestamp + ONE_DAY,
          ethers.constants.AddressZero
        );
    });

    it('reverts if caller not the orderer', async function () {
      await time.increase(ONE_DAY);

      await expect(
        artOrderContract.connect(owner).cancelOrder(orderEth)
      ).to.be.revertedWithCustomError(artOrderContract, 'UnauthorizedCaller');
    });

    it('reverts if order is still valid', async function () {
      await expect(
        artOrderContract.connect(orderer).cancelOrder(orderEth)
      ).to.be.revertedWithCustomError(
        artOrderContract,
        'OrderDeadlineNotExceeded'
      );
    });

    it('reverts if order is not active', async function () {
      await time.increase(ONE_DAY);

      await artOrderContract.connect(orderer).cancelOrder(orderEth);

      await expect(
        artOrderContract.connect(orderer).cancelOrder(orderEth)
      ).to.be.revertedWithCustomError(artOrderContract, 'OrderNotActive');
    });
  });

  describe('finalizeOrder', () => {
    let ethOrderTimestamp;

    beforeEach(async function () {
      const artistSigEth = await createOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSigEth, { value: PRICE });

      ethOrderTimestamp = await time.latest();

      const artistSigErc20 = await createOrderSignature(
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

      const orderHash = getOrderHash(orderEth).toString();
      const order = await artOrderContract.orders(orderHash);

      expect(order.status).to.equal(3);
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

      const orderHash = getOrderHash(orderErc20).toString();
      const order = await artOrderContract.orders(orderHash);

      expect(order.status).to.equal(3);
    });

    it('emits OrderFinalized event', async function () {
      const tx = await artOrderContract
        .connect(artist)
        .finalizeOrder(orderEth, 'token CID');

      await expect(tx)
        .to.emit(artOrderContract, 'OrderFinalized')
        .withArgs(
          0,
          orderer.address,
          artist.address,
          PRICE,
          ethOrderTimestamp + ONE_DAY, // original deadline
          ethers.constants.AddressZero,
          'token CID'
        );
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
      ).to.be.revertedWithCustomError(
        artOrderContract,
        'OrderDeadlineExceeded'
      );
    });

    it('reverts if caller not the artist', async function () {
      await expect(
        artOrderContract.connect(orderer).finalizeOrder(orderErc20, 'token CID')
      ).to.be.revertedWithCustomError(artOrderContract, 'UnauthorizedCaller');
    });

    it('reverts if order does not exist', async function () {
      const order = {
        ...orderEth,
        price: PRICE + 1,
      };

      await expect(
        artOrderContract.connect(artist).finalizeOrder(order, 'token CID')
      ).to.be.revertedWithCustomError(artOrderContract, 'OrderNotActive');
    });

    it('reverts if token cid is empty', async function () {
      await expect(
        artOrderContract.connect(artist).finalizeOrder(orderEth, '')
      ).to.be.revertedWithCustomError(artOrderContract, 'InvalidTokenCID');
    });
  });

  describe('finalizeExtendedOrder', () => {
    beforeEach(async function () {
      await time.increase(ONE_DAY + 1);

      const artistSigEth = await createOrderSignature(
        artOrderContract,
        artist,
        orderEth
      );

      await artOrderContract
        .connect(orderer)
        .createOrder(orderEth, artistSigEth, { value: PRICE });

      const artistSigErc20 = await createOrderSignature(
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

      await expect(
        artOrderContract
          .connect(artist)
          .finalizeExtendedOrder(
            orderEth,
            timestamp2DaysAfter,
            'token CID',
            extendSignatureEth
          )
      ).to.changeEtherBalances(
        [artist, feeRecipient],
        [PRICE * 0.975, PRICE * 0.025]
      );

      expect(
        await ethers.provider.getBalance(artOrderContract.address)
      ).to.equal(0);
    });

    it('finalizes an order and distributes erc20', async function () {
      let extendSignatureErc20 = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        orderErc20,
        timestamp2DaysAfter
      );

      await expect(
        artOrderContract
          .connect(artist)
          .finalizeExtendedOrder(
            orderErc20,
            timestamp2DaysAfter,
            'token CID',
            extendSignatureErc20
          )
      ).to.changeTokenBalances(
        tokenContract,
        [artist, feeRecipient],
        [PRICE * 0.975, PRICE * 0.025]
      );

      expect(await tokenContract.balanceOf(artOrderContract.address)).to.equal(
        0
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

      await expect(tx).to.emit(artOrderContract, 'OrderFinalized').withArgs(
        0,
        orderer.address,
        artist.address,
        PRICE,
        timestamp2DaysAfter, // new deadline
        ethers.constants.AddressZero,
        'token CID'
      );
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
      ).to.be.revertedWithCustomError(
        artOrderContract,
        'OrderDeadlineExceeded'
      );
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
      ).to.be.revertedWithCustomError(artOrderContract, 'UnauthorizedCaller');
    });

    it('reverts if order does not exist', async function () {
      const order = {
        ...orderEth,
        price: PRICE + 1,
      };

      let extendSignatureEth = await createExtendOrderSignature(
        artOrderContract,
        orderer,
        order,
        timestamp2DaysAfter
      );

      await expect(
        artOrderContract
          .connect(artist)
          .finalizeExtendedOrder(
            order,
            timestamp2DaysAfter,
            'token CID',
            extendSignatureEth
          )
      ).to.be.revertedWithCustomError(artOrderContract, 'OrderNotActive');
    });

    it('reverts if signature is invalid', async function () {
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
      ).to.be.revertedWithCustomError(
        artOrderContract,
        'ExtendOrderSignatureInvalid'
      );
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

    it('reverts if caller is not owner', async function () {
      await expect(
        artOrderContract.connect(orderer).updateFees(500, feeRecipient.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
