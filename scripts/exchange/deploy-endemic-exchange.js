const { ethers, upgrades, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { royaltiesProviderProxy } = getForNetwork(network.name);

  console.log('Deploying EndemicExchange with the account:', deployer.address);

  const EndemicExchange = await ethers.getContractFactory('EndemicExchange');
  const endemicExchange = await upgrades.deployProxy(
    EndemicExchange,
    [
      royaltiesProviderProxy,
      '0x813201fe76De0622223492D2467fF5Fd38cF2320',
      250,
      250,
    ],
    {
      deployer,
      initializer: '__EndemicExchange_init',
    }
  );
  await endemicExchange.deployed();

  console.log('EndemicExchange deployed to:', endemicExchange.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
