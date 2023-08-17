const { ethers } = require('hardhat');

const keccak256 = (value) =>
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));

const getTypedMessage_sale = ({
  chainId,
  verifierContract,
  nftContract,
  paymentErc20TokenAddress,
  price,
  buyer,
}) => {
  const domain = {
    name: 'Endemic Exchange',
    version: '1',
    chainId,
    verifyingContract: verifierContract,
    salt: keccak256('Endemic Exchange Salt'),
  };

  const types = {
    Sale: [
      { name: 'orderNonce', type: 'uint256' },
      { name: 'nftContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'paymentErc20TokenAddress', type: 'address' },
      { name: 'price', type: 'uint256' },
      { name: 'buyer', type: 'address' },
      { name: 'expiresAt', type: 'uint256' },
    ],
  };

  const values = {
    orderNonce: 1,
    nftContract: nftContract,
    tokenId: 2,
    paymentErc20TokenAddress: paymentErc20TokenAddress,
    price: price.toString(),
    buyer: buyer,
    expiresAt: 2000994705,
  };

  return { domain, types, values };
};

const getTypedMessage_offer = ({
  chainId,
  verifierContract,
  orderNonce,
  nftContract,
  tokenId,
  paymentErc20TokenAddress,
  price,
  expiresAt,
  isForCollection,
}) => {
  const domain = {
    name: 'Endemic Exchange',
    version: '1',
    chainId: chainId,
    verifyingContract: verifierContract,
    salt: keccak256('Endemic Exchange Salt'),
  };

  const types = {
    Offer: [
      { name: 'orderNonce', type: 'uint256' },
      { name: 'nftContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'paymentErc20TokenAddress', type: 'address' },
      { name: 'price', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'isForCollection', type: 'bool' },
    ],
  };

  const values = {
    orderNonce: orderNonce,
    nftContract: nftContract,
    tokenId: tokenId,
    paymentErc20TokenAddress: paymentErc20TokenAddress,
    price: price.toString(),
    expiresAt: expiresAt,
    isForCollection: isForCollection,
  };

  return { domain, types, values };
};

const getTypedMessage_dutch = ({
  chainId,
  verifierContract,
  orderNonce,
  nftContract,
  tokenId,
  paymentErc20TokenAddress,
  startingPrice,
  endingPrice,
  startingAt,
  duration,
}) => {
  const domain = {
    name: 'Endemic Exchange',
    version: '1',
    chainId: chainId,
    verifyingContract: verifierContract,
    salt: keccak256('Endemic Exchange Salt'),
  };

  const types = {
    DutchAuction: [
      { name: 'orderNonce', type: 'uint256' },
      { name: 'nftContract', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
      { name: 'paymentErc20TokenAddress', type: 'address' },
      { name: 'startingPrice', type: 'uint256' },
      { name: 'endingPrice', type: 'uint256' },
      { name: 'startingAt', type: 'uint256' },
      { name: 'duration', type: 'uint256' },
    ],
  };

  const values = {
    orderNonce: orderNonce,
    nftContract: nftContract,
    tokenId: tokenId,
    paymentErc20TokenAddress: paymentErc20TokenAddress,
    startingPrice: startingPrice.toString(),
    endingPrice: endingPrice.toString(),
    startingAt: startingAt,
    duration: duration,
  };

  return { domain, types, values };
};

module.exports = {
  getTypedMessage_sale,
  getTypedMessage_offer,
  getTypedMessage_dutch,
  keccak256,
};
