const { compose, parallel } = require('../src/processor');

describe('Race Conditions', () => {
    const processorsPath = require('path').join(__dirname, './composition');

    it('should have state from slower processor that does not return objects', async () => {
        // discovered a race condition where a processor that modifies
        // root context (or data) and does not return its modified objects
        // will lose its root state (for later processors in the process)
        // this test proved that condition (and should avoid in future)

        // the prob was with closure references that get overwritten with processor results

        const procName = 'With Slower No Return';
        const process = compose(procName, {
            processorsPath,
            pipeline: [
                parallel(
                    'waitAndNoReturn',
                    'modifyAndReturn',
                ),
            ],
        });

        const { data, context } = await process.start({ starter: true });

        // starting context value
        expect(context.starter).toEqual(true);

        // modifyAndReturn values
        expect(data.modifyAndReturnData).toEqual('modifyAndReturnData');
        expect(context.modifyAndReturnContext).toEqual('modifyAndReturnContext');

        // waitAndNoReturn values
        expect(data.slowDataNoReturn).toEqual('slowDataNoReturn');
        expect(context.slowContextNoReturn).toEqual('slowContextNoReturn');

    });

    it('should have state from slower processor that does return objects', async () => {
        const procName = 'With Slower And Return';
        const process = compose(procName, {
            processorsPath,
            pipeline: [
                parallel(
                    'waitAndReturn',
                    'modifyAndReturn',
                ),
            ],
        });

        const { data, context } = await process.start({ starter: true });

        // starting context value
        expect(context.starter).toEqual(true);

        // modifyAndReturn values
        expect(data.modifyAndReturnData).toEqual('modifyAndReturnData');
        expect(context.modifyAndReturnContext).toEqual('modifyAndReturnContext');

        // waitAndAndReturn values
        expect(data.slowDataAndReturn).toEqual('slowDataAndReturn');
        expect(context.slowContextAndReturn).toEqual('slowContextAndReturn');

    });

    it('should have state from two slow processors where slower returns objects', async () => {
        const procName = 'With Slower Return';
        const process = compose(procName, {
            processorsPath,
            pipeline: [
                parallel(
                    'waitAndReturn',
                    'waitAndNoReturn',
                ),
            ],
        });

        const { data, context } = await process.start({ starter: true });

        // starting context value
        expect(context.starter).toEqual(true);

        // waitAndNoReturn values
        expect(data.slowDataNoReturn).toEqual('slowDataNoReturn');
        expect(context.slowContextNoReturn).toEqual('slowContextNoReturn');

        // waitAndAndReturn values
        expect(data.slowDataAndReturn).toEqual('slowDataAndReturn');
        expect(context.slowContextAndReturn).toEqual('slowContextAndReturn');

    });

    it('should have state from two fast processors that may return objects', async () => {
        // kind of surprised this seems to not fail (prior to fix); even tried with 5000
        const procName = 'With Faster Variable Return';
        for (let i = 0; i < 50; i++) {
            const process = compose(procName, {
                processorsPath,
                pipeline: [
                    parallel(
                        i % 2 ? 'modifyNoReturn' : 'modifyAndReturn',
                        i % 2 ? 'modifyAndReturn' : 'modifyNoReturn',
                    ),
                ],
            });

            const { data, context } = await process.start({ starter: true });

            // starting context value
            expect(context.starter, `Run ${i}`).toEqual(true);

            // modifyAndReturn values
            expect(data.modifyAndReturnData, `Run ${i}`).toEqual('modifyAndReturnData');
            expect(context.modifyAndReturnContext, `Run ${i}`).toEqual('modifyAndReturnContext');

            // waitAndAndReturn values
            expect(data.fastDataNoReturn, `Run ${i}`).toEqual('fastDataNoReturn');
            expect(context.fastContextNoReturn, `Run ${i}`).toEqual('fastContextNoReturn');

        }
    });

});