const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    'Deploying OpenspaceCollectionFactory with the account:',
    deployer.address
  );

  const OpenspaceCollectionFactory = await ethers.getContractFactory(
    'OpenspaceCollectionFactory'
  );
  const openspaceCollectionFactory = await OpenspaceCollectionFactory.deploy();
  await openspaceCollectionFactory.deployed();

  console.log(
    'Deployed OpenspaceCollectionFactory to:',
    openspaceCollectionFactory.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
