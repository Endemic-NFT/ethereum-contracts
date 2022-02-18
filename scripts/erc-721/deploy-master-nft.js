const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying EndemicMasterNFT with the account:', deployer.address);

  const EndemicMasterNFT = await ethers.getContractFactory('EndemicMasterNFT');
  const masterNFTProxy = await upgrades.deployProxy(
    EndemicMasterNFT,
    ['https://storage.googleapis.com/endemic-master-keys/'],
    {
      deployer,
      initializer: '__EndemicMasterNFT_init',
    }
  );
  await masterNFTProxy.deployed();

  console.log('EndemicMasterNFT deployed to:', masterNFTProxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
