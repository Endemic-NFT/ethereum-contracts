const { ethers, network } = require('hardhat');
const { getVerifiedUsers } = require('./get-entities');
const { getForNetwork } = require('./addresses');

async function main() {
  const { endemicErc721Factory } = getForNetwork(network.name);

  const verifiedUsers = await getVerifiedUsers();

  const EndemicCollectionFactory = await ethers.getContractFactory(
    'EndemicCollectionFactory'
  );
  const endemicCollectionFactory = await EndemicCollectionFactory.attach(
    endemicErc721Factory
  );

  const MINTER_ROLE = await endemicCollectionFactory.MINTER_ROLE();

  for (let i = 0; i < verifiedUsers.length; i++) {
    await endemicCollectionFactory.grantRole(MINTER_ROLE, verifiedUsers[i].id);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
