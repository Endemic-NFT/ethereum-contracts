// const { expect } = require('chai');
// const { ethers, upgrades } = require('hardhat');
// const {
//   deployEndemicMasterNFT,
//   deployEndemicERC1155,
// } = require('../helpers/deploy');

// describe('EndemicERC1155', function () {
//   let nftContract;
//   let owner, user, user2, user3;

//   beforeEach(async function () {
//     [owner, user, user2, user3] = await ethers.getSigners();

//     nftContract = await deployEndemicERC1155(owner);
//   });

//   const createNewToken = async (artist, supply) => {
//     return await nftContract.connect(owner).create({
//       artist,
//       supply,
//       tokenURI: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
//     });
//   };

//   it('should have correct initial data', async function () {
//     const name = await nftContract.name();
//     expect(name).to.equal('Endemic ERC 1155');

//     const symbol = await nftContract.symbol();
//     expect(symbol).to.equal('ENDR');

//     const ownerAddress = await nftContract.owner();
//     expect(ownerAddress).to.equal(owner.address);
//   });

//   describe('Create', () => {
//     it('shoud create new token when owner', async () => {
//       const createTx = await createNewToken(user2.address, 10);

//       await expect(createTx)
//         .to.emit(nftContract, 'Create')
//         .withArgs('1', user2.address, 10);

//       expect(await nftContract.totalSupply(1)).to.equal('10');
//     });

//     it('shoud fail to create if not owner', async () => {
//       await expect(
//         nftContract.connect(user2).create({
//           artist: user2.address,
//           supply: 100,
//           tokenURI:
//             'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
//         })
//       ).to.be.revertedWith('Ownable: caller is not the owner');
//     });

//     it('shoud fail to create with zero supply', async () => {
//       await expect(
//         nftContract.connect(user2).create({
//           artist: user2.address,
//           supply: 0,
//           tokenURI:
//             'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
//         })
//       ).to.be.revertedWith('Ownable: caller is not the owner');
//     });
//   });

//   describe('Mint', function () {
//     beforeEach(async () => {
//       await createNewToken(user2.address, 10);
//     });

//     it('should mint with initial supply if owner', async function () {
//       const mintTx = await nftContract.connect(owner).mint({
//         recipient: user.address,
//         amount: 5,
//         tokenId: 1,
//       });

//       const tokenUri = await nftContract.uri(1);
//       expect(tokenUri).to.equal(
//         'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
//       );

//       expect(
//         (await nftContract.balanceOf(user.address, 1)).toString()
//       ).to.equal('5');
//     });

//     it('should fail to mint an NFT if not owner', async function () {
//       await expect(
//         nftContract.connect(user).mint({
//           recipient: user.address,
//           tokenId: 1,
//           amount: 5,
//         })
//       ).to.be.revertedWith('mint caller is not owner nor approved');
//     });

//     it('shoud fail to mint not existing token', async () => {
//       await expect(
//         nftContract.mint({
//           recipient: user.address,
//           tokenId: 2,
//           amount: 5,
//         })
//       ).to.be.revertedWith('supply incorrect');
//     });
//   });
// });
