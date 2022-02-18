const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying EndemicNFT with the account:', deployer.address);
  const EndemicNFT = await ethers.getContractFactory('EndemicNFT');
  const endemicNFTProxy = await upgrades.deployProxy(
    EndemicNFT,
    ['Endemic NFT', 'END', 'ipfs://'],
    {
      deployer,
      initializer: '__EndemicNFT_init',
    }
  );
  await endemicNFTProxy.deployed();
  console.log('EndemicNFT proxy deployed to:', endemicNFTProxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
