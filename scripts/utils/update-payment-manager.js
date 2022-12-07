const { ethers, network } = require('hardhat');
const { getForNetwork } = require('./addresses');

async function main() {
  const { paymentManagerProxy } = getForNetwork(network.name);

  const PaymentManagerFactory = await ethers.getContractFactory(
    'PaymentManager'
  );
  const paymentManager = await PaymentManagerFactory.attach(
    paymentManagerProxy
  );

  const tx = await paymentManager.updateSupportedPaymentMethod(
    '0xC42C30aC6Cc15faC9bD938618BcaA1a1FaE8501d',
    true
  );

  await tx.wait();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
