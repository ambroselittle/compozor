const { Errors, ProcessError, ProcessorError } = require('../../src/errors');

describe('ProcessorError', () => {
    it('should throw if not given process name or it is not a string.', () => {
        const verifyThrow = (processName, msg) => {
            expect(() => {
                new ProcessError(processName);
            }, msg).toThrow(Errors.ProcessNameNotString(processName));
        }

        verifyThrow({}, 'obj');
        verifyThrow(23, 'int');
        verifyThrow(new Date(), 'date');
        verifyThrow(null, 'null');
        verifyThrow([], 'array');
        verifyThrow(true, 'bool');
        verifyThrow(Symbol('hi'), 'symbol');
    });

    it('should initialize fine if given just process name.', () => {
        let err;
        expect(() => {
            err = new ProcessError('My Process');
        }).not.toThrow();

        expect(err).toBeInstanceOf(ProcessError);
        expect(err.message).toEqual(Errors.ProcessErrorMessage('My Process'));
    });

    it('should set isProcessError flag', () => {
        let err;
        expect(() => {
            err = new ProcessError('My Process');
        }).not.toThrow();

        expect(err).toBeInstanceOf(ProcessError);
        expect(err.isProcessError).toEqual(true);
    });

    it('should save startingContext on error object.', () => {
        let err;
        const startingContext = { foo: 'bar' };
        expect(() => {
            err = new ProcessError('My Process', startingContext);
        }).not.toThrow();

        expect(err).toBeInstanceOf(ProcessError);
        expect(err.message).toEqual(Errors.ProcessErrorMessage('My Process'));
        expect(err.startingContext).toEqual(startingContext);

    });

    describe('Aggregating Errors from Processors in Process', () => {
        it('should throw if given non array for errorsFromProcessors', () => {
            const verifyThrow = (errorsFromProcessors, msg) => {
                expect(() => {
                    new ProcessError('Process', {}, errorsFromProcessors);
                }, msg).toThrow(Errors.ErrorsFromProcesssorsNotArray('Process'));
            }

            verifyThrow({}, 'obj');
            verifyThrow(23, 'int');
            verifyThrow(new Date(), 'date');
            verifyThrow(null, 'null');
            verifyThrow('foo', 'string');
            verifyThrow(true, 'bool');
            verifyThrow(Symbol('hi'), 'symbol');
        });

        it('should set errorsFromProcessors if given as array', () => {
            const errs = [{ foo: 'bar' }];
            const err = new ProcessError('Test', {}, errs);
            expect(err.errorsFromProcessors).toEqual(errs);
        });

        it('should default errorsFromProcessors to array', () => {
            const err = new ProcessError('Test');
            expect(Array.isArray(err.errorsFromProcessors)).toBe(true);
        });

        describe('Getting Most Severe Processor Error for Logs', () => {
            it('should allow getting most severe ProcessorError by status code', () => {
                const mostSevere = { ex: new ProcessorError('Two', { statusCode: 500, }) };
                const errs = [
                    { ex: new ProcessorError('One', { statusCode: 400, }) },
                    mostSevere,
                    { ex: new ProcessorError('Three', { statusCode: 400, }) },
                ];
                const err = new ProcessError('Test', {}, errs);
                expect(err.errorsFromProcessors).toEqual(errs);
                expect(err.getMostSevereProcessorError()).toEqual(mostSevere.ex);
            });
        });

        describe('Get If Any Errors Should Be Logged', () => {
            it('should say all given errors from processors have been logged if they have', () => {
                const getErr = (name, statusCode, doNotLog) => {
                    const err = new ProcessorError(name, { statusCode });
                    err.doNotLog = doNotLog; // this will default based on rules in ProcessorError, but we override here to be explicit for test
                    return err;
                }
                const mostSevere = { ex: getErr('One', 500, true) };
                const errs = [
                    { ex: getErr('One', 400, true) },
                    mostSevere,
                    { ex: getErr('Three', 400, true) },
                ];
                const err = new ProcessError('Test', {}, errs);
                expect(err.errorsFromProcessors).toEqual(errs);
                expect(err.allErrorsLogged()).toEqual(true);
            });

            it('should say all given errors from processors have NOT been logged if they have NOT', () => {
                const getErr = (name, statusCode, doNotLog) => {
                    const err = new ProcessorError(name, { statusCode });
                    err.doNotLog = doNotLog;
                    return err;
                }
                const mostSevere = { ex: getErr('One', 500) }; // will set doNotLog to undef
                const errs = [
                    { ex: getErr('One', 400, true) },
                    mostSevere,
                    { ex: getErr('Three', 400, true) },
                ];
                const err = new ProcessError('Test', {}, errs);
                expect(err.errorsFromProcessors).toEqual(errs);
                expect(err.allErrorsLogged()).toEqual(false);
            });

        });
    });
});
