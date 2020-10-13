const { logEmitter } = require('../src/logging');
const { testErrorLogger } = require('./utils');

logEmitter.on('error', testErrorLogger); // just want to see any errors emitted by default during test