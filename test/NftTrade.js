const { expect } = require('chai');
const { ethers } = require('hardhat');
const { ZERO_ADDRESS } = require('./helpers/constants');
const {
  deployEndemicExchangeWithDeps,
  deployEndemicCollectionWithFactory,
} = require('./helpers/deploy');

describe('NftTrade', function () {
  let endemicExchange, nftContract;
  let owner, user1, user2;

  async function mint(id, recipient) {
    await nftContract
      .connect(owner)
      .mint(
        recipient,
        'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
      );
  }

  async function deploy(makerFee = 0, takerFee = 300) {
    [owner, user1, user2] = await ethers.getSigners();

    nftContract = (await deployEndemicCollectionWithFactory()).nftContract;

    const result = await deployEndemicExchangeWithDeps(makerFee, takerFee);

    endemicExchange = result.endemicExchangeContract;

    await mint(1, owner.address);
  }

  beforeEach(deploy);

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
    await endemicExchange.connect(user2).bidForDutchAuction(auctionId, 1, {
      value: ethers.utils.parseUnits('1.03'),
    });
    expect(await nftContract.ownerOf(1)).to.equal(user2.address);

    //user2 accepts bid from user1
    await nftContract.connect(user2).approve(endemicExchange.address, 1);
    await endemicExchange.connect(user2).acceptNftOffer(1);
    expect(await nftContract.ownerOf(1)).to.equal(user1.address);
  });
});
