// const { expect } = require('chai');
// const { ethers } = require('hardhat');
// const BN = require('bignumber.js');
// const {
//   deployRoyaltiesProvider,
//   deployEndemicERC721WithFactory,
// } = require('./helpers/deploy');

// describe('RoyaltiesProvider', function () {
//   let royaltiesProviderContract, nftContract;
//   let owner, nftContractOwner, user2, feeRecipient;

//   async function deploy() {
//     [owner, nftContractOwner, user2, feeRecipient] = await ethers.getSigners();

//     royaltiesProviderContract = await deployRoyaltiesProvider(nftContractOwner);
//     nftContract = (await deployEndemicERC721WithFactory(nftContractOwner))
//       .nftContract;
//   }

//   describe('Intial state', async () => {
//     beforeEach(deploy);

//     it('should set initial owner', async () => {
//       const contractOwner = await royaltiesProviderContract.owner();
//       expect(contractOwner).to.eq(owner.address);
//     });
//   });

//   describe('Setting royalties for collection', () => {
//     beforeEach(deploy);

//     it('should not be able to royalties fee over the limit', async () => {
//       await expect(
//         royaltiesProviderContract.setRoyaltiesForCollection(
//           nftContract.address,
//           feeRecipient.address,
//           5100
//         )
//       ).to.be.revertedWith('Royalties must be up to 50%');
//     });

//     it('should set for collection if caller is collection owner', async () => {
//       await royaltiesProviderContract
//         .connect(nftContractOwner)
//         .setRoyaltiesForCollection(
//           nftContract.address,
//           feeRecipient.address,
//           1200
//         );

//       [account, fee] = await royaltiesProviderContract.getRoyalties(
//         nftContract.address,
//         1
//       );

//       expect(account).to.equal(feeRecipient.address);
//       expect(fee).to.equal('1200');
//     });

//     it('should set for collection if caller is royalties contract owner', async () => {
//       await royaltiesProviderContract.setRoyaltiesForCollection(
//         nftContract.address,
//         feeRecipient.address,
//         1000
//       );

//       [account, fee] = await royaltiesProviderContract.getRoyalties(
//         nftContract.address,
//         1
//       );

//       expect(account).to.equal(feeRecipient.address);
//       expect(fee).to.equal('1000');
//     });

//     it('should fail to set if caller is not royalties owner or contract owner', async () => {
//       await expect(
//         royaltiesProviderContract
//           .connect(user2)
//           .setRoyaltiesForCollection(
//             nftContract.address,
//             feeRecipient.address,
//             1500
//           )
//       ).to.be.revertedWith('Token owner not found');
//     });
//   });

//   describe('Setting royalties for token', () => {
//     beforeEach(deploy);

//     it('should not be able to set royalties over the limit', async () => {
//       await expect(
//         royaltiesProviderContract.setRoyaltiesForToken(
//           nftContract.address,
//           1,
//           feeRecipient.address,
//           5100
//         )
//       ).to.be.revertedWith('Royalties must be up to 50%');
//     });

//     it('should set for collection if caller is collection owner', async () => {
//       await royaltiesProviderContract
//         .connect(nftContractOwner)
//         .setRoyaltiesForToken(
//           nftContract.address,
//           1,
//           feeRecipient.address,
//           1200
//         );

//       [account, fee] = await royaltiesProviderContract.getRoyalties(
//         nftContract.address,
//         1
//       );

//       expect(account).to.equal(feeRecipient.address);
//       expect(fee).to.equal('1200');
//     });

//     it('should set for collection if caller is royalties contract owner', async () => {
//       await royaltiesProviderContract.setRoyaltiesForToken(
//         nftContract.address,
//         1,
//         feeRecipient.address,
//         1400
//       );

//       [account, fee] = await royaltiesProviderContract.getRoyalties(
//         nftContract.address,
//         1
//       );

//       expect(account).to.equal(feeRecipient.address);
//       expect(fee).to.equal('1400');
//     });

//     it('should fail to set if caller is not royalties owner or contract owner', async () => {
//       await expect(
//         royaltiesProviderContract
//           .connect(user2)
//           .setRoyaltiesForToken(
//             nftContract.address,
//             1,
//             feeRecipient.address,
//             1500
//           )
//       ).to.be.revertedWith('Token owner not found');
//     });
//   });

//   describe('Get royalties', () => {
//     beforeEach(deploy);

//     it('should get correct rolayties for token', async () => {
//       await royaltiesProviderContract.setRoyaltiesForCollection(
//         nftContract.address,
//         feeRecipient.address,
//         1000
//       );

//       await royaltiesProviderContract.setRoyaltiesForToken(
//         nftContract.address,
//         1,
//         feeRecipient.address,
//         1200
//       );

//       // should get token royalty 12%
//       [account, fee] = await royaltiesProviderContract.getRoyalties(
//         nftContract.address,
//         1
//       );

//       expect(account).to.equal(feeRecipient.address);
//       expect(fee).to.equal('1200');

//       // should get collection royalty 10%
//       [account, fee] = await royaltiesProviderContract.getRoyalties(
//         nftContract.address,
//         2
//       );

//       expect(account).to.equal(feeRecipient.address);
//       expect(fee).to.equal('1000');
//     });
//   });
// });
