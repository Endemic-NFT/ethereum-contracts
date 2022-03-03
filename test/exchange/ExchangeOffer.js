const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const {
  deployEndemicCollectionWithFactory,
  deployEndemicExchangeWithDeps,
} = require('../helpers/deploy');
const { FEE_RECIPIENT } = require('../helpers/constants');

describe('ExchangeOffer', function () {
  let endemicExchange,
    nftContract,
    feeProviderContract,
    royaltiesProviderContract,
    contractRegistryContract;
  let owner, user1, user2, user3, royaltiesRecipient;

  async function mint(recipient) {
    await nftContract
      .connect(owner)
      .mint(
        recipient,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
  }

  async function deploy(makerFee = 300, takerFee = 300, initialFee = 2200) {
    [
      owner,
      user1,
      user2,
      user3,
      minter,
      signer,
      royaltiesRecipient,
      ...otherSigners
    ] = await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps(
      makerFee,
      takerFee,
      initialFee
    );

    contractRegistryContract = result.contractRegistryContract;
    feeProviderContract = result.feeProviderContract;
    royaltiesProviderContract = result.royaltiesProviderContract;
    endemicExchange = result.endemicExchangeContract;

    nftContract = (await deployEndemicCollectionWithFactory()).nftContract;

    await contractRegistryContract.addExchangeContract(endemicExchange.address);

    await mint(user1.address);
    await mint(user1.address);

    await nftContract.connect(user1).approve(endemicExchange.address, 1);
    await nftContract.connect(user1).approve(endemicExchange.address, 2);
  }

  describe('Create offer', () => {
    beforeEach(deploy);

    it('should successfully create a offer', async () => {
      const placeOfferTx = await endemicExchange.placeOffer(
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.515'),
        }
      );

      const activeOffer = await endemicExchange.getOffer(1);

      await expect(placeOfferTx)
        .to.emit(endemicExchange, 'OfferCreated')
        .withArgs(
          1,
          nftContract.address,
          1,
          owner.address,
          activeOffer.price,
          activeOffer.expiresAt
        );

      expect(activeOffer.id).to.equal('1');
      expect(activeOffer.bidder).to.equal(owner.address);
      expect(activeOffer.price).to.equal(ethers.utils.parseUnits('0.5'));
      expect(activeOffer.priceWithFee).to.equal(
        ethers.utils.parseUnits('0.515')
      );
    });

    it('should fail to offer multiple times on same token', async () => {
      await endemicExchange.placeOffer(nftContract.address, 1, 100000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      await expect(
        endemicExchange.placeOffer(nftContract.address, 1, 100000, {
          value: ethers.utils.parseUnits('0.616'),
        })
      ).to.be.revertedWith('OfferExists');

      const activeOffer = await endemicExchange.getOffer(1);
      expect(activeOffer.bidder).to.equal(owner.address);
      expect(activeOffer.price).to.equal(ethers.utils.parseUnits('0.5'));
      expect(activeOffer.priceWithFee).to.equal(
        ethers.utils.parseUnits('0.515')
      );
    });

    it('should fail to create offer with no eth sent', async () => {
      await expect(
        endemicExchange.placeOffer(nftContract.address, 1, 100000, {
          value: 0,
        })
      ).to.be.revertedWith('InvalidValueSent');
    });

    it('should fail to offer on token owned by bidder', async () => {
      await expect(
        endemicExchange
          .connect(user1)
          .placeOffer(nftContract.address, 1, 100000, {
            value: ethers.utils.parseUnits('0.5'),
          })
      ).to.be.revertedWith('InvalidTokenOwner');
    });

    it('should fail to offer with invalid duration', async () => {
      await expect(
        endemicExchange.placeOffer(nftContract.address, 1, 1, {
          value: ethers.utils.parseUnits('0.5'),
        })
      ).to.be.revertedWith('DurationTooShort');
    });

    it('should successfully create multiple offers on same token', async () => {
      await endemicExchange.placeOffer(nftContract.address, 1, 100000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      await endemicExchange
        .connect(user2)
        .placeOffer(nftContract.address, 1, 100000, {
          value: ethers.utils.parseUnits('0.616'),
        });

      await endemicExchange
        .connect(user3)
        .placeOffer(nftContract.address, 1, 100000, {
          value: ethers.utils.parseUnits('0.717'),
        });

      const activeOffer1 = await endemicExchange.getOffer(1);
      expect(activeOffer1.bidder).to.equal(owner.address);

      const activeOffer2 = await endemicExchange.getOffer(2);
      expect(activeOffer2.bidder).to.equal(user2.address);

      const activeOffer3 = await endemicExchange.getOffer(3);
      expect(activeOffer3.bidder).to.equal(user3.address);
    });
  });

  describe('Cancel offer', () => {
    beforeEach(deploy);

    it('should be able to cancel offer', async () => {
      await endemicExchange.placeOffer(nftContract.address, 1, 100000, {
        value: ethers.utils.parseUnits('0.5'),
      });

      const activeOffer = await endemicExchange.getOffer(1);
      const ownerBalance1 = await owner.getBalance();

      const cancelTx = await endemicExchange.cancelOffer(1);
      await expect(cancelTx)
        .to.emit(endemicExchange, 'OfferCancelled')
        .withArgs(activeOffer.id, nftContract.address, 1, owner.address);

      const ownerBalance2 = await owner.getBalance();
      expect(ownerBalance2.sub(ownerBalance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.5'),
        ethers.utils.parseUnits('0.001') //gas fees
      );

      await expect(endemicExchange.getOffer(1)).to.be.revertedWith(
        'NoActiveOffer'
      );
    });

    it('should not be able to cancel other offers', async () => {
      await endemicExchange.placeOffer(nftContract.address, 1, 100000, {
        value: ethers.utils.parseUnits('0.5'),
      });

      await endemicExchange
        .connect(user2)
        .placeOffer(nftContract.address, 1, 100000, {
          value: ethers.utils.parseUnits('0.3'),
        });

      const ownerBalance1 = await owner.getBalance();

      await endemicExchange.cancelOffer(1);

      const ownerBalance2 = await owner.getBalance();
      expect(ownerBalance2.sub(ownerBalance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.5'),
        ethers.utils.parseUnits('0.001') //gas fees
      );

      await expect(endemicExchange.getOffer(1)).to.be.revertedWith(
        'NoActiveOffer'
      );

      const activeOffer = await endemicExchange.getOffer(2);
      expect(activeOffer.bidder).to.equal(user2.address);
    });

    it('should remove expired offer', async () => {
      await endemicExchange.placeOffer(nftContract.address, 1, 100000, {
        value: ethers.utils.parseUnits('0.5'),
      });

      await endemicExchange
        .connect(user2)
        .placeOffer(nftContract.address, 2, 100000, {
          value: ethers.utils.parseUnits('0.5'),
        });

      await endemicExchange
        .connect(user2)
        .placeOffer(nftContract.address, 1, 300000, {
          value: ethers.utils.parseUnits('0.4'),
        });

      await network.provider.send('evm_increaseTime', [200000]);
      await network.provider.send('evm_mine');

      await endemicExchange.removeExpiredOffers(
        [nftContract.address, nftContract.address],
        [1, 2],
        [owner.address, user2.address]
      );

      await expect(endemicExchange.getOffer(1)).to.be.revertedWith(
        'NoActiveOffer'
      );
      await expect(endemicExchange.getOffer(2)).to.be.revertedWith(
        'NoActiveOffer'
      );

      const offer = await endemicExchange.getOffer(3);
      expect(offer.bidder).to.equal(user2.address);
      expect(offer.priceWithFee).to.equal(ethers.utils.parseUnits('0.4'));
    });

    it('should be able to cancel offer where there are multiple offers on same token', async () => {
      await endemicExchange.placeOffer(nftContract.address, 1, 100000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      await endemicExchange
        .connect(user2)
        .placeOffer(nftContract.address, 1, 100000, {
          value: ethers.utils.parseUnits('0.616'),
        });

      await endemicExchange
        .connect(user3)
        .placeOffer(nftContract.address, 1, 100000, {
          value: ethers.utils.parseUnits('0.717'),
        });

      const activeOffer1 = await endemicExchange.getOffer(1);
      expect(activeOffer1.bidder).to.equal(owner.address);

      const activeOffer2 = await endemicExchange.getOffer(2);
      expect(activeOffer2.bidder).to.equal(user2.address);

      const activeOffer3 = await endemicExchange.getOffer(3);
      expect(activeOffer3.bidder).to.equal(user3.address);

      const cancelTx1 = await endemicExchange.cancelOffer(activeOffer1.id);
      await expect(cancelTx1)
        .to.emit(endemicExchange, 'OfferCancelled')
        .withArgs(activeOffer1.id, nftContract.address, 1, owner.address);

      const cancelTx2 = await endemicExchange
        .connect(user2)
        .cancelOffer(activeOffer2.id);
      await expect(cancelTx2)
        .to.emit(endemicExchange, 'OfferCancelled')
        .withArgs(activeOffer2.id, nftContract.address, 1, user2.address);
    });
  });

  describe('Accept offer', () => {
    beforeEach(async () => {
      await deploy();
      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        royaltiesRecipient.address,
        1000
      );
    });

    it('should be able to accept offer', async () => {
      // sending wants to offer 0.5 eth
      // taker fee is 3% = 0.015 eth
      // user sends 0.515 e th
      // owner of nft sees offer with 0.5 eth
      // maker initial sale fee is 22% = 0.11 eth
      // royalties are 10% 0.05
      // owner will get 0.34 eth
      // total fee is 0.125
      const royaltiesRecipientBalance1 = await royaltiesRecipient.getBalance();
      const feeBalance1 = await nftContract.provider.getBalance(FEE_RECIPIENT);

      await endemicExchange.placeOffer(nftContract.address, 1, 100000000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      const user1Balance1 = await user1.getBalance();

      const offer = await endemicExchange.getOffer(1);

      const acceptOfferTx = await endemicExchange
        .connect(user1)
        .acceptOffer(offer.id);
      await expect(acceptOfferTx)
        .to.emit(endemicExchange, 'OfferAccepted')
        .withArgs(
          offer.id,
          nftContract.address,
          1,
          owner.address,
          user1.address,
          ethers.utils.parseUnits('0.5'),
          ethers.utils.parseUnits('0.125')
        );

      expect(await nftContract.ownerOf(1)).to.equal(owner.address);

      const user1Balance2 = await user1.getBalance();
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.34'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalance2 = await nftContract.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      expect(feeBalance2.sub(feeBalance1).toString()).to.equal(
        ethers.utils.parseUnits('0.125')
      );

      const royaltiesRecipientBalance2 = await royaltiesRecipient.getBalance();
      expect(
        royaltiesRecipientBalance2.sub(royaltiesRecipientBalance1)
      ).to.equal(ethers.utils.parseUnits('0.05'));
    });

    it('should be able to accept offer after purchase', async () => {
      await endemicExchange.placeOffer(nftContract.address, 1, 100000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      await endemicExchange
        .connect(user2)
        .placeOffer(nftContract.address, 1, 100000, {
          value: ethers.utils.parseUnits('0.616'),
        });

      const offer1 = await endemicExchange.getOffer(1);
      const offer2 = await endemicExchange.getOffer(2);

      await endemicExchange.connect(user1).acceptOffer(offer1.id);
      await nftContract.approve(endemicExchange.address, 1);
      const acceptOfferTx = await endemicExchange.acceptOffer(offer2.id);
    });
  });
});
