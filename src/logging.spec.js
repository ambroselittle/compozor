const logging = require('./logging');

describe('Logging', () => {
    const expectedFuncs = ['debug', 'info', 'warn', 'error'];

    it('should export a all expected log functions', () => {
        expectedFuncs.forEach(funcName => {
            const logFn = logging[funcName];
            expect(typeof logFn, funcName).toEqual('function');
        })
    });

    it('should allow overriding functions', () => {
        const subs = {
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

    it('should allow reset to console funcs after customizing', () => {
        const subs = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        expectedFuncs.forEach(fnName => {

        })

        const listeners = expectedFuncs.reduce((listeners, fnName) => {
            const fn = jest.fn();
            logging.logEmitter.on(fnName, fn);
            listeners[fnName] = fn;
            return listeners;
        }, {});

        logging.setLoggingFuncs(subs); // we verify this works in separate test

        logging.resetLogFuncs();

        expectedFuncs.forEach(funcName => {
            const logFn = logging[funcName];
            expect(typeof logFn, funcName).toEqual('function');
            logFn(funcName);
            expect(listeners[funcName]).toBeCalledWith(funcName);
            logging.logEmitter.off(funcName, logFn);
        });
    });

    it('should format object parameters by default', () => {
        const listener = jest.fn();
        logging.logEmitter.on('debug', listener);

        const testNum = 23872732;
        const testObj = { foo: 'bar' };
        const testString = 'my string';

        const expected = [testNum, require('util').inspect(testObj, false, 10), testString]; // see above note on jest mucking with console func params

        logging.debug(testNum, testObj, testString);

        expect(listener).toBeCalledWith(...expected);

        logging.logEmitter.off('debug', listener);
    });
});