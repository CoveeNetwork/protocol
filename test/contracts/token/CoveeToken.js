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
 * Test for the Covee token.
 *
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 */

import {expectThrow, waitNDays, getEvents, BigNumber, increaseTimeTo} from '../helpers/tools';
import {Stages} from '../../../src/helpers/covee-tools.js';

const web3 = require('web3');
const Token = artifacts.require('./CoveeToken.sol');
const Decimals = 1e18;
const Cap = 1e9*Decimals;

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('Covee Token', (accounts) => {
    const initiator     = accounts[0];
    const otherAccount  = accounts[1];
    let coveeToken;

    beforeEach(async () => {
        coveeToken    = await Token.deployed();
    });

    it('Tokens should be mintable up to cap but no further', async () => {
        await coveeToken.mint(initiator, Cap);
        const oldBalance = await coveeToken.balanceOf(initiator);

        try {
            await coveeToken.mint(initiator, 1);
            assert.isTrue(false);
        } catch (error){
            assert.isTrue(true);
        }
        const newBalance = await coveeToken.balanceOf(initiator);
        newBalance.should.be.bignumber.equal(oldBalance);

    });

    it('The ownership of the token should be transferable', async () => {
        const oldOwner = await coveeToken.owner();
        await coveeToken.transferOwnership(otherAccount);
        const newOwner = await coveeToken.owner();
        assert.equal(newOwner, otherAccount);
    });

    it('Tokens should be burnable', async () => {
        await coveeToken.burn(1000*1e18);
        const newBalance = await coveeToken.balanceOf(initiator);
        newBalance.should.be.bignumber.equal(Cap-1000*1e18);
    });
});
