const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying ArtMinter with the account:', deployer.address);

  const ArtMinter = await ethers.getContractFactory('ArtMinter');
  const artMinter = await upgrades.deployProxy(ArtMinter, [], {
    deployer,
    initializer: '__ArtMinter_init',
  });
  await artMinter.deployed();

  console.log('ArtMinter deployed to:', artMinter.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
