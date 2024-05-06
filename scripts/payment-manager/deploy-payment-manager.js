const { ethers, upgrades } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying PaymentManager with the account:', deployer.address);

  const PaymentManager = await ethers.getContractFactory('PaymentManager');
  const paymentManagerProxy = await upgrades.deployProxy(
    PaymentManager,
    [250, 250],
    {
      deployer,
      initializer: '__PaymentManager_init',
    }
  );
  await paymentManagerProxy.deployed();

  console.log('PaymentManager deployed to:', paymentManagerProxy.address);

  return paymentManagerProxy.address;
}

main()
  .then((address) => {
    console.log(' ', address);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
