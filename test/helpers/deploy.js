const { ethers, upgrades } = require('hardhat');
const { FEE_RECIPIENT } = require('./constants');

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
  const nftContractFactory = await upgrades.deployProxy(
    EndemicCollectionFactory,
    [],
    {
      initializer: 'initialize',
    }
  );

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

const deployInitializedCollection = async (
  collectionOwner,
  collectionAdministrator,
  mintApprover
) => {
  const { nftFactory } = await deployEndemicCollectionWithFactory();
  await nftFactory.updateConfiguration(
    collectionAdministrator.address,
    mintApprover.address
  );

  const tx = await nftFactory.createTokenForOwner({
    owner: collectionOwner.address,
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
  const collection = Collection.attach(newAddress);

  return collection;
};

const deployEndemicExchange = async (
  royaltiesProviderAddress,
  paymentManagerAddress
) => {
  const EndemicExchange = await ethers.getContractFactory('EndemicExchange');
  const endemicExchangeContract = await upgrades.deployProxy(
    EndemicExchange,
    [royaltiesProviderAddress, paymentManagerAddress, FEE_RECIPIENT],
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

  const paymentManagerContract = await deployPaymentManager(makerFee, takerFee);

  const endemicExchangeContract = await deployEndemicExchange(
    royaltiesProviderContract.address,
    paymentManagerContract.address
  );

  return {
    royaltiesProviderContract,
    endemicExchangeContract,
    paymentManagerContract,
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

const deployPaymentManager = async (makerFee, takerFee) => {
  const PaymentManager = await ethers.getContractFactory('PaymentManager');
  const paymentManagerProxy = await upgrades.deployProxy(
    PaymentManager,
    [makerFee, takerFee],
    {
      initializer: '__PaymentManager_init',
    }
  );

  await paymentManagerProxy.deployed();

  return paymentManagerProxy;
};

module.exports = {
  deployEndemicToken,
  deployCollectionFactory,
  deployInitializedCollection,
  deployEndemicCollectionWithFactory,
  deployEndemicExchangeWithDeps,
  deployRoyaltiesProvider,
  deployPaymentManager,
};
