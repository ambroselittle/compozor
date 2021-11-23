const { logEmitter, suppressDefaultLogging } = require('../src/logging');
const { testErrorLogger } = require('./utils');

suppressDefaultLogging(); // avoids logging errors to stderr (which is default)

logEmitter.on('error', testErrorLogger); // just want to see any errors emitted by default during test