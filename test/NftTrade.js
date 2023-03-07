const { expect } = require('chai');
const { ethers } = require('hardhat');
const { ZERO_ADDRESS } = require('./helpers/constants');
const {
  deployEndemicExchangeWithDeps,
  deployInitializedCollection,
} = require('./helpers/deploy');
const { createMintApprovalSignature } = require('./helpers/sign');

describe('NftTrade', function () {
  let endemicExchange, nftContract;
  let owner, user1, user2, collectionAdministrator, mintApprover;

  const createApprovalAndMint = async (recipient) => {
    const { v, r, s } = await createMintApprovalSignature(
      nftContract,
      mintApprover,
      owner,
      'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      0
    );
    return nftContract.mint(
      recipient,
      'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
      v,
      r,
      s,
      0
    );
  };

  beforeEach(async () => {
    [owner, user1, user2, collectionAdministrator, mintApprover] =
      await ethers.getSigners();

    nftContract = await deployInitializedCollection(
      owner,
      collectionAdministrator,
      mintApprover
    );

    const result = await deployEndemicExchangeWithDeps(0, 300);

    endemicExchange = result.endemicExchangeContract;

    await createApprovalAndMint(owner.address);
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

    //user1 bids 0.9 ETH
    await endemicExchange
      .connect(user1)
      .placeNftOffer(nftContract.address, 1, 10000, {
        value: ethers.utils.parseUnits('0.9'),
      });

    //user2 buys NFT
    await endemicExchange.connect(user2).bidForDutchAuction(auctionId, {
      value: ethers.utils.parseUnits('1.03'),
    });
    expect(await nftContract.ownerOf(1)).to.equal(user2.address);

    //user2 accepts bid from user1
    await nftContract.connect(user2).approve(endemicExchange.address, 1);
    await endemicExchange.connect(user2).acceptNftOffer(1);
    expect(await nftContract.ownerOf(1)).to.equal(user1.address);
  });
});
