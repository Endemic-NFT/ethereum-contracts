const { expect } = require('chai');
const { ethers } = require('hardhat');
const { ZERO_ADDRESS } = require('./helpers/constants');
const { deployPaymentManager } = require('./helpers/deploy');

const UNSUPPORTED_PAYMENT_METHOD = 'UnsupportedPaymentMethod';
const INVALID_FEES = 'InvalidFees';

describe('PaymentManager', function () {
  let owner, contractAccount, paymentManager;

  async function deploy() {
    [owner, contractAccount] = await ethers.getSigners();

    paymentManager = await deployPaymentManager(200, 300);
  }

  describe('Intial state', async () => {
    beforeEach(deploy);

    it('should set initial owner', async () => {
      const contractOwner = await paymentManager.owner();
      expect(contractOwner).to.eq(owner.address);
    });

    it('should have initial fees for ether payments', async () => {
      const etherFees = await paymentManager.getPaymentMethodFees(ZERO_ADDRESS);
      expect(etherFees.makerFee).to.eq('200');
      expect(etherFees.takerFee).to.eq('300');
    });
  });

  describe('Update state', async () => {
    beforeEach(deploy);

    it('should fail to update fees for unsupported payment method', async () => {
      await expect(
        paymentManager.updatePaymentMethodFees(owner.address, 100, 100)
      ).to.be.revertedWith(UNSUPPORTED_PAYMENT_METHOD);
    });

    it('should fail to update with invalid fees', async () => {
      await expect(
        paymentManager.updatePaymentMethodFees(ZERO_ADDRESS, 100000, 100000)
      ).to.be.revertedWith(INVALID_FEES);
    });

    it('should have default fees for supported non configured method', async () => {
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
  });
});
