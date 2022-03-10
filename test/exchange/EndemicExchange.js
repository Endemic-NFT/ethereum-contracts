const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployEndemicExchangeWithDeps } = require('../helpers/deploy');
const { FEE_RECIPIENT } = require('../helpers/constants');

describe('EndemicExchange', () => {
  let endemicExchange, feeProviderContract, royaltiesProviderContract;

  let owner, contractAddress1, contractAddress2, contractAddress3;

  async function deploy(makerFee = 0, takerFee, initialFee = 0) {
    [owner, contractAddress1, contractAddress2, contractAddress3] =
      await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps(
      makerFee,
      takerFee,
      initialFee
    );

    feeProviderContract = result.feeProviderContract;
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

    it('should have correct providers set', async () => {
      expect(await endemicExchange.feeProvider()).to.equal(
        feeProviderContract.address
      );
      expect(await endemicExchange.royaltiesProvider()).to.equal(
        royaltiesProviderContract.address
      );
    });
  });

  describe('Owner methods', function () {
    beforeEach(deploy);

    it('should update configuration when owner', async () => {
      await endemicExchange.updateConfiguration(
        contractAddress1.address,
        contractAddress2.address,
        contractAddress3.address
      );

      expect(await endemicExchange.feeProvider()).to.equal(
        contractAddress1.address
      );
      expect(await endemicExchange.royaltiesProvider()).to.equal(
        contractAddress2.address
      );
      expect(await endemicExchange.feeClaimAddress()).to.equal(
        contractAddress3.address
      );
    });
  });
});
