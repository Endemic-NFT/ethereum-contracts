const { getForNetwork } = require('./addresses');
const { ethers, network } = require('hardhat');

async function main() {
  const failedRoyalties = [
    {
      nftContract: '0xa7c4564259eced6ceed91dbb34da06e78894bf8c',
      feeRecipient: '0xf6c7d273c46aa4df19367aaabcaed865a54580e6',
      fee: 2000,
    },
    {
      nftContract: '0xa731ddda8a9dd2587be65738efe6f9aab58ec548',
      feeRecipient: '0xe922b2bf828636c426af635445af3af5563465df',
      fee: 1000,
    },
    {
      nftContract: '0xa5bdac24eb5f91119478efdb93fd58efbc0ec9d3',
      feeRecipient: '0x54f78dc7186a0ad2c09865068b0419557c4305fa',
      fee: 1000,
    },
    {
      nftContract: '0xa3b399a75512b7af6410d24b351653a03405d8f3',
      feeRecipient: '0x180ba180c566541eee4f64a2733e4bd806ca9425',
      fee: 500,
    },
    {
      nftContract: '0x9f37f668312b707c421c42025297600636266387',
      feeRecipient: '0x2c3ef1f3df0bf1409af53f8fc0bafdfe60318e01',
      fee: 1000,
    },
    {
      nftContract: '0x9da76367fd298936d8c6a8c1062698544ef5db43',
      feeRecipient: '0x2d53ed5e19657a94230ecd0fe628442a48fdbdf0',
      fee: 500,
    },
    {
      nftContract: '0x9d1f8c54de67fe54411c7cb6f2549f6c817e13f6',
      feeRecipient: '0x54f78dc7186a0ad2c09865068b0419557c4305fa',
      fee: 1000,
    },
    {
      nftContract: '0x9b5db31f2877fdfcb84dabd46db76774aa747986',
      feeRecipient: '0x7f52acea93905321ce572264fb4293ceb10ad1bc',
      fee: 1000,
    },
    {
      nftContract: '0x9945ea8339bf84e3c9466de067aa00cd95f68eaa',
      feeRecipient: '0x5794e07e402d6855c545a994859b9ff7beb5a61f',
      fee: 1500,
    },
    {
      nftContract: '0x98bdb2686bd3483b072fb522040162f225a46b39',
      feeRecipient: '0x9921dc5f180e9278bfac1e4dc6707e8d9e1e89bd',
      fee: 700,
    },
    {
      nftContract: '0x974265984d3f3fdaeca84a2826e140e393681d0c',
      feeRecipient: '0xd70340a14814c9a279145d4c2f1c3242ef70e530',
      fee: 1000,
    },
    {
      nftContract: '0x95b9673ad6df7d42677fcff3f07be340f8208ac0',
      feeRecipient: '0xb13396d6cadca51f721fd08b23fa45ea530d5e91',
      fee: 1000,
    },
    {
      nftContract: '0x93b9bfb7d66411abf00c008a5c10c1ade1728538',
      feeRecipient: '0x938e202f15af8c8a782588262c3ed0565a7f9411',
      fee: 500,
    },
    {
      nftContract: '0x8efb4dd6b7ffff551cbe6cc9709a88b26a7c8d38',
      feeRecipient: '0x919bed1dabaf22c6b6bc7f5b60daad68bfee6f45',
      fee: 1500,
    },
    {
      nftContract: '0x8e0fca4e8d37f81f0b802cd8cd76eeab4d38d63e',
      feeRecipient: '0x5f3f227a6dac5c01c7decfe36af8640540514ecb',
      fee: 1000,
    },
    {
      nftContract: '0x8d7709c6a1f2322c7b7796e421cff63d804be472',
      feeRecipient: '0xe86ed7d50fbe88f4642135ee4a6016a2ce82302a',
      fee: 500,
    },
    {
      nftContract: '0x8b2e2790e1f92ee18180a022aad5da2b3d6f4943',
      feeRecipient: '0xf4a1e5d80e55b1b199fe39f7f242f5e397cd3789',
      fee: 1000,
    },
    {
      nftContract: '0x89b8c461ac2a433eab1bb1924f75aab54719f65e',
      feeRecipient: '0x5a24a291dec76c62c8b3b099e183c852c8148d8a',
      fee: 1000,
    },
    {
      nftContract: '0x895a50f7894f1db4cce58db8ba8dd9b336a13276',
      feeRecipient: '0xc26bcee9492999b23fbdd41812edb5c861536273',
      fee: 1000,
    },
    {
      nftContract: '0x888e87f2c01debc0e3659d2ce09c54e05cd1b809',
      feeRecipient: '0x853d61d1d47c33cb94eede437d9644486be9151c',
      fee: 500,
    },
    {
      nftContract: '0x885941c6a29aba3e193eabb28423a6ab7b955ef2',
      feeRecipient: '0x36564f5fd15f23217340be510b9ba100ed29a072',
      fee: 1000,
    },
    {
      nftContract: '0x8679939a1467621403d8928d102240485c9ce7e7',
      feeRecipient: '0x919bed1dabaf22c6b6bc7f5b60daad68bfee6f45',
      fee: 1500,
    },
    {
      nftContract: '0x85cdf30b5ecba7bb3133268ce0d21ce7cabaa615',
      feeRecipient: '0xc26bcee9492999b23fbdd41812edb5c861536273',
      fee: 1500,
    },
    {
      nftContract: '0x83201907b1d4d715780c3407b4e957965beac3ae',
      feeRecipient: '0x7f52acea93905321ce572264fb4293ceb10ad1bc',
      fee: 1000,
    },
    {
      nftContract: '0x81b75770fd6354f683bc5e7bf00478058fb6c496',
      feeRecipient: '0xf0d107c2eb730a25a04717610692a321293f0ba3',
      fee: 1000,
    },
    {
      nftContract: '0x811c4083096c6d0e297d4a52dd40b629155f422c',
      feeRecipient: '0x77fa0d3cfe87654753fb758a41e013c0a64ee5c8',
      fee: 1500,
    },
    {
      nftContract: '0x7e904e7d62f9ba13756ea46f147fea1dccc940d2',
      feeRecipient: '0x782763ddf55ab53d32114de2150907fee4a2680c',
      fee: 190,
    },
    {
      nftContract: '0x7d21296e679039b9e90babeb6994708ec1cc64b1',
      feeRecipient: '0xe4784e4c0af675b48d7c2b2dafed8a27686d3682',
      fee: 1500,
    },
    {
      nftContract: '0x7afd89b1ca826f685c48073f0850980d45697fe8',
      feeRecipient: '0x938e202f15af8c8a782588262c3ed0565a7f9411',
      fee: 500,
    },
    {
      nftContract: '0x79cc45410aa983f69c10b6d14ccc903b506dc33c',
      feeRecipient: '0x54b4e4a37808b8d71a07f494ec20cfab80e2827d',
      fee: 500,
    },
    {
      nftContract: '0x7612451838fea23b8d7cf7e59502a70d2f920ec7',
      feeRecipient: '0x568c4f4fe612a250eb52b1f340b7f1678ab4cf44',
      fee: 1000,
    },
    {
      nftContract: '0x7422b498c192565401cf33b162c7860a24932fc6',
      feeRecipient: '0xba7fba1bf085ebf42a7b6bf2875cc319f6f08182',
      fee: 1000,
    },
    {
      nftContract: '0x735e5e94f7864f82e4298668deb2b05c9a2df2e8',
      feeRecipient: '0x7fdce0442dbaef8d858926402767c1c2075dc491',
      fee: 1000,
    },
    {
      nftContract: '0x71547363c07bac77ebd2ada17a8b375cd8272494',
      feeRecipient: '0x1d1c46273cecc00f7503ab3e97a40a199bcd6b31',
      fee: 100,
    },
    {
      nftContract: '0x707ce09b079fe21ab9e40fe7d221c30d7541c914',
      feeRecipient: '0x97ecc5482e8f4f52427e3c38b11f88a335d4217b',
      fee: 1000,
    },
    {
      nftContract: '0x68626b390c9cde50ab0ccb445de796caf3bd82ac',
      feeRecipient: '0x032d3675ab5e14937f12ad0b4ce53da0092a2059',
      fee: 1000,
    },
    {
      nftContract: '0x67bc8269e3ab76b12436e033760c8412e252de72',
      feeRecipient: '0x1d1c46273cecc00f7503ab3e97a40a199bcd6b31',
      fee: 500,
    },
    {
      nftContract: '0x6750d68fd4effd41cd74ef9e52ce0bbcfd39dc12',
      feeRecipient: '0x007aefc84c5e47bcc0f6f1e7028196e18f574398',
      fee: 320,
    },
    {
      nftContract: '0x63def8be1c4a497901a8a976d372c1ef1d2c0a0f',
      feeRecipient: '0xbfdaec78aa6c4e1090a7ee470b72bdf19b9a2ff1',
      fee: 1000,
    },
    {
      nftContract: '0x630299ddc7575e323918d93cb2378e0d62740db7',
      feeRecipient: '0x78ef1de1da85b7610516cfdb8e4848aa29f955ea',
      fee: 1500,
    },
    {
      nftContract: '0x62da6a772379c35609ffecf1802bf3d623921cb7',
      feeRecipient: '0x568c4f4fe612a250eb52b1f340b7f1678ab4cf44',
      fee: 1000,
    },
    {
      nftContract: '0x62350ade5b71b4ac48e7907717f3a3be28ffa647',
      feeRecipient: '0x51f16ac6345d21dfd9d54ee9d36d5acc66225cfe',
      fee: 500,
    },
  ];

  const { royaltiesProviderProxy } = getForNetwork(network.name);

  const RoyaltiesProvider = await ethers.getContractFactory(
    'RoyaltiesProvider'
  );
  const royaltiesProvider = await RoyaltiesProvider.attach(
    royaltiesProviderProxy
  );

  for (let i = 0; i < failedRoyalties.length; i++) {
    await royaltiesProvider.setRoyaltiesForCollection(
      failedRoyalties[i].nftContract,
      failedRoyalties[i].feeRecipient,
      failedRoyalties[i].fee
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
