const { compose, Errors } = require('../src/processor');
const { enableErrorLogging, disableErrorLogging, HttpResponse, clone } = require('./utils');
const { logEmitter } = require('../src/logging');
const { ProcessError } = require('../src/errors');


describe('Error Logging', () => {
    const startingContext = { myId: 382828 };

    const getStartingContext = () => clone(startingContext);

    const expectProcessError = (logFunc) => {
        expect(logFunc).toHaveBeenLastCalledWith(expect.any(ProcessError));
    }

    const expectStartingContext = (logFunc, beforeArgs = [], afterArgs = []) => {
        const allArgs = [
            ...beforeArgs,
            expect.objectContaining({ startingContext }),
            ...afterArgs,
        ]
        expect(logFunc).toHaveBeenCalledWith(...allArgs);
    }

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
            await process.start(getStartingContext());
        } catch (ex) {
            thrownEx = ex;
        }

        expect(logVerifier).not.toHaveBeenCalled();
        // start should wrap any errors from individual processors in a ProcessError
        expect(thrownEx).toBeInstanceOf(ProcessError);
    });

    it('does NOT log when thrown from processor if ex.doNotLog is unset', async () => {
        // we will defer to the caller of start (or the logging in send/fireAndForget) to log the error
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
            await process.start(getStartingContext());
        } catch (ex) {
            thrownEx = ex;
        }

        expect(logVerifier).not.toHaveBeenCalled();
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
        await process.send(res, getStartingContext());

        expect(logVerifier).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('does log once via send when thrown from processor', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const process = compose('Log Error in Send');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', () => {
            throw Error('Error')
        });

        let res = new HttpResponse();
        await process.send(res, getStartingContext());

        expect(logVerifier).toHaveBeenCalledTimes(1);
        expectProcessError(logVerifier);
        expectStartingContext(logVerifier);
        expect(res.status).toHaveBeenCalledWith(500);

        // try with continueOnError on
        res = new HttpResponse();
        await process.send(res, getStartingContext(), true);

        expect(logVerifier).toHaveBeenCalledTimes(2);
        expectProcessError(logVerifier);
        expectStartingContext(logVerifier);
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('does log once via fireAndForget when thrown from processor', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const process = compose('Log Error in fireAndForget');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', () => {
            throw Error('Error')
        });


        await process.fireAndForget(getStartingContext());

        expect(logVerifier).toHaveBeenCalledTimes(1);
        expectProcessError(logVerifier);
        expectStartingContext(logVerifier);

        await process.fireAndForget(getStartingContext(), true);

        expect(logVerifier).toHaveBeenCalledTimes(2);
        expectProcessError(logVerifier);
        expectStartingContext(logVerifier);
    });

    it('logs with starting context if error does not come from a processor', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged
        logEmitter.on('verbose', (msg) => {
            if (msg === `Executing 'foo' processor...`) { // trigger unexpected error outside of processor code but inside our handler
                throw new Error('Test');
            }
        });
        const processName = 'Log Non Processor Error in Send';
        const process = compose(processName);
        process.register('foo', (data) => { data.foo = 'bar' });

        let res = new HttpResponse();
        await process.send(res, getStartingContext());

        expect(logVerifier).toHaveBeenCalledTimes(1);
        expectStartingContext(logVerifier, [Errors.NonProcessError(processName)]);
        expect(res.status).toHaveBeenCalledWith(500);

    });

});