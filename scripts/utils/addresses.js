const rinkeby = {
  contractRegistryProxy: '0xD317923c94f41f25204680bc708E7Aa252BdF11b',
  endemicMasterKeyProxy: '0xC3Ee5c9Afe9dB7d931d5f695794AD3f1aBFD3602',
  feeProviderProxy: '0x3Ea680817a6A5d38fBC9DD853D1eb96291EB2065',
  royaltiesProviderProxy: '0xEF2f8d2f9330E46f46F8363aa83413BFc4A366Bf',
  endemicNftProxy: '0x7e0CCe9587527b2eDBF505DeC80aeEffF7A6bF62',
  marketplaceProxy: '0x8Bbd06bc00F21B5d4232dB28191272dD6aA1eee6',
  endemicNftBeacon: '0x347D075C2F12CE0A90CdafFB593cE91970DFa431',
  endemicNftFactory: '0x6891e2695c88aB0B9F27ee45C9Dc43Ff35864067',
  bidProxy: '0xFa232d5Eb771b612a6b3ab81456Bb2e32d0f0d00',
  contractImporter: '0x26a033078618206595D9461132736B0F17d96DEf',
  artMinter: '0x559C5a1058f1aD85842459BbeFDe10f909cc4472',
  collectionBidProxy: '0x763461E4aB5Bd214216C2b2F49aaA405125BA700',
  endemicErc20: '',

  endemicERC1155Proxy: '',
  endemicERC1155Beacon: '',
  endemicERC1155Factory: '',
};

const aurora_testnet = {
  contractRegistryProxy: '0x1BE1744a1d718C1E42dA5BD1e79639Ae6DFbEb58',
  endemicMasterKeyProxy: '0x6D27C84EC245A7865718e1CDb7D1aE0EF4B6f08E',
  feeProviderProxy: '0xb00BB669eb0953144caE73cf4049F59B6d358203',
  royaltiesProviderProxy: '0xe34Ec7b3A3aB22B2422a37ad6726E7A76e5C2787',
  endemicNftProxy: '0x599F825A6cBAdA1c8eB972F2ebb6780576d11B96',
  marketplaceProxy: '0x74f43bE6944154CF4da1731E3ad472dFe34E372B',
  endemicNftBeacon: '0xaFf28326DB64f2f02a7788A047E525B047c0A525',
  endemicNftFactory: '0x3Ee89Db55E6dC0Ff1c2E64917bd4f6C8A7A0F9B2',
  bidProxy: '0x247001fBCE8166ECDeD545a1a52E52041838f87C',
  contractImporter: '0x44317C983Ada8176801B40f98650cf1A1c3E4DcC',
  artMinter: '0xa82aF2fb626752171e8BeC3c652fB881EB9297db',
  collectionBidProxy: '0x35eAfaf3A839DEa11Df7f3dbb573E261124f3CE3',
  endemicErc20: '',

  endemicERC1155Proxy: '',
  endemicERC1155Beacon: '',
  endemicERC1155Factory: '',
};

const aurora = {
  contractRegistryProxy: '0xB2d6c6D02f9b6C68c8Aa5fdb455f0feB008D3107',
  endemicMasterKeyProxy: '0x97cb197f862173a0f4c0B9Fda3272b56464578cc',
  feeProviderProxy: '0x3853676279Ada77826afDEdE6a815D5250A1867A',
  royaltiesProviderProxy: '0xE6a3541995E78600A949049C41A1C310634C57cc',
  endemicNftProxy: '0xCd75e540157E04b0a7f1E347d21dED2FF748AD0f',
  endemicNftBeacon: '0xAfAF30cB1215e344088296e058c7694bAeBAe1E9',
  marketplaceProxy: '0x2f6A8241d4F34EA22B9c122bE9DDdFDaaf3121E7',
  endemicNftFactory: '0x6621bDA8656cA6dbE5Fe51D736587eb91C42AE82',
  bidProxy: '',
  contractImporter: '0x427f522121534EB79d40Cbeeb5C62e172c05979d',
  artMinter: '0x6B7340fDd8974b3fa275C51Fb5074f8774dC8d8f',
  collectionBidProxy: '',
  endemicErc20: '',

  endemicERC1155Proxy: '',
  endemicERC1155Beacon: '',
  endemicERC1155Factory: '',
};

const networks = {
  aurora_testnet,
  aurora,
  rinkeby,
};

const getForNetwork = (network) => networks[network];

exports.getForNetwork = getForNetwork;
