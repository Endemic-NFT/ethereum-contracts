const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  deployEndemicCollectionWithOpenspaceFactory,
} = require('../helpers/deploy');

describe('OpenspaceCollectionFactory', function () {
  let factoryContract = null;
  let owner, user;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const deployResult = await deployEndemicCollectionWithOpenspaceFactory(
      owner
    );
    factoryContract = deployResult.nftFactory;
  });

  it('should have initial roles', async function () {
    const hasAdminRole = await factoryContract.hasRole(
      await factoryContract.DEFAULT_ADMIN_ROLE(),
      owner.address
    );
    expect(hasAdminRole).to.equal(true);
  });

  it('should deploy a new contract correctly', async function () {
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
});
