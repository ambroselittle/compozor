const { compose, parallel } = require('../src/processor');

describe('Process Composition', () => {
    const processorsPath = require('path').join(__dirname, './composition');

    it('composes with expected functions/data (interface) available', async () => {

        const procName = 'Compose Interface';
        const process = compose(procName, {
            processorsPath,
            pipeline: [
                'step1',
                'step2',
            ],
        });

        expect(typeof process.register).toBe('function')
        expect(typeof process.deregister).toBe('function')
        expect(typeof process.use).toBe('function')
        expect(typeof process.start).toBe('function')
        expect(typeof process.send).toBe('function')
        expect(typeof process.writeErrors).toBe('function')
        expect(typeof process.fireAndForget).toBe('function')
        expect(process.processName).toEqual(procName);

    });

    it('allows composition of a list of select processors within a given folder', async () => {

        const process = compose('Compose Select', {
            processorsPath,
            pipeline: [
                'step1',
                'step2',
            ],
        });

        const { data } = await process.start({});

        expect(data.step1).toBe(true);
        expect(data.step2).toBe(true);
        expect(data.step1AlreadySet).toBe(true);
        expect(data.sidestep).toBeUndefined();
    });

    it('allows composition of all processors within a given folder', async () => {

        const process = compose('Compose All', {
            processorsPath,
        });

        const { data } = await process.start({});

        expect(data.step1).toBe(true);
        expect(data.step2).toBe(true);
        expect(data.sidestep).toBe(true);
    });

    it('allows composition of some processors in parallel', async () => {

        const process = compose('Compose Parallel', {
            processorsPath,
            pipeline: [
                parallel(
                    'slowStep1',
                    'step2',
                ),
            ],
        });

        const { data } = await process.start({});

        expect(data.step1).toBe(true);
        expect(data.step2).toBe(true);
        expect(data.step1AlreadySet).toBeUndefined(); // this verifies that step2 executed before slowStep1. (See notes in slowStep one for some details around this.)
    });


    it('allows executes in sequence if parallel is not specified', async () => {

        const process = compose('Compose Sequence', {
            processorsPath,
            pipeline: [
                'slowStep1',
                'step2',
            ],
        });

        const { data } = await process.start({});

        expect(data.step1).toBe(true);
        expect(data.step2).toBe(true);
        expect(data.step1AlreadySet).toBe(true); // inverts the check for parallel, showing it will wait on prior step even if prior has "slow" async operations
    });

    it('supports registering new processors functionally', async () => {
        const process = compose('Registering');
        process.register('step1', (data) => { data.step1 = true; });
        const { data } = await process.start({});

        expect(data.step1).toBe(true);
    });

    it('supports deregistering processors functionally', async () => {
        const process = compose('Registering');

        process.register('step1', (data) => { data.step1 = true; });
        process.deregister('step1');
        const { data } = await process.start({});

        expect(data.step1).toBe(undefined);
    });
});