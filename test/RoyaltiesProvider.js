const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  deployRoyaltiesProvider,
  deployInitializedCollection,
} = require('./helpers/deploy');

describe('RoyaltiesProvider', function () {
  let royaltiesProviderContract, nftContract;
  let owner, nftContractOwner, user2, feeRecipient, feeRecipient2;
  let account, fee;

  beforeEach(async () => {
    let collectionAdministrator, mintApprover;

    [
      owner,
      nftContractOwner,
      user2,
      feeRecipient,
      feeRecipient2,
      collectionAdministrator,
      mintApprover,
    ] = await ethers.getSigners();

    royaltiesProviderContract = await deployRoyaltiesProvider();

    nftContract = await deployInitializedCollection(
      nftContractOwner,
      collectionAdministrator,
      mintApprover
    );
  });

  describe('deploy', async () => {
    it('sets initial owner', async () => {
      expect(await royaltiesProviderContract.owner()).to.eq(owner.address);
    });

    it('has fee limit', async () => {
      const limit = await royaltiesProviderContract.royaltyFeeLimit();
      expect(limit).to.eq('5000');
    });
  });

  describe('setRoyaltiesForCollection', () => {
    it('reverts if royalty fee is over the limit', async () => {
      await expect(
        royaltiesProviderContract.setRoyaltiesForCollection(
          nftContract.address,
          feeRecipient.address,
          5100
        )
      ).to.be.revertedWithCustomError(
        royaltiesProviderContract,
        'FeeOverTheLimit'
      );
    });

    it('sets for collection if a caller is the collection owner', async () => {
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

    it('sets for collection if a caller is the royalties contract owner', async () => {
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

    it('reverts if a caller is not royalties owner nor contract owner', async () => {
      await expect(
        royaltiesProviderContract
          .connect(user2)
          .setRoyaltiesForCollection(
            nftContract.address,
            feeRecipient.address,
            1500
          )
      ).to.be.revertedWithCustomError(
        royaltiesProviderContract,
        'InvalidOwner'
      );
    });
  });

  describe('setRoyaltiesForToken', () => {
    it('reverts if royalties are over the limit', async () => {
      await expect(
        royaltiesProviderContract.setRoyaltiesForToken(
          nftContract.address,
          1,
          feeRecipient.address,
          5100
        )
      ).to.be.revertedWithCustomError(
        royaltiesProviderContract,
        'FeeOverTheLimit'
      );
    });

    it('sets for token if a caller is the collection owner', async () => {
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

    it('sets for token if caller is royalties contract owner', async () => {
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

    it('uses token royalties when collection royalties are set', async () => {
      await royaltiesProviderContract.setRoyaltiesForToken(
        nftContract.address,
        1,
        feeRecipient.address,
        2000
      );

      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        feeRecipient2.address,
        1000
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

    it('reverts if a caller is not royalties owner or contract owner', async () => {
      await expect(
        royaltiesProviderContract
          .connect(user2)
          .setRoyaltiesForToken(
            nftContract.address,
            1,
            feeRecipient.address,
            1500
          )
      ).to.be.revertedWithCustomError(
        royaltiesProviderContract,
        'InvalidOwner'
      );
    });
  });
});
