const { compose, parallel } = require('../src/processor');


describe('Run If (Conditional Processor Execution)', () => {
    const basicProcessor = data => data.foo = 'bar';

    it('should run if no runIf is specified', async () => {
        const process = compose('No runIf');
        process.register('doFoo', basicProcessor);

        const { data } = await process.start({});

        expect(data.foo).toEqual('bar');
    });

    it('should not run if runIf returns false', async () => {
        const process = compose('No runIf');
        process.register('doFoo', basicProcessor, {
            runIf: () => false,
        });

        const { data } = await process.start({});

        expect(data.foo).toBeUndefined();
    });

    it('should run if runIf returns true', async () => {
        const process = compose('No runIf');
        process.register('doFoo', basicProcessor, {
            runIf: () => true,
        });

        const { data } = await process.start({});

        expect(data.foo).toEqual('bar');
    });

    it('should fail if runIf not func', async () => {
        const process = compose('No runIf');

        expect(() => {
            process.register('doFoo', basicProcessor, {
                runIf: true,
            });
        }, 'bool').toThrow();

        expect(() => {
            process.register('doFoo', basicProcessor, {
                runIf: 0,
            });
        }, 'num').toThrow();

        expect(() => {
            process.register('doFoo', basicProcessor, {
                runIf: 'asdf',
            });
        }, 'string').toThrow();

        expect(() => {
            process.register('doFoo', basicProcessor, {
                runIf: {},
            });
        }, 'object').toThrow();

        expect(() => {
            process.register('doFoo', basicProcessor, {
                runIf: [],
            });
        }, 'array').toThrow();

        expect(() => {
            process.register('doFoo', basicProcessor, {
                runIf: new Date(),
            });
        }, 'Date').toThrow();

        expect(() => {
            process.register('doFoo', basicProcessor, {
                runIf: null,
            });
        }, 'null').toThrow();

        expect(() => {
            process.register('doFoo', basicProcessor, {
                runIf: new Symbol('asdf'),
            });
        }, 'Symbol').toThrow();
    });

    it('should run if runIf returns true from async/promise', async () => {
        const process = compose('No runIf');
        process.register('doFoo', basicProcessor, {
            runIf: () => Promise.resolve(true),
        });

        const { data } = await process.start({});

        expect(data.foo).toEqual('bar');
    });

});