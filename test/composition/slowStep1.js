const { sleep } = require('../utils');

module.exports = {
    process: async (data, context) => {
        await sleep(3); // should be enough to ensure step 2 can execute before it

        // the reason the sleep is needed is that (for dev convenience) we pass in the same ref to data and context to all processors in
        // a given step (parallel or not); this means a step can modify the reference that a parallel step has, and so
        // if it executes (by scheduling outside our control) before the second step, the second step has a chance to see the modifications it makes
        // (this was actually happening in the first rev of the parallel test)
        // introducing a sleep even a short one should signal the scheduler to allow the 2nd step to go ahead, and should prove the test

        // note, the dev convenience is simply so the dev doesn't have to **always** return { data, context }; this is especially useful for processor short circuits
        // that is, the dev can just write return; instead of having to always return { data, context }; it prevents annoying errors of forgetting to return
        // we can argue this is not good, of course. :D
        data.step1 = true;

        return { data, context };
    }
}