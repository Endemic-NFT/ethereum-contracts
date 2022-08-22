const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployEndemicExchangeWithDeps } = require('../helpers/deploy');
const { FEE_RECIPIENT } = require('../helpers/constants');

describe('EndemicExchange', () => {
  let endemicExchange, royaltiesProviderContract;

  let owner, contractAddress2, contractAddress3, contractAddress4;

  async function deploy() {
    [owner, contractAddress2, contractAddress3, contractAddress4] =
      await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps();

    royaltiesProviderContract = result.royaltiesProviderContract;
    endemicExchange = result.endemicExchangeContract;
  }

  describe('Initial State', function () {
    beforeEach(deploy);

    it('should have owner', async function () {
      expect(await endemicExchange.owner()).to.equal(owner.address);
    });

    it('should have correct fee claim address', async () => {
      expect(await endemicExchange.feeClaimAddress()).to.equal(FEE_RECIPIENT);
    });
  });

  describe('Owner methods', function () {
    beforeEach(deploy);

    it('should update configuration when owner', async () => {
      await endemicExchange.updateConfiguration(
        contractAddress2.address,
        contractAddress3.address,
        contractAddress4.address
      );

      expect(await endemicExchange.royaltiesProvider()).to.equal(
        contractAddress2.address
      );
      expect(await endemicExchange.paymentManager()).to.equal(
        contractAddress3.address
      );
      expect(await endemicExchange.feeClaimAddress()).to.equal(
        contractAddress4.address
      );
    });
  });
});
