# Endemic Ethereum Contracts
Endemic is a platform connecting established artists and the real-world art with the newly growing NFT market.

Contract addresses are available [here](https://docs.endemic.app/contracts/addresses).

# Setup Accounts

Create local .env file

    cp .env.template .env1

Alchemy

    1. Sign up at https://www.alchemy.com/
    2. Copy API key into the .env file from https://dashboard.alchemyapi.io/

CoinMarketCap

    1. Sign up at https://pro.coinmarketcap.com/account
    2. Copy API key into the .env file from https://pro.coinmarketcap.com/account

Etherscan

    1. Sign up at https://etherscan.io//register
    2. Copy API key into the .env file from https://etherscan.io/myapikey 

Private key

    1. Install MetaMask from
    2. Export Private Key into .env file following the steps outlined here https://metamask.zendesk.com/hc/en-us/articles/360015289632-How-to-Export-an-Account-Private-Key

# Setup Tools

(Ubuntu) Install NodeJS

    https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-20-04

Install Yarn

    https://yarnpkg.com/getting-started/install

Install Hardhat

    https://hardhat.org/getting-started/#installation



# Dev loop

Build

    yarn compile

Test

    yarn test