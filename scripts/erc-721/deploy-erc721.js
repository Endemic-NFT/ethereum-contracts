const { ethers, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicErc721Factory } = getForNetwork(network);

  console.log('Deploying EndemicERC721 with the account:', deployer.address);

  const EndemicERC721 = await ethers.getContractFactory('EndemicERC721');
  const endemicERC721 = await EndemicNFT.deploy(endemicErc721Factory);

  await endemicERC721.deployed();
  console.log('EndemicERC721 proxy deployed to:', endemicERC721.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
