const {
    compose,
    parallel,
} = require('../src/processor');

const {
    processors: p,
    processorNames: n,
    disableErrorLogging,
    enableErrorLogging,
    HttpResponse,
} = require('./utils');

const { logEmitter } = require('../src/logging');
const { getErrorContent } = require('../src/response');


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

    it('should write invalid config error to response (and log) on send', async () => {
        // this came from actual usage by other devs not finding it obvious when this a config error happened
        // making it break every response makes it impossible to overlook (for long! :) )

        const procName = 'Missing Prereqs with Send';
        disableErrorLogging();

        const processErrMessage = `Process '${procName}' has invalid configuration. See logs for details.`;
        const { InvalidProcessError } = require('../src/errors')
        const logVerifier = jest.fn((msg, exDetails) => {
            expect(msg.indexOf(procName)).toBeGreaterThan(0);
            expect(exDetails).toBeInstanceOf(InvalidProcessError);
            // verify config errors are logged:
            expect(exDetails).toEqual(expect.objectContaining({
                details: { configurationErrors: expect.any(Array)},
            }));
        });
        logEmitter.on('error', logVerifier); // pass our own func to be called when error is logged

        const processors = [
            parallel(
                p.getBar(),
                p.getFoo(),
            ),
            p.doFoo({
                prerequisites: [n.getBaz]
            }),
        ]

        const expectedResponseContent = getErrorContent(processErrMessage, {
            configurationErrors: [{
                processorName: n.doFoo,
                reason: `Prequisites not found before processor in pipeline: ${n.getBaz}`
            }]
        });

        const proc = compose(procName, { processors });

        const res = new HttpResponse();

        await proc.send(res, {});

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.send).toHaveBeenCalledWith(expectedResponseContent);
        expect(logVerifier).toHaveBeenCalledTimes(1);
    });
})
