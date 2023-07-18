const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const { ZERO_ADDRESS, ZERO, ZERO_BYTES32 } = require('./helpers/constants');
const {
  deployEndemicExchangeWithDeps,
  deployInitializedCollection,
  deployEndemicToken,
} = require('./helpers/deploy');
const { getTypedMessage_offer } = require('./helpers/eip712');

describe('NftTrade', function () {
  let endemicExchange, nftContract, endemicToken, paymentManagerContract;
  let owner, user1, user2, collectionAdministrator, mintApprover;

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

  const getOfferSignature = async (signer, tokenId, price, expiresAt) => {
    const typedMessage = getTypedMessage_offer({
      chainId: network.config.chainId,
      verifierContract: endemicExchange.address,
      nftContract: nftContract.address,
      tokenId: tokenId,
      paymentErc20TokenAddress: endemicToken.address,
      price: price,
      expiresAt: expiresAt,
      isForCollection: false,
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

  beforeEach(async () => {
    [owner, user1, user2, collectionAdministrator, mintApprover] =
      await ethers.getSigners();

    endemicToken = await deployEndemicToken(owner);

    nftContract = await deployInitializedCollection(
      owner,
      collectionAdministrator,
      mintApprover
    );

    const result = await deployEndemicExchangeWithDeps(0, 300);

    endemicExchange = result.endemicExchangeContract;
    paymentManagerContract = result.paymentManagerContract;

    await paymentManagerContract.updateSupportedPaymentMethod(
      endemicToken.address,
      true
    );

    await mintToken(owner.address);
  });

  it('should be able to accept bid after buying NFT', async () => {
    await nftContract.approve(endemicExchange.address, 1);
    await endemicExchange.createDutchAuction(
      nftContract.address,
      1,
      ethers.utils.parseUnits('1'),
      ethers.utils.parseUnits('0.5'),
      60,
      ZERO_ADDRESS
    );
    const auctionId = await endemicExchange.createAuctionId(
      nftContract.address,
      1,
      owner.address
    );

    await endemicToken.transfer(user1.address, ethers.utils.parseUnits('0.9'));
    await endemicToken
      .connect(user1)
      .approve(endemicExchange.address, ethers.utils.parseUnits('0.9'));

    //user1 bids 0.9 ETH
    const { v, r, s } = await getOfferSignature(
      user1,
      1,
      ethers.utils.parseUnits('0.9'),
      2000994705
    );

    //user2 buys NFT
    await endemicExchange.connect(user2).bidForDutchAuction(auctionId, {
      value: ethers.utils.parseUnits('1.03'),
    });
    expect(await nftContract.ownerOf(1)).to.equal(user2.address);

    //user2 accepts bid from user1
    await nftContract.connect(user2).approve(endemicExchange.address, 1);
    await endemicExchange.connect(user2).acceptNftOffer(v, r, s, {
      bidder: user1.address,
      nftContract: nftContract.address,
      tokenId: 1,
      paymentErc20TokenAddress: endemicToken.address,
      price: ethers.utils.parseUnits('0.9'),
      expiresAt: 2000994705,
      isForCollection: false,
    });
    expect(await nftContract.ownerOf(1)).to.equal(user1.address);
  });
});
