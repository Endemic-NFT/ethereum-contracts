const { ethers } = require('hardhat');

const hashAndSign = async (signer, types, values) => {
  let message = ethers.utils.solidityKeccak256(types, values);
  let flatSig = await signer.signMessage(ethers.utils.arrayify(message));
  return ethers.utils.splitSignature(flatSig);
};

const sign = async (signer, message) => {
  let flatSig = await signer.signMessage(ethers.utils.arrayify(message));
  return ethers.utils.splitSignature(flatSig);
};

const createMintApprovalSignature = async (
  nftContract,
  signer,
  minter,
  tokenUri
) => {
  let abiEncoded = ethers.utils.defaultAbiCoder.encode(
    ['address', 'address', 'string'],
    [nftContract.address, minter.address, tokenUri]
  );

  const hash = ethers.utils.keccak256(ethers.utils.arrayify(abiEncoded));
  let sig = await sign(signer, hash);
  return sig;
};

module.exports = {
  hashAndSign,
  sign,
  createMintApprovalSignature,
};
