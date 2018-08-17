/*
    This file is part of the Covee Network protocol (smart contracts).
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * Test of payout of stakes.
 *
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 */

import {expectThrow, getEvents, BigNumber, increaseTimeTo} from '../helpers/tools';
import {Stages} from '../../../src/helpers/covee-tools';

const Covee  = artifacts.require('./Covee');
const Token = artifacts.require('./CoveeToken.sol');

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('8. Payout Stakes', (accounts) => {
    const initiator     = accounts[0];
    const teamMember1   = accounts[1];
    const teamMember2   = accounts[2];
    const rejectedApplicant   = accounts[3];
    const winners       = [initiator, teamMember1, teamMember2];
    const underwriter   = accounts[9];

    const projectId         = '0x7b00000000000000000000000000000000000000000000000000000000000000';
    const roleCount         = 3;

    const applicationDeadline =     1549790400; // Sunday, February 10, 2019 9:20:00 AM
    const teamFormationDeadline =   1551060000; // Sunday, February 25, 2019 3:00:00 AM
    const projectStartTime =        1551430800; // Friday, March 1, 2019 9:00:00 AM

    const projectStakingAmounts = [0, 20 * 1e18, 30 * 1e18];
    const projectReward = 1*1e18;

    const projectMilestoneDeadlines = [
        1552039200, // Friday, March 8, 2019 10:00:00 AM
    ];

    const projectInitiatorReviewDeadlines = [
        1552298400, // Monday, March 11, 2019 10:00:00 AM
    ];

    const projectPeerReviewDeadlines = [
        1552471200, // Wednesday, March 13, 2019 10:00:00 AM
    ];

    const milestoneContributionLevelDividend = [100 * 1e16];

    //project not fully sadisfactory
    const realMilestoneContributionLevelDividend = [100 * 1e16];

    // Provide the contracts for every test case
    let coveeToken;
    let covee;
    let beneficiary;

    beforeEach(async () => {
        coveeToken    = await Token.deployed();
        covee         = await Covee.deployed();
        beneficiary   = await covee.contractFeeBeneficiary();
    });

    async function stake(teamMember, amount, role) {
        await coveeToken.mint(teamMember, amount);
        const tx1 = await coveeToken.apply(projectId, role, amount, covee.address, {from: teamMember});
        const events1 = getEvents(tx1, 'AppliedForRole');
        return events1;
    }

    it('initiator should create a project and start the application period', async () => {
        console.log('[ ProjectApplicationTime Stage ]'.yellow);
        await coveeToken.mint(initiator, projectReward + projectStakingAmounts[0]);
        const oldBalance = await coveeToken.balanceOf(covee.address);
        const tx1 = await coveeToken.startApplicationPeriod(
            projectId,
            roleCount,
            applicationDeadline,
            teamFormationDeadline,
            projectStartTime,
            projectStakingAmounts,
            projectReward,
            covee.address
        );
        const events1 = getEvents(tx1, 'ApplicationStarted');
        assert.isDefined(events1);

        const newBalance = await coveeToken.balanceOf(covee.address);
        projectReward.should.be.bignumber.equal(newBalance.minus(oldBalance));

        const stage  = await covee.stage(projectId);
        stage.should.be.bignumber.equal(Stages.ProjectApplicationTime);
    });

    it('team member 1 should bid on role 1', async () => {
        const event1 = await stake(teamMember1, projectStakingAmounts[1], 1);
        assert.isDefined(event1);
    });

    it('team member2 should bid on role 2', async () => {
        const event1 = await stake(teamMember2, projectStakingAmounts[2], 2);
        assert.isDefined(event1);
    });

    it('rejected applicant should bid on role 2', async () => {
        const event1 = await stake(rejectedApplicant, projectStakingAmounts[2], 2);
        assert.isDefined(event1);
    });

    it('time is increased to application deadline', async () => {
        await increaseTimeTo(applicationDeadline);
        console.log('[ Project Definition Stage ]'.yellow);
    });

    it('Project should be valid all Roles filled', async () => {
        await covee.confirmTeamMembers(projectId, winners);
        const stage  = await covee.stage(projectId);
        stage.should.be.bignumber.equal(Stages.ProjectDefinition);
    });

    it('time is increased to project start', async () => {
        await increaseTimeTo(projectStartTime);
    });

    it('milestones should be set up', async () => {
        const tx0 = await covee.defineProject(
            projectId,
            projectMilestoneDeadlines,
            projectInitiatorReviewDeadlines,
            projectPeerReviewDeadlines,
            milestoneContributionLevelDividend
        );
        const events0 = getEvents(tx0, 'ProjectDefined');
        assert.isDefined(events0);
    });

    it('initiator review time should be reached', async () => {
        await increaseTimeTo(projectMilestoneDeadlines[0]);
        console.log('[ Milestone 0 deadline reached ]'.blue);
    });

    it('5.1.2b Only during Initiator review time this is possible', async () => {
        const tx0 = await covee.reviewAsInitiator(
            projectId,
            0,
            realMilestoneContributionLevelDividend[0]
        );
        const events0 = getEvents(tx0, 'InitiatorReviewedMilestone');
        assert.isDefined(events0);
    });

    it('initiator review deadline should be expired', async () => {
        await increaseTimeTo(projectInitiatorReviewDeadlines[0]);
        console.log('[ Milestone 0 Initiator review deadline reached ]'.blue);
    });

    it('fraction outcome for Milestone 0 should be submitted by trustee', async () => {
        const tx0 = await covee.submitSplitOfContributions(
            projectId,
            0,
            [0, 40 * 1e16, 60 * 1e16],
            {from: underwriter}
        );
        const events0 = getEvents(tx0, 'ProjectMilestonePaymentProcessed');
        assert.isDefined(events0);

        const p = await coveeToken.allowance(covee.address, teamMember2);
        const pay = p.toNumber() / 1e18;
        console.log('payout team member 2: ', pay);
    });

    it('8.1.2 Payout cant be made before project ended', async () => {
        await expectThrow(
            covee.payoutStakedTokens(
                projectId,
                2,
                {from: teamMember2}
            )
        );
    });

    it('project end should be reached', async () => {
        await increaseTimeTo(projectPeerReviewDeadlines[0]);
        console.log('[ Project end reached ]'.yellow);
    });

    it('8.1.1 Project Id must exist', async ()=> {
        const fakeId = '0x3b00000000000000000000000000000000000000000000000000000000000000';
        await expectThrow(
            covee.payoutStakedTokens(
                fakeId,
                1,
                {from: teamMember1}
            )
        );
    });

    it('8.1.3b Staked Tokens can be payed out before fee is payed out', async () => {
        const tx0 = await covee.payoutStakedTokens(
            projectId,
            1,
            {from: teamMember1}
        );
        const events0 = getEvents(tx0, 'StakePaidOut');
        assert.isDefined(events0);
    });

    it('covee fee payout made', async () => {
        const tx0 = await covee.payoutCoveeFee(
            projectId
        );
        const events0 = getEvents(tx0, 'CoveeFeePaidOut');
        assert.isDefined(events0);
    });

    it('8.1.3b Staked Tokens can be payed out after fee is payed out', async () => {
        const payBefore = (await coveeToken.allowance(covee.address, teamMember2)).toNumber() / 1e18;
        const tx0 = await covee.payoutStakedTokens(
            projectId,
            2,
            {from: teamMember2}
        );

        const p = await coveeToken.allowance(covee.address, teamMember2);
        const pay = p.toNumber() / 1e18;
        console.log('payout team member 2: ', pay);

        console.log('new payout: ', pay - payBefore);
    });

    it('8.1.4 Payout can’t be done twice', async () => {
        await expectThrow(
            covee.payoutStakedTokens(
                projectId,
                2,
                {from: teamMember2}
            )
        );
    });

    it('8.1.5 All staked token', async () => {
        await expectThrow(
            covee.payoutStakedTokens(
                projectId,
                2,
                {from: teamMember2}
            )
        );
    });

    it('if there is any remainder reimbures the client', async () => {
        const tx0 = await covee.reimburseInitiator(projectId);
        const events0 = getEvents(tx0, 'InitiatorReimbursed');
        assert.isDefined(events0);
    });

    it('8.2.1 All staked tokens have been paid out.', async () => {
        const payoutTeammember2 = await coveeToken.allowance(covee.address, teamMember2);
        const payoutTeammember1 = await coveeToken.allowance(covee.address, teamMember1);
        const payoutClient = await coveeToken.allowance(covee.address, initiator);
        const payoutTxFee = await coveeToken.allowance(covee.address, beneficiary);

        const payClient = payoutClient.toNumber() / 1e18;
        const payMember1 = payoutTeammember1.toNumber() / 1e18;
        const payMember2 = payoutTeammember2.toNumber() / 1e18;
        const payTxFee = payoutTxFee.toNumber() / 1e18;

        console.log('payout 0: ', payClient);
        console.log('payout 1: ', payMember1);
        console.log('payout 2: ', payMember2);
        console.log('payout tx fee: ', payTxFee);

        const sumAllPayouts = payClient + payMember1 + payMember2 + payTxFee;
        console.log('sum payout: ',  sumAllPayouts);

        const expectedSum = (
            projectStakingAmounts.reduce((pv, cv) => pv+cv, 0) +
            projectReward) / 1e18;

        assert.equal(expectedSum, sumAllPayouts);
    });

});
