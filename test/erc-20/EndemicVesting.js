const { expect } = require('chai');
const { ethers } = require('hardhat');
const { deployEndemicVesting } = require('../helpers/deploy');

const VESTING_NOT_STARTED = 'VestingNotStarted';
const ENTITY_ALREADY_ALLOCATED = 'EntityAlreadyAllocated';
const NO_ALLOCATED_TOKENS = 'NoAllocatedTokensForClaimer';
const REACHED_ALLOCATION_TYPE_LIMIT = 'ReachedAllocationTypeLimit';
const END_TOKEN_CLAIMED = 'ENDTokenClaimed';

describe('EndemicVesting', function () {
  let owner, user1;

  let endemicVesting, endemicToken;

  const FIVE_MINUTES = 5 * 60000;
  const ONE_YEAR = 12 * 30 * 24 * 60 * 60000;

  const RANDOM_TIMESTAMP = 1680209518;

  const TGE_TIMESTAMP = new Date().getMilliseconds();
  const VESTING_START_TIMESTAMP = TGE_TIMESTAMP + FIVE_MINUTES;

  const END_CLIFF_TIMESTAMP = TGE_TIMESTAMP + FIVE_MINUTES;
  const END_VESTING_TIMESTAMP = VESTING_START_TIMESTAMP + ONE_YEAR;

  const generateAllocTypeRequests = (endCliff, endVesting) => {
    const MIN = 5000000; // 500k
    const MAX = 50000000; // 5mil

    const maxAllocations = Array.from(
      { length: 6 },
      () => Math.floor(Math.random() * (MAX - MIN) + MIN) //from 500k - 5mil
    );

    return maxAllocations.map((maxAllocation, i) => ({
      allocType: i,
      endCliff,
      endVesting,
      maxAllocation,
    }));
  };

  const generateAllocRequests = async () => {
    const totalAllocations = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 50000)
    );

    const signers = await ethers.getSigners();

    return totalAllocations.map((totalAllocation, i) => ({
      claimerAddress: signers[i].address,
      allocType: i,
      initialAllocation: totalAllocation,
      totalAllocated: totalAllocation,
    }));
  };

  beforeEach(async () => {
    [owner, user1] = await ethers.getSigners();

    const allocTypeRequests = generateAllocTypeRequests(
      END_CLIFF_TIMESTAMP,
      END_VESTING_TIMESTAMP
    );

    const result = await deployEndemicVesting(
      owner,
      TGE_TIMESTAMP,
      VESTING_START_TIMESTAMP,
      allocTypeRequests
    );

    endemicVesting = result.endemicVesting;
    endemicToken = result.endemicToken;

    await endemicToken.approve(endemicVesting.address, 500000);
  });

  describe('Initial state', () => {
    it('should fail with vesting not available before TGE', async () => {
      await expect(
        deployEndemicVesting(owner, VESTING_START_TIMESTAMP, TGE_TIMESTAMP, [])
      ).to.be.reverted;
    });

    it('should fail with invalid number of alloc types', async () => {
      await expect(
        deployEndemicVesting(owner, TGE_TIMESTAMP, VESTING_START_TIMESTAMP, [])
      ).to.be.reverted;
    });

    it('should fail with entity already allocated', async () => {
      const maxAllocations = Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 50000)
      );

      const invalidAllocTypeRequests = maxAllocations.map((maxAllocation) => ({
        allocType: 0,
        endCliff: RANDOM_TIMESTAMP,
        endVesting: RANDOM_TIMESTAMP,
        maxAllocation,
      }));

      await expect(
        deployEndemicVesting(
          owner,
          TGE_TIMESTAMP,
          VESTING_START_TIMESTAMP,
          invalidAllocTypeRequests
        )
      ).to.be.revertedWith(ENTITY_ALREADY_ALLOCATED);
    });

    it('should successfully deploy contract', async () => {
      const allocTypeRequests = generateAllocTypeRequests(
        END_CLIFF_TIMESTAMP,
        END_VESTING_TIMESTAMP
      );

      await deployEndemicVesting(
        owner,
        TGE_TIMESTAMP,
        VESTING_START_TIMESTAMP,
        allocTypeRequests
      );
    });
  });

  describe('Allocate tokens', function () {
    it('should fail with entity already allocated', async () => {
      await expect(
        endemicVesting.allocateTokens([
          {
            claimerAddress: owner.address,
            allocType: 0,
            initialAllocation: 500,
            totalAllocated: 5000,
          },
          {
            claimerAddress: owner.address,
            allocType: 0,
            initialAllocation: 500,
            totalAllocated: 5000,
          },
        ])
      ).to.be.revertedWith(ENTITY_ALREADY_ALLOCATED);
    });

    it('should fail with reached allocation type limit', async () => {
      await expect(
        endemicVesting.allocateTokens([
          {
            claimerAddress: owner.address,
            allocType: 0,
            initialAllocation: 500000000, //50mil
            totalAllocated: 500000000, //50mil
          },
          {
            claimerAddress: user1.address,
            allocType: 0,
            initialAllocation: 500000000, //50mil
            totalAllocated: 500000000, //50mil
          },
        ])
      ).to.be.revertedWith(REACHED_ALLOCATION_TYPE_LIMIT);
    });

    it('should successfully allocate tokens', async () => {
      const allocRequests = await generateAllocRequests(
        END_CLIFF_TIMESTAMP,
        END_VESTING_TIMESTAMP
      );

      await endemicVesting.allocateTokens(allocRequests);
    });
  });

  describe('Claim tokens', function () {
    it('should fail with vesting not started yet', async () => {
      const allocTypeRequests = generateAllocTypeRequests(
        END_CLIFF_TIMESTAMP,
        END_VESTING_TIMESTAMP
      );

      const START_TIME_IN_FUTURE = 1680209518;

      const { endemicVesting } = await deployEndemicVesting(
        owner,
        TGE_TIMESTAMP,
        START_TIME_IN_FUTURE,
        allocTypeRequests
      );

      await expect(endemicVesting.claim()).to.be.revertedWith(
        VESTING_NOT_STARTED
      );

      await expect(endemicVesting.claimFor(owner.address)).to.be.revertedWith(
        VESTING_NOT_STARTED
      );
    });

    it('should fail with no allocated tokens for claimer', async () => {
      await expect(endemicVesting.claim()).to.be.revertedWith(
        NO_ALLOCATED_TOKENS
      );

      await expect(endemicVesting.claimFor(owner.address)).to.be.revertedWith(
        NO_ALLOCATED_TOKENS
      );
    });

    it('should claim tokens when cliff passed and vesting not finished yet', async () => {
      await endemicVesting.allocateTokens([
        {
          claimerAddress: user1.address,
          allocType: 0,
          initialAllocation: 500,
          totalAllocated: 5000,
        },
      ]);

      await expect(endemicVesting.connect(user1).claim()).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.equal('500'); //initial allocation
    });

    it('should claim tokens when cliff and vesting passed', async () => {
      const allocTypeRequests = generateAllocTypeRequests(
        END_CLIFF_TIMESTAMP,
        END_CLIFF_TIMESTAMP
      );

      const { endemicVesting, endemicToken } = await deployEndemicVesting(
        owner,
        TGE_TIMESTAMP,
        VESTING_START_TIMESTAMP,
        allocTypeRequests
      );

      await endemicToken.approve(endemicVesting.address, 50000);

      await endemicVesting.allocateTokens([
        {
          claimerAddress: user1.address,
          allocType: 0,
          initialAllocation: 500,
          totalAllocated: 50000,
        },
      ]);

      await expect(endemicVesting.connect(user1).claim()).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.equal('50000'); //total allocated
    });

    it('should claim tokens for address when cliff passed and vesting not finished yet', async () => {
      await endemicVesting.allocateTokens([
        {
          claimerAddress: user1.address,
          allocType: 0,
          initialAllocation: 5000,
          totalAllocated: 50000,
        },
      ]);

      await expect(endemicVesting.claimFor(user1.address)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );
      expect(await endemicToken.balanceOf(user1.address)).to.equal('5000'); // initial allocation
    });

    it('should claim tokens for address when cliff and vesting passed', async () => {
      const allocTypeRequests = generateAllocTypeRequests(
        END_CLIFF_TIMESTAMP,
        END_CLIFF_TIMESTAMP
      );

      const { endemicVesting, endemicToken } = await deployEndemicVesting(
        owner,
        TGE_TIMESTAMP,
        VESTING_START_TIMESTAMP,
        allocTypeRequests
      );

      await endemicToken.approve(endemicVesting.address, 50000);

      await endemicVesting.allocateTokens([
        {
          claimerAddress: user1.address,
          allocType: 0,
          initialAllocation: 500,
          totalAllocated: 50000,
        },
      ]);

      await expect(endemicVesting.claimFor(user1.address)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.equal('50000'); //total allocated
    });
  });

  describe('Update allocation type', function () {
    it('should fail to update allocation type', async () => {
      await expect(
        endemicVesting.connect(user1).updateAllocationType({
          allocType: 0,
          endVesting: END_VESTING_TIMESTAMP,
          endCliff: END_CLIFF_TIMESTAMP,
          maxAllocation: 5000,
        })
      ).to.be.reverted;
    });

    it('should successfully update allocation type', async () => {
      const NEW_VESTING_TIMESTAMP = 1680209520;
      const NEW_CLIFF_TIMESTAMP = 1680209522;
      const NEW_MAX_ALLOCATION = 5000;

      const allocTypeToUpdate = Object.assign(
        {},
        await endemicVesting.allocationTypes(0)
      );

      expect(allocTypeToUpdate.endVesting).to.equal(END_VESTING_TIMESTAMP);
      expect(allocTypeToUpdate.endCliff).to.equal(END_CLIFF_TIMESTAMP);

      await endemicVesting.updateAllocationType({
        allocType: 0,
        endVesting: NEW_VESTING_TIMESTAMP,
        endCliff: NEW_CLIFF_TIMESTAMP,
        maxAllocation: NEW_MAX_ALLOCATION,
      });

      const updatedAllocType = Object.assign(
        {},
        await endemicVesting.allocationTypes(0)
      );

      expect(updatedAllocType.endVesting).to.equal(NEW_VESTING_TIMESTAMP);
      expect(updatedAllocType.endCliff).to.equal(NEW_CLIFF_TIMESTAMP);
      expect(updatedAllocType.maxAllocation).to.equal(NEW_MAX_ALLOCATION);
    });
  });
});
