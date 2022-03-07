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
  feeProviderAddress,
  royaltiesProviderAddress
) => {
  const EndemicExchange = await ethers.getContractFactory('EndemicExchange');
  const endemicExchangeContract = await upgrades.deployProxy(
    EndemicExchange,
    [feeProviderAddress, royaltiesProviderAddress, FEE_RECIPIENT],
    {
      initializer: '__EndemicExchange_init',
    }
  );
  await endemicExchangeContract.deployed();
  return endemicExchangeContract;
};

const deployEndemicExchangeWithDeps = async (
  secondarySaleFee = 0,
  takerFee = 0,
  primarySaleFee = 0
) => {
  const contractRegistryContract = await deployContractRegistry();
  const royaltiesProviderContract = await deployRoyaltiesProvider();
  const feeProviderContract = await deployFeeProvider(
    contractRegistryContract.address,
    secondarySaleFee,
    takerFee,
    primarySaleFee
  );
  const endemicExchangeContract = await deployEndemicExchange(
    feeProviderContract.address,
    royaltiesProviderContract.address
  );

  return {
    contractRegistryContract,
    feeProviderContract,
    royaltiesProviderContract,
    endemicExchangeContract,
  };
};

const deployCollectionBid = async (
  feeProviderAddress,
  royaltiesProviderAddress
) => {
  const CollectionBid = await ethers.getContractFactory('CollectionBid');
  const collectionBidContract = await upgrades.deployProxy(
    CollectionBid,
    [
      feeProviderAddress,
      royaltiesProviderAddress,
      '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD',
    ],
    {
      initializer: '__CollectionBid_init',
    }
  );
  await collectionBidContract.deployed();
  return collectionBidContract;
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

const deployFeeProvider = async (
  contractRegistryAddress,
  secondarySaleFee = 250,
  takerFee = 300,
  primarySaleFee = 2200
) => {
  const FeeProvider = await ethers.getContractFactory('FeeProvider');
  const feeProviderContract = await upgrades.deployProxy(
    FeeProvider,
    [primarySaleFee, secondarySaleFee, takerFee, contractRegistryAddress],
    {
      initializer: '__FeeProvider_init',
    }
  );

  await feeProviderContract.deployed();
  return feeProviderContract;
};

const deployContractRegistry = async () => {
  const ContractRegistry = await ethers.getContractFactory('ContractRegistry');
  const contractRegistryContracat = await upgrades.deployProxy(
    ContractRegistry,
    [],
    {
      initializer: '__ContractRegistry_init',
    }
  );

  await contractRegistryContracat.deployed();
  return contractRegistryContracat;
};

module.exports = {
  deployEndemicRewards,
  deployEndemicToken,
  deployCollectionFactory,
  deployCollection,
  deployEndemicCollectionWithFactory,
  deployEndemicExchangeWithDeps,
  deployCollectionBid,
  deployEndemicERC1155,
  deployFeeProvider,
  deployContractRegistry,
  deployRoyaltiesProvider,
};
