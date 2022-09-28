const { ethers, network, upgrades } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicExchangeProxy } = getForNetwork(network.name);

  console.log('Upgrading EndemicExchange with the account:', deployer.address);

  const EndemicExchange = await ethers.getContractFactory('EndemicExchange');
  await upgrades.upgradeProxy(endemicExchangeProxy, EndemicExchange, {
    deployer,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
