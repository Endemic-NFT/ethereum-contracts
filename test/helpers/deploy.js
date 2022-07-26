const { ethers, upgrades } = require('hardhat');
const { FEE_RECIPIENT } = require('./constants');

const deployEndemicRewards = async (endemicTokenAddress) => {
  const EndemicRewards = await ethers.getContractFactory('EndemicRewards');

  const endemicRewards = await EndemicRewards.deploy(endemicTokenAddress);
  await endemicRewards.deployed();
  return endemicRewards;
};

const deployEndemicToken = async (deployer) => {
  const EndemicToken = await ethers.getContractFactory('EndemicToken');

  const endemicToken = await EndemicToken.deploy(deployer.address);
  await endemicToken.deployed();
  return endemicToken;
};

const deployCollectionFactory = async () => {
  const EndemicCollectionFactory = await ethers.getContractFactory(
    'EndemicCollectionFactory'
  );
  const nftContractFactory = await EndemicCollectionFactory.deploy();
  await nftContractFactory.deployed();

  return nftContractFactory;
};

const deployOpenspaceCollectionFactory = async () => {
  const OpenspaceCollectionFactory = await ethers.getContractFactory(
    'OpenspaceCollectionFactory'
  );
  const openspaceCollectionFactory = await OpenspaceCollectionFactory.deploy();
  await openspaceCollectionFactory.deployed();

  return openspaceCollectionFactory;
};

const deployCollection = async (erc721FactoryAddress) => {
  const Collection = await ethers.getContractFactory('Collection');
  const nftContract = await Collection.deploy(erc721FactoryAddress);
  await nftContract.deployed();
  return nftContract;
};

const deployEndemicCollectionWithFactory = async () => {
  const nftFactory = await deployCollectionFactory();
  const nftContract = await deployCollection(nftFactory.address);

  await nftFactory.updateImplementation(nftContract.address);

  return {
    nftFactory,
    nftContract,
  };
};

const deployEndemicCollectionWithOpenspaceFactory = async () => {
  const nftFactory = await deployOpenspaceCollectionFactory();
  const nftContract = await deployCollection(nftFactory.address);

  await nftFactory.updateImplementation(nftContract.address);

  return {
    nftFactory,
    nftContract,
  };
};

const deployEndemicERC1155 = async () => {
  const EndemicERC1155 = await ethers.getContractFactory('EndemicERC1155');
  const nftContract = await upgrades.deployProxy(
    EndemicERC1155,
    ['Endemic ERC 1155', 'ENDR', 'ipfs://'],
    {
      initializer: '__EndemicERC1155_init',
    }
  );
  await nftContract.deployed();
  return nftContract;
};

const deployEndemicExchange = async (
  royaltiesProviderAddress,
  secondarySaleFee,
  takerFee
) => {
  const EndemicExchange = await ethers.getContractFactory('EndemicExchange');
  const endemicExchangeContract = await upgrades.deployProxy(
    EndemicExchange,
    [royaltiesProviderAddress, FEE_RECIPIENT, secondarySaleFee, takerFee],
    {
      initializer: '__EndemicExchange_init',
    }
  );
  await endemicExchangeContract.deployed();
  return endemicExchangeContract;
};

const deployEndemicExchangeWithDeps = async (
  makerFee = 250,
  takerFee = 300
) => {
  const royaltiesProviderContract = await deployRoyaltiesProvider();

  const endemicExchangeContract = await deployEndemicExchange(
    royaltiesProviderContract.address,
    makerFee,
    takerFee
  );

  return {
    royaltiesProviderContract,
    endemicExchangeContract,
  };
};

const deployRoyaltiesProvider = async () => {
  const RoyaltiesProvider = await ethers.getContractFactory(
    'RoyaltiesProvider'
  );
  const royaltiesProviderProxy = await upgrades.deployProxy(
    RoyaltiesProvider,
    [5000],
    {
      initializer: '__RoyaltiesProvider_init',
    }
  );
  await royaltiesProviderProxy.deployed();
  return royaltiesProviderProxy;
};

const deployEndemicVesting = async (deployer) => {
  const EndemicVesting = await ethers.getContractFactory('EndemicVesting');

  const endemicToken = await deployEndemicToken(deployer);

  const endemicVesting = await EndemicVesting.deploy(endemicToken.address, []);

  await endemicVesting.deployed();

  return {
    endemicVesting,
    endemicToken,
  };
};

module.exports = {
  deployEndemicRewards,
  deployEndemicToken,
  deployCollectionFactory,
  deployOpenspaceCollectionFactory,
  deployCollection,
  deployEndemicCollectionWithFactory,
  deployEndemicCollectionWithOpenspaceFactory,
  deployEndemicExchangeWithDeps,
  deployEndemicERC1155,
  deployRoyaltiesProvider,
  deployEndemicVesting,
};
