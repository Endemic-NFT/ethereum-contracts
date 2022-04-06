const { ethers, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

const FIVE_MINUTES = 5 * 60000;

const TGE_TIMESTAMP = new Date().getMilliseconds();
const VESTING_START_TIMESTAMP = TGE_TIMESTAMP + FIVE_MINUTES;

async function main() {
  const [deployer] = await ethers.getSigners();

  const { endemicENDToken } = getForNetwork(network);

  console.log('Deploying Endemic vesting with the account:', deployer.address);

  const EndemicVesting = await ethers.getContractFactory('EndemicVesting');

  const endemicVesting = await EndemicVesting.deploy(
    TGE_TIMESTAMP,
    VESTING_START_TIMESTAMP,
    endemicENDToken
  );

  await endemicVesting.deployed();

  console.log('Endemic Vesting deployed to:', endemicVesting.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
