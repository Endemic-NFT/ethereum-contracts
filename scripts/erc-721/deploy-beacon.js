const { ethers, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');
const { getProxyImpl } = require('../utils/get-proxy-impl');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicNftProxy } = getForNetwork(network.name);

  console.log('Deploying EndemicNFTBeacon with the account:', deployer.address);
  const nftProxyImpl = await getProxyImpl(endemicNftProxy, network.name);
  const EndemicNFTBeacon = await ethers.getContractFactory('EndemicNFTBeacon');
  const nftBeacon = await EndemicNFTBeacon.deploy(nftProxyImpl);
  await nftBeacon.deployed();
  console.log('Deployed EndemicNFTBeacon to:', nftBeacon.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
