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
  const royaltiesProviderContract = await deployRoyaltiesProvider();
  const feeProviderContract = await deployFeeProvider(
    secondarySaleFee,
    takerFee,
    primarySaleFee
  );
  const endemicExchangeContract = await deployEndemicExchange(
    feeProviderContract.address,
    royaltiesProviderContract.address
  );

  await feeProviderContract.updateEndemicExchangeAddress(
    endemicExchangeContract.address
  );

  return {
    feeProviderContract,
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

const deployFeeProvider = async (
  secondarySaleFee = 250,
  takerFee = 300,
  primarySaleFee = 2200
) => {
  const FeeProvider = await ethers.getContractFactory('FeeProvider');
  const feeProviderContract = await upgrades.deployProxy(
    FeeProvider,
    [primarySaleFee, secondarySaleFee, takerFee],
    {
      initializer: '__FeeProvider_init',
    }
  );

  await feeProviderContract.deployed();
  return feeProviderContract;
};

const deployTipjar = async () => {
  const Tipjar = await ethers.getContractFactory('Tipjar');
  const tipjarContract = await Tipjar.deploy();

  await tipjarContract.deployed();
  return tipjarContract;
};
module.exports = {
  deployEndemicRewards,
  deployEndemicToken,
  deployCollectionFactory,
  deployCollection,
  deployEndemicCollectionWithFactory,
  deployEndemicExchangeWithDeps,
  deployEndemicERC1155,
  deployFeeProvider,
  deployRoyaltiesProvider,
  deployTipjar,
};
