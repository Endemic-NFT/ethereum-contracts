const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    'Deploying EndemicPaymentManager with the account:',
    deployer.address
  );

  const EndemicPaymentManager = await ethers.getContractFactory(
    'EndemicPaymentManager'
  );
  const paymentManagerProxy = await upgrades.deployProxy(
    EndemicPaymentManager,
    [250, 250],
    {
      deployer,
      initializer: '__EndemicPaymentManager_init',
    }
  );
  await paymentManagerProxy.deployed();

  console.log(
    'EndemicPaymentManager deployed to:',
    paymentManagerProxy.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
