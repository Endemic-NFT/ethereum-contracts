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
  tokenUri,
  nonce
) => {
  const signature = await signer._signTypedData(
    {
      name: 'My Collection',
      version: '1',
      chainId: 31337, // Hardhat chain id
      verifyingContract: nftContract.address,
    },
    {
      MintApproval: [
        { name: 'minter', type: 'address' },
        { name: 'tokenCID', type: 'string' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    {
      minter: minter.address,
      tokenCID: tokenUri,
      nonce,
    }
  );

  return ethers.utils.splitSignature(signature);
};

module.exports = {
  hashAndSign,
  sign,
  createMintApprovalSignature,
};
