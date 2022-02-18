const { ethers, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicERC1155Beacon } = getForNetwork(network.name);

  console.log(
    'Deploying EndemicERC1155Factory with the account:',
    deployer.address
  );
  const EndemicERC1155Factory = await ethers.getContractFactory(
    'EndemicERC1155Factory'
  );
  const endemicERC1155Factory = await EndemicERC1155Factory.deploy(
    endemicERC1155Beacon
  );
  await endemicERC1155Factory.deployed();
  console.log(
    'Deployed EndemicERC1155Factory to:',
    endemicERC1155Factory.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
