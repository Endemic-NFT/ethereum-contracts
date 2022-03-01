const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    'Deploying EndemicCollectionFactory with the account:',
    deployer.address
  );

  const EndemicCollectionFactory = await ethers.getContractFactory(
    'EndemicCollectionFactory'
  );
  const endemicERC721Factory = await EndemicCollectionFactory.deploy();
  await endemicERC721Factory.deployed();

  console.log(
    'Deployed EndemicCollectionFactory to:',
    endemicERC721Factory.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
