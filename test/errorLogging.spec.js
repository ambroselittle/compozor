const { compose } = require('../src/processor');
const { enableErrorLogging, disableErrorLogging, HttpResponse } = require('./utils');
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

    it('does log once when thrown from processor if ex.doNotLog is unset', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const process = compose('Log Error');
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

    it('does not log via send when thrown from processor if ex.doNotLog is true', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const process = compose('Suppress Log Error in Send');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', () => {
            try {
                throw Error('Error')
            } catch (ex) {
                ex.doNotLog = true;
                throw ex;
            }
        });

        const res = new HttpResponse();
        await process.send(res, {});

        expect(logVerifier).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('does log once via send when thrown from processor if ex.doNotLog is true', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const process = compose('Log Error in Send');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', () => {
            throw Error('Error')
        });

        const res = new HttpResponse();
        await process.send(res, {});

        expect(logVerifier).toHaveBeenCalledTimes(1);
        expect(logVerifier).toHaveBeenCalledWith({})
        expect(res.status).toHaveBeenCalledWith(500);
    });

});