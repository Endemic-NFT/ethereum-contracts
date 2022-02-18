const { ethers, network, upgrades } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { bidProxy } = getForNetwork(network.name);

  const Bid = await ethers.getContractFactory('Bid');
  await upgrades.upgradeProxy(bidProxy, Bid, { deployer });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
