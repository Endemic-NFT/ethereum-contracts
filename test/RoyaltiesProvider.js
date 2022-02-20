const { expect } = require('chai');
const { ethers } = require('hardhat');
const BN = require('bignumber.js');
const {
  deployRoyaltiesProvider,
  deployEndemicERC721WithFactory,
} = require('./helpers/deploy');

describe('RoyaltiesProvider', function () {
  let royaltiesProviderContract, nftContract;
  let owner, nftContractOwner, user2, feeRecipient;

  async function deploy() {
    [owner, nftContractOwner, user2, feeRecipient] = await ethers.getSigners();

    royaltiesProviderContract = await deployRoyaltiesProvider(nftContractOwner);
    nftContract = (await deployEndemicERC721WithFactory(nftContractOwner))
      .nftContract;
  }

  describe('Intial state', async () => {
    beforeEach(deploy);

    it('should set initial owner', async () => {
      const contractOwner = await royaltiesProviderContract.owner();
      expect(contractOwner).to.eq(owner.address);
    });
  });

  describe('Setting royalties for collection', () => {
    beforeEach(deploy);

    it('should not be able to royalties fee over the limit', async () => {
      await expect(
        royaltiesProviderContract.setRoyaltiesForCollection(
          nftContract.address,
          feeRecipient.address,
          5100
        )
      ).to.be.revertedWith('Royalties must be up to 50%');
    });

    it('should set for collection if caller is collection owner', async () => {
      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        feeRecipient.address,
        1000
      );

      [account, fee] =
        await royaltiesProviderContract.calculateRoyaltiesAndGetRecipient(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1')
        );

      expect(account).to.equal(feeRecipient.address);
      expect(fee).to.equal(ethers.utils.parseUnits('0.1'));
    });

    it('should set for collection if caller is royalties contract owner', async () => {
      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        feeRecipient.address,
        1000
      );

      [account, fee] =
        await royaltiesProviderContract.calculateRoyaltiesAndGetRecipient(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1')
        );

      expect(account).to.equal(feeRecipient.address);
      expect(fee).to.equal(ethers.utils.parseUnits('0.1'));
    });

    it('should fail to set if caller is not royalties owner or contract owner', async () => {
      await expect(
        royaltiesProviderContract
          .connect(user2)
          .setRoyaltiesForCollection(
            nftContract.address,
            feeRecipient.address,
            1500
          )
      ).to.be.revertedWith('InvalidOwner');
    });
  });

  describe('Setting royalties for token', () => {
    beforeEach(deploy);

    it('should not be able to set royalties over the limit', async () => {
      await expect(
        royaltiesProviderContract.setRoyaltiesForToken(
          nftContract.address,
          1,
          feeRecipient.address,
          5100
        )
      ).to.be.revertedWith('Royalties must be up to 50%');
    });

    it('should set for collection if caller is collection owner', async () => {
      await royaltiesProviderContract
        .connect(nftContractOwner)
        .setRoyaltiesForToken(
          nftContract.address,
          1,
          feeRecipient.address,
          1000
        );

      [account, fee] =
        await royaltiesProviderContract.calculateRoyaltiesAndGetRecipient(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1')
        );

      expect(account).to.equal(feeRecipient.address);
      expect(fee).to.equal(ethers.utils.parseUnits('0.1'));
    });

    it('should set for collection if caller is royalties contract owner', async () => {
      await royaltiesProviderContract.setRoyaltiesForToken(
        nftContract.address,
        1,
        feeRecipient.address,
        2000
      );

      [account, fee] =
        await royaltiesProviderContract.calculateRoyaltiesAndGetRecipient(
          nftContract.address,
          1,
          ethers.utils.parseUnits('1')
        );

      expect(account).to.equal(feeRecipient.address);
      expect(fee).to.equal(ethers.utils.parseUnits('0.2'));
    });

    it('should fail to set if caller is not royalties owner or contract owner', async () => {
      await expect(
        royaltiesProviderContract
          .connect(user2)
          .setRoyaltiesForToken(
            nftContract.address,
            1,
            feeRecipient.address,
            1500
          )
      ).to.be.revertedWith('InvalidOwner');
    });
  });
});
