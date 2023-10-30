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
  endemicErc721Factory: '0x1244F3358F25A50b11c0B4EC5a1831116c9cB2f4',
  endemicErc721: '0x6945ae5F31998CC28d8652f54a5d24cDf4377D2d',
  endemicExchangeProxy: '0xC33a562169bC0fB03aBDDD869F2952A608eaf641',
  paymentManagerProxy: '0x054ABdbAB1efb098a0e2aC52BcD6fB3436631dDA',
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
  endemicErc721Factory: '0x6574671af0fAAD94714aD2e99e4eC7d50F22EFF6',
  endemicErc721: '0x727a68e8DE25C75942E1E033b799E493E362802D',
  endemicExchangeProxy: '0xF3891616B1bC96d52f642F2cc8FEB15C6D2a43Da',
  paymentManagerProxy: '0xD48CC91057118e15fB9841c2138E2ec836AbF438',

  endemicENDToken: '0x7f5C4AdeD107F66687E6E55dEe36A3A8FA3de030',
};

const sepolia = {
  royaltiesProviderProxy: '0x1F709030A998b1756Ab9917E0Ca0E60F29736f94',
  endemicErc721Factory: '0xa3899FD9035de8438857c74F78E411e588fFCf39',
  endemicErc721: '0x611eaF72138D36Fe41E85308021f89A1f01F59ae',
  paymentManagerProxy: '0xBE45e76c9Db68e23148392400452114be019e5EC',
  endemicExchangeProxy: '0x389F14Ed3aA0F277a90e7C3ADb0a2CfEC02d62B7',
};

const mumbai = {
  royaltiesProviderProxy: '0x1F709030A998b1756Ab9917E0Ca0E60F29736f94',
  endemicErc721Factory: '0x2255D0C57eF61Eb4f89aC4f8b541c352dFFfc240',
  endemicErc721: '0x6d76e19174CB4dEBa01D82BcA16914935c83f792',
  paymentManagerProxy: '0x2bA3BC56f48f2E28F672B86bA75cB6C379293Fe1',
  endemicExchangeProxy: '0x12394c8C432E14c9D2E25967e1B2125Ba58B8A76',
};

const polygon = {
  royaltiesProviderProxy: '0xaBF9Bd38B968e6ABba30736bb7Ca93270fC023A0',
  endemicErc721Factory: '0x01F7F54678CabC43275271EDbF3b354aCb69E7f7',
  endemicErc721: '0x6d76e19174CB4dEBa01D82BcA16914935c83f792',
  endemicExchangeProxy: '0x5a98342C0E883B9387D070d5f13cFb572D33a936',
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
