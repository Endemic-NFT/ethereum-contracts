const { ethers, upgrades, network } = require('hardhat');
const { getForNetwork } = require('../utils/addresses');

async function main() {
  const [deployer] = await ethers.getSigners();
  const { contractRegistryProxy } = getForNetwork(network.name);

  console.log('Deploying FeeProvider with the account:', deployer.address);

  const initialSaleFee = 1500;
  const secondarySaleMakerFee = 250;
  const takerFee = 250;

  const FeeProvider = await ethers.getContractFactory('FeeProvider');
  const feeProviderProxy = await upgrades.deployProxy(
    FeeProvider,
    [initialSaleFee, secondarySaleMakerFee, takerFee, contractRegistryProxy],
    {
      deployer,
      initializer: '__FeeProvider_init',
    }
  );
  await feeProviderProxy.deployed();

  console.log('FeeProvider deployed to:', feeProviderProxy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
