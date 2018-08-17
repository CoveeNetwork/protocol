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
 * Truffle configuration
 */

const cnf               = require('./config/networks.json');
const HDWalletProvider  = require('truffle-hdwallet-provider');

require('babel-register');
require('babel-polyfill');

const network   = process.env.NETWORK;
let secrets     = '';

if (network === 'rinkebyInfura') {
    secrets = require('./config/.secrets.json');
}

const path      = require('path');
const basePath  = process.cwd();

const buildDir          = path.join(basePath, 'build');
const buildDirContracts = path.join(basePath, 'build/contracts');
const srcDir            = path.join(basePath, 'src/contracts');
const testDir           = path.join(basePath, 'test/contracts');
const migrationsDir     = path.join(basePath, 'migrations/contracts');

module.exports = {
    mocha: {
        useColors: true,
        // reporter: 'eth-gas-reporter',
        // reporterOptions : {
        //     currency: 'EUR',
        //     gasPrice: 21
        // }
    },
    solc: {
        optimizer: {
            enabled:    true,
            runs:       200
        }
    },
    networks: {
        develop: {
            host:       cnf.networks.develop.host,
            port:       cnf.networks.develop.port,
            network_id: cnf.networks.develop.chainId, // eslint-disable-line
            gas:        cnf.networks.develop.gas,
            gasPrice:   cnf.networks.develop.gasPrice
        },
        coverage: {
            host:       cnf.networks.coverage.host,
            network_id: cnf.networks.coverage.chainId, // eslint-disable-line
            port:       cnf.networks.coverage.port,
            gas:        cnf.networks.coverage.gas,
            gasPrice:   cnf.networks.coverage.gasPrice
        },
        rinkebyInfura:  getRinkebyConfig()
    },
    build_directory:            buildDir,            // eslint-disable-line
    contracts_build_directory:  buildDirContracts,   // eslint-disable-line
    migrations_directory:       migrationsDir,       // eslint-disable-line
    contracts_directory:        srcDir,              // eslint-disable-line
    test_directory:             testDir              // eslint-disable-line
};

function getRinkebyConfig() {
    let rinkebyProvider = '';

    if (network === 'rinkebyInfura') {
        rinkebyProvider = new HDWalletProvider(secrets.rinkeby.mnemonic, secrets.rinkeby.host);

        return {
            network_id: cnf.networks.rinkeby.chainId, // eslint-disable-line
            provider:   rinkebyProvider,
            from:       rinkebyProvider.getAddress(),
            gas:        cnf.networks.rinkeby.gas,
            gasPrice:   cnf.networks.rinkeby.gasPrice
        };
    }
}
