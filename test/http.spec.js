const { compose, parallel } = require('../src/processor');
const { HttpResponse, enableErrorLogging, disableErrorLogging, mockProcessor } = require('./utils');
const { getOkContent, getErrorContent } = require('../src/response');
const { ProcessorError } = require('../src/errors');
const { logEmitter } = require('../src/logging');

describe('HTTP Request/Response', () => {
    beforeEach(enableErrorLogging);

    it('should send composite data to response when using send', async () => {
        const process = compose('Send');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', (data) => { data.bar = 'foo' });
        const res = new HttpResponse();

        await process.send(res, {});

        const expectedResponseData = getOkContent({ foo: 'bar', bar: 'foo' });

        expect(res.status).toBeCalledWith(200);
        expect(res.send).toBeCalledWith(expectedResponseData);
    });

    it('should send error data to response when using send and processor throws an error', async () => {
        disableErrorLogging();
        const process = compose('Basic Error');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', () => { throw Error('Error') });
        const res = new HttpResponse();

        await process.send(res, {});

        const expectedResponseData = getErrorContent("Error executing process 'Basic Error'.");

        expect(res.status).toBeCalledWith(500);
        expect(res.send).toBeCalledWith(expectedResponseData);
    });

    it('should log error when a processor throws an error', async () => {
        disableErrorLogging(); // disables our default log to console.error (to keep jest console clean when we expect an error)

        const logVerifier = jest.fn();
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const process = compose('Log Error');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', () => { throw Error('Error') });
        const res = new HttpResponse();

        await process.send(res, {});

        expect(logVerifier).toHaveBeenCalled();
    });

    describe('Customizing Error Response', () => {
        it('should send supplied error message/status/data to response when using send and processor throws an ProcessorError', async () => {
            disableErrorLogging();
            const process = compose('Custom Error');
            process.register('foo', (data) => { data.foo = 'bar' });

            const processorErrorDetails = { errBar: 'fooErr' };
            const statusErrorCode = 501;
            const specificResponseErrorMessage = 'Could not do the thing.';

            process.register('bar', () => {
                throw new ProcessorError('Error', {
                    text: specificResponseErrorMessage,
                    statusCode: statusErrorCode,
                    errors: processorErrorDetails,
                })
            });
            const res = new HttpResponse();

            await process.send(res, {});

            const expectedResponseData = getErrorContent(specificResponseErrorMessage, processorErrorDetails);

            expect(res.status).toBeCalledWith(statusErrorCode);
            expect(res.send).toBeCalledWith(expectedResponseData);
        });

        it('should send given Error message if no text prop supplied in ProcessorError responseInfo', async () => {
            disableErrorLogging();
            const process = compose('Message Fallback');
            process.register('foo', (data) => { data.foo = 'bar' });

            const processorErrorDetails = { errBar: 'fooErr' };
            const statusErrorCode = 550;
            const specificResponseErrorMessage = 'Could not do the thing.';

            process.register('bar', () => {
                throw new ProcessorError(specificResponseErrorMessage, {
                    statusCode: statusErrorCode,
                    errors: processorErrorDetails,
                })
            });
            const res = new HttpResponse();

            await process.send(res, {});

            const expectedResponseData = getErrorContent(specificResponseErrorMessage, processorErrorDetails);

            expect(res.status).toBeCalledWith(statusErrorCode);
            expect(res.send).toBeCalledWith(expectedResponseData);
        });

        it('should send highest status code/details if multiple processors throw errors with continueOnError', async () => {
            disableErrorLogging();
            const process = compose('Multiple Errors in Sequence');
            process.register('foo', () => {
                throw new ProcessorError('Problem validating.', {
                    statusCode: 400,
                    errors: { code: 'BAD_INFO' }
                })
            });

            const processorErrorDetails = { errBar: 'fooErr' };
            const statusErrorCode = 550;
            const specificResponseErrorMessage = 'Could not do the thing.';

            process.register('bar', () => {
                throw new ProcessorError(specificResponseErrorMessage, {
                    statusCode: statusErrorCode,
                    errors: processorErrorDetails,
                })
            });
            const res = new HttpResponse();

            await process.send(res, {}, true); // we use continue on error to prove this test without parallelizing

            const expectedResponseData = getErrorContent(specificResponseErrorMessage, processorErrorDetails);

            expect(res.status).toBeCalledWith(statusErrorCode);
            expect(res.send).toBeCalledWith(expectedResponseData);
        });

        it('should send highest status code/details if multiple processors throw errors in parallel', async () => {
            disableErrorLogging();
            const processorErrorDetails = { errBar: 'fooErr' };
            const statusErrorCode = 550;
            const specificResponseErrorMessage = 'Could not do the thing.';

            const process = compose('Parallel Error', {
                processors: [
                    // because parallel processors are initiated as a group, we can't stop processing if just one errors
                    // so all will complete, and then the results are aggregated
                    // we aggregate errors by choosing the most severe by max status code
                    parallel(
                        mockProcessor('foo', {
                            process: () => {
                                throw new ProcessorError('Problem validating.', {
                                    statusCode: 400,
                                    errors: { code: 'BAD_INFO' }
                                })
                            }
                        }),
                        mockProcessor('bar', {
                            process: () => {
                                throw new ProcessorError(specificResponseErrorMessage, {
                                    statusCode: statusErrorCode,
                                    errors: processorErrorDetails,
                                })
                            }
                        }),

                    ),
                ]
            });

            const res = new HttpResponse();

            await process.send(res, {});

            const expectedResponseData = getErrorContent(specificResponseErrorMessage, processorErrorDetails);

            expect(res.status).toBeCalledWith(statusErrorCode);
            expect(res.send).toBeCalledWith(expectedResponseData);
        });

        it('should sends 500 by default if no statusCode prop supplied in ProcessorError responseInfo', async () => {
            disableErrorLogging();
            const process = compose('Default Status Code');
            process.register('foo', (data) => { data.foo = 'bar' });

            const processorErrorDetails = { errBar: 'fooErr' };
            const specificResponseErrorMessage = 'Could not do the thing.';

            process.register('bar', () => {
                throw new ProcessorError(specificResponseErrorMessage, {
                    errors: processorErrorDetails,
                })
            });
            const res = new HttpResponse();

            await process.send(res, {});

            const expectedResponseData = getErrorContent(specificResponseErrorMessage, processorErrorDetails);

            expect(res.status).toBeCalledWith(500);
            expect(res.send).toBeCalledWith(expectedResponseData);
        });

    });


});