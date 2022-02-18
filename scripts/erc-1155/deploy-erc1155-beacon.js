const { ethers, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');
const { getProxyImpl } = require('../utils/get-proxy-impl');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { endemicERC1155Proxy } = getForNetwork(network.name);

  console.log(
    'Deploying EndemicERC1155Beacon with the account:',
    deployer.address
  );
  const nftProxyImpl = await getProxyImpl(endemicERC1155Proxy, network.name);
  const EndemicERC1155Beacon = await ethers.getContractFactory(
    'EndemicERC1155Beacon'
  );
  const nftBeacon = await EndemicERC1155Beacon.deploy(nftProxyImpl);
  await nftBeacon.deployed();
  console.log('Deployed EndemicERC1155Beacon to:', nftBeacon.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
