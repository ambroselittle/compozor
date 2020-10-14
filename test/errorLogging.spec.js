const { compose } = require('../src/processor');
const { enableErrorLogging, disableErrorLogging } = require('./utils');
const { logEmitter } = require('../src/logging');
const { ProcessError } = require('../src/errors');


describe('Error Logging', () => {
    beforeEach(enableErrorLogging);

    it('does not log error thrown from processor if ex.doNotLog is true', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const process = compose('Suppress Log Error');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', () => {
            try {
                throw Error('Error')
            } catch (ex) {
                ex.doNotLog = true;
                throw ex;
            }
        });

        let thrownEx = null;
        try {
            await process.start({});
        } catch (ex) {
            thrownEx = ex;
        }

        expect(logVerifier).not.toHaveBeenCalled();
        // start should wrap any errors from individual processors in a ProcessError
        expect(thrownEx).toBeInstanceOf(ProcessError);
    });

    it('does log error thrown from processor if ex.doNotLog is unset', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const process = compose('Suppress Log Error');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', () => {
            throw Error('Error')
        });

        let thrownEx = null;
        try {
            await process.start({});
        } catch (ex) {
            thrownEx = ex;
        }

        expect(logVerifier).toHaveBeenCalledTimes(1);
        // start should wrap any errors from individual processors in a ProcessError
        expect(thrownEx).toBeInstanceOf(ProcessError);
    });

});