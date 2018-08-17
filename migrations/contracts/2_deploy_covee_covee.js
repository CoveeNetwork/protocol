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

const cnf                 = require('../../config/contract-covee-covee.json');
const CoveeToken          = artifacts.require('./token/CoveeToken.sol');
const TokenVestingFactory = artifacts.require('./token/TokenVestingFactory.sol');
const Covee               = artifacts.require('./covee/Covee.sol');

module.exports = function (deployer, network, accounts) {
    const wallet      = accounts[6];
    const underwriter = accounts[9];

    deployer.deploy(CoveeToken, 1e+27).then(() => {
        return deployer.deploy(Covee, CoveeToken.address, underwriter, wallet);
    }).then(() => {
        return deployer.deploy(TokenVestingFactory, CoveeToken.address);
    });
};
