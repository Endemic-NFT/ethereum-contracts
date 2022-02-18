const { ethers, upgrades, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicMasterKeyProxy, feeProviderProxy, royaltiesProviderProxy } =
    getForNetwork(network.name);

  console.log('Deploying CollectionBid with the account:', deployer.address);

  const CollectionBid = await ethers.getContractFactory('CollectionBid');
  const collectionBidProxy = await upgrades.deployProxy(
    CollectionBid,
    [
      feeProviderProxy,
      endemicMasterKeyProxy,
      royaltiesProviderProxy,
      '0x813201fe76De0622223492D2467fF5Fd38cF2320',
    ],
    {
      deployer,
      initializer: '__CollectionBid_init',
    }
  );
  await collectionBidProxy.deployed();

  console.log('CollectionBid deployed to:', collectionBidProxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
