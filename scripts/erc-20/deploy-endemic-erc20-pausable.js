const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    'Deploying Pausable Endemic ERC20 with the account:',
    deployer.address
  );

  const EndemicToken = await ethers.getContractFactory('EndemicTokenPausable');
  const endemicToken = await EndemicToken.deploy(
    '0x718aFE0beaD3C333958Ba4dEA4a0650b1182283e'
  );
  await endemicToken.deployed();

  console.log('Pausable Endemic ERC20 deployed to:', endemicToken.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
