const { ethers, upgrades, network } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying ContractRegistry with the account:', deployer.address);

  const ContractRegistry = await ethers.getContractFactory('ContractRegistry');
  const contractRegistryProxy = await upgrades.deployProxy(
    ContractRegistry,
    [],
    {
      deployer,
      initializer: '__ContractRegistry_init',
    }
  );
  await contractRegistryProxy.deployed();

  console.log('ContractRegistry deployed to:', contractRegistryProxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
