const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployInitializedCollection } = require('../helpers/deploy');
const { createMintApprovalSignature } = require('../helpers/sign');

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
      const mintTx = await createApprovalAndMint(
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
          createApprovalAndMint(
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

    it('reverts is minter is not the owner', async function () {
      await expect(
        createApprovalAndMint(
          user,
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          0
        )
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('mints after burn', async function () {
      await createApprovalAndMint(
        owner,
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        0
      );

      await nftContract.burn(1);

      await createApprovalAndMint(
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

  describe('mintAndApprove', () => {
    it('mints and approves operator', async () => {
      const tokenId = 1;

      expect(
        await nftContract.isApprovedForAll(owner.address, operator.address)
      ).to.equal(false);

      const { v, r, s } = await createMintApprovalSignature(
        nftContract,
        mintApprover,
        owner,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        0
      );

      await nftContract.mintAndApprove(
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        operator.address,
        v,
        r,
        s,
        0
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
      await createApprovalAndMint(
        owner,
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        0
      );

      await nftContract.connect(user).burn(1);

      expect(await nftContract.totalSupply()).to.equal('0');
    });

    it('burns multiple tokens', async function () {
      await createApprovalAndMint(
        owner,
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        0
      );

      await createApprovalAndMint(
        owner,
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
        1
      );

      await nftContract.burn(1);
      expect(await nftContract.totalSupply()).to.equal('1');

      await nftContract.burn(2);
      expect(await nftContract.totalSupply()).to.equal('0');
    });

    it('reverts is a caller is not the token owner', async function () {
      await createApprovalAndMint(
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
  });
});
