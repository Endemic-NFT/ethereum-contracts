const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const {
  deployEndemicMasterNFT,
  deployEndemicNFT,
} = require('../helpers/deploy');

describe('EndemicNFT', function () {
  let lazyNftContract;
  let owner, user, user2, user3;

  beforeEach(async function () {
    [owner, user, user2, user3] = await ethers.getSigners();

    lazyNftContract = await deployEndemicNFT(owner);
  });

  it('should have correct initial data', async function () {
    const name = await lazyNftContract.name();
    expect(name).to.equal('NftLazyTest');

    const symbol = await lazyNftContract.symbol();
    expect(symbol).to.equal('NFTL');

    const ownerAddress = await lazyNftContract.owner();
    expect(ownerAddress).to.equal(owner.address);
  });

  describe('Mint', function () {
    it('should mint an NFT if owner', async function () {
      const tokenId = 1;
      const mintTx = await lazyNftContract
        .connect(owner)
        .mint(
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
        );

      await expect(mintTx)
        .to.emit(lazyNftContract, 'Mint')
        .withArgs(tokenId.toString(), owner.address);

      const nftOwnerAddress = await lazyNftContract.ownerOf(tokenId);
      expect(nftOwnerAddress).to.equal(user.address);

      const tokenUri = await lazyNftContract.tokenURI(tokenId);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
    });

    it('should mint an NFT if default approval', async function () {
      const tokenId = 1;

      await lazyNftContract
        .connect(owner)
        .setDefaultApproval(user.address, true);

      const mintTx = await lazyNftContract
        .connect(user)
        .mint(
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
        );

      await expect(mintTx)
        .to.emit(lazyNftContract, 'Mint')
        .withArgs(tokenId.toString(), owner.address);

      const nftOwnerAddress = await lazyNftContract.ownerOf(tokenId);
      expect(nftOwnerAddress).to.equal(user.address);

      const tokenUri = await lazyNftContract.tokenURI(tokenId);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
    });

    it('should not mint an NFT if not owner', async function () {
      await expect(
        lazyNftContract
          .connect(user)
          .mint(
            user.address,
            'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
          )
      ).to.be.revertedWith('mint caller is not owner nor approved');
    });

    it('should mint an NFT after burn', async function () {
      const tokenId = 1;

      await lazyNftContract
        .connect(owner)
        .setDefaultApproval(user.address, true);

      await lazyNftContract
        .connect(user)
        .mint(
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
        );

      await lazyNftContract.connect(user).burn(1);

      await lazyNftContract
        .connect(user)
        .mint(
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
        );

      const nftOwnerAddress = await lazyNftContract.ownerOf(2);
      expect(nftOwnerAddress).to.equal(user.address);

      const tokenUri = await lazyNftContract.tokenURI(2);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      expect(await lazyNftContract.totalSupply()).to.equal('1');
    });
  });
});
