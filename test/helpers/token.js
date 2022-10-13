const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');

const weiToEther = (weiValue) => ethers.utils.formatUnits(weiValue, 'ether');

const addTakerFee = (value) => {
  if (value === '0') return value;
  const valueBn = BigNumber.from(value.toString());
  const takerFee = BigNumber.from('300');
  const takerFeeCut = calculateCutFromPercent(valueBn, takerFee);

  return valueBn.add(takerFeeCut).toString();
};

const calculateCutFromPercent = (price, cut) =>
  price.mul(cut).div(BigNumber.from('10000'));

const calculateAuctionDuration = (auction) => {
  const duration = +auction.endingAt - +auction.startedAt;

  return duration.toString();
};

module.exports = { weiToEther, addTakerFee, calculateAuctionDuration };
