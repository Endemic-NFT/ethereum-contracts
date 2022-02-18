const { expect } = require('chai');
const { ethers, network, upgrades } = require('hardhat');
const BN = require('bignumber.js');
const {
  deployEndemicNFT,
  deployBid,
  deployEndemicMasterNFT,
  deployContractRegistry,
  deployFeeProvider,
} = require('./helpers/deploy');

describe('ContractRegistry', function () {
  let contractRegistryContract;
  let owner, user1;

  async function deploy(makerFee = 300, takerFee = 300, initialFee = 2200) {
    [owner, user1, saleContract] = await ethers.getSigners();

    contractRegistryContract = await deployContractRegistry(owner);
  }

  describe('Owner functions', () => {
    beforeEach(deploy);

    it('should fail to add sale contract if not owner', async function () {
      await expect(
        contractRegistryContract
          .connect(user1)
          .addSaleContract(saleContract.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should fail to remove sale contract if not owner', async function () {
      await expect(
        contractRegistryContract
          .connect(user1)
          .removeSaleContract(saleContract.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should add sale contract', async function () {
      await contractRegistryContract.addSaleContract(saleContract.address);
      expect(
        await contractRegistryContract.isSaleContract(saleContract.address)
      ).to.equal(true);
    });

    it('should remove sale contract', async function () {
      await contractRegistryContract.addSaleContract(saleContract.address);
      await contractRegistryContract.removeSaleContract(saleContract.address);

      expect(
        await contractRegistryContract.isSaleContract(saleContract.address)
      ).to.equal(false);
    });
  });
});
