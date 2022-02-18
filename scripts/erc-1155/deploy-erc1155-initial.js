const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying EndemicERC1155 with the account:', deployer.address);
  const EndemicERC1155 = await ethers.getContractFactory('EndemicERC1155');
  const endemicERC1155Proxy = await upgrades.deployProxy(
    EndemicERC1155,
    ['Endemic NFT', 'END', 'ipfs://'],
    {
      deployer,
      initializer: '__EndemicERC1155_init',
    }
  );
  await endemicERC1155Proxy.deployed();
  console.log('EndemicERC1155 proxy deployed to:', endemicERC1155Proxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
