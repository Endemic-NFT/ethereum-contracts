const { ethers, upgrades, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');
require('dotenv').config();

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
      process.env.FEE_RECIPIENT, //'0x813201fe76De0622223492D2467fF5Fd38cF2320',
      process.env.RESERVE_AUCTION_APPROVED_SIGNER,
    ],
    {
      deployer,
      initializer: '__EndemicExchange_init',
    }
  );

  await endemicExchange.deployed();

  console.log('EndemicExchange deployed to:', endemicExchange.address);

  return endemicExchange.address;
}

main()
  .then((address) => {
    console.log(' ', address);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
