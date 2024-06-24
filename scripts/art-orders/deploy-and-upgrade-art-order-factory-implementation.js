const { ethers, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { artOrderFactory } = getForNetwork(network.name);

  console.log('Deploying OrderCollection with the account:', deployer.address);

  const OrderCollection = await ethers.getContractFactory('OrderCollection');
  const orderCollection = await OrderCollection.deploy(artOrderFactory);

  await orderCollection.deployed();
  console.log('OrderCollection proxy deployed to:', orderCollection.address);

  const OrderCollectionFactory = await ethers.getContractFactory(
    'OrderCollectionFactory'
  );

  const collectionFactory = await OrderCollectionFactory.attach(
    artOrderFactory
  );

  await collectionFactory.updateImplementation(orderCollection.address);
  console.log('Implementation updated');
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

//npx hardhat verify --network sepolia new_address factory_address
