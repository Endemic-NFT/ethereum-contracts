const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(
    'Deploying RoyaltiesProvider with the account:',
    deployer.address
  );

  const RoyaltiesProvider = await ethers.getContractFactory(
    'RoyaltiesProvider'
  );
  const royaltiesProviderProxy = await upgrades.deployProxy(
    RoyaltiesProvider,
    [5000],
    {
      deployer,
      initializer: '__RoyaltiesProvider_init',
    }
  );
  await royaltiesProviderProxy.deployed();

  console.log('RoyaltiesProvider deployed to:', royaltiesProviderProxy.address);
  return royaltiesProviderProxy.address;
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
