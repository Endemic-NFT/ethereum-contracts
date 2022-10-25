const { ethers, network } = require('hardhat');
const { getCollectionsWithRoyalites } = require('./get-entities');
const { getForNetwork } = require('./addresses');

async function main() {
  const { royaltiesProviderProxy } = getForNetwork(network.name);

  const collections = await getCollectionsWithRoyalites();

  const RoyaltiesProvider = await ethers.getContractFactory(
    'RoyaltiesProvider'
  );
  const royaltiesProvider = await RoyaltiesProvider.attach(
    royaltiesProviderProxy
  );

  for (let i = 0; i < collections.length; i++) {
    await royaltiesProvider.setRoyaltiesForCollection(
      collections[i].id,
      collections[i].royaltiesRecipient,
      collections[i].royalties
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
