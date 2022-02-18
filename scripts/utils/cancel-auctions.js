const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  const marketplaceAddress = '0x45b87060571e9d372c0762497b6893374f3638Ee';
  const auctionsToCancel = [
    {
      id: 'x',
    },
  ];

  const Marketplace = await ethers.getContractFactory('Marketplace');
  const marketplace = await Marketplace.attach(marketplaceAddress);

  const claimTx = await marketplace.claimETH();
  await claimTx.wait();

  const pauseTx = await marketplace.pause();
  await pauseTx.wait();

  console.log('Canceling auctions');

  for (let index = 0; index < auctionsToCancel.length; index++) {
    await marketplace.cancelAuctionWhenPaused(auctionsToCancel[index].id);
  }

  console.log('Auctions canceled');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
