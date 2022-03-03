.PHONY: deployContractRegistry
deployContractRegistry:
	npx hardhat run scripts/contract-registry/deploy-contract-registry.js --network ${network}

.PHONY: deployFeeProvider
deployFeeProvider:
	npx hardhat run scripts/fee-provider/deploy-fee-provider.js --network ${network}

.PHONY: deployRoyaltiesProvider
deployRoyaltiesProvider:
	npx hardhat run scripts/royalties-provider/deploy-royalties-provider.js --network ${network}

.PHONY: deployEndemicErc721
deployErc721:
	npx hardhat run scripts/erc-721/deploy-endemic-erc721.js --network ${network}

.PHONY: deployEndemicExchange
deployEndemicExchange:
	npx hardhat run scripts/exchange/deploy-endemic-exchange.js --network ${network}

.PHONY: deployErc721Factory
deployFactory:
	npx hardhat run scripts/erc-721/deploy-erc721-factory.js --network ${network}

.PHONY: deployBid
deployBid:
	npx hardhat run scripts/bid/deploy-bid.js --network ${network}

.PHONY: upgradeEndemicExchange
upgradeEndemicExchange:
	npx hardhat run scripts/exchange/upgrade-endemic-exchange-proxy.js --network ${network}

.PHONY: upgradeFeeProvider
upgradeFeeProvider:
	npx hardhat run scripts/fee-provider/upgrade-fee-provider-proxy.js --network ${network}

.PHONY: deployInitialERC1155
deployInitialERC1155:
	npx hardhat run scripts/erc-1155/deploy-erc1155-initial.js --network ${network}
	
.PHONY: deployERC1155Beacon
deployERC1155Beacon:
	npx hardhat run scripts/erc-1155/deploy-erc1155-beacon.js --network ${network}

.PHONY: deployERC1155Factory
deployERC1155Factory:
	npx hardhat run scripts/erc-1155/deploy-erc1155-factory.js --network ${network}

.PHONY: deployContractImporter
deployContractImporter:
	npx hardhat run scripts/import/deploy-contract-importer.js --network ${network}

.PHONY: verify
verify:
	npx hardhat verify --network ${network} ${address}