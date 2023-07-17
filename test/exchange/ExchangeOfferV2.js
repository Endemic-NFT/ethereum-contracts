/* eslint-disable no-unexpected-multiline */
const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const {
  deployInitializedCollection,
  deployEndemicExchangeWithDeps,
  deployEndemicToken,
} = require('../helpers/deploy');
const {
  FEE_RECIPIENT,
  ZERO_ADDRESS,
  ZERO,
  ZERO_BYTES32,
} = require('../helpers/constants');

const { getTypedMessage_offer } = require('../helpers/eip712');

const INVALID_OFFER_ERROR = 'InvalidOffer';

const OFFER_ACCEPTED = 'OfferAccepted';

describe('ExchangeOfferV2', function () {
  let endemicExchange,
    endemicToken,
    nftContract,
    royaltiesProviderContract,
    paymentManagerContract;

  let owner,
    user1,
    user2,
    user3,
    royaltiesRecipient,
    collectionAdministrator,
    mintApprover;

  const getOfferSignature = async (
    signer,
    tokenId,
    price,
    expiresAt,
    isForCollection
  ) => {
    const typedMessage = getTypedMessage_offer({
      chainId: network.config.chainId,
      verifierContract: endemicExchange.address,
      nftContract: nftContract.address,
      tokenId: tokenId,
      paymentErc20TokenAddress: endemicToken.address,
      price: price,
      expiresAt: expiresAt,
      isForCollection: isForCollection,
    });

    const signature = await signer._signTypedData(
      typedMessage.domain,
      typedMessage.types,
      typedMessage.values
    );

    const sig = signature.substring(2);
    const r = '0x' + sig.substring(0, 64);
    const s = '0x' + sig.substring(64, 128);
    const v = parseInt(sig.substring(128, 130), 16);

    return { v, r, s };
  };

  const mintToken = async (recipient) => {
    return nftContract.mint(
      recipient,
      'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      ZERO,
      ZERO_BYTES32,
      ZERO_BYTES32,
      ZERO
    );
  };

  async function deploy(makerFee = 300, takerFee = 300) {
    [
      owner,
      user1,
      user2,
      user3,
      royaltiesRecipient,
      collectionAdministrator,
      mintApprover,
    ] = await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps(makerFee, takerFee);

    royaltiesProviderContract = result.royaltiesProviderContract;
    endemicExchange = result.endemicExchangeContract;
    paymentManagerContract = result.paymentManagerContract;

    nftContract = await deployInitializedCollection(
      owner,
      collectionAdministrator,
      mintApprover
    );

    await mintToken(user1.address);
    await mintToken(user1.address);
    await mintToken(user1.address);
    await mintToken(user1.address);

    await nftContract.connect(user1).approve(endemicExchange.address, 1);
    await nftContract.connect(user1).approve(endemicExchange.address, 2);
    await nftContract.connect(user1).approve(endemicExchange.address, 3);
    await nftContract.connect(user1).approve(endemicExchange.address, 4);
  }

  describe('Accept NFT offer', () => {
    beforeEach(async () => {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );

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

      const { v, r, s } = await getOfferSignature(
        user3,
        4,
        ethers.utils.parseUnits('0.515'),
        2000994705,
        false
      );

      const user1Balance1 = await endemicToken.balanceOf(user1.address);

      const acceptOfferTx = await endemicExchange
        .connect(user1)
        .acceptNftOffer(v, r, s, {
          bidder: user3.address,
          nftContract: nftContract.address,
          tokenId: 4,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.515'),
          expiresAt: 2000994705,
          isForCollection: false,
        });

      await expect(acceptOfferTx)
        .to.emit(endemicExchange, OFFER_ACCEPTED)
        .withArgs(
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

    it('should be able to accept offer with different fees for specific ERC20', async () => {
      await paymentManagerContract.updatePaymentMethodFees(
        endemicToken.address,
        500,
        500
      );

      // sending wants to offer 0.5 eth
      // taker fee is 5% = 0.025 eth
      // user sends 0.525 eth
      // owner of nft sees offer with 0.5 eth
      // maker sale fee is 5% = 0.025 eth
      // royalties are 10% 0.05
      // owner will get 0.425 ETH
      // total fee is 0.05
      const royaltiesRecipientBalance1 = await endemicToken.balanceOf(
        royaltiesRecipient.address
      );
      const feeBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.525')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.525'));

      const { v, r, s } = await getOfferSignature(
        user3,
        4,
        ethers.utils.parseUnits('0.525'),
        2000994705,
        false
      );

      const user1Balance1 = await endemicToken.balanceOf(user1.address);

      const acceptOfferTx = await endemicExchange
        .connect(user1)
        .acceptNftOffer(v, r, s, {
          bidder: user3.address,
          nftContract: nftContract.address,
          tokenId: 4,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.525'),
          expiresAt: 2000994705,
          isForCollection: false,
        });

      await expect(acceptOfferTx)
        .to.emit(endemicExchange, OFFER_ACCEPTED)
        .withArgs(
          nftContract.address,
          4,
          user3.address,
          user1.address,
          ethers.utils.parseUnits('0.5'),
          ethers.utils.parseUnits('0.05')
        );

      expect(await nftContract.ownerOf(4)).to.equal(user3.address);

      const user1Balance2 = await endemicToken.balanceOf(user1.address);
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.425'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      expect(feeBalance2.sub(feeBalance1).toString()).to.equal(
        ethers.utils.parseUnits('0.05')
      );

      const royaltiesRecipientBalance2 = await endemicToken.balanceOf(
        royaltiesRecipient.address
      );
      expect(
        royaltiesRecipientBalance2.sub(royaltiesRecipientBalance1)
      ).to.equal(ethers.utils.parseUnits('0.05'));
    });

    it('should fail to accept offer that is for collection', async () => {
      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      const { v, r, s } = await getOfferSignature(
        user3,
        1,
        ethers.utils.parseUnits('0.515'),
        2000994705,
        true
      );

      await expect(
        endemicExchange.connect(user1).acceptNftOffer(v, r, s, {
          bidder: user3.address,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.515'),
          expiresAt: 2000994705,
          isForCollection: true,
        })
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_OFFER_ERROR);
    });
  });

  describe('Accept collection offer', () => {
    beforeEach(async () => {
      await deploy();

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );

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

      const { v, r, s } = await getOfferSignature(
        user3,
        0,
        ethers.utils.parseUnits('0.515'),
        2000994705,
        true
      );

      const user1Balance1 = await endemicToken.balanceOf(user1.address);

      const acceptOfferTx = await endemicExchange
        .connect(user1)
        .acceptCollectionOffer(
          v,
          r,
          s,
          {
            bidder: user3.address,
            nftContract: nftContract.address,
            tokenId: 0,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.515'),
            expiresAt: 2000994705,
            isForCollection: true,
          },
          4
        );

      await expect(acceptOfferTx)
        .to.emit(endemicExchange, OFFER_ACCEPTED)
        .withArgs(
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

    it('should be able to accept offer with different fees for specific ERC20', async () => {
      await paymentManagerContract.updatePaymentMethodFees(
        endemicToken.address,
        500,
        500
      );

      // sending wants to offer 0.5 eth
      // taker fee is 5% = 0.025 eth
      // user sends 0.525 eth
      // owner of nft sees offer with 0.5 eth
      // maker sale fee is 5% = 0.025 eth
      // royalties are 10% 0.05
      // owner will get 0.425 ETH
      // total fee is 0.05
      const royaltiesRecipientBalance1 = await endemicToken.balanceOf(
        royaltiesRecipient.address
      );
      const feeBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.525')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.525'));

      const { v, r, s } = await getOfferSignature(
        user3,
        0,
        ethers.utils.parseUnits('0.525'),
        2000994705,
        true
      );

      const user1Balance1 = await endemicToken.balanceOf(user1.address);

      const acceptOfferTx = await endemicExchange
        .connect(user1)
        .acceptCollectionOffer(
          v,
          r,
          s,
          {
            bidder: user3.address,
            nftContract: nftContract.address,
            tokenId: 0,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.525'),
            expiresAt: 2000994705,
            isForCollection: true,
          },
          4
        );

      await expect(acceptOfferTx)
        .to.emit(endemicExchange, OFFER_ACCEPTED)
        .withArgs(
          nftContract.address,
          4,
          user3.address,
          user1.address,
          ethers.utils.parseUnits('0.5'),
          ethers.utils.parseUnits('0.05')
        );

      expect(await nftContract.ownerOf(4)).to.equal(user3.address);

      const user1Balance2 = await endemicToken.balanceOf(user1.address);
      expect(user1Balance2.sub(user1Balance1)).to.be.closeTo(
        ethers.utils.parseUnits('0.425'),
        ethers.utils.parseUnits('0.001') //gas
      );

      const feeBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      expect(feeBalance2.sub(feeBalance1).toString()).to.equal(
        ethers.utils.parseUnits('0.05')
      );

      const royaltiesRecipientBalance2 = await endemicToken.balanceOf(
        royaltiesRecipient.address
      );
      expect(
        royaltiesRecipientBalance2.sub(royaltiesRecipientBalance1)
      ).to.equal(ethers.utils.parseUnits('0.05'));
    });

    it('should fail to accept offer that is for nft', async () => {
      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      const { v, r, s } = await getOfferSignature(
        user3,
        1,
        ethers.utils.parseUnits('0.515'),
        2000994705,
        false
      );

      await expect(
        endemicExchange.connect(user1).acceptCollectionOffer(
          v,
          r,
          s,
          {
            bidder: user3.address,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.515'),
            expiresAt: 2000994705,
            isForCollection: false,
          },
          1
        )
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_OFFER_ERROR);
    });
  });
});
