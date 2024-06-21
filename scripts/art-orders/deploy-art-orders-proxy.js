const { ethers, upgrades, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');
require('dotenv').config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicErc721Factory } = getForNetwork(network.name);

  console.log('Deploying Art orders with the account:', deployer.address);

  const ArtOrder = await ethers.getContractFactory('ArtOrder');
  const artOrder = await upgrades.deployProxy(
    ArtOrder,
    [250, process.env.FEE_RECIPIENT, endemicErc721Factory],
    {
      deployer,
      initializer: 'initialize',
    }
  );

  await artOrder.deployed();

  console.log('EndemicExchange deployed to:', artOrder.address);

  return artOrder.address;
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