.PHONY: deployRoyaltiesProvider
deployRoyaltiesProvider:
	npx hardhat run scripts/royalties-provider/deploy-royalties-provider.js --network ${network}

.PHONY: deployErc721Factory
deployErc721Factory:
	npx hardhat run scripts/erc-721/deploy-erc721-factory.js --network ${network}

.PHONY: deployOpenspaceFactory
deployOpenspaceFactory:
	npx hardhat run scripts/erc-721/deploy-openspace-factory.js --network ${network}

.PHONY: deployEndemicErc721
deployEndemicErc721:
	npx hardhat run scripts/erc-721/deploy-erc721.js --network ${network}

.PHONY: deployEndemicExchange
deployEndemicExchange:
	npx hardhat run scripts/exchange/deploy-endemic-exchange.js --network ${network}

.PHONY: deployEndemicToken
deployEndemicToken:
	npx hardhat run scripts/erc-20/deploy-endemic-erc20.js --network ${network}

.PHONY: deployEndemicVesting
deployEndemicVesting:
	npx hardhat run scripts/erc-20/deploy-endemic-vesting.js --network ${network}

.PHONY: deployPaymentManager
deployPaymentManager:
	npx hardhat run scripts/payment-manager/deploy-payment-manager.js --network ${network}

.PHONY: upgradeEndemicExchange
upgradeEndemicExchange:
	npx hardhat run scripts/exchange/upgrade-endemic-exchange-proxy.js --network ${network}

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

.PHONY: deployEndemicTokenPausable
deployEndemicTokenPausable:
	npx hardhat run scripts/erc-20/deploy-endemic-erc20-pausable.js --network ${network}
	
.PHONY: verify
verify:
	npx hardhat verify --network ${network} "${address}"
