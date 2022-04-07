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
  endemicVesting: '',
};

const networks = {
  rinkeby,
};

const getForNetwork = (network) => networks[network];

exports.getForNetwork = getForNetwork;
