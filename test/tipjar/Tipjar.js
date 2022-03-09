const { expect } = require('chai');
const { ethers } = require('hardhat');
const BN = require('bignumber.js');
const { deployTipjar } = require('../helpers/deploy');

describe('Tipjar', function () {
  let owner, sender, receiver;
  let tipjarContract;
  let tip, gasLimitMax;
  let senderStartingBalance, receiverStartingBalance;

  beforeEach(async () => {
    [owner, sender, receiver] = await ethers.getSigners();
    tipjarContract = await deployTipjar();
    tip = ethers.BigNumber.from(100000000000000);
    gasLimitMax = ethers.BigNumber.from(44000000);
    senderStartingBalance = await sender.getBalance();
    receiverStartingBalance = await receiver.getBalance();
  });

  it('has expected gas limit', async () => {
    const { gasLimit } = await tipjarContract
      .connect(sender)
      .sendTip(receiver.address, {
        value: tip,
      });
    expect(gasLimit.lt(gasLimitMax)).to.be.true;
  });

  it('has decreased sender balance for expected amount', async () => {
    await tipjarContract.connect(sender).sendTip(receiver.address, {
      value: tip,
    });
    const senderEndBalance = await sender.getBalance();

    expect(senderStartingBalance.sub(senderEndBalance).gt(tip)).to.be.true;
  });

  it('has increased reciever balance for expected amount', async () => {
    await tipjarContract.connect(sender).sendTip(receiver.address, {
      value: tip,
    });

    const receiverEndBalance = await receiver.getBalance();

    expect(receiverEndBalance.sub(receiverStartingBalance)).to.equals(tip);
  });

  it('will fail empty tip', async () => {
    await expect(
      tipjarContract.connect(sender).sendTip(receiver.address, {
        value: 0,
      })
    ).to.be.revertedWith('AmountSentToSmall');
  });
});
