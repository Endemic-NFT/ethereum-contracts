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

  await endemicERC721FactoryProxy.updateConfiguration(
    '0x3D77a01EF9265F8Af731367abF5b467641764191',
    '0x3D77a01EF9265F8Af731367abF5b467641764191'
  );

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
