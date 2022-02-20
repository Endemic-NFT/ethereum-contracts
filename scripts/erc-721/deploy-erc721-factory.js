const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    'Deploying EndemicERC721Factory with the account:',
    deployer.address
  );

  const EndemicERC721Factory = await ethers.getContractFactory(
    'EndemicERC721Factory'
  );
  const endemicERC721Factory = await EndemicERC721Factory.deploy();
  await endemicERC721Factory.deployed();

  console.log(
    'Deployed EndemicERC721Factory to:',
    endemicERC721Factory.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
