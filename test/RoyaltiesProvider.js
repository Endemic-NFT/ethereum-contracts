const { expect } = require('chai');
const { ethers } = require('hardhat');
const BN = require('bignumber.js');
const {
  deployRoyaltiesProvider,
  deployEndemicCollectionWithFactory,
} = require('./helpers/deploy');

describe('RoyaltiesProvider', function () {
  let royaltiesProviderContract, nftContract, nftContractFactory;
  let owner, nftContractOwner, user2, feeRecipient, feeRecipient2;

  async function deploy() {
    [owner, nftContractOwner, user2, feeRecipient, feeRecipient2] =
      await ethers.getSigners();

    royaltiesProviderContract = await deployRoyaltiesProvider();
    const deployResults = await deployEndemicCollectionWithFactory();
    nftContractFactory = deployResults.nftFactory;

    const tx = await nftContractFactory.createTokenForOwner({
      owner: nftContractOwner.address,
      name: 'My Collection',
      symbol: 'MC',
      category: 'Art',
    });

    const res = await tx.wait();
    const nftContractAddresss = res.events.find(
      (e) => e.event === 'NFTContractCreated'
    ).args.nftContract;

    const Collection = await ethers.getContractFactory('Collection');
    nftContract = await Collection.attach(nftContractAddresss);
  }

  describe('Intial state', async () => {
    beforeEach(deploy);

    it('should set initial owner', async () => {
      const contractOwner = await royaltiesProviderContract.owner();
      expect(contractOwner).to.eq(owner.address);
    });

    it('should have fee limit', async () => {
      const limit = await royaltiesProviderContract.royaltyFeeLimit();
      expect(limit).to.eq('5000');
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
      ).to.be.revertedWith('Royalties over the limit');
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
      ).to.be.revertedWith('Royalties over the limit');
    });

    it('should set for token if caller is collection owner', async () => {
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

    it('should set for token if caller is royalties contract owner', async () => {
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

    it('should use even when collection royalties are set', async () => {
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

  describe('ERC2981', function () {
    it('should support ERC2981 royalties', () => {});

    it('should not use if custom token or collection royalties are set', () => {});
  });
});
