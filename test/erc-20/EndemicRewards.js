const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  deployEndemicToken,
  deployEndemicRewards,
} = require('../helpers/deploy');
const { sign } = require('../helpers/sign');

describe('EndemicRewards', function () {
  let owner, user1, signer;
  let endemicToken, endemicRewards;

  beforeEach(async () => {
    [owner, user1, signer] = await ethers.getSigners();

    endemicToken = await deployEndemicToken(owner);
    endemicRewards = await deployEndemicRewards(endemicToken.address);

    await endemicToken.transfer(
      endemicRewards.address,
      ethers.utils.parseUnits('1000')
    ); // 1000 END

    await endemicRewards.addSigner(signer.address);
  });

  const signBalance = async (signerAcc, balance) => {
    let abiEncoded = ethers.utils.defaultAbiCoder.encode(
      ['tuple(address recipient, uint256 value)'],
      [balance]
    );

    const hash = ethers.utils.keccak256(ethers.utils.arrayify(abiEncoded));
    let sig = await sign(signerAcc, hash);
    return sig;
  };

  it('can claims balance signed by signer', async () => {
    // Todo
    const balance = {
      recipient: user1.address,
      value: ethers.utils.parseUnits('10'),
    };

    const { v, r, s } = await signBalance(signer, balance);
    await endemicRewards.connect(user1).claim(balance, v, r, s);

    expect(await endemicToken.balanceOf(user1.address)).to.equal(
      ethers.utils.parseUnits('10')
    );
  });

  it("can't claim same balance twice", async () => {
    const balance = {
      recipient: user1.address,
      value: ethers.utils.parseUnits('10'),
    };

    const { v, r, s } = await signBalance(signer, balance);
    await endemicRewards.connect(user1).claim(balance, v, r, s);
    await expect(
      endemicRewards.connect(user1).claim(balance, v, r, s)
    ).to.be.revertedWith('NothingToClaim');
  });

  it('can claim multiple times', async () => {
    const balance1 = {
      recipient: user1.address,
      value: ethers.utils.parseUnits('10'),
    };

    const signature1 = await signBalance(signer, balance1);

    const balance2 = {
      recipient: user1.address,
      value: ethers.utils.parseUnits('15'),
    };

    const signature2 = await signBalance(signer, balance2);

    await endemicRewards
      .connect(user1)
      .claim(balance1, signature1.v, signature1.r, signature1.s);

    await endemicRewards
      .connect(user1)
      .claim(balance2, signature2.v, signature2.r, signature2.s);

    expect(await endemicToken.balanceOf(user1.address)).to.equal(
      ethers.utils.parseUnits('15')
    );
  });

  it("can't claim balances not signed by the signer", async () => {
    const balance = {
      recipient: user1.address,
      value: ethers.utils.parseUnits('10'),
    };

    const { v, r, s } = await signBalance(user1, balance);

    await expect(
      endemicRewards.connect(user1).claim(balance, v, r, s)
    ).to.be.revertedWith('InvalidSigner');
  });

  it("can't claim when paused", async () => {
    const balance1 = {
      recipient: user1.address,
      value: ethers.utils.parseUnits('10'),
    };

    const signature1 = await signBalance(signer, balance1);

    await endemicRewards.pause();

    await expect(
      endemicRewards
        .connect(user1)
        .claim(balance1, signature1.v, signature1.r, signature1.s)
    ).to.be.revertedWith('Pausable: paused');
  });

  it('can pause and unpause if owner', async () => {
    await endemicRewards.pause();
    await expect(await endemicRewards.paused()).to.equal(true);

    await endemicRewards.unpause();
    await expect(await endemicRewards.paused()).to.equal(false);
  });

  it("can't pause and unpause if not owner", async () => {
    await expect(endemicRewards.connect(user1).pause()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(await endemicRewards.paused()).to.equal(false);

    await endemicRewards.pause();
    await expect(endemicRewards.connect(user1).unpause()).to.be.revertedWith(
      'Ownable: caller is not the owner'
    );
    await expect(await endemicRewards.paused()).to.equal(true);
  });
});
