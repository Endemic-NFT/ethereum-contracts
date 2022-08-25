const rinkeby = {
  royaltiesProviderProxy: '0xD26379F5dcb89E257cDB7F5Ce46b98B98Cab6752',
  endemicErc721Factory: '0x8A2619ff673EeA38324Bf03d212d23e50831E182',
  endemicErc721: '0x369dFC49b3540d340FcE60A622FEFdD1a4C6c6F6',
  endemicExchangeProxy: '0x9DaBd7D44BBf227e51eBe3d05E070851edD572cC',
  contractImporter: '0x8350146089b4B4B591439953fF36D22Fc07ebf18',

  endemicERC1155Proxy: '',
  endemicERC1155Beacon: '',
  endemicERC1155Factory: '',

  endemicENDToken: '',
};

const goerli = {
  royaltiesProviderProxy: '0xD0E7364473F0843461F2631306AE248539Dab487',
  endemicErc721Factory: '0xB4550D625035B1D563B6c883B34AE83E0fa71411',
  endemicErc721: '0x247001fBCE8166ECDeD545a1a52E52041838f87C',
  endemicExchangeProxy: '0x2B01B64f11353F55A0500DeEeA9524ab633687E9',
  contractImporter: '0x846Ea711c6809cA9Dbf232d95075bd9222C6bdE6',

  endemicERC1155Proxy: '',
  endemicERC1155Beacon: '',
  endemicERC1155Factory: '',

  endemicENDToken: '0x27f31c8B3D6024C44155De1198dB86F23124b1A4',
};

const aurora_test = {
  royaltiesProviderProxy: '',
  endemicErc721Factory: '0x21aAB5F1458BC5BDaeC902683fd518A647eF52d4',
  endemicErc721: '0x7d05e42A3bacB672dB99D951c34F8012aB847De5',
  endemicExchangeProxy: '',
  contractImporter: '',

  endemicERC1155Proxy: '',
  endemicERC1155Beacon: '',
  endemicERC1155Factory: '',
};

const aurora = {
  endemicENDToken: '0x7916afb40e8d776e9002477d4bad56767711b8e7',
};

const mainnet = {
  endemicENDToken: '0x7f5C4AdeD107F66687E6E55dEe36A3A8FA3de030',
};

const networks = {
  rinkeby,
  aurora_test,
  aurora,
  mainnet,
  goerli,
};

const getForNetwork = (network) => networks[network];

exports.getForNetwork = getForNetwork;
