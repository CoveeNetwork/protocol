/**
 * @title Main entry point for the task runner
 * @version 0.7
 * @author Validity Labs AG <info@validitylabs.org>
 * @author Covee Network AG <info@covee.network>
 */

'use strict';

require('babel-polyfill');

const env   = process.env.NODE_ENV  || 'develop';
const task  = process.env.TASK;

if (env !== 'production') {
    require('babel-register');
}

const log = require('../lib/logger').logger;

if (!process.env.TASK) {
    log.error('No task passed!');
    process.exit(1);
}

log.info('======================================================');
// log.info('[ Args ]');
log.info('ENV\t: ' + env.toUpperCase());
log.info('Task\t: ' + task.toUpperCase());
// log.info('argv\t: ' + process.argv.toString());
log.info('======================================================');

require('./runner').run();
