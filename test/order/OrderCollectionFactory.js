const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployOrderCollectionWithFactory } = require('../helpers/deploy');

describe('OrderCollectionFactory', function () {
  let factoryContract = null;
  let owner, user, collectionAdministrator, artist;

  beforeEach(async function () {
    [owner, user, collectionAdministrator, artist] = await ethers.getSigners();

    const deployResult = await deployOrderCollectionWithFactory();
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

  describe('createCollection', () => {
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

      const tx = await factoryContract
        .connect(user)
        .createCollection(artist.address, 'My Collection', 'MC', 1500);

      const receipt = await tx.wait();
      const eventData = receipt.events.find(
        ({ event }) => event === 'NFTContractCreated'
      );
      const [newAddress] = eventData.args;

      const Collection = await ethers.getContractFactory('Collection');
      const newCollection = await Collection.attach(newAddress);

      expect(await newCollection.name()).to.eq('My Collection');
      expect(await newCollection.symbol()).to.eq('MC');
      expect(await newCollection.owner()).to.eq(artist.address);
      expect(await newCollection.administrator()).to.eq(
        collectionAdministrator.address
      );
    });

    it('emits NFTContractCreated event', async function () {
      //grant minter to other account
      await factoryContract.grantRole(
        await factoryContract.MINTER_ROLE(),
        user.address
      );

      const tx = await factoryContract
        .connect(user)
        .createCollection(artist.address, 'My Collection', 'MC', 1500);

      const receipt = await tx.wait();
      const eventData = receipt.events.find(
        ({ event }) => event === 'NFTContractCreated'
      );
      const [newAddress, contractOwner, name, symbol, category, royalties] =
        eventData.args;

      expect(newAddress).to.properAddress;
      expect(contractOwner).to.equal(artist.address);
      expect(name).to.equal('My Collection');
      expect(symbol).to.equal('MC');
      expect(category).to.equal('Art Order');
      expect(royalties).to.equal('1500');
    });

    it('reverts if a caller is not authorized', async function () {
      await expect(
        factoryContract
          .connect(user)
          .createCollection(artist.address, 'My Collection', 'MC', 1500)
      ).to.be.reverted;
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

    it('reverts if new admin is zero address', async () => {
      await expect(
        factoryContract.updateCollectionAdministrator(
          ethers.constants.AddressZero
        )
      ).to.be.reverted;
    });
  });

  describe('updateOperator', () => {
    it('updates operator correctly', async () => {
      await factoryContract.updateOperator(user.address);

      expect(await factoryContract.operator()).to.eq(user.address);
    });

    it('reverts is caller is not an admin', async () => {
      await expect(factoryContract.connect(user).updateOperator(user.address))
        .to.be.reverted;
    });

    it('reverts if new operator is zero address', async () => {
      await expect(factoryContract.updateOperator(ethers.constants.AddressZero))
        .to.be.reverted;
    });
  });

  describe('updateConfiguration', () => {
    it('updates configuration correctly', async () => {
      await factoryContract.updateConfiguration(user.address, artist.address);

      expect(await factoryContract.collectionAdministrator()).to.eq(
        user.address
      );
      expect(await factoryContract.operator()).to.eq(artist.address);
    });

    it('reverts is caller is not an admin', async () => {
      await expect(
        factoryContract
          .connect(user)
          .updateConfiguration(user.address, artist.address)
      ).to.be.reverted;
    });

    it('reverts if values are zero address', async () => {
      await expect(
        factoryContract.updateConfiguration(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        )
      ).to.be.reverted;
    });
  });
});
