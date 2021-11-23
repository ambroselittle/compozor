const isRealObj = require('./isRealObj')
const { inspect } = require('util');
const { EventEmitter } = require("events");

const logEmitter = new EventEmitter();

const suppressDefaultLogging = (shouldSuppress = true) => process.env.COMPOZOR_SUPPRESS_DEFAULT_LOGGING = String(shouldSuppress);

// if no listeners are attached for the 'error' event, it will throw
// so we handle in production and log to stderr.. obvious can be overidden by supplying custom error func
logEmitter.on('error', (...args) => {
    // apps/tests can use this to prevent default logging
    !/true/i.test(String(process.env.COMPOZOR_SUPPRESS_DEFAULT_LOGGING)) && console.error(...args.map(arg => typeof arg === 'object' ? fmtObj(arg) : arg));
});

/**
 * Wraps a call to util.inspect with depth of 10.
 *
 * Normally I wrap logging into more sophistication, but trying to keep this library focused.
 *
 * @param {object} obj - any object that can be inspected
 */
const fmtObj = obj => inspect(obj, false, 10);

const SUPPORTED_LOG_FUNCS = ['verbose', 'debug', 'info', 'warn', 'error'];

// *** Loggers Message Queues: This is to save/emit messages that occur before an app uses setLoggingFuncs, so they can receive and log those. ***
// type MsgQ = {
//     listener: (...args: any[]) => void
//     removed?: boolean
//     q: any[][]
// }
const MAX_Q = 50; // using setLoggingFuncs should happen early in lifetime of app; this is mainly to catch module initialization type messages, so we are limiting so that the q doesn't get too big in case an app doesn't use this feature
const msgQueues = SUPPORTED_LOG_FUNCS.reduce((qs, fName) => {
    const q = [];
    const listener = (...args) => {
        if (q.length < MAX_Q) {
            // save log message
            q.push(args);
        } else {
            // stop listening
            logEmitter.removeListener(fName, listener);
            qs[fName] && (qs[fName].removed = true);
        }
    }
    qs[fName] = {
        q,
        listener
    };
    logEmitter.on(fName, listener); // start the q listening
    return qs;
}, {})

const drainQ = (fName, logFunc) => {
    const mq = msgQueues[fName];
    if (mq) {
        // emit each of the saved messages (in order received)
        mq.q.forEach(args => {
            logFunc(...args);
        })
        if (!mq.removed) {
            // if not already removed:
            logEmitter.removeListener(fName, mq.listener);
        }
        // clean up
        delete msgQueues[fName];
    }
}

// Gets a ref to the console log func but also will auto util.inspect any object type args when logging.
const getDefaultLogFunc = (funcName) => (...args) => logEmitter.emit(funcName, ...args.map(arg => isRealObj(arg) ? fmtObj(arg) : arg))

/** Logs the given values on the verbose event of the logEmitter. */
const verbose = getDefaultLogFunc('verbose');
/** Logs the given values on the debug event of the logEmitter. */
const debug = getDefaultLogFunc('debug');
/** Logs the given values on the info event of the logEmitter. */
const info = getDefaultLogFunc('info');
/** Logs the given values on the warn event of the logEmitter. */
const warn = getDefaultLogFunc('warn');
/** Logs the given values on the error event of the logEmitter. */
const error = getDefaultLogFunc('error');

/**
 * Use this to override the default logging functions used by the framework.
 *
 * @param {object} funcs - key/value pairs to override one or all supported logging funcs. All object keys must be supported and have functions as values. Supported Functions: 'verbose', 'debug', 'info', 'warn', 'error'
 *
 */
const setLoggingFuncs = (logFuncs) => {
    if (!isRealObj(logFuncs)) {
        throw Error('logFuncs should be an object with functions named the same as SUPPORTED_LOG_FUNCS.');
    }

    suppressDefaultLogging();
    const attachedEvents = [];
    SUPPORTED_LOG_FUNCS.forEach(logFuncName => {
        const logFunc = logFuncs[logFuncName];
        if (typeof logFunc === 'function') {
            drainQ(logFuncName, logFunc);
            logEmitter.on(logFuncName, (...args) => {
                logFunc(...args);
            });
            attachedEvents.push(logFuncName);
        }
    });
    verbose('Attached Log Funcs:', attachedEvents.join(', '));
}

module.exports = {
    SUPPORTED_LOG_FUNCS,
    logEmitter,

    suppressDefaultLogging,
    setLoggingFuncs,
    fmtObj,

    verbose,
    debug,
    info,
    warn,
    error,
}

