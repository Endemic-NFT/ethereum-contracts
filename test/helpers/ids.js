const { ethers } = require('hardhat');

function id(str) {
  return ethers.utils
    .keccak256(ethers.utils.toUtf8Bytes(str))
    .toString('hex')
    .substring(0, 10);
}

const ERC721_ASSET_CLASS = id('ERC721');
const ERC1155_ASSET_CLASS = id('ERC1155');

module.exports = { ERC721_ASSET_CLASS, ERC1155_ASSET_CLASS };
