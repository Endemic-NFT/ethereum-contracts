const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying Tipjar with the account:', deployer.address);

  const Tipjar = await ethers.getContractFactory('Tipjar');
  const tipjarContract = await Tipjar.deploy();
  await tipjarContract.deployed();

  console.log('Tipjar deployed to:', tipjarContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
