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
  endemicENDToken: '0x7f5C4AdeD107F66687E6E55dEe36A3A8FA3de030',
};

const networks = {
  aurora,
  mainnet,
  goerli,
  arbitrum_goerli,
};

const getForNetwork = (network) => networks[network];

exports.getForNetwork = getForNetwork;
