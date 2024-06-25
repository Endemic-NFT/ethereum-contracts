const { ethers, network, upgrades } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { artOrders } = getForNetwork(network.name);

  console.log('Upgrading Art Order with the account:', deployer.address);

  const ArtOrder = await ethers.getContractFactory('ArtOrder');
  await upgrades.upgradeProxy(artOrders, ArtOrder, {
    deployer,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
