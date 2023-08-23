const { ethers, upgrades, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { royaltiesProviderProxy, paymentManagerProxy } = getForNetwork(
    network.name
  );

  console.log('Deploying EndemicExchange with the account:', deployer.address);

  const EndemicExchange = await ethers.getContractFactory('EndemicExchange');
  const endemicExchange = await upgrades.deployProxy(
    EndemicExchange,
    [
      royaltiesProviderProxy,
      paymentManagerProxy,
      '0x813201fe76De0622223492D2467fF5Fd38cF2320',
      '0x3D77a01EF9265F8Af731367abF5b467641764191',
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
