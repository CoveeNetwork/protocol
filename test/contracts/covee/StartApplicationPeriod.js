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
 * Test start application period.
 *
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 */

import {expectThrow, getEvents, BigNumber} from '../helpers/tools';
import {Stages} from '../../../src/helpers/covee-tools';
import cnf from '../../../config/networks.json';
import Web3 from 'web3';

const PORT = cnf.networks.develop.port;
const web3 = new Web3(new Web3.providers.HttpProvider('http://' + cnf.networks.develop.host + ':' + PORT));
const Covee  = artifacts.require('./Covee');
const Token = artifacts.require('./CoveeToken.sol');

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('Covee Team', (accounts) => {
    const initiator     = accounts[0];
    const teamMember1   = accounts[1];
    const teamMember2   = accounts[2];
    const winners = [initiator, teamMember1, teamMember2];

    const projectId         = '0x7b00000000000000000000000000000000000000000000000000000000000000';
    const projectId2        = '0x1b00000000000000000000000000000000000000000000000000000000000000';
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

    it('1.1.1 initiator cant create a project with the same projectId twice', async () => {
        await coveeToken.mint(initiator, projectStakingAmounts[0]);
        await expectThrow(
            coveeToken.startApplicationPeriod(
                projectId,
                roleCount,
                applicationDeadline,
                teamFormationDeadline,
                projectStartTime,
                projectStakingAmounts,
                projectReward,
                covee.address
            )
        );
    });

    it('1.1.2 Test that _roleCount < 1 are rejected', async () => {
        await coveeToken.mint(initiator, projectStakingAmounts[0]);
        await expectThrow(
            coveeToken.startApplicationPeriod(
                projectId2,
                0, //roleCount
                applicationDeadline,
                teamFormationDeadline,
                projectStartTime,
                projectStakingAmounts,
                projectReward,
                covee.address
            )
        );
    });

    it('1.1.3 Test that _roleCount >= 42 are rejected.  42 is a sufficiently large number where teams do not make sense anymore.', async () => {
        await coveeToken.mint(initiator, projectStakingAmounts[0]);
        await expectThrow(
            coveeToken.startApplicationPeriod(
                projectId2,
                42, //roleCount
                applicationDeadline,
                teamFormationDeadline,
                projectStartTime,
                projectStakingAmounts,
                projectReward,
                covee.address
            )
        );
    });

    it('1.1.4 DEPRECATED', async () => {

    });

    it('1.1.5 DEPRECATED', async () => {

    });

    it('1.1.6 DEPRECATED', async () => {

    });

    it('1.1.7 DEPRECATED', async () => {

    });

    it('1.1.8 _projectStartTime must be greater than `now`', async () => {
        await coveeToken.mint(initiator, projectStakingAmounts[0]);
        const blockNumber = await web3.eth.getBlockNumber();
        const now = (await web3.eth.getBlock(blockNumber)).timestamp;
        await expectThrow(
            coveeToken.startApplicationPeriod(
                '0x3b00000000000000000000000000000000000000000000000000000000000000',
                roleCount,
                applicationDeadline,
                teamFormationDeadline,
                now,
                projectStakingAmounts,
                projectReward,
                covee.address
            )
        );
    });

    it('1.1.9 _projectStakingAmounts length == _roleCount', async () => {
        await coveeToken.mint(initiator, projectStakingAmounts[0]);
        projectStakingAmounts.push(123);
        await expectThrow(
            coveeToken.startApplicationPeriod(
                '0x3b00000000000000000000000000000000000000000000000000000000000000',
                roleCount,
                applicationDeadline,
                teamFormationDeadline,
                projectStartTime,
                projectStakingAmounts,
                projectReward,
                covee.address
            )
        );
    });

});
