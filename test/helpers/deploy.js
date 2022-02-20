const { ethers, upgrades } = require('hardhat');

const deployEndemicERC721Factory = async () => {
  const EndemicERC721Factory = await ethers.getContractFactory(
    'EndemicERC721Factory'
  );
  const nftContractFactory = await EndemicERC721Factory.deploy();
  await nftContractFactory.deployed();

  return nftContractFactory;
};

const deployEndemicERC721 = async (erc721FactoryAddress) => {
  const EndemicERC721 = await ethers.getContractFactory('EndemicERC721');
  const nftContract = await EndemicERC721.deploy(erc721FactoryAddress);
  await nftContract.deployed();
  return nftContract;
};

const deployEndemicERC721WithFactory = async () => {
  const nftFactory = await deployEndemicERC721Factory();
  const nftContract = await deployEndemicERC721(nftFactory.address);

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
    [
      feeProviderAddress,
      royaltiesProviderAddress,
      '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31',
    ],
    {
      initializer: '__EndemicExchange_init',
    }
  );
  await endemicExchangeContract.deployed();
  return endemicExchangeContract;
};

const deployEndemicExchangeWithDeps = async (
  makerFee = 0,
  takerFee = 0,
  initialFee = 0
) => {
  const contractRegistryContract = await deployContractRegistry();
  const royaltiesProviderContract = await deployRoyaltiesProvider();
  const feeProviderContract = await deployFeeProvider(
    contractRegistryContract.address,
    makerFee,
    takerFee,
    initialFee
  );
  const endemicExchange = await deployEndemicExchange(
    feeProviderContract.address,
    royaltiesProviderContract.address
  );

  return {
    contractRegistryContract,
    feeProviderContract,
    royaltiesProviderContract,
    endemicExchange,
  };
};

const deployBid = async (feeProviderAddress, royaltiesProviderAddress) => {
  const Bid = await ethers.getContractFactory('Bid');
  const bidContract = await upgrades.deployProxy(
    Bid,
    [
      feeProviderAddress,
      royaltiesProviderAddress,
      '0x1D96e9bA0a7c1fdCEB33F3f4C71ca9117FfbE5CD',
    ],
    {
      initializer: '__Bid_init',
    }
  );
  await bidContract.deployed();
  return bidContract;
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
  deployEndemicERC721Factory,
  deployEndemicERC721,
  deployEndemicERC721WithFactory,
  deployEndemicExchangeWithDeps,
  deployBid,
  deployCollectionBid,
  deployEndemicERC1155,
  deployFeeProvider,
  deployContractRegistry,
  deployRoyaltiesProvider,
};
