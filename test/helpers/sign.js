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

const createBatchMintApprovalSignature = async (
  nftContract,
  signer,
  minter,
  tokenCIDs,
  nonce
) => {
  // Convert tokenCIDs to an array of keccak256 hashes
  const tokenCIDHashes = tokenCIDs.map((tokenCID) =>
    ethers.utils.keccak256(ethers.utils.toUtf8Bytes(tokenCID))
  );

  const signature = await signer._signTypedData(
    {
      name: 'My Collection',
      version: '1',
      chainId: 31337, // Hardhat chain id
      verifyingContract: nftContract.address,
    },
    {
      BatchMintApproval: [
        { name: 'minter', type: 'address' },
        { name: 'tokenCIDHashes', type: 'bytes32[]' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    {
      minter: minter.address,
      tokenCIDHashes,
      nonce,
    }
  );

  return ethers.utils.splitSignature(signature);
};

module.exports = {
  hashAndSign,
  sign,
  createMintApprovalSignature,
  createBatchMintApprovalSignature,
};
