// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

error VestingNotStarted();
error NoAllocatedTokensForClaimer();
error AllocationExists();
error ENDTransferFailed();
error MaximumAdditionalAllocationReached();

contract EndemicVesting is Context, Ownable {
    IERC20 public immutable END;
    uint256 private immutable vestingStartTime;

    uint256 private additionalTokensAllocated;

    uint256 public constant ADDITIONAL_TOKENS_LIMIT = 100_000 * 10**18;

    mapping(address => mapping(AllocationType => AllocationData))
        public allocations;

    enum AllocationType {
        SEED_SALE,
        PRIVATE_SALE,
        STRATEGIC_SALE,
        PUBLIC_SALE,
        TEAM,
        ADVISORS
    }

    struct AllocationData {
        address claimer;
        //percentage of TGE that is available for claimer immediately after TGE
        uint32 initialAllocation;
        //total allocation that is available for claimer after vesting finishes
        uint32 totalAllocated;
        uint32 totalClaimed;
        uint256 endCliff;
        uint256 endVesting;
    }

    struct AllocationRequest {
        AllocationType allocType;
        address claimer;
        uint32 initialAllocation;
        uint32 totalAllocated;
        uint256 endCliff;
        uint256 endVesting;
    }

    event ENDTokenClaimed(
        address indexed claimer,
        uint256 indexed amountClaimed,
        uint256 indexed totalClaimed
    );

    constructor(
        uint256 tgeStartTime,
        uint256 startTime,
        address tokenAddress
    ) {
        require(startTime >= tgeStartTime, "Vesting not available before TGE");

        END = IERC20(tokenAddress);
        vestingStartTime = startTime;
    }

    function addAllocations(AllocationRequest[] calldata allocRequests)
        external
        onlyOwner
    {
        uint32 amountToTransfer;

        for (uint256 i = 0; i < allocRequests.length; i++) {
            AllocationRequest calldata allocRequest = allocRequests[i];
            _allocateTokens(allocRequest);

            amountToTransfer += allocRequest.totalAllocated;
        }

        additionalTokensAllocated += amountToTransfer;

        if (additionalTokensAllocated > ADDITIONAL_TOKENS_LIMIT) {
            revert MaximumAdditionalAllocationReached();
        }

        if (!END.transferFrom(_msgSender(), address(this), amountToTransfer)) {
            revert ENDTransferFailed();
        }
    }

    function _allocateTokens(AllocationRequest calldata allocRequest) internal {
        AllocationData storage claimerAlloc = allocations[allocRequest.claimer][
            allocRequest.allocType
        ];

        if (claimerAlloc.claimer != address(0)) {
            revert AllocationExists();
        }

        claimerAlloc.claimer = allocRequest.claimer;
        claimerAlloc.endCliff = allocRequest.endCliff;
        claimerAlloc.endVesting = allocRequest.endVesting;
        claimerAlloc.initialAllocation = allocRequest.initialAllocation;
        claimerAlloc.totalAllocated = allocRequest.totalAllocated;
    }

    function claim(AllocationType allocType) external {
        if (vestingStartTime > block.timestamp) {
            revert VestingNotStarted();
        }

        _transferTokens(_msgSender(), allocType);
    }

    function claimFor(address claimer, AllocationType allocType)
        external
        onlyOwner
    {
        if (vestingStartTime > block.timestamp) {
            revert VestingNotStarted();
        }

        _transferTokens(claimer, allocType);
    }

    function getAllocationsForClaimer(address claimer)
        external
        view
        returns (AllocationData[] memory, uint256[] memory)
    {
        AllocationData[] memory claimerAllocs = new AllocationData[](6);
        uint256[] memory amountsToClaim = new uint256[](6);

        for (uint256 i = 0; i < claimerAllocs.length; i++) {
            AllocationType allocType = AllocationType(i);

            claimerAllocs[i] = allocations[claimer][allocType];

            amountsToClaim[i] = _getAmountToClaim(claimer, allocType);
        }

        return (claimerAllocs, amountsToClaim);
    }

    function _transferTokens(address claimer, AllocationType allocType)
        internal
    {
        AllocationData memory claimerAlloc = allocations[claimer][allocType];

        if (claimerAlloc.totalClaimed >= claimerAlloc.totalAllocated) {
            revert NoAllocatedTokensForClaimer();
        }

        uint32 amountToClaim = _getAmountToClaim(claimer, allocType);

        if (amountToClaim == 0) {
            revert NoAllocatedTokensForClaimer();
        }

        allocations[claimer][allocType].totalClaimed += amountToClaim;

        require(
            END.transfer(claimer, amountToClaim),
            "END Token transfer fail"
        );

        emit ENDTokenClaimed(claimer, amountToClaim, claimerAlloc.totalClaimed);
    }

    function _getAmountToClaim(address claimer, AllocationType allocType)
        internal
        view
        returns (uint32 amountToClaim)
    {
        AllocationData storage claimerAlloc = allocations[claimer][allocType];

        //if vesting finished total allocation is available for claimer
        if (block.timestamp >= claimerAlloc.endVesting) {
            amountToClaim = claimerAlloc.totalAllocated;
        } else {
            //initial allocation is available for claimer immediately after TGE
            amountToClaim = claimerAlloc.initialAllocation;

            //if cliff passed initial allocation is summed with tokens that are lineary released by block
            if (block.timestamp >= claimerAlloc.endCliff) {
                amountToClaim += uint32(
                    ((claimerAlloc.totalAllocated -
                        claimerAlloc.initialAllocation) *
                        (block.timestamp - claimerAlloc.endCliff)) /
                        (claimerAlloc.endVesting - claimerAlloc.endCliff)
                );
            }
        }

        //calculated allocation is subtracted by amount claimer already claimed
        amountToClaim -= claimerAlloc.totalClaimed;
    }
}
