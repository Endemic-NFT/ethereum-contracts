const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployEndemicToken } = require('../helpers/deploy');

describe('EndemicToken', function () {
  let user1;
  let endemicToken;
  beforeEach(async () => {
    [user1] = await ethers.getSigners();

    endemicToken = await deployEndemicToken(user1);
  });

  it('has correct name and symbol', async () => {
    const name = await endemicToken.name();
    expect(name).to.equal('Endemic');

    const symbol = await endemicToken.symbol();
    expect(symbol).to.equal('END');
  });

  it('has correct initial supply', async () => {
    const totalSupply = await endemicToken.totalSupply();
    expect(totalSupply.toString()).to.equal('50000000000000000000000000'); // 50 mil
  });

  it('allows holders to burn their tokens', async () => {
    const userBalance1 = await endemicToken.balanceOf(user1.address);
    await endemicToken.burn('1000000000000000000000000');
    const userBalance2 = await endemicToken.balanceOf(user1.address);
    expect(userBalance1.sub(userBalance2)).to.equal(
      '1000000000000000000000000'
    );
  });
});
