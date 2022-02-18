const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying ContractImporter with the account:', deployer.address);

  const ContractImporter = await ethers.getContractFactory('ContractImporter');
  const contractImporter = await upgrades.deployProxy(ContractImporter, [], {
    deployer,
    initializer: '__ContractImporter_init',
  });
  await contractImporter.deployed();

  console.log('ContractImporter deployed to:', contractImporter.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
