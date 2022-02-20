const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const BN = require('bignumber.js');
const {
  deployContractRegistry,
  deployFeeProvider,
} = require('./helpers/deploy');

describe('FeeProvider', function () {
  let feeProviderContract,
    contractRegistryContract,
    nftContract,
    exchangeContract;
  let owner, user1;

  async function deploy(
    secondarySaleFee = 300,
    takerFee = 300,
    primarySaleFee = 2200
  ) {
    [owner, user1, nftContract, exchangeContract] = await ethers.getSigners();

    contractRegistryContract = await deployContractRegistry(owner);

    feeProviderContract = await deployFeeProvider(
      owner,
      contractRegistryContract.address,
      secondarySaleFee,
      takerFee,
      primarySaleFee
    );

    await contractRegistryContract.addExchangeContract(
      exchangeContract.address
    );
  }

  describe('Maker fee', () => {
    beforeEach(deploy);

    it('should calculate correct fee for primary sale', async () => {
      const fee = await feeProviderContract.getMakerFee(
        owner.address,
        nftContract.address,
        1
      );

      expect(fee.toString()).to.equal('2200');
    });

    it('should calculate correct fee for secondary sale', async () => {
      await feeProviderContract
        .connect(exchangeContract)
        .onSale(nftContract.address, 1);

      const fee = await feeProviderContract.getMakerFee(
        owner.address,
        nftContract.address,
        1
      );

      expect(fee.toString()).to.equal('300');
    });

    it('should be able to set primary sale fee per account when owner', async () => {
      await feeProviderContract.setPrimarySaleFeePerAccount(owner.address, 100);

      const fee = await feeProviderContract.getMakerFee(
        owner.address,
        nftContract.address,
        1
      );

      expect(fee.toString()).to.equal('100');
    });

    it('should not be able to set primary sale fee per account when not owner', async () => {
      await expect(
        feeProviderContract
          .connect(user1)
          .setPrimarySaleFeePerAccount(user1.address, 100)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should be able to set collection without primary sale fee when owner', async () => {
      await feeProviderContract.setCollectionWithoutPrimarySaleFee(
        nftContract.address,
        true
      );

      const fee = await feeProviderContract.getMakerFee(
        owner.address,
        nftContract.address,
        1
      );

      expect(fee.toString()).to.equal('300');
    });

    it('should not be able to set collection without primary sale fee when not owner', async () => {
      await expect(
        feeProviderContract
          .connect(user1)
          .setCollectionWithoutPrimarySaleFee(nftContract.address, true)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Taker fee', () => {
    beforeEach(deploy);

    it('should calculate correct fee', async () => {
      const fee = await feeProviderContract.takerFee();
      expect(fee.toString()).to.equal('300');
    });
  });

  describe('Update fee', () => {
    beforeEach(deploy);

    it('should fail to update fee if not owner', async function () {
      await expect(feeProviderContract.connect(user1).updateFee(500, 600, 2000))
        .to.be.reverted;
    });

    it('should update fee', async function () {
      await feeProviderContract.updateFee(2000, 500, 600);

      expect((await feeProviderContract.takerFee()).toString()).to.equal('600');

      expect(
        (
          await feeProviderContract.getMakerFee(
            owner.address,
            nftContract.address,
            1
          )
        ).toString()
      ).to.equal('2000');

      await feeProviderContract
        .connect(exchangeContract)
        .onSale(nftContract.address, 1);

      expect(
        (
          await feeProviderContract.getMakerFee(
            owner.address,
            nftContract.address,
            1
          )
        ).toString()
      ).to.equal('500');
    });
  });

  describe('On sale', () => {
    beforeEach(deploy);

    it('should fail if caller is not exchange contract', async function () {
      await expect(
        feeProviderContract.connect(user1).onSale(nftContract.address, 1)
      ).to.be.revertedWith('CallerNotExchangeContract');
    });
  });
});
