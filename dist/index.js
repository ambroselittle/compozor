const { compose, parallel, single } = require('../src/processor');
const { ProcessorError } = require('../src/errors');
const { bindResponseUtils } = require('../src/response');
const { setLoggingFuncs, resetLogFuncs, logEmitter } = require('../src/logging');

module.exports = {
    // * Process/Processor
    compose,
    parallel,
    single,
    ProcessorError,

    // * Logging
    setLoggingFuncs,
    resetLogFuncs,
    logEmitter,
}