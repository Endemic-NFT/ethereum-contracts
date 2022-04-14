// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

error VestingNotStarted();
error NoAllocatedTokensForClaimer();

contract EndemicVesting is Context, Ownable {
    IERC20 private immutable END;
    uint256 private immutable vestingStartTime;

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

    function allocateTokens(AllocationRequest[] calldata allocRequests)
        external
        onlyOwner
    {
        uint32 amountToTransfer;

        for (uint256 i = 0; i < allocRequests.length; i++) {
            AllocationRequest calldata allocReq = allocRequests[i];

            AllocationData storage claimerAlloc = allocations[allocReq.claimer][
                allocReq.allocType
            ];

            claimerAlloc.endCliff = allocReq.endCliff;
            claimerAlloc.endVesting = allocReq.endVesting;
            claimerAlloc.initialAllocation = allocReq.initialAllocation;
            claimerAlloc.totalAllocated = allocReq.totalAllocated;

            amountToTransfer += allocReq.totalAllocated;
        }

        require(
            END.transferFrom(_msgSender(), address(this), amountToTransfer),
            "END Token transfer fail"
        );
    }

    function updateAllocation(
        AllocationType allocType,
        address claimer,
        uint256 endCliff,
        uint256 endVesting
    ) external onlyOwner {
        allocations[claimer][allocType].endCliff = endCliff;
        allocations[claimer][allocType].endVesting = endVesting;
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
