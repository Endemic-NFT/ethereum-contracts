const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    'Deploying EndemicCollectionFactory with the account:',
    deployer.address
  );

  const EndemicCollectionFactory = await ethers.getContractFactory(
    'EndemicCollectionFactory'
  );

  const endemicERC721FactoryProxy = await upgrades.deployProxy(
    EndemicCollectionFactory,
    [],
    {
      deployer,
      initializer: 'initialize',
    }
  );
  await endemicERC721FactoryProxy.deployed();

  console.log(
    'Deployed EndemicCollectionFactory proxy to:',
    endemicERC721FactoryProxy.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
