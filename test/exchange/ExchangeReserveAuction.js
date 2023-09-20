const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const {
  deployInitializedCollection,
  deployEndemicExchangeWithDeps,
  deployEndemicToken,
} = require('../helpers/deploy');
const { getTypedMessage_reserve } = require('../helpers/eip712');

const { FEE_RECIPIENT, ZERO, ZERO_BYTES32 } = require('../helpers/constants');

const INVALID_PAYMENT_METHOD = 'InvalidPaymentMethod';
const UNSUFFICIENT_CURRENCY_SUPPLIED = 'UnsufficientCurrencySupplied';

describe('ExchangeReserveAuction', function () {
  let endemicExchange,
    endemicToken,
    nftContract,
    royaltiesProviderContract,
    paymentManagerContract;

  let owner,
    user1,
    user2,
    user3,
    feeRecipient,
    mintApprover,
    collectionAdministrator,
    settler;

  const mintToken = async (recipient) => {
    return nftContract.mint(
      recipient,
      'bafybeigdyrzt5sfp7udm7hu76uh7y2anf3efuylqabf3oclgtqy55fbzdi',
      ZERO,
      ZERO_BYTES32,
      ZERO_BYTES32,
      ZERO
    );
  };

  async function deploy(makerFee = 0, takerFee) {
    [
      owner,
      user1,
      user2,
      user3,
      feeRecipient,
      collectionAdministrator,
      mintApprover,
      settler,
    ] = await ethers.getSigners();

    const result = await deployEndemicExchangeWithDeps(
      makerFee,
      takerFee,
      settler.address
    );

    royaltiesProviderContract = result.royaltiesProviderContract;
    endemicExchange = result.endemicExchangeContract;
    paymentManagerContract = result.paymentManagerContract;

    nftContract = await deployInitializedCollection(
      owner,
      collectionAdministrator,
      mintApprover
    );

    await nftContract.connect(collectionAdministrator).toggleMintApproval();

    await mintToken(user1.address);
    await mintToken(user1.address);
  }

  const getReserveAuctionSignature = async (
    signer,
    orderNonce,
    tokenId,
    paymentErc20TokenAddress,
    price,
    isBid
  ) => {
    const typedMessage = getTypedMessage_reserve({
      chainId: network.config.chainId,
      verifierContract: endemicExchange.address,
      orderNonce: orderNonce,
      nftContract: nftContract.address,
      tokenId: tokenId,
      paymentErc20TokenAddress: paymentErc20TokenAddress,
      price: price,
      isBid: isBid,
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

  describe('Finalize reserve auction', function () {
    let sig;

    beforeEach(async function () {
      await deploy();
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );

      const reservePrice = ethers.utils.parseUnits('0.1');

      sig = await getReserveAuctionSignature(
        user1,
        1,
        1,
        endemicToken.address,
        reservePrice,
        false
      );
    });

    it('should be able to finalize reserve auction', async function () {
      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      const { v, r, s } = await getReserveAuctionSignature(
        user2,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.103'),
        true
      );

      await endemicExchange.connect(settler).finalizeReserveAuction(
        {
          signer: user1.address,
          v: sig.v,
          r: sig.r,
          s: sig.s,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.1'),
          isBid: false,
        },
        {
          signer: user2.address,
          v: v,
          r: r,
          s: s,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.103'),
          isBid: true,
        }
      );

      // User1 should receive 100 wei, fee is zero
      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const user1Diff = user1Bal2.sub(user1Bal1);
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.085'));

      // Bidder should own NFT
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user2.address);
    });

    it('should fail to finalize if payment method is not supported', async function () {
      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress:
              '0x000000000000000000000000000000000000beef',
            price: ethers.utils.parseUnits('0.1'),
            isBid: false,
          },
          {
            signer: user2.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress:
              '0x000000000000000000000000000000000000beef',
            price: ethers.utils.parseUnits('0.103'),
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_PAYMENT_METHOD);

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress:
              '0x0000000000000000000000000000000000000000', // ether
            price: ethers.utils.parseUnits('0.1'),
            isBid: false,
          },
          {
            signer: user2.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress:
              '0x0000000000000000000000000000000000000000', // ether
            price: ethers.utils.parseUnits('0.103'),
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, INVALID_PAYMENT_METHOD);
    });

    it('should fail to finalize if auction or bid has wrong configuration', async function () {
      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: true, // wrong
          },
          {
            signer: user2.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'InvalidConfiguration');

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: false,
          },
          {
            signer: user2.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: false, // wrong
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'InvalidConfiguration');
    });

    it('should fail to finalize if auction and bid mismatch', async function () {
      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: '0x000000000000000000000000000000000000beef', // mismatch
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: false,
          },
          {
            signer: user2.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address, // mismatch
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'InvalidConfiguration');

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 2, // mismatch
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: false,
          },
          {
            signer: user2.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1, // mismatch
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'InvalidConfiguration');

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address, // mismatch
            price: 100,
            isBid: false,
          },
          {
            signer: user2.address,
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress:
              '0x000000000000000000000000000000000000beef', // mismatch
            price: 100,
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'InvalidConfiguration');

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address, // mismatch
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: false,
          },
          {
            signer: user1.address, // mismatch
            v: ZERO,
            r: ZERO_BYTES32,
            s: ZERO_BYTES32,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: 100,
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'InvalidConfiguration');
    });

    it('should fail to finalize if signature is invalid', async function () {
      const { v, r, s } = await getReserveAuctionSignature(
        user2,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.103'),
        true
      );

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.09'), // changed price
            isBid: false,
          },
          {
            signer: user2.address,
            v: v,
            r: r,
            s: s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.103'),
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'InvalidSignature');

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.1'),
            isBid: false,
          },
          {
            signer: user2.address,
            v: v,
            r: r,
            s: s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.104'), // changed price
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'InvalidSignature');
    });

    it('should fail to finalize if bid has insufficient value', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.102')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.102'));

      const { v, r, s } = await getReserveAuctionSignature(
        user2,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.102'),
        true
      );

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.1'),
            isBid: false,
          },
          {
            signer: user2.address,
            v: v,
            r: r,
            s: s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.102'),
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(
        endemicExchange,
        UNSUFFICIENT_CURRENCY_SUPPLIED
      );
    });

    it('should fail to finalize if auction is cancelled', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      const { v, r, s } = await getReserveAuctionSignature(
        user2,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.103'),
        true
      );

      await endemicExchange.connect(user1).cancelNonce(1);

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.1'),
            isBid: false,
          },
          {
            signer: user2.address,
            v: v,
            r: r,
            s: s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.103'),
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'NonceUsed');
    });

    it('should fail to finalize if bid is cancelled', async function () {
      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.103')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.103'));

      const { v, r, s } = await getReserveAuctionSignature(
        user2,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.103'),
        true
      );

      await endemicExchange.connect(user2).cancelNonce(1);

      await expect(
        endemicExchange.connect(settler).finalizeReserveAuction(
          {
            signer: user1.address,
            v: sig.v,
            r: sig.r,
            s: sig.s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.1'),
            isBid: false,
          },
          {
            signer: user2.address,
            v: v,
            r: r,
            s: s,
            orderNonce: 1,
            nftContract: nftContract.address,
            tokenId: 1,
            paymentErc20TokenAddress: endemicToken.address,
            price: ethers.utils.parseUnits('0.103'),
            isBid: true,
          }
        )
      ).to.be.revertedWithCustomError(endemicExchange, 'NonceUsed');
    });
  });

  describe('ERC20 fee', function () {
    beforeEach(async function () {
      await deploy(250, 300);
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it('should take cut on sale on reserve auction', async function () {
      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      const { v, r, s } = await getReserveAuctionSignature(
        user1,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.02472'),
        false
      );

      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.206')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.206'));

      const {
        v: v2,
        r: r2,
        s: s2,
      } = await getReserveAuctionSignature(
        user2,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.206'),
        true
      );

      await endemicExchange.connect(settler).finalizeReserveAuction(
        {
          signer: user1.address,
          v: v,
          r: r,
          s: s,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.02472'),
          isBid: false,
        },
        {
          signer: user2.address,
          v: v2,
          r: r2,
          s: s2,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.206'),
          isBid: true,
        }
      );

      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const token2Owner = await nftContract.ownerOf(1);
      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.011')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);

      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.165'));
      expect(token2Owner).to.equal(user2.address);
    });

    it('should take cut on sequential sales on reserve auction', async function () {
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      const { v, r, s } = await getReserveAuctionSignature(
        user1,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.5'),
        false
      );

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('1.03')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('1.03'));

      const {
        v: v2,
        r: r2,
        s: s2,
      } = await getReserveAuctionSignature(
        user2,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('1.03'),
        true
      );

      await endemicExchange.connect(settler).finalizeReserveAuction(
        {
          signer: user1.address,
          v: v,
          r: r,
          s: s,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.5'),
          isBid: false,
        },
        {
          signer: user2.address,
          v: v2,
          r: r2,
          s: s2,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('1.03'),
          isBid: true,
        }
      );

      // Auction again with user 2
      await nftContract.connect(user2).approve(endemicExchange.address, 1);
      const {
        v: v3,
        r: r3,
        s: s3,
      } = await getReserveAuctionSignature(
        user2,
        2,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.1'),
        false
      );

      await endemicToken.transfer(
        user3.address,
        ethers.utils.parseUnits('0.515')
      );

      await endemicToken
        .connect(user3)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.515'));

      const {
        v: v4,
        r: r4,
        s: s4,
      } = await getReserveAuctionSignature(
        user3,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.515'),
        true
      );

      // Grab current balance
      const user2Bal1 = await endemicToken.balanceOf(user2.address);
      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      await endemicExchange.connect(settler).finalizeReserveAuction(
        {
          signer: user2.address,
          v: v3,
          r: r3,
          s: s3,
          orderNonce: 2,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.1'),
          isBid: false,
        },
        {
          signer: user3.address,
          v: v4,
          r: r4,
          s: s4,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.515'),
          isBid: true,
        }
      );

      //Grab updated balances
      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);
      const user2Bal2 = await endemicToken.balanceOf(user2.address);

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);
      const user2Diff = user2Bal2.sub(user2Bal1);

      // Checks if endemicExchange gets 2.5% maker fee + 3% taker fee
      // 2.5% of 0.5 + 0.015 taker fee
      expect(claimEthBalanceDiff).to.equal(ethers.utils.parseUnits('0.0275'));
      expect(user2Diff.toString()).to.equal(ethers.utils.parseUnits('0.4125'));

      // New owner
      const tokenOwner = await nftContract.ownerOf(1);
      expect(tokenOwner).to.equal(user3.address);
    });
  });

  describe('ERC20 Royalties', function () {
    beforeEach(async function () {
      await deploy(250, 300, 2200);
      await nftContract.connect(user1).approve(endemicExchange.address, 1);

      await royaltiesProviderContract.setRoyaltiesForCollection(
        nftContract.address,
        feeRecipient.address,
        1000
      );

      endemicToken = await deployEndemicToken(owner);

      await paymentManagerContract.updateSupportedPaymentMethod(
        endemicToken.address,
        true
      );
    });

    it('should distribute royalties on reserve auction', async () => {
      const { v, r, s } = await getReserveAuctionSignature(
        user1,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.2'),
        false
      );

      // 22% of 0.2 + 3% fee
      // 22% of 0.2 maker fee= 0.044ETH
      // 10% of 0.2 royalties = 0.02ETH
      // 0.2 + 3% taker fee = 0.006
      // fees = 0.05
      // seller gets 0.2 - 22% -10% = 0.136
      // buyer pays 0.2 + 3% = 0.206

      // buys NFT and calculates price diff on contract and user1 wallet

      const claimEthBalance1 = await endemicToken.balanceOf(FEE_RECIPIENT);

      const feeRecipientBalance1 = await endemicToken.balanceOf(
        feeRecipient.address
      );
      const user1Bal1 = await endemicToken.balanceOf(user1.address);

      await endemicToken.transfer(
        user2.address,
        ethers.utils.parseUnits('0.206')
      );

      await endemicToken
        .connect(user2)
        .approve(endemicExchange.address, ethers.utils.parseUnits('0.206'));

      const {
        v: v2,
        r: r2,
        s: s2,
      } = await getReserveAuctionSignature(
        user2,
        1,
        1,
        endemicToken.address,
        ethers.utils.parseUnits('0.206'),
        true
      );

      await endemicExchange.connect(settler).finalizeReserveAuction(
        {
          signer: user1.address,
          v: v,
          r: r,
          s: s,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.2'),
          isBid: false,
        },
        {
          signer: user2.address,
          v: v2,
          r: r2,
          s: s2,
          orderNonce: 1,
          nftContract: nftContract.address,
          tokenId: 1,
          paymentErc20TokenAddress: endemicToken.address,
          price: ethers.utils.parseUnits('0.206'),
          isBid: true,
        }
      );

      const user1Bal2 = await endemicToken.balanceOf(user1.address);
      const feeRecipientBalance2 = await endemicToken.balanceOf(
        feeRecipient.address
      );
      const claimEthBalance2 = await endemicToken.balanceOf(FEE_RECIPIENT);

      const claimEthBalanceDiff = claimEthBalance2.sub(claimEthBalance1);

      // 3% of 0.2 + 3% fee
      expect(claimEthBalanceDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.011')
      );

      const user1Diff = user1Bal2.sub(user1Bal1);
      // 0.2 minus 3% fee minus 10% royalties
      expect(user1Diff.toString()).to.equal(ethers.utils.parseUnits('0.175'));

      const feeRecipientDiff = feeRecipientBalance2.sub(feeRecipientBalance1);
      expect(feeRecipientDiff.toString()).to.equal(
        ethers.utils.parseUnits('0.02')
      );
    });
  });
});
