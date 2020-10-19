const { Errors, InvalidProcessError } = require('../../src/errors');

describe('ProcessorError', () => {
    it('should throw if not given process name or it is not a string.', () => {
        const verifyThrow = (processName, msg) => {
            expect(() => {
                new InvalidProcessError(processName);
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
            err = new InvalidProcessError('My Process');
        }).not.toThrow();

        expect(err).toBeInstanceOf(InvalidProcessError);
        expect(err.message).toEqual(Errors.InvalidProcessErrorMessage('My Process'));
    });

    it('should set isInvalidProcessError flag', () => {
        let err;
        expect(() => {
            err = new InvalidProcessError('My Process');
        }).not.toThrow();

        expect(err).toBeInstanceOf(InvalidProcessError);
        expect(err.isInvalidProcessError).toEqual(true);
    });

    it('should save given details on error object.', () => {
        let err;
        const details = { foo: 'bar' };
        expect(() => {
            err = new InvalidProcessError('My Process', details);
        }).not.toThrow();

        expect(err).toBeInstanceOf(InvalidProcessError);
        expect(err.message).toEqual(Errors.InvalidProcessErrorMessage('My Process'));
        expect(err.details).toEqual(details);

    });


});
