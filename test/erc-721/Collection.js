const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployInitializedCollection } = require('../helpers/deploy');
const {
  createMintApprovalSignature,
  createBatchMintApprovalSignature,
} = require('../helpers/sign');
const { ZERO, ZERO_BYTES32 } = require('../helpers/constants');

describe('Collection', function () {
  let nftContract;
  let owner, user, mintApprover, administrator, royaltiesRecipient, operator;

  beforeEach(async function () {
    [owner, user, royaltiesRecipient, operator, mintApprover, administrator] =
      await ethers.getSigners();

    nftContract = await deployInitializedCollection(
      owner,
      administrator,
      mintApprover
    );
  });

  const mintToken = async (caller, recipient, tokenUri) => {
    return nftContract
      .connect(caller)
      .mint(recipient, tokenUri, ZERO, ZERO_BYTES32, ZERO_BYTES32, ZERO);
  };

  const batchMintTokens = async (caller, recipient, tokenUris) => {
    return nftContract
      .connect(caller)
      .batchMint(recipient, tokenUris, ZERO, ZERO_BYTES32, ZERO_BYTES32, ZERO);
  };

  const createApprovalAndMint = async (caller, recipient, tokenUri, nonce) => {
    const { v, r, s } = await createMintApprovalSignature(
      nftContract,
      mintApprover,
      owner,
      tokenUri,
      nonce
    );
    return nftContract
      .connect(caller)
      .mint(recipient, tokenUri, v, r, s, nonce);
  };

  const createApprovalAndBatchMint = async (
    caller,
    recipient,
    tokenUris,
    nonce
  ) => {
    const { v, r, s } = await createBatchMintApprovalSignature(
      nftContract,
      mintApprover,
      owner,
      tokenUris,
      nonce
    );
    return nftContract
      .connect(caller)
      .batchMint(recipient, tokenUris, v, r, s, nonce);
  };

  it('deploys with correct initial setup', async function () {
    const name = await nftContract.name();
    expect(name).to.equal('My Collection');

    const symbol = await nftContract.symbol();
    expect(symbol).to.equal('MC');

    const ownerAddress = await nftContract.owner();
    expect(ownerAddress).to.equal(owner.address);

    const baseUri = await nftContract.baseURI();
    expect(baseUri).to.equal('ipfs://');
  });

  describe('mint', function () {
    it('mints if the owner is a caller', async function () {
      const tokenId = 1;
      const mintTx = await mintToken(
        owner,
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        0
      );

      await expect(mintTx)
        .to.emit(nftContract, 'Minted')
        .withArgs(
          '1',
          owner.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
        );

      const nftOwnerAddress = await nftContract.ownerOf(tokenId);
      expect(nftOwnerAddress).to.equal(user.address);

      const tokenUri = await nftContract.tokenURI(tokenId);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
    });

    it('mints multiple tokens', async function () {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          mintToken(
            owner,
            user.address,
            `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi-${i}`,
            i
          )
        );
      }

      await Promise.all(promises);

      for (let i = 0; i < 10; i++) {
        const nftOwnerAddress = await nftContract.ownerOf(i + 1);
        expect(nftOwnerAddress).to.equal(user.address);

        const tokenUri = await nftContract.tokenURI(i + 1);
        expect(tokenUri).to.equal(
          `ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi-${i}`
        );
      }
    });

    it('mints if mint approval is required', async function () {
      await nftContract.connect(administrator).toggleMintApproval();

      const tokenId = 1;
      await createApprovalAndMint(
        owner,
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        0
      );

      const nftOwnerAddress = await nftContract.ownerOf(tokenId);
      expect(nftOwnerAddress).to.equal(user.address);
    });

    it('reverts if mint approval is already used', async function () {
      await nftContract.connect(administrator).toggleMintApproval();

      const nonce = 0;
      await createApprovalAndMint(
        owner,
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        nonce
      );

      await expect(
        createApprovalAndMint(
          owner,
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          nonce
        )
      ).to.be.revertedWithCustomError(nftContract, 'NonceUsed');
    });

    it('reverts is minter is not the owner', async function () {
      await expect(
        mintToken(
          user,
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          0
        )
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('mints after burn', async function () {
      await mintToken(
        owner,
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        0
      );

      await nftContract.burn(1);

      await mintToken(
        owner,
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        1
      );

      const nftOwnerAddress = await nftContract.ownerOf(2);
      expect(nftOwnerAddress).to.equal(owner.address);

      const tokenUri = await nftContract.tokenURI(2);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      expect(await nftContract.totalSupply()).to.equal('1');
    });
  });

  describe('batchMint', () => {
    it('mints if the owner is a caller', async function () {
      const tokenUris = [
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      ];

      const mintTx = await batchMintTokens(owner, user.address, tokenUris);

      await expect(mintTx)
        .to.emit(nftContract, 'BatchMinted')
        .withArgs('1', '1', owner.address, tokenUris);

      expect(await nftContract.ownerOf(1)).to.equal(user.address);
      expect(await nftContract.tokenURI(1)).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
    });

    it('mints multiple tokens', async function () {
      const tokenUris = [];
      for (let i = 0; i < 10; i++) {
        tokenUris.push(
          `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi-${i}`
        );
      }

      const mintTx = await batchMintTokens(owner, user.address, tokenUris);

      await expect(mintTx)
        .to.emit(nftContract, 'BatchMinted')
        .withArgs('1', '10', owner.address, tokenUris);

      for (let i = 0; i < 10; i++) {
        const nftOwnerAddress = await nftContract.ownerOf(i + 1);
        expect(nftOwnerAddress).to.equal(user.address);

        const tokenUri = await nftContract.tokenURI(i + 1);
        expect(tokenUri).to.equal('ipfs://' + tokenUris[i]);
      }
      expect(await nftContract.totalSupply()).to.equal('10');
    });

    it('mints if mint approval is required', async function () {
      await nftContract.connect(administrator).toggleMintApproval();

      const tokenUris = [];
      for (let i = 0; i < 5; i++) {
        tokenUris.push(
          `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi-${i}`
        );
      }

      await createApprovalAndBatchMint(owner, user.address, tokenUris, 0);

      for (let i = 0; i < 5; i++) {
        const nftOwnerAddress = await nftContract.ownerOf(i + 1);
        expect(nftOwnerAddress).to.equal(user.address);
      }
    });

    it('reverts if mint approval is already used', async function () {
      await nftContract.connect(administrator).toggleMintApproval();

      const nonce = 0;
      const tokenUris = [];
      for (let i = 0; i < 5; i++) {
        tokenUris.push(
          `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi-${i}`
        );
      }

      await createApprovalAndBatchMint(owner, user.address, tokenUris, nonce);

      await expect(
        createApprovalAndBatchMint(owner, user.address, tokenUris, nonce)
      ).to.be.revertedWithCustomError(nftContract, 'NonceUsed');
    });

    it('reverts if wrong token URIs are provided', async function () {
      await nftContract.connect(administrator).toggleMintApproval();

      const approvedTokenUris = [
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        'cafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        'dafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      ];

      const { v, r, s } = await createBatchMintApprovalSignature(
        nftContract,
        mintApprover,
        owner,
        approvedTokenUris,
        155
      );

      const unapprovedTokenUris = [
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        'eafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        'dafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      ];

      await expect(
        nftContract.batchMint(user.address, unapprovedTokenUris, v, r, s, 155)
      ).to.be.revertedWithCustomError(nftContract, 'MintNotApproved');
    });

    it('reverts if minter is not the owner', async function () {
      const tokenUris = [];
      for (let i = 0; i < 5; i++) {
        tokenUris.push(
          `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi-${i}`
        );
      }

      await expect(
        batchMintTokens(user, user.address, tokenUris)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('mintAndApprove', () => {
    it('mints and approves operator', async () => {
      const tokenId = 1;

      expect(
        await nftContract.isApprovedForAll(owner.address, operator.address)
      ).to.equal(false);

      await nftContract.mintAndApprove(
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        operator.address,
        ZERO,
        ZERO_BYTES32,
        ZERO_BYTES32,
        ZERO
      );

      const nftOwnerAddress = await nftContract.ownerOf(tokenId);
      expect(nftOwnerAddress).to.equal(user.address);

      const tokenUri = await nftContract.tokenURI(tokenId);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      expect(
        await nftContract.isApprovedForAll(owner.address, operator.address)
      ).to.equal(true);
    });
  });

  describe('burn', function () {
    it('burns if the token owner is caller', async function () {
      await mintToken(
        owner,
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await nftContract.connect(user).burn(1);

      expect(await nftContract.totalSupply()).to.equal('0');
    });

    it('burns multiple tokens', async function () {
      await mintToken(
        owner,
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await mintToken(
        owner,
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await nftContract.burn(1);
      expect(await nftContract.totalSupply()).to.equal('1');

      await nftContract.burn(2);
      expect(await nftContract.totalSupply()).to.equal('0');
    });

    it('reverts is a caller is not the token owner', async function () {
      await mintToken(
        owner,
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        0
      );

      await expect(nftContract.connect(user).burn(1)).to.be.revertedWith(
        'ERC721: caller is not token owner or approved'
      );
    });
  });

  describe('setRoyalties', function () {
    it('sets royalties', async () => {
      await nftContract.setRoyalties(royaltiesRecipient.address, 500);
      expect(await nftContract.royaltiesRecipient()).to.equal(
        royaltiesRecipient.address
      );
      expect(await nftContract.royaltiesAmount()).to.equal('500');
    });

    it('reverts is a caller is not the owner', async () => {
      await expect(
        nftContract.connect(user).setRoyalties(royaltiesRecipient.address, 500)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('respects royalties amount limit', async () => {
      await expect(
        nftContract.setRoyalties(royaltiesRecipient.address, 10001)
      ).to.be.revertedWithCustomError(nftContract, 'RoyaltiesTooHigh');
    });
  });

  describe('royaltyInfo', () => {
    it('calculates royalties correctly', async () => {
      await nftContract.setRoyalties(royaltiesRecipient.address, 1000);
      const royaltyInfo = await nftContract.royaltyInfo(
        1,
        ethers.utils.parseUnits('1')
      );
      expect(royaltyInfo.receiver).to.equal(royaltiesRecipient.address);
      expect(royaltyInfo.royaltyAmount).to.equal(
        ethers.utils.parseUnits('0.1')
      );
    });
  });

  describe('interfaces', () => {
    it('supports ERC2981 interface', async () => {
      const ERC2981InterfaceId = 0x2a55205a;
      expect(await nftContract.supportsInterface(ERC2981InterfaceId)).to.equal(
        true
      );
    });
    it('supports ERC721', async () => {
      expect(await nftContract.supportsInterface('0x80ac58cd')).to.eq(true);
    });
    it('supports ERC165', async () => {
      expect(await nftContract.supportsInterface('0x01ffc9a7')).to.eq(true);
    });
    it('supports ERC721Metadata', async () => {
      expect(await nftContract.supportsInterface('0x5b5e139f')).to.eq(true);
    });
  });
});
