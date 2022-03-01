const { expect, use } = require('chai');
const { ethers } = require('hardhat');
const Web3 = require('web3');
const { deployEndemicCollectionWithFactory } = require('../helpers/deploy');

describe('EndemicCollectionFactory', function () {
  let factoryContract = null;
  let owner, user, signer;

  beforeEach(async function () {
    [owner, user, signer] = await ethers.getSigners();

    const deployResult = await deployEndemicCollectionWithFactory(owner);
    factoryContract = deployResult.nftFactory;
  });

  it('should have initial roles', async function () {
    const hasAdminRole = await factoryContract.hasRole(
      await factoryContract.DEFAULT_ADMIN_ROLE(),
      owner.address
    );
    expect(hasAdminRole).to.equal(true);
  });

  it('should be able to add new minters if admin', async () => {
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

  it('should not be able to add new minters if not admin', async () => {
    await expect(
      factoryContract
        .connect(user)
        .grantRole(await factoryContract.MINTER_ROLE(), user.address)
    ).to.be.reverted;
  });

  it('should deploy a new contract correctly if minter', async function () {
    //grant minter to other account
    await factoryContract.grantRole(
      await factoryContract.MINTER_ROLE(),
      user.address
    );

    const tx = await factoryContract.connect(user).createToken({
      name: 'My Collection',
      symbol: 'MC',
      category: 'Art',
    });

    const receipt = await tx.wait();
    const eventData = receipt.events.find(
      ({ event }) => event === 'NFTContractCreated'
    );
    const [newAddress, contractOwner, name, symbol, category] = eventData.args;

    expect(newAddress).to.properAddress;
    expect(contractOwner).to.equal(user.address);
    expect(name).to.equal('My Collection');
    expect(symbol).to.equal('MC');
    expect(category).to.equal('Art');

    // todo attach contract and check data
  });

  it('should fail to deploy a new contract if not minter', async function () {
    await expect(
      factoryContract.connect(user).createToken({
        name: 'My Collection',
        symbol: 'MC',
        category: 'Art',
      })
    ).to.be.reverted;
  });

  it('should deploy new contract for owner if admin', async () => {
    const tx = await factoryContract.connect(owner).createTokenForOwner({
      owner: user.address,
      name: 'My Collection',
      symbol: 'MC',
      category: 'Art',
    });

    const receipt = await tx.wait();
    const eventData = receipt.events.find(
      ({ event }) => event === 'NFTContractCreated'
    );
    const [newAddress, contractOwner, name, symbol, category] = eventData.args;

    expect(newAddress).to.properAddress;
    expect(contractOwner).to.equal(user.address);
    expect(name).to.equal('My Collection');
    expect(symbol).to.equal('MC');
    expect(category).to.equal('Art');
  });

  it('should fail to deploy new contract for owner if not admin', async function () {
    await expect(
      factoryContract.connect(user).createTokenForOwner({
        owner: user.address,
        name: 'My Collection',
        symbol: 'MC',
        category: 'Art',
      })
    ).to.be.reverted;
  });
});
