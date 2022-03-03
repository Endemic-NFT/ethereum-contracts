const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployEndemicExchangeWithDeps } = require('../helpers/deploy');
const { FEE_RECIPIENT } = require('../helpers/constants');

describe('EndemicExchange', () => {
  let endemicExchange,
    feeProviderContract,
    royaltiesProviderContract,
    contractRegistryContract;

  let owner;

  async function deploy(makerFee = 0, takerFee, initialFee = 0) {
    [owner] = await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps(
      makerFee,
      takerFee,
      initialFee
    );

    contractRegistryContract = result.contractRegistryContract;
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
});
