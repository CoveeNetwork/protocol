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
 * Test for the Covee token factory.
 *
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 */

import {getEvents, BigNumber, increaseTimeTo} from '../helpers/tools';

const TokenVestingFactory = artifacts.require('./TokenVestingFactory.sol');
const TokenVesting = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/TokenVesting.sol');
const Token = artifacts.require('./CoveeToken.sol');

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('TokenVestingFactory', (accounts) => {
    const initiator     = accounts[0];
    const account1  = accounts[1];
    const account2  = accounts[2];
    let coveeToken;
    let vestingFactory;
    const vestingAmount = 234 * 1e18;

    const vestingDeadlines = [
        1552039200, // Friday, March 8, 2019 10:00:00 AM
        1552644000  // Friday, March 15, 2019 10:00:00 AM
    ];

    beforeEach(async () => {
        coveeToken     = await Token.deployed();
        vestingFactory = await TokenVestingFactory.deployed();
    });

    it('Full vesting after a discrete time is set up correctly', async () => {
        console.log('[ Setup Period - All in One Vesting]'.yellow);

        await coveeToken.mint(initiator, vestingAmount);

        await vestingFactory.createAllInOneVesting(account1, vestingDeadlines[0]);
        const vestingForAccount = TokenVesting.at(await vestingFactory.vestings(account1));

        await coveeToken.transfer(vestingForAccount.address, vestingAmount);
        const newBalance = await vestingForAccount.vestedAmount(coveeToken.address);
        newBalance.should.be.bignumber.equal(0); // Because Cliff not reached
    });

    it('time is increased to vesting deadline', async () => {
        await increaseTimeTo(vestingDeadlines[0] + 1);
        console.log('[ Claim Period - All in One Vesting]'.yellow);
    });

    it('The vesting amount can be claimed', async () => {
        const vestingForAccount = TokenVesting.at(await vestingFactory.vestings(account1));
        const newBalance = await vestingForAccount.vestedAmount(coveeToken.address);
        newBalance.should.be.bignumber.equal(vestingAmount);
        const releasableAmount = await vestingForAccount.releasableAmount(coveeToken.address);
        releasableAmount.should.be.bignumber.equal(vestingAmount);
        const tx0 = await vestingForAccount.release(coveeToken.address);
        const events0 = getEvents(tx0, 'Released');
        assert.isDefined(events0);
    });

    it('No two vestings for same account', async () => {
        try {
            await vestingFactory.createLinearVesting(account1, vestingDeadlines[1], 100000);
            assert.isTrue(false);
        } catch (error) {
            assert.isTrue(true);
        }
    });

    it('Linear vesting after a discrete time is set up correctly', async () => {
        console.log('[ Setup Period - Linear Vesting]'.yellow);

        await coveeToken.mint(initiator, vestingAmount);

        await vestingFactory.createLinearVesting(account2, vestingDeadlines[1], 100000);
        const vestingForAccount2 = TokenVesting.at(await vestingFactory.vestings(account2));

        await coveeToken.transfer(vestingForAccount2.address, vestingAmount);
        const newBalance = await vestingForAccount2.vestedAmount(coveeToken.address);
        newBalance.should.be.bignumber.equal(0); // Because Cliff not reached
    });

    it('time is increased to vesting deadline', async () => {
        await increaseTimeTo(vestingDeadlines[1] + 100); // + 100s
        console.log('[ Linear Claim Period - Linear Vesting]'.yellow);
    });

    it('Part of he vesting amount can be claimed', async () => {
        const vestingForAccount = TokenVesting.at(await vestingFactory.vestings(account2));
        const newBalance = await vestingForAccount.vestedAmount(coveeToken.address);
        // can be bigger because increasing time can't be done precisely
        newBalance.should.be.bignumber.least(vestingAmount / 1000);
    });

    it('time is increased to duration deadline', async () => {
        await increaseTimeTo(vestingDeadlines[1] + 100001);
        console.log('[ Full Claim Period - Linear Vesting]'.yellow);
    });

    it('The vesting amount can be claimed', async () => {
        const vestingForAccount = TokenVesting.at(await vestingFactory.vestings(account2));
        const newBalance = await vestingForAccount.vestedAmount(coveeToken.address);
        newBalance.should.be.bignumber.equal(vestingAmount);
        const releasableAmount = await vestingForAccount.releasableAmount(coveeToken.address);
        releasableAmount.should.be.bignumber.equal(vestingAmount);
        const tx0 = await vestingForAccount.release(coveeToken.address);
        const events0 = getEvents(tx0, 'Released');
        assert.isDefined(events0);
    });
});
