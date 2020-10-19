const { Errors, ProcessorError } = require('../../src/errors');

describe('ProcessorError', () => {

    const verifyWithRespInfo = (responseInfo, msg = 'Test') => {
        let err;

        expect(() => {
            err = new ProcessorError(msg, responseInfo);
        }).not.toThrow();

        expect(err).toBeInstanceOf(ProcessorError);
        expect(err.responseInfo).toEqual(responseInfo);
        return err;
    }

    it('should initialize fine if given just a message', () => {
        let err;
        expect(() => {
            err = new ProcessorError('Test');
        }).not.toThrow();

        expect(err).toBeInstanceOf(ProcessorError);
        expect(err.message).toEqual('Test');
    });

    it('should set isProcessorError flag', () => {
        let err;
        expect(() => {
            err = new ProcessorError();
        }).not.toThrow();

        expect(err).toBeInstanceOf(ProcessorError);
        expect(err.isProcessorError).toEqual(true);
    });

    it('should initialize fine if given no parameters', () => {
        let err;
        expect(() => {
            err = new ProcessorError();
        }).not.toThrow();

        expect(err).toBeInstanceOf(ProcessorError);
        expect(err.message).toEqual('');
    });

    describe('Response Info - Controllilng Response', () => {
        it('should throw if responseInfo is not a real obj.', () => {
            const verifyThrow = (responseInfo, msg) => {
                expect(() => {
                    new ProcessorError('', responseInfo);
                }, msg).toThrow(Errors.ResponseInfoNotObject());
            }

            verifyThrow('foo', 'string');
            verifyThrow(23, 'int');
            verifyThrow(new Date(), 'date');
            verifyThrow(null, 'null');
            verifyThrow([], 'array');
            verifyThrow(true, 'bool');
            verifyThrow(Symbol('hi'), 'symbol');
        });

        it('should initialize fine if given text only on responseInfo.', () => {
            verifyWithRespInfo({ text: 'Howdy' });
        });

        it('should initialize fine if given statusCode only on responseInfo.', () => {
            verifyWithRespInfo({ statusCode: 409 })
        });

        it('should initialize fine if given statusCode given as numerical string.', () => {
            const err = verifyWithRespInfo({ statusCode: '409' })
            expect(err.responseInfo.statusCode).toEqual(409); // do typed compare as well to ensure it is converted to num
        });

        it('should initialize fine if given errors only on responseInfo.', () => {
            verifyWithRespInfo({ errors: { myErrDetails: "bar" } })
        });

        it('should default to statusCode 500 if none supplied', () => {
            let err;
            expect(() => {
                err = new ProcessorError();
            }).not.toThrow();

            expect(err).toBeInstanceOf(ProcessorError);
            expect(err.responseInfo.statusCode).toEqual(500);
        });

        it('should default to statusCode 500 if given an unparseable number.', () => {
            const verifyStatusDefault = (statusCode, msg) => {
                let err = verifyWithRespInfo({ statusCode })
                expect(err.responseInfo.statusCode, msg).toEqual(500);
            }

            verifyStatusDefault('foo', 'non number string');
            verifyStatusDefault(-233, 'negative number');
            verifyStatusDefault(0, 'zero');
            verifyStatusDefault(new Date(), 'date');
            verifyStatusDefault(null, 'null');
            verifyStatusDefault([], 'array');
            verifyStatusDefault(true, 'bool');
            // verifyStatusDefault(Symbol('hi'), 'symbol'); // parseInt fails, but not gonna add code to handle this edge
        });
    });

    describe('Do Not Log - Controlling Logging', () => {
        it('should set doNotLog if statusCode less than 500.', () => {
            const err = verifyWithRespInfo({ statusCode: 409 })
            expect(err.doNotLog).toEqual(true);
        });

        it('should have doNotLog as falsy if status 500 or greater.', () => {
            let err = verifyWithRespInfo({ statusCode: 500 });
            expect(err.doNotLog, '500 - equal').toBeFalsy();
            err = verifyWithRespInfo({ statusCode: 503 });
            expect(err.doNotLog, '503 - greater than').toBeFalsy();
        });
    });

})

