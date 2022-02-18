const { ethers, upgrades, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicMasterKeyProxy, feeProviderProxy, royaltiesProviderProxy } =
    getForNetwork(network.name);

  console.log('Deploying Bid with the account:', deployer.address);

  const Bid = await ethers.getContractFactory('Bid');
  const bidProxy = await upgrades.deployProxy(
    Bid,
    [
      feeProviderProxy,
      endemicMasterKeyProxy,
      royaltiesProviderProxy,
      '0x813201fe76De0622223492D2467fF5Fd38cF2320',
    ],
    {
      deployer,
      initializer: '__Bid_init',
    }
  );
  await bidProxy.deployed();

  console.log('Bid deployed to:', bidProxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
