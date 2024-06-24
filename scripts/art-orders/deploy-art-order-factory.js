const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    'Deploying ArtOrderCollectionFactory with the account:',
    deployer.address
  );

  const OrderCollectionFactory = await ethers.getContractFactory(
    'OrderCollectionFactory'
  );

  const orderCollectionFactoryProxy = await upgrades.deployProxy(
    OrderCollectionFactory,
    [],
    {
      deployer,
      initializer: 'initialize',
    }
  );
  await orderCollectionFactoryProxy.deployed();

  await orderCollectionFactoryProxy.updateConfiguration(
    '0x3D77a01EF9265F8Af731367abF5b467641764191',
    '0x3D77a01EF9265F8Af731367abF5b467641764191'
  );

  console.log(
    'Deployed ArtOrderCollectionFactory proxy to:',
    orderCollectionFactoryProxy.address
  );

  return orderCollectionFactoryProxy.address;
}

main()
  .then((address) => {
    console.log(` ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//TO VERIFY: make verify network=sepolia address=endemicERC721FactoryProxy.address
