// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../royalties/interfaces/IRoyaltiesProvider.sol";

error FeeTransferFailed();
error RoyaltiesTransferFailed();
error FundsTransferFailed();
error InvalidAddress();
error InvalidFees();
error InvalidInterface();
error SellerNotAssetOwner();
error InvalidAssetClass();
error InvalidValueProvided();

abstract contract EndemicExchangeCore {
    bytes4 public constant ERC721_INTERFACE = bytes4(0x80ac58cd);
    bytes4 public constant ERC1155_INTERFACE = bytes4(0xd9b67a26);

    bytes4 public constant ERC721_ASSET_CLASS = bytes4(keccak256("ERC721"));
    bytes4 public constant ERC1155_ASSET_CLASS = bytes4(keccak256("ERC1155"));

    IRoyaltiesProvider public royaltiesProvider;

    mapping(address => bool) internal supportedErc20Addresses;

    address public feeClaimAddress;
    uint256 public makerFee;
    uint256 public takerFee;

    uint256 internal constant MAX_FEE = 10000;
    uint256 internal constant MIN_PRICE = 0.0001 ether;
    address internal constant ZERO_ADDRESS = address(0);

    function _calculateFees(
        address nftContract,
        uint256 tokenId,
        uint256 price
    )
        internal
        view
        returns (
            uint256 makerCut,
            uint256 takerCut,
            address royaltiesRecipient,
            uint256 royaltieFee,
            uint256 totalCut
        )
    {
        takerCut = _calculateCut(takerFee, price);
        makerCut = _calculateCut(makerFee, price);

        (royaltiesRecipient, royaltieFee) = royaltiesProvider
            .calculateRoyaltiesAndGetRecipient(nftContract, tokenId, price);

        totalCut = takerCut + makerCut;
    }

    function _calculateCut(uint256 fee, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        return (amount * fee) / MAX_FEE;
    }

    function _distributeFunds(
        uint256 price,
        uint256 makerCut,
        uint256 totalCut,
        uint256 royaltieFee,
        address royaltiesRecipient,
        address seller,
        address buyer,
        address paymentErc20TokenAddress
    ) internal {
        uint256 sellerProceeds = price - makerCut - royaltieFee;

        if (paymentErc20TokenAddress == ZERO_ADDRESS) {
            _distributeEtherFunds(
                royaltieFee,
                totalCut,
                sellerProceeds,
                royaltiesRecipient,
                seller
            );
        } else {
            _distributeErc20Funds(
                royaltieFee,
                totalCut,
                sellerProceeds,
                royaltiesRecipient,
                seller,
                buyer,
                paymentErc20TokenAddress
            );
        }
    }

    function _distributeEtherFunds(
        uint256 royaltieFee,
        uint256 totalCut,
        uint256 sellerProceeds,
        address royaltiesRecipient,
        address seller
    ) internal {
        if (royaltieFee > 0) {
            _transferEtherRoyalties(royaltiesRecipient, royaltieFee);
        }

        if (totalCut > 0) {
            _transferEtherFees(totalCut);
        }

        _transferEtherFunds(seller, sellerProceeds);
    }

    function _distributeErc20Funds(
        uint256 royaltieFee,
        uint256 totalCut,
        uint256 sellerProceeds,
        address royaltiesRecipient,
        address seller,
        address buyer,
        address paymentErc20TokenAddress
    ) internal {
        IERC20 ERC20PaymentToken = IERC20(paymentErc20TokenAddress);

        if (royaltieFee > 0) {
            _transferErc20Royalties(
                ERC20PaymentToken,
                buyer,
                royaltiesRecipient,
                royaltieFee
            );
        }

        if (totalCut > 0) {
            _transferErc20Fees(ERC20PaymentToken, buyer, totalCut);
        }

        _transferErc20Funds(ERC20PaymentToken, buyer, seller, sellerProceeds);
    }

    function _transferEtherFees(uint256 value) internal {
        (bool success, ) = payable(feeClaimAddress).call{value: value}("");

        if (!success) revert FeeTransferFailed();
    }

    function _transferErc20Fees(
        IERC20 ERC20PaymentToken,
        address sender,
        uint256 value
    ) internal {
        bool success = ERC20PaymentToken.transferFrom(
            sender,
            feeClaimAddress,
            value
        );

        if (!success) revert FeeTransferFailed();
    }

    function _transferEtherRoyalties(
        address royaltiesRecipient,
        uint256 royaltiesCut
    ) internal {
        (bool success, ) = payable(royaltiesRecipient).call{
            value: royaltiesCut
        }("");

        if (!success) revert RoyaltiesTransferFailed();
    }

    function _transferErc20Royalties(
        IERC20 ERC20PaymentToken,
        address royaltiesSender,
        address royaltiesRecipient,
        uint256 royaltiesCut
    ) internal {
        bool success = ERC20PaymentToken.transferFrom(
            royaltiesSender,
            royaltiesRecipient,
            royaltiesCut
        );

        if (!success) revert RoyaltiesTransferFailed();
    }

    function _transferEtherFunds(address recipient, uint256 value) internal {
        (bool success, ) = payable(recipient).call{value: value}("");

        if (!success) revert FundsTransferFailed();
    }

    function _transferErc20Funds(
        IERC20 ERC20PaymentToken,
        address sender,
        address recipient,
        uint256 value
    ) internal {
        bool success = ERC20PaymentToken.transferFrom(sender, recipient, value);

        if (!success) revert FundsTransferFailed();
    }

    function _requireCorrectNftInterface(
        bytes4 _assetClass,
        address _nftContract
    ) internal view {
        if (_assetClass == ERC721_ASSET_CLASS) {
            if (!IERC721(_nftContract).supportsInterface(ERC721_INTERFACE))
                revert InvalidInterface();
        } else if (_assetClass == ERC1155_ASSET_CLASS) {
            if (!IERC1155(_nftContract).supportsInterface(ERC1155_INTERFACE))
                revert InvalidInterface();
        } else {
            revert InvalidAssetClass();
        }
    }

    function _requireTokenOwnership(
        bytes4 assetClass,
        address nftContract,
        uint256 tokenId,
        uint256 amount,
        address seller
    ) internal view {
        if (assetClass == ERC721_ASSET_CLASS) {
            if (IERC721(nftContract).ownerOf(tokenId) != seller)
                revert SellerNotAssetOwner();
        } else if (assetClass == ERC1155_ASSET_CLASS) {
            if (IERC1155(nftContract).balanceOf(seller, tokenId) < amount)
                revert SellerNotAssetOwner();
        } else {
            revert InvalidAssetClass();
        }
    }

    function _requireSupportedErc20Token(address paymentErc20TokenAddress)
        internal
        view
    {
        if (paymentErc20TokenAddress == ZERO_ADDRESS) return;

        require(
            supportedErc20Addresses[paymentErc20TokenAddress],
            "ERC20 Token is not supported for paying on Endemic!"
        );
    }

    function _requireCorrectValueProvided(
        uint256 requiredValue,
        address paymentErc20TokenAddress,
        address buyer
    ) internal view {
        if (paymentErc20TokenAddress == ZERO_ADDRESS) {
            _requireCorrectEtherValueProvided(requiredValue);
        } else {
            _requireCorrectErc20ValueProvided(
                requiredValue,
                paymentErc20TokenAddress,
                buyer
            );
        }
    }

    function _requireCorrectEtherValueProvided(uint256 requiredValue)
        internal
        view
    {
        if (msg.value < requiredValue) {
            revert InvalidValueProvided();
        }
    }

    function _requireCorrectErc20ValueProvided(
        uint256 requiredValue,
        address paymentErc20TokenAddress,
        address buyer
    ) internal view {
        IERC20 ERC20PaymentToken = IERC20(paymentErc20TokenAddress);

        uint256 contractAllowance = ERC20PaymentToken.allowance(
            buyer,
            address(this)
        );

        if (contractAllowance < requiredValue) {
            revert InvalidValueProvided();
        }
    }

    function _updateSupportedErc20Tokens(address _erc20TokenAddressToSupport)
        internal
    {
        if (_erc20TokenAddressToSupport == ZERO_ADDRESS) {
            revert InvalidAddress();
        }

        supportedErc20Addresses[_erc20TokenAddressToSupport] = true;
    }

    function _updateConfiguration(
        address _royaltiesProvider,
        address _feeClaimAddress,
        uint256 _makerFee,
        uint256 _takerFee
    ) internal {
        if (
            _royaltiesProvider == ZERO_ADDRESS ||
            _feeClaimAddress == ZERO_ADDRESS
        ) revert InvalidAddress();

        if (_makerFee >= MAX_FEE || _takerFee >= MAX_FEE) {
            revert InvalidFees();
        }

        royaltiesProvider = IRoyaltiesProvider(_royaltiesProvider);
        feeClaimAddress = _feeClaimAddress;

        makerFee = _makerFee;
        takerFee = _takerFee;
    }

    uint256[1000] private __gap;
}
