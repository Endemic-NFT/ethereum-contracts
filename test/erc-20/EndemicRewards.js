const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  deployEndemicToken,
  deployEndemicRewards,
} = require('../helpers/deploy');
const { sign } = require('../helpers/sign');

describe('EndemicRewards', function () {
  let owner, user1, user2;
  let endemicToken, endemicTokenMining;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    endemicToken = await deployEndemicToken(owner);
    endemicTokenMining = await deployEndemicRewards(endemicToken.address);

    await endemicToken.transfer(
      endemicTokenMining.address,
      ethers.utils.parseUnits('1000')
    ); // 1000 END
  });

  const signBalances = async (signer, balances) => {
    let abiEncoded = ethers.utils.defaultAbiCoder.encode(
      ['tuple(address recipient, uint256 value)[]'],
      [balances]
    );

    const hash = ethers.utils.keccak256(ethers.utils.arrayify(abiEncoded));
    let sig = await sign(signer, hash);
    return sig;
  };

  it('can claims balances signed by owner', async () => {
    // Todo
    let balances = [
      { recipient: user1.address, value: ethers.utils.parseUnits('10') },
      { recipient: user2.address, value: ethers.utils.parseUnits('15') },
    ];

    const { v, r, s } = await signBalances(owner, balances);
    await endemicTokenMining.connect(user1).claim(balances, v, r, s);
    await endemicTokenMining.connect(user2).claim(balances, v, r, s);

    const balance = await endemicToken.balanceOf(user1.address);
    expect(balance.toString()).to.equal(ethers.utils.parseUnits('10'));

    const balance2 = await endemicToken.balanceOf(user2.address);
    expect(balance2.toString()).to.equal(ethers.utils.parseUnits('15'));
  });

  it("can't claim same balance twice", async () => {
    let balances = [
      { recipient: user1.address, value: ethers.utils.parseUnits('10') },
      { recipient: user2.address, value: ethers.utils.parseUnits('15') },
    ];

    const { v, r, s } = await signBalances(owner, balances);
    await endemicTokenMining.connect(user1).claim(balances, v, r, s);
    await expect(
      endemicTokenMining.connect(user1).claim(balances, v, r, s)
    ).to.be.revertedWith('nothing to claim');
  });

  it('can claim multiple balances', async () => {
    let balances1 = [
      { recipient: user1.address, value: ethers.utils.parseUnits('10') },
      { recipient: user2.address, value: ethers.utils.parseUnits('15') },
    ];

    const signature1 = await signBalances(owner, balances1);

    let balances2 = [
      { recipient: user1.address, value: ethers.utils.parseUnits('20') },
      { recipient: user2.address, value: ethers.utils.parseUnits('25') },
    ];

    const signature2 = await signBalances(owner, balances2);

    await endemicTokenMining
      .connect(user1)
      .claim(balances1, signature1.v, signature1.r, signature1.s);

    await endemicTokenMining
      .connect(user1)
      .claim(balances2, signature2.v, signature2.r, signature2.s);

    const balance = await endemicToken.balanceOf(user1.address);
    expect(balance.toString()).to.equal(ethers.utils.parseUnits('20'));
  });

  it("can't claim balances not signed by the owner", async () => {
    let balances = [
      { recipient: user1.address, value: ethers.utils.parseUnits('10') },
      { recipient: user2.address, value: ethers.utils.parseUnits('15') },
    ];

    const { v, r, s } = await signBalances(user1, balances);

    await expect(
      endemicTokenMining.connect(user1).claim(balances, v, r, s)
    ).to.be.revertedWith('Owner should sign message');
  });

  it('reverts if user is not on the list', async () => {
    let balances = [
      { recipient: user1.address, value: ethers.utils.parseUnits('10') },
    ];

    const { v, r, s } = await signBalances(owner, balances);

    await expect(
      endemicTokenMining.connect(user2).claim(balances, v, r, s)
    ).to.be.revertedWith('caller not found in recipients');
  });
});
