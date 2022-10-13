// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../royalties/interfaces/IRoyaltiesProvider.sol";
import "../../manager/interfaces/IPaymentManager.sol";

error InvalidAddress();
error InvalidInterface();
error SellerNotAssetOwner();
error InvalidAssetClass();
error UnsufficientCurrencySupplied();
error InvalidPaymentMethod();

abstract contract EndemicExchangeCore {
    bytes4 public constant ERC721_INTERFACE = bytes4(0x80ac58cd);
    bytes4 public constant ERC1155_INTERFACE = bytes4(0xd9b67a26);

    bytes4 public constant ERC721_ASSET_CLASS = bytes4(keccak256("ERC721"));
    bytes4 public constant ERC1155_ASSET_CLASS = bytes4(keccak256("ERC1155"));

    IRoyaltiesProvider public royaltiesProvider;
    IPaymentManager public paymentManager;

    uint256 internal constant MAX_FEE = 10000;
    uint256 internal constant MIN_PRICE = 0.0001 ether;
    address internal constant ZERO_ADDRESS = address(0);

    modifier onlySupportedERC20Payments(address paymentErc20TokenAddress) {
        if (
            paymentErc20TokenAddress == ZERO_ADDRESS ||
            !paymentManager.isPaymentMethodSupported(paymentErc20TokenAddress)
        ) revert InvalidPaymentMethod();

        _;
    }

    function _calculateFees(
        address paymentMethodAddress,
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
        (uint256 takerFee, uint256 makerFee) = paymentManager
            .getPaymentMethodFees(paymentMethodAddress);

        takerCut = _calculateCut(takerFee, price);
        makerCut = _calculateCut(makerFee, price);

        (royaltiesRecipient, royaltieFee) = royaltiesProvider
            .calculateRoyaltiesAndGetRecipient(nftContract, tokenId, price);

        totalCut = takerCut + makerCut;
    }

    function _calculateTakerCut(address paymentErc20TokenAddress, uint256 price)
        internal
        view
        returns (uint256)
    {
        (uint256 takerFee, ) = paymentManager.getPaymentMethodFees(
            paymentErc20TokenAddress
        );

        return _calculateCut(takerFee, price);
    }

    function _calculateCut(uint256 fee, uint256 amount)
        internal
        pure
        returns (uint256)
    {
        return (amount * fee) / MAX_FEE;
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

    function _requireSupportedPaymentMethod(address paymentMethodAddress)
        internal
        view
    {
        if (paymentMethodAddress == ZERO_ADDRESS) return;

        if (!paymentManager.isPaymentMethodSupported(paymentMethodAddress)) {
            revert InvalidPaymentMethod();
        }
    }

    function _requireSufficientCurrencySupplied(
        uint256 sufficientAmount,
        address paymentMethodAddress,
        address buyer
    ) internal view {
        if (paymentMethodAddress == ZERO_ADDRESS) {
            _requireSufficientEtherSupplied(sufficientAmount);
        } else {
            _requireSufficientErc20Allowance(
                sufficientAmount,
                paymentMethodAddress,
                buyer
            );
        }
    }

    function _requireSufficientEtherSupplied(uint256 sufficientAmount)
        internal
        view
    {
        if (msg.value < sufficientAmount) {
            revert UnsufficientCurrencySupplied();
        }
    }

    function _requireSufficientErc20Allowance(
        uint256 sufficientAmount,
        address paymentMethodAddress,
        address buyer
    ) internal view {
        IERC20 ERC20PaymentToken = IERC20(paymentMethodAddress);

        uint256 contractAllowance = ERC20PaymentToken.allowance(
            buyer,
            address(this)
        );

        if (contractAllowance < sufficientAmount) {
            revert UnsufficientCurrencySupplied();
        }
    }

    function _updateExchangeConfiguration(
        address _royaltiesProvider,
        address _paymentManager
    ) internal {
        if (
            _royaltiesProvider == ZERO_ADDRESS ||
            _paymentManager == ZERO_ADDRESS
        ) revert InvalidAddress();

        royaltiesProvider = IRoyaltiesProvider(_royaltiesProvider);
        paymentManager = IPaymentManager(_paymentManager);
    }

    /**
     * @notice See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[1000] private __gap;
}
