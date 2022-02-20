const { ethers, network, upgrades } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicExchangeProxy, royaltiesProviderProxy } = getForNetwork(
    network.name
  );

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
