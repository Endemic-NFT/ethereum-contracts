const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployEndemicMasterNFT } = require('../helpers/deploy');

describe('EndemicMasterNFT', function () {
  let masterNftContract, owner, minter, user;

  beforeEach(async function () {
    [owner, minter, user, ...otherSigners] = await ethers.getSigners();

    masterNftContract = await deployEndemicMasterNFT(owner);
    await masterNftContract.addDistributor(owner.address);
  });

  it('should have correct initial data', async function () {
    const name = await masterNftContract.name();
    expect(name).to.equal('Lost Animals of the World');

    const symbol = await masterNftContract.symbol();
    expect(symbol).to.equal('LAW');

    const ownerAddress = await masterNftContract.owner();
    expect(ownerAddress).to.equal(owner.address);
  });

  describe('Mint NFT', function () {
    it('should fail to mint nft if not owner', async () => {
      await expect(masterNftContract.connect(user).mintNFT(user.address)).to.be
        .reverted;
    });

    it('should mint nft if owner', async () => {
      await masterNftContract.connect(owner).mintNFT(user.address);

      const tokenId = await masterNftContract.tokenOfOwnerByIndex(
        user.address,
        0
      );
      const tokenUri = await masterNftContract.connect(user).tokenURI(tokenId);

      expect(tokenId).to.equal(1);
      expect(tokenUri).to.equal('https://tokenbase.com/master/1');
    });

    it('should mint up to max supply', async () => {
      for (var i = 0; i < 50; i++) {
        await masterNftContract.mintNFT(owner.address);
      }

      for (var i = 0; i < 50; i++) {
        const tokenId = await masterNftContract.tokenOfOwnerByIndex(
          owner.address,
          i
        );
        expect(tokenId).to.equal(i + 1);
      }

      expect(await masterNftContract.totalSupply()).to.eq(50);

      await expect(masterNftContract.mintNFT(owner.address)).to.be.revertedWith(
        'Minted max supply'
      );
    });
  });

  describe('Base token uri', async () => {
    it('should update token uri', async () => {
      await masterNftContract.connect(owner).mintNFT(owner.address);

      const tokenId = await masterNftContract.tokenOfOwnerByIndex(
        owner.address,
        0
      );
      const tokenUri = await masterNftContract.connect(owner).tokenURI(tokenId);
      expect(tokenUri).to.equal('https://tokenbase.com/master/1');

      await masterNftContract
        .connect(owner)
        .setBaseTokenURI('https://new-tokenbase.com/master/');
      const newTokenUri = await masterNftContract
        .connect(owner)
        .tokenURI(tokenId);
      expect(newTokenUri).to.equal('https://new-tokenbase.com/master/1');
    });

    it('should fail to update token uri if not owner', async () => {
      await expect(
        masterNftContract
          .connect(user)
          .setBaseTokenURI('https://new-base-uri.com/')
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Burn', async () => {
    it('should burn token for owner', async () => {
      await masterNftContract.connect(owner).mintNFT(user.address);

      const tokenId = await masterNftContract.tokenOfOwnerByIndex(
        user.address,
        0
      );

      await masterNftContract.connect(user).burn(tokenId);

      await expect(masterNftContract.connect(user).tokenURI(tokenId)).to.be
        .reverted;

      await expect(masterNftContract.tokenOfOwnerByIndex(user.address, 0)).to.be
        .reverted;
    });

    it('should not burn token if not owner', async () => {
      await masterNftContract.connect(owner).mintNFT(user.address);

      const tokenId = await masterNftContract.tokenOfOwnerByIndex(
        user.address,
        0
      );

      await expect(masterNftContract.connect(owner).burn(tokenId)).to.be
        .reverted;
    });
  });

  describe('Shares distribution', async () => {
    it('should distribute shares to all token owners', async () => {
      // Mint 5 master NFT-s.
      let currentBalances = [];

      for (let i = 0; i < 5; i++) {
        await masterNftContract.connect(owner).mintNFT(otherSigners[i].address);

        let balanceOfAccount = await otherSigners[i].getBalance();
        currentBalances.push(balanceOfAccount);
      }

      // Distribute 1 ether
      await masterNftContract.connect(owner).distributeShares({
        value: ethers.utils.parseUnits('1'),
      });

      // Check updated balances
      for (let i = 0; i < 5; i++) {
        let updatedBalance = await otherSigners[i].getBalance();
        expect(updatedBalance.sub(currentBalances[i]).toString()).to.equal(
          ethers.utils.parseUnits((1 / 5).toString())
        );
      }
    });

    it('should fail to distribute shares if distributor is not a caller', async () => {
      await expect(
        masterNftContract.connect(user).distributeShares({
          value: 1000,
        })
      ).to.be.revertedWith('Caller is not the distributor');
    });
  });

  describe('Public Mint', () => {
    it('cant mint if sale is not active', async () => {
      await expect(
        masterNftContract.publicMintNFT({
          value: ethers.utils.parseUnits('1'),
        })
      ).to.be.revertedWith('Sale must be active');
    });

    it('can mint for eth', async () => {
      await masterNftContract.toggleSaleState();

      await masterNftContract.connect(user).publicMintNFT({
        value: ethers.utils.parseUnits('15'),
      });

      const tokenId = await masterNftContract.tokenOfOwnerByIndex(
        user.address,
        0
      );

      expect(tokenId).to.eq('1');
    });

    it('cant mint for invalid value', async () => {
      await masterNftContract.toggleSaleState();

      await expect(
        masterNftContract.connect(user).publicMintNFT({
          value: ethers.utils.parseUnits('14'),
        })
      ).to.be.revertedWith('ETH sent is incorrect');
    });
  });

  describe('Owner functions', () => {
    it('should set sale price', async () => {
      await masterNftContract.setSalePrice(ethers.utils.parseUnits('1'));
      expect(await masterNftContract.price()).to.equal(
        ethers.utils.parseUnits('1')
      );
    });

    it('should set sale price', async () => {
      await masterNftContract.setSalePrice(ethers.utils.parseUnits('1'));
      expect(await masterNftContract.price()).to.equal(
        ethers.utils.parseUnits('1')
      );
    });
  });
});
