const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployEndemic } = require('../helpers/deploy');
const { hashAndSign } = require('../helpers/sign');

describe('Endemic', function () {
  let endemicContract, owner, user, defaultSigner;

  const mintToken = async (signer, minter, tokenId = 1) => {
    let sig = await hashAndSign(
      signer,
      ['address', 'uint256'],
      [endemicContract.address, tokenId]
    );

    const tx = await endemicContract
      .connect(minter)
      .mint(tokenId, sig.v, sig.r, sig.s, 'ais9d8as9d9asd');

    return tx;
  };

  beforeEach(async function () {
    [owner, user, defaultSigner] = await ethers.getSigners();

    endemicContract = await deployEndemic(owner, defaultSigner);
  });

  it('should have correct initial data', async function () {
    const name = await endemicContract.name();
    expect(name).to.equal('Endemic');

    const symbol = await endemicContract.symbol();
    expect(symbol).to.equal('END');

    const ownerAddress = await endemicContract.owner();
    expect(ownerAddress).to.equal(owner.address);
  });

  describe('Mint NFT', function () {
    it('should be able to mint', async () => {
      const mintTx = await mintToken(defaultSigner, user);

      const tokenId = await endemicContract.tokenOfOwnerByIndex(
        user.address,
        0
      );
      const tokenUri = await endemicContract.connect(user).tokenURI(tokenId);

      expect(tokenId).to.equal(1);
      expect(tokenUri).to.equal('ipfs://ais9d8as9d9asd');

      await expect(mintTx)
        .to.emit(endemicContract, 'Mint')
        .withArgs(tokenId.toString(), user.address);
    });

    it('should not be able to mint same token twice', async () => {
      await mintToken(defaultSigner, user);
      await expect(mintToken(defaultSigner, user)).to.be.revertedWith(
        'ERC721: token already minted'
      );
    });

    it('should not be able to mint if signer is not in signer role', async () => {
      await expect(mintToken(user, user)).to.be.revertedWith(
        'Owner should sign tokenId'
      );
    });
  });

  describe('Burn', async () => {
    it('should burn token for owner', async () => {
      await mintToken(defaultSigner, user);
      await endemicContract.connect(user).burn(1);
      await expect(endemicContract.tokenURI(1)).to.be.revertedWith(
        'ERC721URIStorage: URI query for nonexistent token'
      );
    });

    it('should not burn token if not owner', async () => {
      await mintToken(defaultSigner, user);
      await expect(endemicContract.connect(owner).burn(1)).to.be.revertedWith(
        'ERC721Burnable: caller is not owner nor approved'
      );
    });
  });

  describe('Signer', () => {
    it('should add new signer', async () => {
      await endemicContract.addSigner(user.address);
      expect(await endemicContract.isSigner(user.address)).to.equal(true);
    });

    it('should renounce signer', async () => {
      await endemicContract.addSigner(user.address);
      expect(await endemicContract.isSigner(user.address)).to.equal(true);

      await endemicContract.connect(user).renounceSigner();
      expect(await endemicContract.isSigner(user.address)).to.equal(false);
    });
  });
});
