const { expect } = require('chai');
const { ethers } = require('hardhat');
const { ZERO_ADDRESS } = require('./helpers/constants');
const { deployPaymentManager } = require('./helpers/deploy');

const UNSUPPORTED_PAYMENT_METHOD = 'UnsupportedPaymentMethod';
const INVALID_FEES = 'InvalidFees';

describe('PaymentManager', function () {
  let owner, contractAccount, paymentManager;

  beforeEach(async () => {
    [owner, contractAccount] = await ethers.getSigners();

    paymentManager = await deployPaymentManager(200, 300);
  });

  describe('deploy', async () => {
    it('sets initial owner', async () => {
      const contractOwner = await paymentManager.owner();
      expect(contractOwner).to.eq(owner.address);
    });

    it('sets fees for ether payments', async () => {
      const etherFees = await paymentManager.getPaymentMethodFees(ZERO_ADDRESS);
      expect(etherFees.makerFee).to.eq('200');
      expect(etherFees.takerFee).to.eq('300');
    });
  });

  describe('updatePaymentMethodFees', () => {
    it('updates ether paymentManager fees', async () => {
      const defaultFeesBefore = await paymentManager.getPaymentMethodFees(
        ZERO_ADDRESS
      );
      expect(defaultFeesBefore.makerFee).to.eq('200');
      expect(defaultFeesBefore.takerFee).to.eq('300');

      await paymentManager.updatePaymentMethodFees(ZERO_ADDRESS, 400, 500);

      const defaultFees = await paymentManager.getPaymentMethodFees(
        ZERO_ADDRESS
      );
      expect(defaultFees.makerFee).to.eq('400');
      expect(defaultFees.takerFee).to.eq('500');
    });

    it('updates ERC20 payment fees', async () => {
      await paymentManager.updateSupportedPaymentMethod(
        contractAccount.address,
        true
      );

      await paymentManager.updatePaymentMethodFees(
        contractAccount.address,
        550,
        500
      );

      const erc20PaymentFeesBefore = await paymentManager.getPaymentMethodFees(
        contractAccount.address
      );
      expect(erc20PaymentFeesBefore.makerFee).to.eq('550');
      expect(erc20PaymentFeesBefore.takerFee).to.eq('500');

      await paymentManager.updatePaymentMethodFees(
        contractAccount.address,
        400,
        500
      );

      const defaultFees = await paymentManager.getPaymentMethodFees(
        contractAccount.address
      );
      expect(defaultFees.makerFee).to.eq('400');
      expect(defaultFees.takerFee).to.eq('500');
    });

    it('reverts for unsupported payment method', async () => {
      await expect(
        paymentManager.updatePaymentMethodFees(owner.address, 100, 100)
      ).to.be.revertedWithCustomError(paymentManager, UNSUPPORTED_PAYMENT_METHOD);
    });

    it('reverts for invalid fees', async () => {
      await expect(
        paymentManager.updatePaymentMethodFees(ZERO_ADDRESS, 100000, 100000)
      ).to.be.revertedWithCustomError(paymentManager, INVALID_FEES);
    });
  });

  describe('getPaymentMethodFees', () => {
    it('has default fees for supported non configured method', async () => {
      await paymentManager.updateSupportedPaymentMethod(
        contractAccount.address,
        true
      );

      const defaultFees = await paymentManager.getPaymentMethodFees(
        contractAccount.address
      );
      expect(defaultFees.makerFee).to.eq('200');
      expect(defaultFees.takerFee).to.eq('300');
    });

    it('has default fees for supported non configured method', async () => {
      await paymentManager.updateSupportedPaymentMethod(
        contractAccount.address,
        true
      );

      await paymentManager.updatePaymentMethodFees(ZERO_ADDRESS, 400, 500);

      const defaultFees = await paymentManager.getPaymentMethodFees(
        contractAccount.address
      );
      expect(defaultFees.makerFee).to.eq('400');
      expect(defaultFees.takerFee).to.eq('500');
    });
  });
});
