const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployEndemicCollectionWithFactory } = require('../helpers/deploy');

describe('EndemicCollectionFactory', function () {
  let factoryContract = null;
  let owner, user, collectionAdministrator;

  beforeEach(async function () {
    [owner, user, collectionAdministrator] = await ethers.getSigners();

    const deployResult = await deployEndemicCollectionWithFactory(owner);
    factoryContract = deployResult.nftFactory;
  });

  describe('roles', () => {
    it('sets initial roles', async function () {
      const hasAdminRole = await factoryContract.hasRole(
        await factoryContract.DEFAULT_ADMIN_ROLE(),
        owner.address
      );
      expect(hasAdminRole).to.equal(true);
    });

    describe('grantRole', () => {
      it('grants minter role if caller is the admin', async () => {
        await factoryContract.grantRole(
          await factoryContract.MINTER_ROLE(),
          user.address
        );

        const hasMinterRole = await factoryContract.hasRole(
          await factoryContract.MINTER_ROLE(),
          user.address
        );
        expect(hasMinterRole).to.equal(true);
      });

      it('reverts if a caller is not the admin', async () => {
        await expect(
          factoryContract
            .connect(user)
            .grantRole(await factoryContract.MINTER_ROLE(), user.address)
        ).to.be.reverted;
      });
    });
  });

  describe('createToken', () => {
    beforeEach(async () => {
      await factoryContract.updateCollectionAdministrator(
        collectionAdministrator.address
      );
    });

    it('deploys a new collections if caller is a minter', async function () {
      //grant minter to other account
      await factoryContract.grantRole(
        await factoryContract.MINTER_ROLE(),
        user.address
      );

      const tx = await factoryContract.connect(user).createToken({
        name: 'My Collection',
        symbol: 'MC',
        category: 'Art',
        royalties: 1500,
      });

      const receipt = await tx.wait();
      const eventData = receipt.events.find(
        ({ event }) => event === 'NFTContractCreated'
      );
      const [newAddress] = eventData.args;

      const Collection = await ethers.getContractFactory('Collection');
      const newCollection = await Collection.attach(newAddress);

      expect(await newCollection.name()).to.eq('My Collection');
      expect(await newCollection.symbol()).to.eq('MC');
      expect(await newCollection.owner()).to.eq(user.address);
      expect(await newCollection.administrator()).to.eq(
        collectionAdministrator.address
      );
    });

    it('emits NFTContractCreatede event', async function () {
      //grant minter to other account
      await factoryContract.grantRole(
        await factoryContract.MINTER_ROLE(),
        user.address
      );

      const tx = await factoryContract.connect(user).createToken({
        name: 'My Collection',
        symbol: 'MC',
        category: 'Art',
        royalties: 1500,
      });

      const receipt = await tx.wait();
      const eventData = receipt.events.find(
        ({ event }) => event === 'NFTContractCreated'
      );
      const [newAddress, contractOwner, name, symbol, category, royalties] =
        eventData.args;

      expect(newAddress).to.properAddress;
      expect(contractOwner).to.equal(user.address);
      expect(name).to.equal('My Collection');
      expect(symbol).to.equal('MC');
      expect(category).to.equal('Art');
      expect(royalties).to.equal('1500');
    });

    it('reverts if a caller is not authorized', async function () {
      await expect(
        factoryContract.connect(user).createToken({
          name: 'My Collection',
          symbol: 'MC',
          category: 'Art',
          royalties: 1500,
        })
      ).to.be.reverted;
    });

    describe('createTokenForOwner', () => {
      it('deploys a new collections if caller is an admin', async () => {
        const tx = await factoryContract.connect(owner).createTokenForOwner({
          owner: user.address,
          name: 'My Collection',
          symbol: 'MC',
          category: 'Art',
          royalties: 1500,
        });

        const receipt = await tx.wait();
        const eventData = receipt.events.find(
          ({ event }) => event === 'NFTContractCreated'
        );
        const [newAddress, contractOwner, name, symbol, category, royalties] =
          eventData.args;

        expect(newAddress).to.properAddress;
        expect(contractOwner).to.equal(user.address);
        expect(name).to.equal('My Collection');
        expect(symbol).to.equal('MC');
        expect(category).to.equal('Art');
        expect(royalties).to.equal('1500');
      });

      it('reverts if caller is not authorized', async function () {
        await expect(
          factoryContract.connect(user).createTokenForOwner({
            owner: user.address,
            name: 'My Collection',
            symbol: 'MC',
            category: 'Art',
            royalties: 0,
          })
        ).to.be.reverted;
      });
    });
  });

  describe('updateCollectionAdministrator', () => {
    it('updates', async () => {
      await factoryContract.updateCollectionAdministrator(
        collectionAdministrator.address
      );

      expect(await factoryContract.collectionAdministrator()).to.eq(
        collectionAdministrator.address
      );
    });
    it('reverts is caller is not an admin', async () => {
      await expect(
        factoryContract
          .connect(user)
          .updateCollectionAdministrator(collectionAdministrator.address)
      ).to.be.reverted;
    });
  });
});
