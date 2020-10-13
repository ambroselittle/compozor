const {
    //ProcessorError,
    compose,
    parallel,
    //single
} = require('../src/processor');

const {
    processors: p,
    processorNames: n,
    disableErrorLogging,
    enableErrorLogging,
} = require('./utils');





describe('Prerequisites', () => {

    beforeEach(enableErrorLogging);

    it('should error if a processor has missing prerequisites in the pipeline', async () => {
        const procName = 'Missing Prereqs';

        const processors = [
            parallel(
                p.getBar(),
                p.getFoo(),
            ),
            p.doFoo({
                prerequisites: [n.getBaz]
            }),
        ]

        const proc = compose(procName, { processors });

        let actualEx = null;
        try {
            await proc.start({});
        } catch (ex) {
            actualEx = ex;
        }

        expect(actualEx).toBeTruthy();
        expect(actualEx.isInvalidProcessError).toBe(true);
        const invalidCfg = actualEx.details.configurationErrors[0];
        expect(invalidCfg.processorName).toBe('doFoo');
        expect(invalidCfg.reason).toMatch(/.*getBaz/);
    });

    it('should bypass if a processor prerequisite ends in error', async () => {
        const procName = 'Prereq Error';

        const doFoo = p.doFoo({
            prerequisites: [n.getBar]
        })

        disableErrorLogging();

        const processors = [
            parallel(
                p.getBar({ process: async () => { throw Error('Ahhh') } }),
                p.getFoo(),
            ),
            doFoo,
        ]

        const proc = compose(procName, { processors });

        await proc.start({}, true);

        expect(doFoo.process).not.toHaveBeenCalled();
    });
})
