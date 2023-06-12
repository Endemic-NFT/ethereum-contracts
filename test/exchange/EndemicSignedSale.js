const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const {
  deployEndemicExchangeWithDeps,
  deployInitializedCollection,
  deployEndemicToken,
} = require('../helpers/deploy');
const { getTypedMessage } = require('../helpers/eip712');
const {
  signTypedData,
  SignTypedDataVersion,
} = require('@metamask/eth-sig-util');
const { ZERO_ADDRESS, ZERO, ZERO_BYTES32 } = require('../helpers/constants');
const { addTakerFee } = require('../helpers/token');

const INVALID_SIGNATURE = 'InvalidSignature';
const INVALID_PAYMENT_METHOD = 'InvalidPaymentMethod';

const SIGNED_SALE_EXPIRED = 'SignedSaleExpired';
const SIGNED_SALE_SUCCESS = 'SignedSaleSuccess';

const UNSUFFICIENT_CURRENCY_SUPPLIED = 'UnsufficientCurrencySupplied';

describe('EndemicSignedSale', () => {
  let endemicExchange, endemicToken, nftContract, paymentManagerContract;

  let owner, user2, mintApprover, collectionAdministrator;

  const RANDOM_R_VALUE =
    '0x4355c47d63924e8a72e509b65029052eb6c299d53a04e167c5775fd466751c9d';
  const RANDOM_S_VALUE =
    '0x07299936d304c153f6443dfa05f40ff007d72911b6f72307f996231605b91562';
  const RANDOM_V_VALUE = '0x1c';
  const RANDOM_TIMESTAMP = 2032530705;
  const LAST_YEAR_TIMESTAMP = 1615762236;
  const ONE_ETHER = ethers.utils.parseUnits('1.0');
  const ZERO_ONE_ETHER = ethers.utils.parseUnits('0.1');

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

  async function deploy() {
    [owner, user2, mintApprover, collectionAdministrator] =
      await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps();

    endemicExchange = result.endemicExchangeContract;
    paymentManagerContract = result.paymentManagerContract;

    nftContract = await deployInitializedCollection(
      owner,
      collectionAdministrator,
      mintApprover
    );

    await mintToken(owner.address);
  }

  const getSignedSale = async (paymentErc20TokenAddress, buyer) => {
    const wallet = ethers.Wallet.createRandom();

    const signer = wallet.connect(endemicExchange.provider);

    await owner.sendTransaction({
      to: signer.address,
      value: ethers.utils.parseEther('1650'),
    });

    await mintToken(signer.address);

    await nftContract.connect(signer).approve(endemicExchange.address, 2);

    const data = getTypedMessage({
      chainId: network.config.chainId,
      verifierContract: endemicExchange.address,
      nftContract: nftContract.address,
      seller: signer.address,
      buyer: buyer.address,
      paymentErc20TokenAddress,
      price: ONE_ETHER,
    });

    return signTypedData({
      privateKey: Buffer.from(signer.privateKey.substring(2), 'hex'),
      data,
      version: SignTypedDataVersion.V4,
    });
  };

  const getSignedSaleSignature = async ({
    paymentErc20TokenAddress = ZERO_ADDRESS,
    buyer = ZERO_ADDRESS,
  }) => {
    const signedSale = await getSignedSale(
      paymentErc20TokenAddress,
      buyer
    );

    const signature = signedSale.substring(2);
    const r = '0x' + signature.substring(0, 64);
    const s = '0x' + signature.substring(64, 128);
    const v = parseInt(signature.substring(128, 130), 16);

    return { r, s, v };
  };

  describe('Initial State', function () {
    it('should set domain separator', async function () {
      await deploy();

      expect(await endemicExchange.DOMAIN_SEPARATOR()).to.exist;
    });
  });

  describe('Buy from signed sale with Ether', function () {
    beforeEach(deploy);

    it('should fail with signed sale expired', async function () {
      await expect(
        endemicExchange.buyFromReservedSignedSale(
          ZERO_ADDRESS,
          nftContract.address,
          1,
          ZERO_ONE_ETHER,
          LAST_YEAR_TIMESTAMP,
          RANDOM_V_VALUE,
          RANDOM_R_VALUE,
          RANDOM_S_VALUE
        )
      ).to.be.revertedWithCustomError(endemicExchange, SIGNED_SALE_EXPIRED);
    });

    it('should fail with price not correct (too low provided)', async function () {
      await expect(
        endemicExchange.buyFromReservedSignedSale(
          ZERO_ADDRESS,
          nftContract.address,
          1,
          ONE_ETHER,
          RANDOM_TIMESTAMP,
          RANDOM_V_VALUE,
          RANDOM_R_VALUE,
          RANDOM_S_VALUE,
          {
            value: ZERO_ONE_ETHER,
          }
        )
      ).to.be.revertedWithCustomError(
        endemicExchange,
        UNSUFFICIENT_CURRENCY_SUPPLIED
      );
    });

    it('should fail with invalid signature', async function () {
      const priceWithFees = addTakerFee(ONE_ETHER);

      await expect(
        endemicExchange.buyFromReservedSignedSale(
          ZERO_ADDRESS,
          nftContract.address,
          1,
          ONE_ETHER,
          RANDOM_TIMESTAMP,
          RANDOM_V_VALUE,
          RANDOM_R_VALUE,
          RANDOM_S_VALUE,
          {
            value: priceWithFees,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_SIGNATURE);
    });

    it('should fail to buy from signed sale when taker fee not included', async function () {
      const { r, s, v } = await getSignedSaleSignature({ buyer: owner });

      await expect(
        endemicExchange.buyFromReservedSignedSale(
          ZERO_ADDRESS,
          nftContract.address,
          2,
          ONE_ETHER,
          2000994705,
          v,
          r,
          s,
          {
            value: ONE_ETHER,
          }
        )
      ).to.be.revertedWithCustomError(
        endemicExchange,
        UNSUFFICIENT_CURRENCY_SUPPLIED
      );
    });

    it('should succesfully buy from signed sale', async function () {
      const { r, s, v } = await getSignedSaleSignature({ buyer: owner });

      const priceWithFees = addTakerFee(ONE_ETHER);

      await expect(
        endemicExchange.buyFromReservedSignedSale(
          ZERO_ADDRESS,
          nftContract.address,
          2,
          ONE_ETHER,
          2000994705,
          v,
          r,
          s,
          {
            value: priceWithFees,
          }
        )
      ).to.emit(endemicExchange, SIGNED_SALE_SUCCESS);

      expect(await nftContract.ownerOf(2)).to.equal(owner.address);
    });

    it('should fail to buy with valid signature and invalid buyer', async function () {
      const { r, s, v } = await getSignedSaleSignature({ buyer: owner });

      await expect(
        endemicExchange
          .connect(user2)
          .buyFromReservedSignedSale(
            ZERO_ADDRESS,
            nftContract.address,
            2,
            1,
            2000994705,
            v,
            r,
            s,
            {
              value: 1,
            }
          )
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_SIGNATURE);
    });
  });

  describe('Buy from signed sale with ERC20', function () {
    beforeEach(async function () {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it('should fail with signed sale expired', async function () {
      await expect(
        endemicExchange.buyFromReservedSignedSale(
          endemicToken.address,
          nftContract.address,
          1,
          ZERO_ONE_ETHER,
          LAST_YEAR_TIMESTAMP,
          RANDOM_V_VALUE,
          RANDOM_R_VALUE,
          RANDOM_S_VALUE
        )
      ).to.be.revertedWithCustomError(endemicExchange, SIGNED_SALE_EXPIRED);
    });

    it('should fail with Erc20 not supported', async function () {
      await expect(
        endemicExchange.buyFromReservedSignedSale(
          '0x0000000000000000000000000000000000000001',
          nftContract.address,
          1,
          ONE_ETHER,
          RANDOM_TIMESTAMP,
          RANDOM_V_VALUE,
          RANDOM_R_VALUE,
          RANDOM_S_VALUE
        )
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_PAYMENT_METHOD);
    });

    it('should fail with price not correct (too low approved)', async function () {
      await expect(
        endemicExchange.buyFromReservedSignedSale(
          endemicToken.address,
          nftContract.address,
          1,
          ONE_ETHER,
          RANDOM_TIMESTAMP,
          RANDOM_V_VALUE,
          RANDOM_R_VALUE,
          RANDOM_S_VALUE
        )
      ).to.be.revertedWithCustomError(
        endemicExchange,
        UNSUFFICIENT_CURRENCY_SUPPLIED
      );
    });

    it('should fail with invalid signature', async function () {
      const priceWithFees = addTakerFee(ONE_ETHER);

      await endemicToken.transfer(user2.address, priceWithFees);

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, priceWithFees);

      await expect(
        endemicExchange
          .connect(user2)
          .buyFromReservedSignedSale(
            endemicToken.address,
            nftContract.address,
            1,
            ONE_ETHER,
            RANDOM_TIMESTAMP,
            RANDOM_V_VALUE,
            RANDOM_R_VALUE,
            RANDOM_S_VALUE
          )
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_SIGNATURE);
    });

    it('should fail to buy from signed sale when taker fee not included', async function () {
      const { r, s, v } = await getSignedSaleSignature({ buyer: owner });

      await endemicToken.transfer(user2.address, ONE_ETHER);

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ONE_ETHER);

      await expect(
        endemicExchange
          .connect(user2)
          .buyFromReservedSignedSale(
            endemicToken.address,
            nftContract.address,
            2,
            ONE_ETHER,
            2000994705,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(
        endemicExchange,
        UNSUFFICIENT_CURRENCY_SUPPLIED
      );
    });

    it('should succesfully buy from signed sale', async function () {
      const { r, s, v } = await getSignedSaleSignature({
        paymentErc20TokenAddress: endemicToken.address,
        buyer: owner,
      });

      const priceWithFees = addTakerFee(ONE_ETHER);

      await endemicToken.approve(endemicExchange.address, priceWithFees);

      await expect(
        endemicExchange.buyFromReservedSignedSale(
          endemicToken.address,
          nftContract.address,
          2,
          ONE_ETHER,
          2000994705,
          v,
          r,
          s
        )
      ).to.emit(endemicExchange, SIGNED_SALE_SUCCESS);

      expect(await nftContract.ownerOf(2)).to.equal(owner.address);
    });

    it('should fail to buy with valid signature and invalid buyer', async function () {
      const { r, s, v } = await getSignedSaleSignature({
        paymentErc20TokenAddress: endemicToken.address,
        buyer: owner,
      });

      await endemicToken.transfer(user2.address, 1);
      await endemicToken.connect(user2).approve(endemicExchange.address, 1);

      await expect(
        endemicExchange
          .connect(user2)
          .buyFromReservedSignedSale(
            endemicToken.address,
            nftContract.address,
            2,
            1,
            2000994705,
            v,
            r,
            s
          )
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_SIGNATURE);
    });
  });
});
