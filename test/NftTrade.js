// const { expect } = require('chai');
// const { ethers, network, upgrades } = require('hardhat');
// const BN = require('bignumber.js');
// const {
//   deployEndemicNFT,
//   deployMarketplaceWithDeps,
//   deployBid,
// } = require('./helpers/deploy');
// const { ERC721_ASSET_CLASS } = require('./helpers/ids');
// const safeTransferWithBytes = require('./helpers/safeTransferWithBytes');

// describe('NftTrade', function () {
//   let marketplace,
//     bid,
//     masterNftContract,
//     nftContract,
//     feeProviderContract,
//     contractRegistryContract,
//     royaltiesProviderContract;

//   let owner, user1, user2, user3, minter, signer;

//   async function mint(id, recipient) {
//     await nftContract
//       .connect(owner)
//       .mint(
//         recipient,
//         'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
//       );
//   }

//   async function deploy(makerFee = 0, takerFee, initialFee = 0) {
//     [owner, user1, user2, user3, minter, signer, ...otherSigners] =
//       await ethers.getSigners();

//     const result = await deployMarketplaceWithDeps(
//       owner,
//       makerFee,
//       takerFee,
//       initialFee
//     );

//     contractRegistryContract = result.contractRegistryContract;
//     masterNftContract = result.masterNftContract;
//     feeProviderContract = result.feeProviderContract;
//     marketplace = result.marketplace;
//     royaltiesProviderContract = result.royaltiesProviderContract;

//     bid = await deployBid(
//       owner,
//       feeProviderContract.address,
//       royaltiesProviderContract.address,
//       masterNftContract.address
//     );

//     nftContract = await deployEndemicNFT(owner);

//     await contractRegistryContract.addSaleContract(marketplace.address);
//     await contractRegistryContract.addSaleContract(bid.address);

//     await mint(1, owner.address);
//   }

//   beforeEach(deploy);

//   it('should be able to accept bid after buying NFT', async () => {
//     // owner set auctions for 1 ETH
//     await nftContract.approve(marketplace.address, 1);
//     await marketplace.createAuction(
//       nftContract.address,
//       1,
//       ethers.utils.parseUnits('1'),
//       ethers.utils.parseUnits('1'),
//       60,
//       1,
//       ERC721_ASSET_CLASS
//     );

//     const auctionId = await marketplace.createAuctionId(
//       nftContract.address,
//       1,
//       owner.address
//     );

//     //user1 bids 0.9 ETH
//     await bid.connect(user1).placeBid(nftContract.address, 1, 1000, {
//       value: ethers.utils.parseUnits('0.9'),
//     });

//     const user1Bid = await bid.getBidByBidder(
//       nftContract.address,
//       1,
//       user1.address
//     );

//     //user2 buys NFT
//     await marketplace.connect(user2).bid(auctionId, 1, {
//       value: ethers.utils.parseUnits('1'),
//     });

//     expect(await nftContract.ownerOf(1)).to.equal(user2.address);

//     //user2 accepts bid from user1
//     await safeTransferWithBytes(
//       nftContract,
//       user2,
//       user2.address,
//       bid.address,
//       1,
//       user1Bid.bidId
//     );
//     expect(await nftContract.ownerOf(1)).to.equal(user1.address);
//   });
// });
