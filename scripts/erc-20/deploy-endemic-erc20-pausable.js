const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    'Deploying Pausable Endemic ERC20 with the account:',
    deployer.address
  );

  const EndemicToken = await ethers.getContractFactory('EndemicTokenPausable');
  const endemicToken = await EndemicToken.deploy(
    '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
  );
  await endemicToken.deployed();

  console.log('Pausable Endemic ERC20 deployed to:', endemicToken.address);

  // #1
  const tx1 = await endemicToken.transfer(
    '0xCef2D0c7d89C3Dcc7a8E8AF561b0294BCD6e9EBD',
    ethers.utils.parseUnits('833333', 'ether').toString()
  );

  await tx1.wait();

  // #2
  const tx2 = await endemicToken.transfer(
    '0x0D492b8b6C24b8e593E9A4Ba12e213680ed0f4D5',
    ethers.utils.parseUnits('600000', 'ether').toString()
  );
  await tx2.wait();

  // #3
  const tx3 = await endemicToken.transfer(
    '0xEE924A5B496Cd3eee11325F079003A74Cf73b373',
    ethers.utils.parseUnits('500000', 'ether').toString()
  );
  await tx3.wait();

  // #4
  const tx4 = await endemicToken.transfer(
    '0xD7b2eD1219AD585D8536Ca53F5e1846CE9A4B88a',
    ethers.utils.parseUnits('266667', 'ether').toString()
  );
  await tx4.wait();

  // #5
  const tx5 = await endemicToken.transfer(
    '0x06cAb6cC49fB017188a223ae93C7718dFC4FE73a',
    ethers.utils.parseUnits('1250000', 'ether').toString()
  );
  await tx5.wait();

  // #6
  const tx6 = await endemicToken.transfer(
    '0xc0819E1e01204BCB9CB5a0a3Be826afedAd6EDEf',
    ethers.utils.parseUnits('1666667', 'ether').toString()
  );
  await tx6.wait();

  // #7
  const tx7 = await endemicToken.transfer(
    '0xdBB0FfAFD38A61A1C06BA0C40761355F9F50a01E',
    ethers.utils.parseUnits('166667', 'ether').toString()
  );
  await tx7.wait();

  // #8
  const tx8 = await endemicToken.transfer(
    '0xfDB3519f49149ffBd787927cd09792eeacCdd56C',
    ethers.utils.parseUnits('666667', 'ether').toString()
  );
  await tx8.wait();

  // #9 & 10
  const tx9 = await endemicToken.transfer(
    '0x7E3474DFB1f9510Ed314d11aFa6c6F395B2DED61',
    ethers.utils.parseUnits('2000000', 'ether').toString()
  );
  await tx9.wait();

  // #11
  const tx10 = await endemicToken.transfer(
    '0xA0d8f6c24394EBBeBCE0A4a8618e0A4eD70Ee22A',
    ethers.utils.parseUnits('666667', 'ether').toString()
  );
  await tx10.wait();

  await endemicToken.pause();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
