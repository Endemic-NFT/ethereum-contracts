const { expect } = require('chai');
const { utils } = require('ethers');
const { ethers, network } = require('hardhat');
const { deployEndemicVesting } = require('../helpers/deploy');
const { BigNumber } = ethers;

const VESTING_FREEZED = 'VestingFreezed';
const VESTING_NOT_STARTED = 'VestingNotStarted';
const NO_ALLOCATED_TOKENS = 'NoAllocatedTokensForClaimer';
const ALLOCATION_EXISTS = 'AllocationExists';
const END_TOKEN_CLAIMED = 'ENDTokenClaimed';
const NOT_OWNER = 'Ownable: caller is not the owner';

describe('EndemicVesting', function () {
  let owner, user1;

  let endemicVesting, endemicToken;

  const ONE_YEAR = 12 * 30 * 24 * 60 * 60;
  const ONE_AND_A_HALF_YEAR = 1.5 * ONE_YEAR;
  const SIX_MONTHS = ONE_YEAR / 2;

  const VESTING_START_TIMESTAMP = Math.floor(new Date().getTime() / 1000);
  const VESTING_END_TIMESTAMP = VESTING_START_TIMESTAMP + ONE_AND_A_HALF_YEAR;

  const generateAllocRequests = async (
    cliffDuration = SIX_MONTHS,
    vestingDuration = ONE_AND_A_HALF_YEAR,
    initialAllocation = 500,
    totalAllocated = 1000
  ) => {
    return [...new Array(6)].map((_, i) => ({
      initialAllocation,
      totalAllocated,
      cliffDuration,
      vestingDuration,
      allocType: i,
      claimer: i < 3 ? owner.address : user1.address,
    }));
  };

  const assignToObject = (source) => Object.assign({}, source);

  beforeEach(async () => {
    [owner, user1] = await ethers.getSigners();

    const result = await deployEndemicVesting(owner);

    endemicVesting = result.endemicVesting;
    endemicToken = result.endemicToken;

    await endemicToken.approve(
      endemicVesting.address,
      utils.parseEther('2000000')
    );
  });

  describe('Initial state', () => {
    it('should successfully deploy contract', async () => {
      await deployEndemicVesting(owner);
    });
  });

  describe('Allocate additional tokens', function () {
    it('should successfully allocate tokens', async () => {
      const allocRequests = await generateAllocRequests();

      await endemicVesting.addAllocations(allocRequests);

      const ownerAllocations = await endemicVesting.getAllocationsForClaimer(
        owner.address
      );

      const ownerSeedAllocation = assignToObject(ownerAllocations[0][0]);

      expect(ownerSeedAllocation.initialAllocation).to.equal(500);
      expect(ownerSeedAllocation.totalAllocated).to.equal(1000);
    });

    it('should fail to update existing allocation', async () => {
      const allocRequests = await generateAllocRequests();

      await endemicVesting.addAllocations(allocRequests);

      await expect(
        endemicVesting.addAllocations(allocRequests)
      ).to.be.revertedWith(ALLOCATION_EXISTS);
    });
  });

  describe('Claim tokens', function () {
    it('should fail with vesting not started yet', async () => {
      const { endemicVesting } = await deployEndemicVesting(owner);

      await expect(endemicVesting.claim(0)).to.be.revertedWith(
        VESTING_NOT_STARTED
      );

      await expect(
        endemicVesting.claimFor(owner.address, 0)
      ).to.be.revertedWith(VESTING_NOT_STARTED);
    });

    it('should fail with no allocated tokens for claimer', async () => {
      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      await expect(endemicVesting.claim(0)).to.be.revertedWith(
        NO_ALLOCATED_TOKENS
      );

      await expect(
        endemicVesting.claimFor(owner.address, 0)
      ).to.be.revertedWith(NO_ALLOCATED_TOKENS);
    });

    it('should fail with no allocated tokens for claimer', async () => {
      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      const allocRequests = await generateAllocRequests();

      await endemicVesting.addAllocations(allocRequests);

      await endemicVesting.claim(0);

      await expect(endemicVesting.claim(0)).to.be.revertedWith(
        NO_ALLOCATED_TOKENS
      );

      await expect(
        endemicVesting.claimFor(owner.address, 0)
      ).to.be.revertedWith(NO_ALLOCATED_TOKENS);
    });

    it('should claim initial tokens for address when neither cliff or vesting passed', async () => {
      const allocRequests = await generateAllocRequests(
        VESTING_END_TIMESTAMP + SIX_MONTHS,
        VESTING_END_TIMESTAMP + SIX_MONTHS
      );

      await endemicVesting.addAllocations(allocRequests);

      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      await expect(endemicVesting.claimFor(user1.address, 5)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.equal('500'); //initial allocated
    });
  });

  describe('Update vesting dates', function () {
    it('should succesfully update vesting dates', async () => {
      //initial setup
      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      //some allocations
      const allocRequests = await generateAllocRequests(ONE_YEAR, 2 * ONE_YEAR);
      await endemicVesting.addAllocations(allocRequests);

      //update setup
      await endemicVesting.setVestingDates(
        SIX_MONTHS //vesting start
      );
    });

    it('should fail to update vesting dates when contract freezed', async () => {
      //initial setup
      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      //some allocations
      const allocRequests = await generateAllocRequests();
      await endemicVesting.addAllocations(allocRequests);

      await endemicVesting.freezeVesting();

      //update setup
      await expect(
        endemicVesting.setVestingDates(
          SIX_MONTHS //vesting start
        )
      ).to.be.revertedWith(VESTING_FREEZED);
    });

    it('should fail to setup vesting dates when not owner', async () => {
      await expect(
        endemicVesting.connect(user1).setVestingDates(VESTING_START_TIMESTAMP)
      ).to.be.revertedWith(NOT_OWNER);
    });

    it('should fail to freeze contract when not owner', async () => {
      await expect(
        endemicVesting.connect(user1).freezeVesting()
      ).to.be.revertedWith(NOT_OWNER);
    });
  });

  describe('Afterwards claims of tokens', function () {
    it('should claim initial tokens for address when neither cliff or vesting passed', async () => {
      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      await network.provider.send('evm_increaseTime', [SIX_MONTHS]);
      await network.provider.send('evm_mine');

      const allocRequests = await generateAllocRequests(
        VESTING_END_TIMESTAMP + SIX_MONTHS,
        VESTING_END_TIMESTAMP + SIX_MONTHS
      );

      await endemicVesting.addAllocations(allocRequests);

      await expect(endemicVesting.claimFor(user1.address, 5)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.equal('500'); //initial allocated
    });

    it('should claim tokens when cliff passed and vesting not finished yet for afterward allocation', async () => {
      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      const initialAllocation = 500;
      const totalAllocated = 1000;

      const allocRequests = await generateAllocRequests(
        2 * SIX_MONTHS,
        ONE_AND_A_HALF_YEAR + SIX_MONTHS,
        initialAllocation,
        totalAllocated
      );

      await endemicVesting.addAllocations(allocRequests);

      const initalLinearClaim = 526;
      const closeToDelta = totalAllocated - initalLinearClaim;

      await expect(endemicVesting.connect(user1).claim(5)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.be.closeTo(
        BigNumber.from(initalLinearClaim),
        closeToDelta
      ); //initial + linear
    });

    it('should claim tokens when cliff passed and vesting not finished yet', async () => {
      const initialAllocation = 500;
      const totalAllocated = 1000;

      const allocRequests = await generateAllocRequests(
        initialAllocation,
        totalAllocated
      );

      await endemicVesting.addAllocations(allocRequests);

      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      await network.provider.send('evm_increaseTime', [SIX_MONTHS]);
      await network.provider.send('evm_mine');

      const initalLinearClaim = 526;
      const closeToDelta = totalAllocated - initalLinearClaim;

      await expect(endemicVesting.connect(user1).claim(5)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.be.closeTo(
        BigNumber.from(initalLinearClaim),
        closeToDelta
      ); //initial + linear
    });

    it('should claim tokens for address when cliff passed and vesting not finished yet', async () => {
      const initialAllocation = 500;
      const totalAllocated = 1000;

      const allocRequests = await generateAllocRequests(
        initialAllocation,
        totalAllocated
      );

      await endemicVesting.addAllocations(allocRequests);

      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      await network.provider.send('evm_increaseTime', [SIX_MONTHS]);
      await network.provider.send('evm_mine');

      const initalLinearClaim = 526;
      const closeToDelta = totalAllocated - initalLinearClaim;

      //verify claimer allocations before claim
      const ownerAllocsBeforeClaim =
        await endemicVesting.getAllocationsForClaimer(owner.address);

      const userAllocsBeforeClaim =
        await endemicVesting.getAllocationsForClaimer(user1.address);

      const ownerSeedAllocBeforeClaim = assignToObject(
        ownerAllocsBeforeClaim[0][0]
      );
      const userTeamAllocBeforeClaim = assignToObject(
        userAllocsBeforeClaim[0][5]
      );

      const ownerAmountToClaimForSeedBefore = ownerAllocsBeforeClaim[1][0];
      const userAmountToClaimForTeamBefore = userAllocsBeforeClaim[1][5];

      expect(ownerSeedAllocBeforeClaim.totalAllocated).to.equal(1000);
      expect(ownerSeedAllocBeforeClaim.totalClaimed).to.equal(0);

      expect(userTeamAllocBeforeClaim.totalAllocated).to.equal(1000);
      expect(userTeamAllocBeforeClaim.totalClaimed).to.equal(0);
      expect(ownerAmountToClaimForSeedBefore).to.be.closeTo(
        BigNumber.from(initalLinearClaim),
        closeToDelta
      ); //initial + linear
      expect(userAmountToClaimForTeamBefore).to.be.closeTo(
        BigNumber.from(initalLinearClaim),
        closeToDelta
      ); //initial + linear

      //claim tokens for owner and user
      await expect(endemicVesting.claimFor(owner.address, 0)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );
      await expect(endemicVesting.claimFor(user1.address, 5)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      //verify claimer allocations after claim
      const ownerAllocationsAfterClaim =
        await endemicVesting.getAllocationsForClaimer(owner.address);

      const userAllocationsAfterClaim =
        await endemicVesting.getAllocationsForClaimer(user1.address);

      const ownerSeedAlocationAfterClaim = assignToObject(
        ownerAllocationsAfterClaim[0][0]
      );
      const userTeamAlocationAfterClaim = assignToObject(
        userAllocationsAfterClaim[0][5]
      );

      const ownerAmountToClaimForSeedAfter = ownerAllocationsAfterClaim[1][0];
      const userAmountToClaimForTeamAfter = userAllocationsAfterClaim[1][5];

      expect(ownerSeedAlocationAfterClaim.totalAllocated).to.equal(1000);
      expect(ownerSeedAlocationAfterClaim.totalClaimed).to.be.closeTo(
        BigNumber.from(initalLinearClaim),
        closeToDelta
      ); //initial + linear

      expect(userTeamAlocationAfterClaim.totalAllocated).to.equal(1000);
      expect(userTeamAlocationAfterClaim.totalClaimed).to.be.closeTo(
        BigNumber.from(initalLinearClaim),
        closeToDelta
      ); //initial + linear

      expect(ownerAmountToClaimForSeedAfter).to.equal(0);
      expect(userAmountToClaimForTeamAfter).to.equal(0);
    });

    it('should claim tokens for address when cliff and vesting passed', async () => {
      const allocRequests = await generateAllocRequests();

      await endemicVesting.addAllocations(allocRequests);

      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      await network.provider.send('evm_increaseTime', [
        4 * SIX_MONTHS, // 2years
      ]);
      await network.provider.send('evm_mine');

      //verify claimer allocations before claim
      const ownerAllocsBeforeClaim =
        await endemicVesting.getAllocationsForClaimer(owner.address);

      const userAllocsBeforeClaim =
        await endemicVesting.getAllocationsForClaimer(user1.address);

      const ownerSeedAllocBeforeClaim = assignToObject(
        ownerAllocsBeforeClaim[0][0]
      );
      const userTeamAllocBeforeClaim = assignToObject(
        userAllocsBeforeClaim[0][5]
      );

      const ownerAmountToClaimForSeedBefore = ownerAllocsBeforeClaim[1][0];
      const userAmountToClaimForTeamBefore = userAllocsBeforeClaim[1][5];

      expect(ownerSeedAllocBeforeClaim.totalAllocated).to.equal(1000);
      expect(ownerSeedAllocBeforeClaim.totalClaimed).to.equal(0);

      expect(userTeamAllocBeforeClaim.totalAllocated).to.equal(1000);
      expect(userTeamAllocBeforeClaim.totalClaimed).to.equal(0);

      expect(ownerAmountToClaimForSeedBefore).to.equal('1000'); //amount of total allocated
      expect(userAmountToClaimForTeamBefore).to.equal('1000'); //amount of total allocated

      //claim tokens for user and owner
      await expect(endemicVesting.claimFor(owner.address, 0)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );
      await expect(endemicVesting.claimFor(user1.address, 5)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      //verify claimer allocations after claim
      const ownerAllocationsAfterClaim =
        await endemicVesting.getAllocationsForClaimer(owner.address);

      const userAllocationsAfterClaim =
        await endemicVesting.getAllocationsForClaimer(user1.address);

      const ownerSeedAlocationAfterClaim = assignToObject(
        ownerAllocationsAfterClaim[0][0]
      );
      const userTeamAlocationAfterClaim = assignToObject(
        userAllocationsAfterClaim[0][5]
      );

      const ownerAmountToClaimForSeedAfter = ownerAllocationsAfterClaim[1][0];
      const userAmountToClaimForTeamAfter = userAllocationsAfterClaim[1][5];

      expect(ownerSeedAlocationAfterClaim.totalAllocated).to.equal(1000);
      expect(ownerSeedAlocationAfterClaim.totalClaimed).to.equal(1000); //amount of total allocated

      expect(userTeamAlocationAfterClaim.totalAllocated).to.equal(1000);
      expect(userTeamAlocationAfterClaim.totalClaimed).to.equal(1000); //amount of total allocated

      expect(ownerAmountToClaimForSeedAfter).to.equal(0);
      expect(userAmountToClaimForTeamAfter).to.equal(0);
    });

    it('should claim tokens when cliff and vesting passed for afterward allocation', async () => {
      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      await network.provider.send('evm_increaseTime', [SIX_MONTHS]);
      await network.provider.send('evm_mine');

      const allocRequests = await generateAllocRequests(
        2 * SIX_MONTHS,
        ONE_AND_A_HALF_YEAR + SIX_MONTHS
      );

      await endemicVesting.addAllocations(allocRequests);

      await expect(endemicVesting.connect(user1).claim(5)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.equal('1000'); //amount of total allocated
    });

    it('should claim tokens when cliff and vesting passed', async () => {
      const allocRequests = await generateAllocRequests();

      await endemicVesting.addAllocations(allocRequests);

      await endemicVesting.setVestingDates(VESTING_START_TIMESTAMP);

      await expect(endemicVesting.connect(user1).claim(5)).to.emit(
        endemicVesting,
        END_TOKEN_CLAIMED
      );

      expect(await endemicToken.balanceOf(user1.address)).to.equal('1000'); //amount of total allocated
    });
  });
  after(async function () {
    await network.provider.send('hardhat_reset');
  });
});
