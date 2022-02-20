const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  const endemicExchangeAddress = '0x45b87060571e9d372c0762497b6893374f3638Ee';
  const auctionsToCancel = [
    {
      id: 'x',
    },
  ];

  const EndemicExchange = await ethers.getContractFactory('EndemicExchange');
  const endemicExchange = await EndemicExchange.attach(endemicExchangeAddress);

  const claimTx = await endemicExchange.claimETH();
  await claimTx.wait();

  const pauseTx = await endemicExchange.pause();
  await pauseTx.wait();

  console.log('Canceling auctions');

  for (let index = 0; index < auctionsToCancel.length; index++) {
    await endemicExchange.cancelAuctionWhenPaused(auctionsToCancel[index].id);
  }

  console.log('Auctions canceled');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
