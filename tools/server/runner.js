/**
 * @title ES6 Runner script
 * @version 0.7
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 *
 * @TODO: Catch all stdout from sub processes and pipe them through the logger util
 * @TODO: For test runner, count the passing / pending/ failing test cases and output summary after all tests have run (@see SolCover => already implemented)
 */

import {spawn} from 'child_process';
import {spawnSync} from 'child_process';
import kill from 'tree-kill';
import {logger as log} from '../lib/logger';
import sh from 'shelljs';
import fs from 'fs';
import path from 'path';

const env           = process.env.NODE_ENV  || 'develop';
const task          = process.env.TASK;
const bnode         = env === 'production' ? 'node' : 'babel-node';
const configDir     = path.join(__dirname, '/../../config/');
const deploymentDir = path.join(__dirname, '/../../deployment/contracts/');
let dead            = false;

/**
 * Get all tests from config files
 *
 * @returns {array} Test collection
 */
function getTests() {
    const tests = []; // Object.freeze(tests); // => make tests array immutable
    const files = fs.readdirSync(configDir);

    files.forEach((file) => {
        // read only contract config files
        if (file.split('-')[0] === 'contract') {
            const props = fs.readFileSync(path.join(configDir, file), 'utf8');
            const data  = JSON.parse(props);

            if (data.tests) {
                data.tests.forEach((test) => {
                    tests.push(test);
                });
            }
        }
    });
    return tests;
}

/**
 * Get all deployment files (containing auto execution)
 *
 * @returns {array} Deployment files
 */
function getDeployments() {
    const deployments   = [];
    const files         = fs.readdirSync(deploymentDir);

    files.forEach((file) => {
        deployments.push(path.join('babel-node ', deploymentDir, file));
    });

    return deployments;
}

/**
 * Do a clean exit and kill all (child) processes properly
 *
 * @returns {void}
 */
function cleanExit() {
    if (!dead) {
        log.info('Clean up all (sub) processes');
        kill(process.pid);
        dead = true;
    }
}

/**
 * Listen to all async process events
 *
 * @param {object} p Process
 * @returns {void}
 */
function listen(p) {
    p.on('exit', () => {
        cleanExit();
    });

    p.on('SIGINT', cleanExit);    // Catch ctrl-c
    p.on('SIGTERM', cleanExit);   // Catch kill

    p.on('error', (err) => {
        log.error('onError:');
        log.error(err);
        p.exit(1);
    });

    p.on('unhandledRejection', (err) => {
        log.error(err);
        p.exit(1);
    });

    p.on('uncaughtException', (err) => {
        log.error('onUncaughtException:');
        log.error(err);
        p.exit(1);
    });
}

/**
 * Spawn a new ganache server
 *
 * @returns {void}
 */
function spawnServer() {
    return spawn(bnode + ' ./tools/server/ganache', {
        stdio: 'inherit',
        shell: true
    });
}

/**
 * Async sleep
 *
 * @param {integer} time Time in milliseconds
 * @returns {Promise} Promise
 */
async function sleep(time) {
    return new Promise(function (resolve) {
        setTimeout(function () {
            resolve();
        }, time);
    });
}

/**
 * Bundle the contracts
 *
 * @returns{void}
 */
function bundle() {
    log.info('Bundling the contracts');

    sh.rm('-fr', 'build');
    sh.mkdir('build');
    sh.mkdir('build/bundle');

    spawnSync('solcpiler --config-file ./config/solcpiler.json', {
        stdio: 'inherit',
        shell: true
    });
}

// Listen to main process
listen(process);

/**
 * Run specific procedure
 *
 * @returns {void}
 * @export
 */
export async function run() {
    switch (task) {
        case 'compile':
            spawnSync('truffle compile --all', {
                stdio: 'inherit',
                shell: true
            });

            cleanExit();

            break;
        case 'testrpc':
            process.env.verbose = true;
            listen(spawnServer());

            break;
        case 'migrate':
            listen(spawnServer());
            spawnSync('truffle migrate --reset --compile-all --network develop', {
                stdio: 'inherit',
                shell: true
            });
            cleanExit();

            break;
        case 'bundle':
            bundle();
            break;
        case 'deploy':
            const deployments = getDeployments();

            bundle();

            for (let i = 0; i < deployments.length; i++) {
                log.info('Running deployment ' + (i + 1) + ' of ' + deployments.length);

                spawnSync(deployments[i], {
                    stdio: 'inherit',
                    shell: true
                });
            }

            cleanExit();
            break;
        case 'test':
            const tests = getTests();

            for (let i = 0; i < tests.length; i++) {
                const test      = tests[i];
                const server    = spawnServer();

                listen(server);

                log.info('Running test ' + (i + 1) + ' of ' + tests.length);

                spawnSync('truffle test ' + test + ' --network develop', {
                    stdio: 'inherit',
                    shell: true
                });

                kill(server.pid);

                if (i < (tests.length - 1)) {
                    await sleep(1000);
                }
            }
            break;
        case 'coverage':
            // @TODO: refactor SolCover + pull request + start coverage task without provided TestRPC (user our own Ganache Server)

            // remove build folder, otherwise the result of code coverage might not be correct
            sh.rm('-fr', './build');

            spawnSync('solidity-coverage', {
                stdio: 'inherit',
                shell: true
            });
            cleanExit();

            break;
        default:
    }
}
