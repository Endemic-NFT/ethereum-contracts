const axios = require('axios');

const queryGraph = async (query) => {
  const { data } = await axios({
    url: 'https://api.thegraph.com/subgraphs/name/endemic-nft/endemic-aurora',
    method: 'post',
    data: {
      query: query,
    },
  });

  return data.data;
};

const getCollectionsWithRoyalites = async () => {
  const { nftContracts } = await queryGraph(`
  query GetAllRoyalites {
    nftContracts(
      where: { royalties_not: null, royaltiesRecipient_not: null }
    ) {
      id
      royalties
      royaltiesRecipient
    }
  }
  `);

  return nftContracts;
};

const getVerifiedUsers = async () => {
  const { data } = await axios.get(
    'https://api.endemic.app/users/verified-users'
  );

  return data;
};

module.exports = {
  getCollectionsWithRoyalites,
  getVerifiedUsers,
};
