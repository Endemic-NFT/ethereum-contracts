const rinkeby = {
  contractRegistryProxy: '',
  feeProviderProxy: '',
  royaltiesProviderProxy: '',
  endemicErc721: '',
  endemicErc721Factory: '',
  exchangeProxy: '',
  bidProxy: '',
  contractImporter: '',
  collectionBidProxy: '',

  endemicERC1155Proxy: '',
  endemicERC1155Beacon: '',
  endemicERC1155Factory: '',
};

const networks = {
  rinkeby,
};

const getForNetwork = (network) => networks[network];

exports.getForNetwork = getForNetwork;
