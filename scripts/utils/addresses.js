const goerli = {
  royaltiesProviderProxy: '0xD0E7364473F0843461F2631306AE248539Dab487',
  endemicErc721Factory: '0xB4550D625035B1D563B6c883B34AE83E0fa71411',
  endemicErc721: '0x8d32913032259E1A5fC26A6Da6bAF74ED942391c',
  endemicExchangeProxy: '0x53431AB725Edf32deF31992c4fd8ba2719c16661',
  contractImporter: '0x846Ea711c6809cA9Dbf232d95075bd9222C6bdE6',
  paymentManagerProxy: '0xb5Dd2930Eb6c2106C55126050829D7390d714FEe',

  endemicERC1155Proxy: '',
  endemicERC1155Beacon: '',
  endemicERC1155Factory: '',

  endemicENDToken: '0x27f31c8B3D6024C44155De1198dB86F23124b1A4',
};

const arbitrum_goerli = {
  royaltiesProviderProxy: '0x03B19c39355fD271A0fF071fAeaEe65F4fe26914',
  endemicErc721Factory: '0x45F3e4c28b68142e7C83c55aA95F3c5281006DB8',
  endemicErc721: '0xFC69e4EFaB6e85D0400bf74873aEc6A5e4b73fbc',
  endemicExchangeProxy: '0xF85Ab30873673dDe16E1d70518cB21814eE8fF9A',
  paymentManagerProxy: '0x4bfe31506DBCbf63ECda7320A060008e81acf8c5',
};

const aurora = {
  royaltiesProviderProxy: '0x4282CAB4548FBB27f1eaBD1b16F5B8c3D128B268',
  endemicErc721Factory: '0x76FA7f90D3900eB95Cfc58AB12c916984AeC50c8',
  endemicErc721: '0x56BD4958781792ace55169a9FbBB6FC7Ce4eF43a',
  endemicExchangeProxy: '0x0c45c5971f751D93F2e4Ae0E7CeB149967b846d2',
  paymentManagerProxy: '0x50929DA8eDEf4077eFBBddDe6B47D5e7A0442063',

  endemicENDToken: '0x7916afb40e8d776e9002477d4bad56767711b8e7',
};

const mainnet = {
  royaltiesProviderProxy: '0x99F8D550094076b63bbBe84D291Bb8a6D34133aB',
  endemicErc721Factory: '0x153963Ce24b27868f944b669a7a25114578feE95',
  endemicErc721: '0x7A0A36B4353EbF5B01130b3A3DBEdCCBb326bee5',
  endemicExchangeProxy: '0xadeddcd5b4F6f9a0631B3a0BC5B069150E558161',
  paymentManagerProxy: '0xD48CC91057118e15fB9841c2138E2ec836AbF438',

  endemicENDToken: '0x7f5C4AdeD107F66687E6E55dEe36A3A8FA3de030',
};

const sepolia = {
  royaltiesProviderProxy: '0x1F709030A998b1756Ab9917E0Ca0E60F29736f94',
  endemicErc721Factory: '0x4b8312305d25330E73b0b5778Fb9193a183C5c22',
  endemicErc721: '0x3B7A2D4bfA13378f275146D7AE05518F42241BcD',
  paymentManagerProxy: '0xBE45e76c9Db68e23148392400452114be019e5EC',
  endemicExchangeProxy: '0x96126E53fb8A595e59c85f25D0535F9D9b646dB0',
};

const mumbai = {
  royaltiesProviderProxy: '0x1F709030A998b1756Ab9917E0Ca0E60F29736f94',
  endemicErc721Factory: '0x8243A166c489B902640991710241eb91cCc78Cc5',
  endemicErc721: '0xc6570BFca2ee551B813eaFb5b17Cf3337d4BB5ef',
  paymentManagerProxy: '0x2bA3BC56f48f2E28F672B86bA75cB6C379293Fe1',
  endemicExchangeProxy: '0x2a48F4d51641693B8d7cd6Ad194c2907eeE5427B',
};

const polygon = {
  royaltiesProviderProxy: '0xaBF9Bd38B968e6ABba30736bb7Ca93270fC023A0',
  endemicErc721Factory: '0x783C73C80c54D05777a8584a8fbEeBE37E3E596F',
  endemicErc721: '0xdFf29d105E841c20d9aDfA2F632a69E8D64c764B',
  endemicExchangeProxy: '0xD028022Be9601538F73C0283e182d8E5db3247f7',
  paymentManagerProxy: '0x0372523354E4aBA4840d2856F77E543384b359bD',
};

const networks = {
  aurora,
  mainnet,
  goerli,
  arbitrum_goerli,
  sepolia,
  mumbai,
  polygon,
};

const getForNetwork = (network) => networks[network];

exports.getForNetwork = getForNetwork;
