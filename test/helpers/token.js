const { ethers } = require('hardhat');

const weiToEther = (weiValue) => ethers.utils.formatUnits(weiValue, 'ether');

module.exports = { weiToEther };
