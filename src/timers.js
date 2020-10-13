/**
 * Simple utility for basic operation tracing. It just uses Date and only tracks ms. If you need fancier (and more complicated), use https://nodejs.org/api/perf_hooks.html
 */

let timers = {};
const TRACE_TIME = process.env.TRACE_TIME;
const shouldTraceTime = TRACE_TIME === true || /true/i.test(TRACE_TIME) || TRACE_TIME > 0;
const DEFAULT_MIN_DURATION = (TRACE_TIME !== true && TRACE_TIME > 0) ? Number(TRACE_TIME) : 0;

/**
 * Start a timed trace for your code. Call traceEnd to mark the end point.
 *
 * @param {string} name - dev-friendly name of the thing you are tracing
 * @param {string} batchName - supplying a batch name will allow you to group and report on multiple timer traces in one related report
 * @param {boolean} batchStartOnly - use this when you want to use a trace timer to specify the start and end of the batch to get its total duration, instead of just adding up all the individual items
 *
 * Using batchStartOnly can be useful if you have a larger/surrounding thing that you want to time, with more detailed timers. You can set this when you want to start timing the whole batch, and call traceEnd with the same key later to indicate the end of the batch.
 * Otherwise, we report just a simple sum of the individuals, which may not be indicative of the whole conceptual batch.
 */
const traceStart = (name, batchName, batchStartOnly = false) => {
    if (!shouldTraceTime) { return; }

    const start = new Date();
    const timerKey = batchName || name;
    let timer = timers[timerKey];
    if (!timer) {
        timer = {
            batchName,
            traces: {},
        }
        timers[timerKey] = timer;
    }
    timer.traces[name] = { start, batchStart: batchStartOnly };
}

/**
 * Mark the end of a timed trace in your code.
 *
 * If you do not use a batchName (for traceStart/traceEnd), this function will immediately log out the trace results. Otherwise, for batches, you need to call traceWrite when done to log the batch results.
 *
 * @param {string} name - dev-friendly name of the thing you are tracing; must be the same as what was passed earlier to traceStart, else it will error.
 * @param {string} batchName - same as the batchName supplied in traceStart; otherwise it will fail to find the trace
 * @param {number} minDuration - optional minimum duration, which controls whether or not to log something based on its duration
 */
const traceEnd = (name, batchName, minDuration) => {
    if (!shouldTraceTime) { return; }

    const end = new Date();
    const timerName = batchName || name;
    const timer = timers[timerName];
    if (!timer) {
        console.warn('Missing Timer for:', timerName);
        return;
    }
    const trace = timer.traces[name];
    if (!trace) {
        console.warn('Missing Timer Trace for:', name);
        return;
    }
    trace.end = end;
    if (!batchName) {
        __finalize(timer, timerName, minDuration, true, true);
    }
}

/** Calculates timer durations and logs, if requested.  */
const __finalize = (timer, batchName, minDuration = DEFAULT_MIN_DURATION, shouldLog = false, isSingle = false) => {
    const eol = require('os').EOL;

    let totalDuration = 0;
    const loc = new Intl.NumberFormat();

    let batchStart;

    const traces = Object.keys(timer.traces).reduce((traceMsg, traceName) => {
        const trace = timer.traces[traceName];
        if (trace) {
            const duration = trace.end - trace.start;
            trace.duration = duration;
            if (trace.batchStart) {
                batchStart = trace;
            } else {
                traceMsg += `${loc.format(duration).padStart(5)}ms - ${traceName}` + eol;
                totalDuration += duration;
            }
            // if (duration > minDuration) {
            // }
        }
        return traceMsg;
    }, '');

    if (batchStart) {
        totalDuration = batchStart.duration;
    }

    timer.totalDuration = totalDuration;

    if (!shouldLog || totalDuration < minDuration) {
        return;
    }

    const logMsg = isSingle ? traces : `
Timer: ${batchName} (${loc.format(totalDuration)}ms)
-----------------------
${traces}
`;
    console.log(logMsg);
}

/**
 * Writes to console.log the results of the batch and returns the batch.
 *
 * @param {string} batchName - batchName that matches a batch you have created traces for.
 * @param {number} minDuration - optional minimum duration (ms), which controls whether or not to log the batch based on its total duration.  (Defaults to process.env.TRACE_TIME if that is set with a number.)
 */
const traceWrite = (batchName, minDuration) => {
    if (!shouldTraceTime) { return; }

    const timer = timers[batchName];
    if (!timer) {
        console.warn('Missing Timer for:', batchName);
        return;
    }

    __finalize(timer, batchName, minDuration, true);

    delete timers[batchName];

    return timer;
}

/**
 * Finalizes the batch and returns the timer with the batch data.
 *
 * @param {string} batchName - batchName that matches a batch you have created traces for.
 */
const batchEnd = (batchName) => {
    const timer = timers[batchName];

    __finalize(timer, batchName, undefined, false);

    delete timers[batchName];

    return timer;

}

module.exports = {
    traceStart,
    traceEnd,
    traceWrite,
    batchEnd,
}