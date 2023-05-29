const { ethers } = require('hardhat');

const keccak256 = (value) =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));

const getTypedMessage = ({
  chainId,
  paymentErc20TokenAddress,
  verifierContract,
  nftContract,
  price,
  seller,
  buyer,
}) => {
  return {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
        { name: 'salt', type: 'bytes32' },
      ],
      PrivateSale: [
        { name: 'nftContract', type: 'address' },
        { name: 'tokenId', type: 'uint256' },
        { name: 'paymentErc20TokenAddress', type: 'address' },
        { name: 'seller', type: 'address' },
        { name: 'buyer', type: 'address' },
        { name: 'price', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'PrivateSale',
    domain: {
      name: 'Endemic Exchange',
      version: '1',
      chainId: chainId,
      verifyingContract: verifierContract,
      salt: keccak256('Endemic Exchange Salt'),
    },
    message: {
      nftContract: nftContract,
      tokenId: 2,
      paymentErc20TokenAddress: paymentErc20TokenAddress,
      seller: seller,
      buyer: buyer,
      price: price.toString(),
      deadline: 2000994705,
    },
  };
};

module.exports = { getTypedMessage, keccak256 };
