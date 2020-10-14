


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

module.exports = {
    processors,
    processorNames,
    mockProcessor,
    HttpResponse,
    testErrorLogger,
    sleep,
    disableErrorLogging: () => enableErrorLogs = false,
    enableErrorLogging: () => enableErrorLogs = true,
}