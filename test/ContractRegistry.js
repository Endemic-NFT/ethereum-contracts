const { expect } = require('chai');
const { ethers } = require('hardhat');
const BN = require('bignumber.js');
const { deployContractRegistry } = require('./helpers/deploy');

describe('ContractRegistry', function () {
  let contractRegistryContract;
  let owner, user1;

  async function deploy() {
    [owner, user1, exchangeContract] = await ethers.getSigners();

    contractRegistryContract = await deployContractRegistry();
  }

  describe('Owner functions', () => {
    beforeEach(deploy);

    it('should fail to add exchange contract if not owner', async function () {
      await expect(
        contractRegistryContract
          .connect(user1)
          .addExchangeContract(exchangeContract.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should fail to remove exhange contract if not owner', async function () {
      await expect(
        contractRegistryContract
          .connect(user1)
          .removeExchangeContract(exchangeContract.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should add exchange contract', async function () {
      await contractRegistryContract.addExchangeContract(
        exchangeContract.address
      );
      expect(
        await contractRegistryContract.isExchangeContract(
          exchangeContract.address
        )
      ).to.equal(true);
    });

    it('should remove exchange contract', async function () {
      await contractRegistryContract.addExchangeContract(
        exchangeContract.address
      );
      await contractRegistryContract.removeExchangeContract(
        exchangeContract.address
      );

      expect(
        await contractRegistryContract.isExchangeContract(
          exchangeContract.address
        )
      ).to.equal(false);
    });
  });
});
