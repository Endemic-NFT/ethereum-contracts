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
    '0x84547Ab11037f68e696DD0557A152E77Ea30d926',
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
