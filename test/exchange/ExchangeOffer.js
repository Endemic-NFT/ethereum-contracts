/* eslint-disable no-unexpected-multiline */
const { expect } = require('chai');
const { ethers } = require('hardhat');
const {
  deployEndemicCollectionWithFactory,
  deployEndemicExchangeWithDeps,
  deployEndemicToken,
} = require('../helpers/deploy');
const { FEE_RECIPIENT, ZERO_ADDRESS } = require('../helpers/constants');

const INVALID_OFFER_ERROR = 'InvalidOffer';
const INVALID_VALUE_PROVIDED = 'InvalidValueProvided';
const INVALID_TOKEN_OWNER = 'InvalidTokenOwner';

const OFFER_CREATED = 'OfferCreated';
const OFFER_EXISTS = 'OfferExists';
const OFFER_CANCELED = 'OfferCancelled';
const OFFER_ACCEPTED = 'OfferAccepted';

const DURATION_TOO_SHORT = 'DurationTooShort';
const ERC20_TOKEN_NOT_SUPPORTED =
  'ERC20 Token is not supported for paying on Endemic!';

describe('ExchangeOffer', function () {
  let endemicExchange, endemicToken, nftContract, royaltiesProviderContract;

  let owner, user1, user2, user3, royaltiesRecipient;

  async function mint(recipient) {
    await nftContract
      .connect(owner)
      .mint(
        recipient,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
  }

  async function deploy(makerFee = 300, takerFee = 300) {
    [owner, user1, user2, user3, royaltiesRecipient] =
      await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps(makerFee, takerFee);

    royaltiesProviderContract = result.royaltiesProviderContract;
    endemicExchange = result.endemicExchangeContract;

    nftContract = (await deployEndemicCollectionWithFactory()).nftContract;

    await mint(user1.address);
    await mint(user1.address);
    await mint(user1.address);
    await mint(user1.address);

    await nftContract.connect(user1).approve(endemicExchange.address, 1);
    await nftContract.connect(user1).approve(endemicExchange.address, 2);
    await nftContract.connect(user1).approve(endemicExchange.address, 3);
    await nftContract.connect(user1).approve(endemicExchange.address, 4);
  }

  describe('Create offer with Ether', () => {
    beforeEach(deploy);

    it('should successfully create a offer', async () => {
      const placeOfferTx = await endemicExchange[
        'placeOffer(address,uint256,uint256)'
      ](nftContract.address, 1, 100000, {
        value: ethers.utils.parseUnits('0.515'),
      });

      const activeOffer = await endemicExchange.getOffer(1);

      await expect(placeOfferTx)
        .to.emit(endemicExchange, OFFER_CREATED)
        .withArgs(
          1,
          nftContract.address,
          1,
          owner.address,
          activeOffer.price,
          activeOffer.expiresAt,
          ZERO_ADDRESS
        );

      expect(activeOffer.id).to.equal('1');
      expect(activeOffer.bidder).to.equal(owner.address);
      expect(activeOffer.price).to.equal(ethers.utils.parseUnits('0.5'));
      expect(activeOffer.priceWithTakerFee).to.equal(
        ethers.utils.parseUnits('0.515')
      );
    });

    it('should fail to offer multiple times on same token', async () => {
      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.515'),
        }
      );

      await expect(
        endemicExchange['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          100000,
          {
            value: ethers.utils.parseUnits('0.616'),
          }
        )
      ).to.be.revertedWith(OFFER_EXISTS);

      const activeOffer = await endemicExchange.getOffer(1);
      expect(activeOffer.bidder).to.equal(owner.address);
      expect(activeOffer.price).to.equal(ethers.utils.parseUnits('0.5'));
      expect(activeOffer.priceWithTakerFee).to.equal(
        ethers.utils.parseUnits('0.515')
      );
    });

    it('should fail to create offer with no eth sent', async () => {
      await expect(
        endemicExchange['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          100000,
          {
            value: 0,
          }
        )
      ).to.be.revertedWith(INVALID_VALUE_PROVIDED);
    });

    it('should fail to offer on token owned by bidder', async () => {
      await expect(
        endemicExchange
          .connect(user1)
          ['placeOffer(address,uint256,uint256)'](
            nftContract.address,
            1,
            100000,
            {
              value: ethers.utils.parseUnits('0.5'),
            }
          )
      ).to.be.revertedWith(INVALID_TOKEN_OWNER);
    });

    it('should fail to offer with invalid duration', async () => {
      await expect(
        endemicExchange['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          1,
          {
            value: ethers.utils.parseUnits('0.5'),
          }
        )
      ).to.be.revertedWith(DURATION_TOO_SHORT);
    });

    it('should successfully create multiple offers on same token', async () => {
      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.515'),
        }
      );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          100000,
          {
            value: ethers.utils.parseUnits('0.616'),
          }
        );

      await endemicExchange
        .connect(user3)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          100000,
          {
            value: ethers.utils.parseUnits('0.717'),
          }
        );

      const activeOffer1 = await endemicExchange.getOffer(1);
      expect(activeOffer1.bidder).to.equal(owner.address);

      const activeOffer2 = await endemicExchange.getOffer(2);
      expect(activeOffer2.bidder).to.equal(user2.address);

      const activeOffer3 = await endemicExchange.getOffer(3);
      expect(activeOffer3.bidder).to.equal(user3.address);
    });
  });

  describe('Create offer with ERC20', () => {
    beforeEach(async function () {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await endemicExchange.updateSupportedErc20Tokens(endemicToken.address);
    });

    it('should successfully create a offer', async () => {
      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      const placeOfferTx = await endemicExchange
        .connect(user3)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.515'),
          3,
          100000
        );

      const activeOffer = await endemicExchange.getOffer(1);

      await expect(placeOfferTx)
        .to.emit(endemicExchange, OFFER_CREATED)
        .withArgs(
          1,
          nftContract.address,
          3,
          user3.address,
          activeOffer.price,
          activeOffer.expiresAt,
          endemicToken.address
        );

      expect(activeOffer.id).to.equal('1');
      expect(activeOffer.bidder).to.equal(user3.address);
      expect(activeOffer.price).to.equal(ethers.utils.parseUnits('0.5'));
      expect(activeOffer.priceWithTakerFee).to.equal(
        ethers.utils.parseUnits('0.515')
      );
    });

    it('should fail to offer multiple times on same token', async () => {
      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('1.131')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      await endemicExchange
        .connect(user3)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.515'),
          1,
          100000
        );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.616'));

      await expect(
        endemicExchange
          .connect(user3)
          ['placeOffer(address,address,uint256,uint256,uint256)'](
            nftContract.address,
            endemicToken.address,
            ethers.utils.parseUnits('0.616'),
            1,
            100000
          )
      ).to.be.revertedWith(OFFER_EXISTS);

      const activeOffer = await endemicExchange.getOffer(1);
      expect(activeOffer.bidder).to.equal(user3.address);
      expect(activeOffer.price).to.equal(ethers.utils.parseUnits('0.5'));
      expect(activeOffer.priceWithTakerFee).to.equal(
        ethers.utils.parseUnits('0.515')
      );
    });

    it('should fail to create offer with no erc20 tokens approved', async () => {
      await expect(
        endemicExchange
          .connect(user2)
          ['placeOffer(address,address,uint256,uint256,uint256)'](
            nftContract.address,
            endemicToken.address,
            ethers.utils.parseUnits('0.515'),
            1,
            100000
          )
      ).to.be.revertedWith(INVALID_VALUE_PROVIDED);
    });

    it('should fail to create offer with no supported erc20 tokens', async () => {
      await expect(
        endemicExchange
          .connect(user2)
          ['placeOffer(address,address,uint256,uint256,uint256)'](
            nftContract.address,
            '0x0000000000000000000000000000000000000001',
            ethers.utils.parseUnits('0.515'),
            1,
            100000
          )
      ).to.be.revertedWith(ERC20_TOKEN_NOT_SUPPORTED);
    });

    it('should fail to offer on token owned by bidder', async () => {
      await endemicToken.transfer(
        user1.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user1)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      await expect(
        endemicExchange
          .connect(user1)
          ['placeOffer(address,address,uint256,uint256,uint256)'](
            nftContract.address,
            endemicToken.address,
            ethers.utils.parseUnits('0.515'),
            1,
            100000
          )
      ).to.be.revertedWith(INVALID_TOKEN_OWNER);
    });

    it('should fail to offer with invalid duration', async () => {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      await expect(
        endemicExchange
          .connect(user2)
          ['placeOffer(address,address,uint256,uint256,uint256)'](
            nftContract.address,
            endemicToken.address,
            ethers.utils.parseUnits('0.515'),
            1,
            1
          )
      ).to.be.revertedWith(DURATION_TOO_SHORT);
    });

    it('should successfully create multiple offers on same token', async () => {
      await mint(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.616')
      );

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.717')
      );

      await endemicToken.approve(
        endemicExchange.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.616'));

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.717'));

      await endemicExchange[
        'placeOffer(address,address,uint256,uint256,uint256)'
      ](
        nftContract.address,
        endemicToken.address,
        ethers.utils.parseUnits('0.515'),
        3,
        100000
      );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.616'),
          3,
          100000
        );

      await endemicExchange
        .connect(user3)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.717'),
          3,
          100000
        );

      const activeOffer1 = await endemicExchange.getOffer(1);
      expect(activeOffer1.bidder).to.equal(owner.address);

      const activeOffer2 = await endemicExchange.getOffer(2);
      expect(activeOffer2.bidder).to.equal(user2.address);

      const activeOffer3 = await endemicExchange.getOffer(3);
      expect(activeOffer3.bidder).to.equal(user3.address);
    });
  });

  describe('Cancel offer with Ether', () => {
    beforeEach(deploy);

    it('should be able to cancel offer', async () => {
      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.5'),
        }
      );

      const activeOffer = await endemicExchange.getOffer(1);
      const ownerBalance1 = await owner.getBalance();

      const cancelTx = await endemicExchange.cancelOffer(1);
      await expect(cancelTx)
        .to.emit(endemicExchange, OFFER_CANCELED)
        .withArgs(activeOffer.id, nftContract.address, 1, owner.address);

      const ownerBalance2 = await owner.getBalance();
      expect(ownerBalance2.sub(ownerBalance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.5'),
        ethers.utils.parseUnits('0.001') //gas fees
      );

      await expect(endemicExchange.getOffer(1)).to.be.revertedWith(
        INVALID_OFFER_ERROR
      );
    });

    it('should not be able to cancel other offers', async () => {
      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.5'),
        }
      );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          100000,
          {
            value: ethers.utils.parseUnits('0.3'),
          }
        );

      await expect(endemicExchange.cancelOffer(2)).to.be.revertedWith(
        INVALID_OFFER_ERROR
      );
    });

    it('should be able to cancel offer where there are multiple offers on same token', async () => {
      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.515'),
        }
      );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          100000,
          {
            value: ethers.utils.parseUnits('0.616'),
          }
        );

      await endemicExchange
        .connect(user3)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          100000,
          {
            value: ethers.utils.parseUnits('0.717'),
          }
        );

      const activeOffer1 = await endemicExchange.getOffer(1);
      expect(activeOffer1.bidder).to.equal(owner.address);

      const activeOffer2 = await endemicExchange.getOffer(2);
      expect(activeOffer2.bidder).to.equal(user2.address);

      const activeOffer3 = await endemicExchange.getOffer(3);
      expect(activeOffer3.bidder).to.equal(user3.address);

      const cancelTx1 = await endemicExchange.cancelOffer(activeOffer1.id);
      await expect(cancelTx1)
        .to.emit(endemicExchange, OFFER_CANCELED)
        .withArgs(activeOffer1.id, nftContract.address, 1, owner.address);

      const cancelTx2 = await endemicExchange
        .connect(user2)
        .cancelOffer(activeOffer2.id);
      await expect(cancelTx2)
        .to.emit(endemicExchange, OFFER_CANCELED)
        .withArgs(activeOffer2.id, nftContract.address, 1, user2.address);
    });

    it('should cancel offers when contract owner', async () => {
      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.5'),
        }
      );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          2,
          100000,
          {
            value: ethers.utils.parseUnits('0.5'),
          }
        );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          300000,
          {
            value: ethers.utils.parseUnits('0.4'),
          }
        );

      await endemicExchange.adminCancelOffers([1, 2]);

      await expect(endemicExchange.getOffer(1)).to.be.revertedWith(
        INVALID_OFFER_ERROR
      );
      await expect(endemicExchange.getOffer(2)).to.be.revertedWith(
        INVALID_OFFER_ERROR
      );

      const offer = await endemicExchange.getOffer(3);
      expect(offer.bidder).to.equal(user2.address);
      expect(offer.priceWithTakerFee).to.equal(ethers.utils.parseUnits('0.4'));
    });

    it('should not cancel offers when not contract owner', async () => {
      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.5'),
        }
      );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          2,
          100000,
          {
            value: ethers.utils.parseUnits('0.5'),
          }
        );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          300000,
          {
            value: ethers.utils.parseUnits('0.4'),
          }
        );

      await expect(
        endemicExchange.connect(user1).adminCancelOffers([1, 2])
      ).to.be.revertedWith('as');
    });
  });

  describe('Cancel offer with ERC20', () => {
    beforeEach(async function () {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await endemicExchange.updateSupportedErc20Tokens(endemicToken.address);
    });

    it('should be able to cancel offer', async () => {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.5')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.5'));

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.5'),
          4,
          100000
        );

      const activeOffer = await endemicExchange.getOffer(1);
      const user2allowance1 = await endemicToken.allowance(
        user2.address,
        endemicExchange.address
      );

      const cancelTx = await endemicExchange.connect(user2).cancelOffer(1);
      await expect(cancelTx)
        .to.emit(endemicExchange, OFFER_CANCELED)
        .withArgs(activeOffer.id, nftContract.address, 4, user2.address);

      const user2allowance2 = await endemicToken.allowance(
        user2.address,
        endemicExchange.address
      );
      const user2balance = await endemicToken.balanceOf(user2.address);
      expect(user2allowance1.sub(user2allowance2)).to.be.closeTo(
        ethers.utils.parseUnits('0.5'),
        ethers.utils.parseUnits('0.001') //gas fees
      );
      expect(user2balance).to.equal(ethers.utils.parseUnits('0.5'));

      await expect(endemicExchange.getOffer(1)).to.be.revertedWith(
        INVALID_OFFER_ERROR
      );
    });

    it('should not be able to cancel other offers', async () => {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.5')
      );

      await endemicToken.approve(
        endemicExchange.address,
        ethers.utils.parseUnits('0.5')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.5'));

      await endemicExchange[
        'placeOffer(address,address,uint256,uint256,uint256)'
      ](
        nftContract.address,
        endemicToken.address,
        ethers.utils.parseUnits('0.5'),
        4,
        100000
      );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.5'),
          4,
          100000
        );

      await expect(endemicExchange.cancelOffer(2)).to.be.revertedWith(
        INVALID_OFFER_ERROR
      );
    });

    it('should be able to cancel offer where there are multiple offers on same token', async () => {
      await endemicToken.approve(
        endemicExchange.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicExchange[
        'placeOffer(address,address,uint256,uint256,uint256)'
      ](
        nftContract.address,
        endemicToken.address,
        ethers.utils.parseUnits('0.515'),
        4,
        100000
      );

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.616')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.616'));

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.616'),
          4,
          100000
        );

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.717')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.717'));

      await endemicExchange
        .connect(user3)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.717'),
          4,
          100000
        );

      const activeOffer1 = await endemicExchange.getOffer(1);
      expect(activeOffer1.bidder).to.equal(owner.address);

      const activeOffer2 = await endemicExchange.getOffer(2);
      expect(activeOffer2.bidder).to.equal(user2.address);

      const activeOffer3 = await endemicExchange.getOffer(3);
      expect(activeOffer3.bidder).to.equal(user3.address);

      const cancelTx1 = await endemicExchange.cancelOffer(activeOffer1.id);
      await expect(cancelTx1)
        .to.emit(endemicExchange, OFFER_CANCELED)
        .withArgs(activeOffer1.id, nftContract.address, 4, owner.address);

      const cancelTx2 = await endemicExchange
        .connect(user2)
        .cancelOffer(activeOffer2.id);
      await expect(cancelTx2)
        .to.emit(endemicExchange, OFFER_CANCELED)
        .withArgs(activeOffer2.id, nftContract.address, 4, user2.address);
    });

    it('should cancel offers when contract owner', async () => {
      await endemicToken.approve(
        endemicExchange.address,
        ethers.utils.parseUnits('0.5')
      );

      await endemicExchange[
        'placeOffer(address,address,uint256,uint256,uint256)'
      ](
        nftContract.address,
        endemicToken.address,
        ethers.utils.parseUnits('0.5'),
        4,
        100000
      );

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.5')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.5'));

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.5'),
          2,
          100000
        );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.4'),
          1,
          300000
        );

      await endemicExchange.adminCancelOffers([1, 2]);

      await expect(endemicExchange.getOffer(1)).to.be.revertedWith(
        INVALID_OFFER_ERROR
      );
      await expect(endemicExchange.getOffer(2)).to.be.revertedWith(
        INVALID_OFFER_ERROR
      );

      const offer = await endemicExchange.getOffer(3);
      expect(offer.bidder).to.equal(user2.address);
      expect(offer.priceWithTakerFee).to.equal(ethers.utils.parseUnits('0.4'));
    });

    it('should not cancel offers when not contract owner', async () => {
      await endemicToken.approve(
        endemicExchange.address,
        ethers.utils.parseUnits('0.5')
      );

      await endemicExchange[
        'placeOffer(address,address,uint256,uint256,uint256)'
      ](
        nftContract.address,
        endemicToken.address,
        ethers.utils.parseUnits('0.5'),
        1,
        100000
      );

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.9')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.9'));

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.5'),
          2,
          100000
        );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.4'),
          1,
          300000
        );

      await expect(
        endemicExchange.connect(user1).adminCancelOffers([1, 2])
      ).to.be.revertedWith('as');
    });
  });

  describe('Accept offer with Ether', () => {
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
      // user sends 0.515 eth
      // owner of nft sees offer with 0.5 eth
      // maker sale fee is 3% = 0.015 eth
      // royalties are 10% 0.05
      // owner will get 0.435 ETH
      // total fee is 0.030
      const royaltiesRecipientBalance1 = await royaltiesRecipient.getBalance();
      const feeBalance1 = await nftContract.provider.getBalance(FEE_RECIPIENT);

      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000000,
        {
          value: ethers.utils.parseUnits('0.515'),
        }
      );

      const user1Balance1 = await user1.getBalance();

      const offer = await endemicExchange.getOffer(1);

      const acceptOfferTx = await endemicExchange
        .connect(user1)
        .acceptOffer(offer.id);

      await expect(acceptOfferTx)
        .to.emit(endemicExchange, OFFER_ACCEPTED)
        .withArgs(
          offer.id,
          nftContract.address,
          1,
          owner.address,
          user1.address,
          ethers.utils.parseUnits('0.5'),
          ethers.utils.parseUnits('0.030')
        );

      expect(await nftContract.ownerOf(1)).to.equal(owner.address);

      const user1Balance2 = await user1.getBalance();
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.435'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalance2 = await nftContract.provider.getBalance(
        '0x1d1C46273cEcC00F7503AB3E97A40a199bcd6b31'
      );
      expect(feeBalance2.sub(feeBalance1).toString()).to.equal(
        ethers.utils.parseUnits('0.030')
      );

      const royaltiesRecipientBalance2 = await royaltiesRecipient.getBalance();
      expect(
        royaltiesRecipientBalance2.sub(royaltiesRecipientBalance1)
      ).to.equal(ethers.utils.parseUnits('0.05'));
    });

    it('should be able to accept offer after purchase', async () => {
      await endemicExchange['placeOffer(address,uint256,uint256)'](
        nftContract.address,
        1,
        100000,
        {
          value: ethers.utils.parseUnits('0.515'),
        }
      );

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,uint256,uint256)'](
          nftContract.address,
          1,
          100000,
          {
            value: ethers.utils.parseUnits('0.616'),
          }
        );

      const offer1 = await endemicExchange.getOffer(1);
      const offer2 = await endemicExchange.getOffer(2);

      await endemicExchange.connect(user1).acceptOffer(offer1.id);
      await nftContract.approve(endemicExchange.address, 1);
      await endemicExchange.acceptOffer(offer2.id);
    });
  });

  describe('Accept offer with ERC20', () => {
    beforeEach(async () => {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await endemicExchange.updateSupportedErc20Tokens(endemicToken.address);

      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        royaltiesRecipient.address,
        1000
      );
    });

    it('should be able to accept offer', async () => {
      // sending wants to offer 0.5 eth
      // taker fee is 3% = 0.015 eth
      // user sends 0.515 eth
      // owner of nft sees offer with 0.5 eth
      // maker sale fee is 3% = 0.015 eth
      // royalties are 10% 0.05
      // owner will get 0.435 ETH
      // total fee is 0.030
      const royaltiesRecipientBalance1 = await endemicToken.balanceOf(
        royaltiesRecipient.address
      );
      const feeBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      await endemicExchange
        .connect(user3)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.515'),
          4,
          100000000
        );

      const user1Balance1 = await endemicToken.balanceOf(user1.address);

      const offer = await endemicExchange.getOffer(1);

      const acceptOfferTx = await endemicExchange
        .connect(user1)
        .acceptOffer(offer.id);

      await expect(acceptOfferTx)
        .to.emit(endemicExchange, OFFER_ACCEPTED)
        .withArgs(
          offer.id,
          nftContract.address,
          4,
          user3.address,
          user1.address,
          ethers.utils.parseUnits('0.5'),
          ethers.utils.parseUnits('0.030')
        );

      expect(await nftContract.ownerOf(4)).to.equal(user3.address);

      const user1Balance2 = await endemicToken.balanceOf(user1.address);
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.435'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      expect(feeBalance2.sub(feeBalance1).toString()).to.equal(
        ethers.utils.parseUnits('0.030')
      );

      const royaltiesRecipientBalance2 = await endemicToken.balanceOf(
        royaltiesRecipient.address
      );
      expect(
        royaltiesRecipientBalance2.sub(royaltiesRecipientBalance1)
      ).to.equal(ethers.utils.parseUnits('0.05'));
    });

    it('should be able to accept offer after purchase', async () => {
      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      await endemicExchange
        .connect(user3)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.515'),
          4,
          100000
        );

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.616')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.616'));

      await endemicExchange
        .connect(user2)
        ['placeOffer(address,address,uint256,uint256,uint256)'](
          nftContract.address,
          endemicToken.address,
          ethers.utils.parseUnits('0.616'),
          4,
          100000
        );

      const offer1 = await endemicExchange.getOffer(1);
      const offer2 = await endemicExchange.getOffer(2);

      await endemicExchange.connect(user1).acceptOffer(offer1.id);
      await nftContract.connect(user3).approve(endemicExchange.address, 4);
      await endemicExchange.connect(user3).acceptOffer(offer2.id);
    });
  });
});
