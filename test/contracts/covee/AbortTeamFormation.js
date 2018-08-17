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
 * Test for team formation abortion.
 *
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 */

import {getEvents, BigNumber, increaseTimeTo} from '../helpers/tools';
import {Stages} from '../../../src/helpers/covee-tools.js';

const Covee  = artifacts.require('./Covee');
const Token = artifacts.require('./CoveeToken.sol');

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('Covee Abort Team formation manually', (accounts) => {
    const initiator     = accounts[0];
    const teamMember1   = accounts[1];
    const teamMember2   = accounts[2];

    const projectId         = '0x7b00000000000000000000000000000000000000000000000000000000000000';
    const roleCount         = 3;

    const applicationDeadline =     1549790400; // Sunday, February 10, 2019 9:20:00 AM
    const teamFormationDeadline =   1551060000; // Sunday, February 25, 2019 3:00:00 AM
    const projectStartTime =        1551430800; // Friday, March 1, 2019 9:00:00 AM

    const projectStakingAmounts = [10, 20, 30];
    const projectReward = 0;

    // Provide the contracts for every test case
    let coveeToken;
    let covee;

    beforeEach(async () => {
        coveeToken    = await Token.deployed();
        covee        = await Covee.deployed();
    });

    async function stake(teamMember, amount, role) {
        await coveeToken.mint(teamMember, amount);
        const tx1 = await coveeToken.apply(projectId, role, amount, covee.address, {from: teamMember});
        const events1 = getEvents(tx1, 'AppliedForRole');
        return events1;
    }

    it('initiator should create a project and start the application period', async () => {
        console.log('[ ProjectApplicationTime Stage ]'.yellow);
        await coveeToken.mint(initiator, projectStakingAmounts[0]);
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
        projectStakingAmounts[0].should.be.bignumber.equal(newBalance.minus(oldBalance));

        const stage  = await covee.stage(projectId);
        stage.should.be.bignumber.equal(Stages.ProjectApplicationTime);
    });

    it('team member 1 should bid on role 1', async () => {
        const event1 = await stake(teamMember1, projectStakingAmounts[1], 1);
        assert.isDefined(event1);
    });

    it('team member 2 should bid on role 2', async () => {
        const event1 = await stake(teamMember2, projectStakingAmounts[2], 2);
        assert.isDefined(event1);
    });

    it('time is increased to application deadline', async () => {
        await increaseTimeTo(applicationDeadline);
        console.log('[ ProjectInvalid Stage ]'.yellow);
    });

    it('Project should be invalid because initator aborded team formation', async () => {
        await covee.cancelTeamFormation(projectId);
    });

    it('project stage should be ProjectInvalid', async () => {
        const stage  = await covee.stage(projectId);
        stage.should.be.bignumber.equal(Stages.ProjectInvalid);
    });

    it('team member 1 should claim his money back', async () => {
        const tx0 = await covee.claimMoneyBack(projectId, 1, {from: teamMember1});
        const events0 = getEvents(tx0, 'Reimbursed');
        assert.isDefined(events0);
    });

    it('team member 2 should claim his money back', async () => {
        const tx0 = await covee.claimMoneyBack(projectId, 2, {from: teamMember2});
        const events0 = getEvents(tx0, 'Reimbursed');
        assert.isDefined(events0);
    });

    it('initiator should claim his money back', async () => {
        const tx0 = await covee.claimMoneyBack(projectId, 0, {from: initiator});
        const events0 = getEvents(tx0, 'Reimbursed');
        assert.isDefined(events0);
    });
});
