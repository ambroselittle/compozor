


const mockProcessor = (name, { process, runIf, prerequisites = [] } = {}) => ({
    name,
    process: jest.fn(process || (async (data, context) => ({ data, context }))),
    runIf: jest.fn(runIf || (async () => true)),
    prerequisites
})

const processorNames = {
    getFoo: 'getFoo',
    getBar: 'getBar',
    getBaz: 'getBaz',
    doFoo: 'doFoo',
    doBar: 'doBar',
}
const processors = {};

Object.keys(processorNames).forEach(name => {
    processors[name] = (...args) => mockProcessor(name, ...args);
});

class HttpResponse {
    constructor() {
        this.cookie = jest.fn();
        this.clearCookie = jest.fn();
        this.status = jest.fn(() => this);
        this.send = jest.fn();
    }
}


function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

let enableErrorLogs = true;
const testErrorLogger = (...args) => enableErrorLogs && console.error(...args);

/**
 * Gets a clone using the JSON.stringify -> parse approach. Note this can result in some values not being strictly equivalent, like dates.
 *
 * @param {object} obj - arbitrary object to clone
 * @param {boolean} runMapper - run our from DB value mapper (to convert stringified values like dates and such to real JS objects)
 */
const clone = (obj, runMapper = false) => {
    const cloned = JSON.parse(JSON.stringify(obj));
    return runMapper ? mapAllResults(cloned) : cloned;
}


module.exports = {
    clone,
    processors,
    processorNames,
    mockProcessor,
    HttpResponse,
    testErrorLogger,
    sleep,
    disableErrorLogging: () => enableErrorLogs = false,
    enableErrorLogging: () => enableErrorLogs = true,
}