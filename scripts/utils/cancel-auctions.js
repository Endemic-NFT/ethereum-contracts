const { ethers, network } = require('hardhat');
const { getAllAuctionIds } = require('./get-entities');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const { endemicExchangeProxy } = getForNetwork(network.name);

  const auctionIdsToCancel = await getAllAuctionIds();

  const EndemicExchange = await ethers.getContractFactory('EndemicExchange');
  const endemicExchange = await EndemicExchange.attach(endemicExchangeProxy);

  console.log('Canceling auctions');

  await endemicExchange.adminCancelAuctions(auctionIdsToCancel);

  console.log('Auctions canceled');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
