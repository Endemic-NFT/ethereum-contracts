// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

error NoAllocatedTokensForClaimer();
error VestingNotStarted();
error EntityAlreadyAllocated();
error ReachedAllocationTypeLimit();

contract EndemicVesting is Context, Ownable {
    IERC20 private immutable END;
    uint256 private immutable vestingStartTime;

    uint256 public grandTotalAllocated;
    uint256 public grandTotalClaimed;

    //claimer address to allocation
    mapping(address => AllocationData) private allocations;

    mapping(AllocationType => AllocationTypeData) public allocationTypes;

    enum AllocationType {
        SEED_SALE,
        PRIVATE_SALE,
        STRATEGIC_SALE,
        PUBLIC_SALE,
        TEAM,
        ADVISORS
    }

    struct AllocationData {
        AllocationType allocType;
        uint256 initialAllocation;
        uint256 totalAllocated;
        uint256 totalClaimed;
        bool isAllocated;
    }

    struct AllocationTypeData {
        uint256 endCliff;
        uint256 endVesting;
        uint256 maxAllocation;
        uint256 totalAllocated;
        uint256 totalClaimed;
        bool isAllocated;
    }

    struct AllocationRequest {
        address claimerAddress;
        uint256 allocType;
        uint256 initialAllocation;
        uint256 totalAllocated;
    }

    struct AllocationTypeRequest {
        AllocationType allocType;
        uint256 endCliff;
        uint256 endVesting;
        uint256 maxAllocation;
    }

    event ENDTokenClaimed(
        address indexed claimer,
        uint256 indexed amountClaimed,
        uint256 indexed totalClaimed
    );

    constructor(
        uint256 tgeTime,
        uint256 startTime,
        address tokenAddress,
        AllocationTypeRequest[] memory allocTypeRequests
    ) {
        require(startTime >= tgeTime, "Vesting not available before TGE");

        require(
            allocTypeRequests.length == _getNumberOfAllocTypes(),
            "Invalid number of alloc types"
        );

        for (uint256 i = 0; i < allocTypeRequests.length; i++) {
            AllocationTypeRequest memory allocTypeReq = allocTypeRequests[i];

            if (allocationTypes[allocTypeReq.allocType].isAllocated) {
                revert EntityAlreadyAllocated();
            }

            allocationTypes[allocTypeReq.allocType] = AllocationTypeData(
                allocTypeReq.endCliff,
                allocTypeReq.endVesting,
                allocTypeReq.maxAllocation,
                0,
                0,
                true
            );
        }

        END = IERC20(tokenAddress);
        vestingStartTime = startTime;
    }

    function allocateTokens(AllocationRequest[] calldata allocRequests)
        external
        onlyOwner
    {
        uint256 amountToTransfer;
        uint256[] memory allocsForTypes = new uint256[](6);

        for (uint256 i = 0; i < allocRequests.length; i++) {
            AllocationRequest calldata allocReq = allocRequests[i];

            if (allocations[allocReq.claimerAddress].isAllocated) {
                revert EntityAlreadyAllocated();
            }

            allocations[allocReq.claimerAddress] = AllocationData(
                AllocationType(allocReq.allocType),
                allocReq.initialAllocation,
                allocReq.totalAllocated,
                0,
                true
            );

            allocsForTypes[allocReq.allocType] += allocReq.totalAllocated;

            amountToTransfer += allocReq.totalAllocated;
        }

        for (uint256 i = 0; i < allocsForTypes.length; i++) {
            AllocationType allocType = AllocationType(i);

            if (
                allocationTypes[allocType].totalAllocated + allocsForTypes[i] >=
                allocationTypes[allocType].maxAllocation
            ) {
                revert ReachedAllocationTypeLimit();
            }

            allocationTypes[allocType].totalAllocated += allocsForTypes[i];
        }

        grandTotalAllocated += amountToTransfer;

        require(
            END.transferFrom(_msgSender(), address(this), amountToTransfer),
            "END Token transfer fail"
        );
    }

    function claim() external {
        if (vestingStartTime > block.timestamp) {
            revert VestingNotStarted();
        }

        address claimer = _msgSender();

        _transferTokens(claimer);
    }

    function claimFor(address claimer) external {
        if (vestingStartTime > block.timestamp) {
            revert VestingNotStarted();
        }

        _transferTokens(claimer);
    }

    function updateAllocationType(
        AllocationTypeRequest calldata allocTypeRequest
    ) external onlyOwner {
        AllocationTypeData storage allocTypeToUpdate = allocationTypes[
            allocTypeRequest.allocType
        ];

        allocTypeToUpdate.endCliff = allocTypeRequest.endCliff;
        allocTypeToUpdate.endVesting = allocTypeRequest.endVesting;
        allocTypeToUpdate.maxAllocation = allocTypeRequest.maxAllocation;
    }

    function _transferTokens(address claimer) internal {
        uint256 amountToClaim = _getAmountToClaim(claimer);

        AllocationData storage claimerAlloc = allocations[claimer];

        if (
            claimerAlloc.totalClaimed >= claimerAlloc.totalAllocated ||
            amountToClaim == 0
        ) {
            revert NoAllocatedTokensForClaimer();
        }

        claimerAlloc.totalClaimed = amountToClaim;

        allocationTypes[claimerAlloc.allocType].totalClaimed += amountToClaim;

        grandTotalClaimed += amountToClaim;

        require(
            END.transfer(claimer, amountToClaim),
            "END Token transfer fail"
        );

        emit ENDTokenClaimed(claimer, amountToClaim, claimerAlloc.totalClaimed);
    }

    function _getAmountToClaim(address claimer)
        internal
        view
        returns (uint256 amountToClaim)
    {
        AllocationData storage claimerAlloc = allocations[claimer];

        if (
            block.timestamp >=
            allocationTypes[claimerAlloc.allocType].endVesting
        ) {
            return claimerAlloc.totalAllocated - claimerAlloc.totalClaimed;
        }

        if (
            block.timestamp >= allocationTypes[claimerAlloc.allocType].endCliff
        ) {
            return claimerAlloc.initialAllocation - claimerAlloc.totalClaimed;
        }
    }

    function _getNumberOfAllocTypes()
        internal
        pure
        returns (uint256 numberOfAllocTypes)
    {
        numberOfAllocTypes = uint256(AllocationType.ADVISORS) + 1;
    }
}
