const { ethers, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

const FIVE_MINUTES = 5 * 60;

const TGE_TIMESTAMP = Math.floor(new Date().getTime() / 1000);
const VESTING_START_TIMESTAMP = TGE_TIMESTAMP + FIVE_MINUTES;

const SEED_ALLOC_TYPE = 0;
const PRIVATE_ALLOC_TYPE = 1;

//GMT: Thursday, 21 July 2022 14:00:00
//const DEPLOYMENT_DATE = 1658412000;

//Six months from DEPLOYMENT_DATE
//GMT: Saturday, 21 January 2023 14:00:00
const END_CLIFF = 1674309600;

//One year from END_CLIFF
//GMT: Sunday, 21 January 2024 14:00:00
const END_VESTING = 1705845600;

const allocations = [
  {
    // #3
    allocType: SEED_ALLOC_TYPE,
    claimer: '0x0D492b8b6C24b8e593E9A4Ba12e213680ed0f4D5',
    initialAllocation: ethers.utils.parseUnits('30000', 'ether').toString(),
    totalAllocated: ethers.utils.parseUnits('600000', 'ether').toString(),
    endCliff: END_CLIFF,
    endVesting: END_VESTING,
  },
  {
    // #4
    allocType: SEED_ALLOC_TYPE,
    claimer: '0xEE924A5B496Cd3eee11325F079003A74Cf73b373',
    initialAllocation: ethers.utils.parseUnits('25000', 'ether').toString(),
    totalAllocated: ethers.utils.parseUnits('500000', 'ether').toString(),
    endCliff: END_CLIFF,
    endVesting: END_VESTING,
  },
  {
    // #5
    allocType: PRIVATE_ALLOC_TYPE,
    claimer: '0xD7b2eD1219AD585D8536Ca53F5e1846CE9A4B88a',
    initialAllocation: ethers.utils.parseUnits('26666.7', 'ether').toString(),
    totalAllocated: ethers.utils.parseUnits('266667', 'ether').toString(),
    endCliff: END_CLIFF,
    endVesting: END_VESTING,
  },
  {
    // #6
    allocType: SEED_ALLOC_TYPE,
    claimer: '0x06cAb6cC49fB017188a223ae93C7718dFC4FE73a',
    initialAllocation: ethers.utils.parseUnits('62500', 'ether').toString(),
    totalAllocated: ethers.utils.parseUnits('1250000', 'ether').toString(),
    endCliff: END_CLIFF,
    endVesting: END_VESTING,
  },
  {
    // #7
    allocType: PRIVATE_ALLOC_TYPE,
    claimer: '0xc0819E1e01204BCB9CB5a0a3Be826afedAd6EDEf',
    initialAllocation: ethers.utils.parseUnits('166666.7', 'ether').toString(),
    totalAllocated: ethers.utils.parseUnits('1666667', 'ether').toString(),
    endCliff: END_CLIFF,
    endVesting: END_VESTING,
  },
  {
    // #8
    allocType: PRIVATE_ALLOC_TYPE,
    claimer: '0xdBB0FfAFD38A61A1C06BA0C40761355F9F50a01E',
    initialAllocation: ethers.utils.parseUnits('16666.7', 'ether').toString(),
    totalAllocated: ethers.utils.parseUnits('166667', 'ether').toString(),
    endCliff: END_CLIFF,
    endVesting: END_VESTING,
  },
  {
    // #9
    allocType: PRIVATE_ALLOC_TYPE,
    claimer: '0xfDB3519f49149ffBd787927cd09792eeacCdd56C',
    initialAllocation: ethers.utils.parseUnits('66666.7', 'ether').toString(),
    totalAllocated: ethers.utils.parseUnits('666667', 'ether').toString(),
    endCliff: END_CLIFF,
    endVesting: END_VESTING,
  },
  {
    // #10 & #11
    allocType: SEED_ALLOC_TYPE,
    claimer: '0x7E3474DFB1f9510Ed314d11aFa6c6F395B2DED61',
    initialAllocation: ethers.utils.parseUnits('100000', 'ether').toString(),
    totalAllocated: ethers.utils.parseUnits('2000000', 'ether').toString(),
    endCliff: END_CLIFF,
    endVesting: END_VESTING,
  },
];

async function main() {
  const [deployer] = await ethers.getSigners();

  const { endemicENDToken } = getForNetwork(network);

  console.log('Deploying Endemic vesting with the account:', deployer.address);

  const EndemicVesting = await ethers.getContractFactory('EndemicVesting');

  const endemicVesting = await EndemicVesting.deploy(
    TGE_TIMESTAMP,
    VESTING_START_TIMESTAMP,
    endemicENDToken,
    allocations
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
