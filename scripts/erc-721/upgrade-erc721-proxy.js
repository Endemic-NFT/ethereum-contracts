const { ethers, network, upgrades } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicNftProxy } = getForNetwork(network.name);

  const EndemicNFT = await ethers.getContractFactory('EndemicNFT');
  await upgrades.upgradeProxy(endemicNftProxy, EndemicNFT, { deployer });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
