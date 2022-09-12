const logging = require('../src/logging');

const {
    disableErrorLogging,
    enableErrorLogging,
} = require('./utils');

describe('Logging', () => {
    const expectedFuncs = logging.SUPPORTED_LOG_FUNCS;

    beforeEach(enableErrorLogging);

    it('should export a all expected log functions', () => {
        expectedFuncs.forEach(funcName => {
            const logFn = logging[funcName];
            expect(typeof logFn, funcName).toEqual('function');
        })
    });

    it('should allow overriding functions', () => {
        disableErrorLogging();
        const subs = {
            verbose: jest.fn(),
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        logging.setLoggingFuncs(subs);

        expectedFuncs.forEach(funcName => {
            const logFn = logging[funcName];
            expect(typeof logFn, funcName).toEqual('function');
            logFn(funcName);
            expect(subs[funcName]).toBeCalledWith(funcName);
        })
    });

    it('should format object parameters by default', () => {
        const listener = jest.fn();
        logging.logEmitter.on('debug', listener);

        const testNum = 23872732;
        const testObj = { foo: 'bar' };
        const testString = 'my string';

        const expected = [testNum, testObj, testString];

        logging.debug(testNum, testObj, testString);

        expect(listener).toBeCalledWith(...expected);

        logging.logEmitter.off('debug', listener);
    });
});