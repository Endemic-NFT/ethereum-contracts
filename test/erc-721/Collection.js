const { expect } = require('chai');
const { ethers, upgrades } = require('hardhat');
const { deployEndemicCollectionWithFactory } = require('../helpers/deploy');

describe('Collection', function () {
  let nftContract;
  let owner, user, royaltiesRecipient, operator;

  beforeEach(async function () {
    [owner, user, royaltiesRecipient, operator] = await ethers.getSigners();

    const deployResult = await deployEndemicCollectionWithFactory(owner);

    nftContract = deployResult.nftContract;
  });

  it('should have correct initial data', async function () {
    const name = await nftContract.name();
    expect(name).to.equal('Collection Template');

    const symbol = await nftContract.symbol();
    expect(symbol).to.equal('CT');

    const ownerAddress = await nftContract.owner();
    expect(ownerAddress).to.equal(owner.address);

    const baseUri = await nftContract.baseURI();
    expect(baseUri).to.equal('ipfs://');
  });

  describe('Mint', function () {
    it('should mint an NFT if owner', async function () {
      const tokenId = 1;
      const mintTx = await nftContract
        .connect(owner)
        .mint(
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
        );

      await expect(mintTx)
        .to.emit(nftContract, 'Mint')
        .withArgs('1', owner.address);

      const nftOwnerAddress = await nftContract.ownerOf(tokenId);
      expect(nftOwnerAddress).to.equal(user.address);

      const tokenUri = await nftContract.tokenURI(tokenId);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
    });

    it('should not mint an NFT if not owner', async function () {
      await expect(
        nftContract
          .connect(user)
          .mint(
            user.address,
            'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
          )
      ).to.be.revertedWith('CallerNotOwner');
    });

    it('should mint an NFT after burn', async function () {
      await nftContract.mint(
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await nftContract.burn(1);

      await nftContract.mint(
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      const nftOwnerAddress = await nftContract.ownerOf(2);
      expect(nftOwnerAddress).to.equal(owner.address);

      const tokenUri = await nftContract.tokenURI(2);
      expect(tokenUri).to.equal(
        'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      expect(await nftContract.totalSupply()).to.equal('1');
    });

    it('should mint and approve', async () => {
      const tokenId = 1;

      expect(
        await nftContract.isApprovedForAll(owner.address, operator.address)
      ).to.equal(false);

      const mintTx = await nftContract
        .connect(owner)
        .mintAndApprove(
          user.address,
          'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
          operator.address
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

  describe('Burn', function () {
    it('should burn if token owner', async function () {
      await nftContract.mint(
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await nftContract.burn(1);

      expect(await nftContract.totalSupply()).to.equal('0');
    });

    it('should fail to burn if not token owner', async function () {
      await nftContract.mint(
        owner.address,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );

      await expect(nftContract.connect(user).burn(1)).to.be.revertedWith(
        'CallerNotTokenOwner'
      );
    });
  });

  describe('Royalties', function () {
    it('should support ERC2981 interface', async () => {
      const ERC2981InterfaceId = 0x2a55205a;
      expect(await nftContract.supportsInterface(ERC2981InterfaceId)).to.equal(
        true
      );
    });
    it('should be able to set royalties if owner', async () => {
      await nftContract.setRoyalties(royaltiesRecipient.address, 500);
      expect(await nftContract.royaltiesRecipient()).to.equal(
        royaltiesRecipient.address
      );
      expect(await nftContract.royaltiesAmount()).to.equal('500');
    });
    it('should not be able to set royalties if not owner', async () => {
      await expect(
        nftContract.connect(user).setRoyalties(royaltiesRecipient.address, 500)
      ).to.be.revertedWith('CallerNotOwner');
    });
    it('should respect royalties amount limit', async () => {
      await expect(
        nftContract.setRoyalties(royaltiesRecipient.address, 10001)
      ).to.be.revertedWith('RoyaltiesTooHigh');
    });
    it('should calculate royalties correctly', async () => {
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
});
