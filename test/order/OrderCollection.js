const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployInitializedOrderCollection } = require('../helpers/deploy');

describe('OrderCollection', function () {
  let nftContract;
  let administrator, creator, user, royaltiesRecipient, operator;

  beforeEach(async function () {
    [administrator, creator, user, royaltiesRecipient, operator] =
      await ethers.getSigners();

    nftContract = await deployInitializedOrderCollection(
      creator,
      administrator,
      operator
    );
  });

  const mintToken = async (caller, recipient, tokenUri) => {
    return await nftContract.connect(caller).mint(recipient, tokenUri);
  };

  const batchMintTokens = async (caller, recipient, tokenUris) => {
    return nftContract.connect(caller).batchMint(recipient, tokenUris);
  };

  it('deploys with correct initial setup', async function () {
    const name = await nftContract.name();
    expect(name).to.equal('My Collection');

    const symbol = await nftContract.symbol();
    expect(symbol).to.equal('MC');

    const ownerAddress = await nftContract.owner();
    expect(ownerAddress).to.equal(creator.address);

    const baseUri = await nftContract.baseURI();
    expect(baseUri).to.equal('ipfs://');
  });

  describe('mint', function () {
    it('mints if the operator is a caller', async function () {
      const tokenId = 1;
      const mintTx = await mintToken(
        operator,
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await expect(mintTx)
        .to.emit(nftContract, 'Minted')
        .withArgs(
          '1',
          creator.address,
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
            operator,
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

    it('reverts is minter is not the operator', async function () {
      await expect(
        mintToken(
          user,
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          0
        )
      ).to.be.reverted;
    });

    it('mints after burn', async function () {
      await mintToken(
        operator,
        creator.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await nftContract.connect(creator).burn(1);

      await mintToken(
        operator,
        creator.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      const nftOwnerAddress = await nftContract.ownerOf(2);
      expect(nftOwnerAddress).to.equal(creator.address);

      const tokenUri = await nftContract.tokenURI(2);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      expect(await nftContract.totalSupply()).to.equal('1');
    });
  });

  describe('batchMint', () => {
    it('mints if the operator is a caller', async function () {
      const tokenUris = [
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      ];

      const mintTx = await batchMintTokens(operator, user.address, tokenUris);

      await expect(mintTx)
        .to.emit(nftContract, 'BatchMinted')
        .withArgs('1', '1', creator.address, tokenUris);

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

      const mintTx = await batchMintTokens(operator, user.address, tokenUris);

      await expect(mintTx)
        .to.emit(nftContract, 'BatchMinted')
        .withArgs('1', '10', creator.address, tokenUris);

      for (let i = 0; i < 10; i++) {
        const nftOwnerAddress = await nftContract.ownerOf(i + 1);
        expect(nftOwnerAddress).to.equal(user.address);

        const tokenUri = await nftContract.tokenURI(i + 1);
        expect(tokenUri).to.equal('ipfs://' + tokenUris[i]);
      }
      expect(await nftContract.totalSupply()).to.equal('10');
    });

    it('reverts if minter is not the operator', async function () {
      const tokenUris = [];
      for (let i = 0; i < 5; i++) {
        tokenUris.push(
          `bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi-${i}`
        );
      }

      await expect(batchMintTokens(user, user.address, tokenUris)).to.be
        .reverted;
    });
  });

  describe('updateMintOperator', () => {
    it('updates mint operator', async () => {
      await nftContract.connect(administrator).updateMintOperator(user.address);
      await mintToken(
        user,
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
      expect(await nftContract.ownerOf(1)).to.equal(user.address);
    });

    it('reverts if caller is not the owner', async () => {
      await expect(nftContract.connect(user).updateMintOperator(user.address))
        .to.be.reverted;
    });

    it('reverts if operator is the zero address', async () => {
      await expect(
        nftContract
          .connect(administrator)
          .updateMintOperator(ethers.constants.AddressZero)
      ).to.be.reverted;
    });
  });

  describe('burn', function () {
    it('burns if the token owner is caller', async function () {
      await mintToken(
        operator,
        user.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await nftContract.connect(user).burn(1);

      expect(await nftContract.totalSupply()).to.equal('0');
    });

    it('burns multiple tokens', async function () {
      await mintToken(
        operator,
        operator.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await mintToken(
        operator,
        operator.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await nftContract.connect(operator).burn(1);
      expect(await nftContract.totalSupply()).to.equal('1');

      await nftContract.connect(operator).burn(2);
      expect(await nftContract.totalSupply()).to.equal('0');
    });

    it('reverts is a caller is not the token owner', async function () {
      await mintToken(
        operator,
        operator.address,
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
      await nftContract
        .connect(creator)
        .setRoyalties(royaltiesRecipient.address, 500);
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
        nftContract
          .connect(creator)
          .setRoyalties(royaltiesRecipient.address, 10001)
      ).to.be.revertedWithCustomError(nftContract, 'RoyaltiesTooHigh');
    });
  });

  describe('royaltyInfo', () => {
    it('calculates royalties correctly', async () => {
      await nftContract
        .connect(creator)
        .setRoyalties(royaltiesRecipient.address, 1000);
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
