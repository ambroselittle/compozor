const isRealObj = require('./isRealObj')
const { inspect } = require('util');
const { EventEmitter } = require("events");

const logEmitter = new EventEmitter();
// if no listeners are attached for the 'error' event, it will throw
// so we handle in production and log to stderr.. obvious can be overidden by supplying custom error func
logEmitter.on('error', (...args) => {
    if (process.env.NODE_ENV === 'production') {
        console.error(...args);
    }
});

/**
 * Wraps a call to util.inspect with depth of 10.
 *
 * Normally I wrap logging into more sophistication, but trying to keep this library focused.
 *
 * @param {object} obj - any object that can be inspected
 */
const fmtObj = obj => inspect(obj, false, 10);

const SUPPORTED_LOG_FUNCS = ['debug', 'info', 'warn', 'error'];

// Gets a ref to the console log func but also will auto util.inspect any object type args when logging.
const getDefaultLogFunc = (funcName) => (...args) => logEmitter.emit(funcName, ...args.map(arg => isRealObj(arg) ? fmtObj(arg) : arg))

const logFuncs = {};

/**
 * Use this to override the default logging functions used by the framework.
 *
 * @param {object} funcs - key/value pairs to override one or all supported logging funcs. All object keys must be supported and have functions as values. Supported Functions: 'debug', 'info', 'warn', 'error'
 *
 */
const setLoggingFuncs = (funcs) => {
    if (typeof funcs !== 'object' || Array.isArray(funcs) || funcs === null) {
        throw new Error('funcs must be a real object.');
    }
    Object.keys(funcs).forEach(funcName => {
        const func = funcs[funcName];
        if (typeof func !== 'function') {
            throw new Error(`All properties on the given funcs object must be functions. ${funcName} was ${typeof func}`);
        }
        if (!SUPPORTED_LOG_FUNCS.some(supportedName => supportedName === funcName)) {
            throw new Error(`Log function name '${funcName}' is not supported. Supported: ${SUPPORTED_LOG_FUNCS}`);
        }
        logFuncs[funcName] = func;
    })
}

/**
 * Configure to use default logging functions, which will use log functions on console.
 */
const resetLogFuncs = () => {
    setLoggingFuncs(SUPPORTED_LOG_FUNCS.reduce((logFuncs, funcName) => {
        logFuncs[funcName] = getDefaultLogFunc(funcName);
        return logFuncs;
    }, {}));
}

// initialize to just use console funcs by default
resetLogFuncs();


module.exports = {
    debug: (...args) => logFuncs.debug(...args),
    info: (...args) => logFuncs.info(...args),
    warn: (...args) => logFuncs.warn(...args),
    error: (...args) => logFuncs.error(...args),
    fmtObj,
    setLoggingFuncs,
    resetLogFuncs,
    logEmitter,
}

