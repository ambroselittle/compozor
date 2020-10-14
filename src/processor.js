const { error, warn, debug } = require('./logging');
const fs = require('fs');
const path = require('path');
const { sendOk, sendErrors } = require('./response');

const { traceStart, traceEnd, traceWrite } = require('./timers');

const { ProcessError, ProcessorError, InvalidProcessError } = require('./errors');

const mergeOptions = (options, defaults) => {
    if (!defaults) { return options; }
    const newOptions = {
        ...options,
    };
    // filter to defaults for which there is no value in given options
    Object.keys(defaults).filter(key => defaults[key] !== undefined && newOptions[key] === undefined)
        .forEach(key => newOptions[key] = defaults[key]);

    return newOptions;
}

/**
 * Specify that the given list of processors can run independently, in parallel. Useful if you need to execute several async operations at once.
 *
 * @param  {...any} processors - a list of processor module names found in the given processorPath as part of a compose pipeline.
 */
const parallel = (...processors) => ([...processors])

/** Gets just the name part of the file, minus its extension. */
const getModuleName = filePath => path.basename(filePath, path.extname(filePath));


/**
 * Compose a process with the given options.
 *
 * @param {string} processName - distinct name for logs/errors
 * @param {object} options -
 *      - {string} processorsPath - use if you want to specify a pipeline of module-based processors. If pipeline is not specified, all modules in directory will be executed in order of files in the directory.
 *      - {Array<string|parallel>} pipeline - a list of paths and or calls to parallel, if you want a step in the pipeline to execute multiple processors in parallel
 *      - {options} cookieOptions - default cookie options for any cookies set without options. Can be static object of options or a function. If a function, it will be called for each cookie creation (so you can control the default options functionally).
 */
const compose = (processName, options = {}) => {
    const COMPOSE_TIMER = 'Compose ' + processName;
    const START_TIMER = 'Start -> ' + processName;
    const __self = this;

    debug(`Compose Process: ${processName}; options:`, options);
    traceStart(COMPOSE_TIMER, processName, true);
    processName = String(processName || 'Unknown');
    /** we track these to make it more obvious when a process has invalid config */
    let invalidConfigs = [];
    const addInvalidProcessor = (processorName, reason) => invalidConfigs.push({ processorName, reason });

    let {
        processorsPath,
        pipeline,
        processors = [], // we allow passing built pipeline, but should only be used for testing :)
        cookieOptions,
    } = options || {};

    /** Gets process-specified cookie option defaults. */
    const getProcessDefaultCookieOptions = typeof cookieOptions === 'function' ? cookieOptions : () => cookieOptions;

    /** Validates and returns a processor in the expected shape for process to use. */
    const createProcessor = (name, processor, options = {}) => {
        if (typeof name !== 'string') {
            throw Error(`Processor 'name' must be a string.`);
        }

        if (typeof processor === 'function') {
            processor = {
                process: processor,
                ...options,
            }
        }

        processor.name = String(name);

        if (typeof processor !== 'object') {
            throw Error(`Processors must be a function or an object with a 'process' function.`);
        }

        if (typeof processor.process !== 'function') {
            throw Error(`Processor.process must be a function.`);
        }

        if (processor.runIf !== undefined) {
            if (typeof processor.runIf !== 'function') {
                throw Error('Processor runIf must be a function.');
            }
        } else {
            processor.runIf = () => true; // if runIf not specified, we will always return true and run
        }

        if (processor.prerequisites) {
            if (!(Array.isArray(processor.prerequisites) && processor.prerequisites.every(prereq => typeof prereq === 'string'))) {
                throw Error('Processor prerequisites must be an array of string names of procesors that are expected to run before it.')
            }
        } else {
            processor.prerequisites = [];
        }

        return processor;
    }

    /**
     * Add a processor function to the end of the process.
     *
     * @param {string} name - recognizable, distinct name for this processor
     * @param {function} processor - function called with signature (data, context) => { data, context }, or an object with a 'process' function of the same signature.
     * @param {object} options - optional processor configuration:
     *      {function} runIf - if provided, will execute prior to processor. if return value is truthy, will execute the processor, otherwise will skip it
     */
    const register = (name, processor, options = {}) => {
        try {
            processor = createProcessor(name, processor, options);
            validatePrerequisites(processor);
        } catch (ex) {
            addInvalidProcessor(name, ex.message);
            throw ex; // rethrow to notify callers..
        }

        if (!processors.some(p => p.name === processor.name)) {
            debug(`Adding processor '${processor.name}' to process '${processName}'.`);
            processors.push(processor);
        } else {
            warn(`Processor with name '${processor.name}' already registered. Skipping.`, processor);
        }

        return __self; // for chaining
    }


    // recursively ensure processor is removed
    const removeProcessor = (processorName, processorList) => {
        return processorList.map(p => {
            if (Array.isArray(p)) {
                return removeProcessor(processorName, p);
            }
            return p;
        }).filter(p => Array.isArray(p) ? p.length > 0 : p.name !== processorName);
    }

    /**
     * Remove the named processor from the process.
     *
     * @param {string} processorName - recognizable, distinct name for this processor
     */
    const deregister = processorName => {
        processors = removeProcessor(processorName, processors);
        invalidConfigs = invalidConfigs.filter(p => p.name !== processorName); // in case code tries to add and removes if it fails. You never know. :D

        return __self; // for chaining
    }

    /**
     * Start the process with the given context. Returns
     *
     * @param {object} startingContext - arbitrary object containing needed context for starting the process. A shallow copy is made that is passed to each processor along with any data each returns.
     * @param {boolean} continueOnError - if your process might be able to continue despite errors in prior processors, set this to true; then inspect context.errors as need. Will throw ProcessError on error if not set.
     */
    const start = async (startingContext, continueOnError) => {
        traceStart('Process Start', START_TIMER, true);
        // we fail on every start if there is invalid config to make it really obvious. nobody should ship with invalid process
        if (invalidConfigs.length > 0) {
            throw new InvalidProcessError(processName, { configurationErrors: invalidConfigs });
        }

        let context = {
            ...startingContext,
            processName,
        }
        context.errors = [];
        let data = { cookies: {}, }; // start with empty cookies so processors can just set values on it
        const processorsRun = [];

        const ensureCookies = (processorName) => {
            if (!(typeof data.cookies === 'object' && data.cookies !== null && !Array.isArray(data.cookies) && !(data.cookies instanceof Date))) {
                error(`Processor '${processorName}' invalidly changed data.cookies. Resetting to normal object.`);
                data.cookies = {};
            }
        }

        const aggregateResult = ((processorInfo, result) => {
            traceEnd(processorInfo.name, START_TIMER);

            processorsRun.push({
                name: processorInfo.name,
                ok: true,
            })

            if (result) {
                context = {
                    ...context,
                    ...result.context,
                }
                data = {
                    ...data,
                    ...result.data
                };
            }

            ensureCookies(processorInfo.name);

        });

        const handleProcessorError = (processorName, ex) => {
            traceEnd(processorName, START_TIMER);
            const errInfo = {
                occurredIn: processorName,
                message: ex.message,
                ex,
            };

            processorsRun.push({
                name: processorName,
                ok: false,
            })

            context.errors.push(errInfo);

            ensureCookies(processorName);

            ex.doNotLog = ex.doNotLog // allow other arbitrary errors to suppress this logging
                || ex.isEpiError  // epi already logs its own errors
                ;

            if (!ex.doNotLog) {
                error(`Processor '${processorName}' for '${processName}' process exception:`, ex);
                ex.doNotLog = true; // signal it has already been logged now
            }
        }

        const getExecPromise = async processor => {
            traceStart(processor.name, START_TIMER);
            if (await processor.runIf(data, context)) {
                return processor.process(data, context); // it is important for dev convenience to pass in a ref to our current data/context so processors can short circuit without having to return { data, context } (they can return; and have any of their modifications to data/context be carried forward, as would be expected)
            }
            return Promise.resolve({ data, context });
        }

        const getExecutable = (processor) => {
            const execInfo = {};
            let toExec;
            if (Array.isArray(processor)) { // if an array is passed for any step in the pipeline, we treat them as parallel
                execInfo.isParallel = true;
                execInfo.names = processor.map(p => p && p.name);
                execInfo.name = `'Parallel: ${JSON.stringify(execInfo.names)}`;
                toExec = processor;
            } else {
                execInfo.name = processor.name;
                execInfo.isParallel = false;
                toExec = [processor]; // we map to promises below
            }

            // check prerequisites
            toExec.map(p => p) // create an array clone so we can modify the base toExec if there's an error in prereq
                .forEach(processor => {
                    if (processor.prerequisites.length === 0) { return; }

                    processor.prerequisites.forEach(prereq => {
                        const procRun = processorsRun.find(p => p.name === prereq);
                        if (procRun && !procRun.ok) {
                            error(`Processor '${processor.name}' requires '${prereq}' to run first, but it failed with an error. Skipping '${processor.name}'...`);
                            toExec = toExec.filter(p => p !== processor);
                        }
                    });
                })

            // we get a promise for each processor and they resolve/catch as they get done
            execInfo.promises = toExec.map(p => Promise.resolve(getExecPromise(p)).then(result => aggregateResult(p, result)).catch(ex => handleProcessorError(p.name, ex)));
            return execInfo;
        }

        const checkErrors = () => {
            if (context.errors.length > 0 && !continueOnError) {
                throw new ProcessError(processName, startingContext, context.errors);
            }
        }

        try {
            for (let i = 0; i < processors.length; i++) {
                checkErrors();
                const execInfo = getExecutable(processors[i]);
                if (execInfo.promises.length === 0) { continue; }
                traceStart(execInfo.name, START_TIMER);

                try {
                    debug(`Executing '${execInfo.name}' processor...`);
                    await Promise.all(execInfo.promises);
                } catch (ex) {
                    handleProcessorError(execInfo.name, ex);
                }

                traceEnd(execInfo.name, START_TIMER);
            }

            if (data.cookies && Object.keys(data.cookies).length === 0) {
                // no cookies set in process, so remove the auto-appended cookies obj
                delete data.cookies;
            }

            checkErrors(); // if last processor errors, we need to check for that here
        } catch (ex) {
            if (!ex.isProcessError) {
                error(`Unexpected error in process '${processName}' start.`, ex);
            }
            throw ex;
        }

        traceEnd('Process Start', START_TIMER);
        traceWrite(START_TIMER);

        return { data, errors: context.errors, context };
    }

    /**
     *
     * Runs the process and, if there are no errors, sends the resultant data to the response. If there are errors, will send an error response.
     *
     * This is a convenience wrapper for the start function that just adds error and response handling.
     *
     * @param {Node|Express} res - Node/Express response object.
     * @param {object} startingContext - arbitrary object containing needed context for starting the process. A shallow copy is made that is passed to each processor along with any data each returns.
     * @param {boolean} continueOnError - if your process might be able to continue despite errors in prior processors, set this to true; then inspect context.errors as need. Will throw ProcessError on error if not set.
     */
    const send = async (res, startingContext, continueOnError) => {
        try {
            const { data, errors } = await start(startingContext, continueOnError);
            if (errors.length > 0) {
                throw new ProcessError(processName, startingContext, errors);
            }

            // check for cookies to send
            const cookieNames = data.cookies ? Object.keys(data.cookies) : [];
            if (cookieNames.length > 0) {
                // one or more processors wanted to send cookies back
                const responseSupportsCookies = typeof res.cookie === 'function' && typeof res.clearCookie === 'function';
                if (!responseSupportsCookies) {
                    return warn(`Response object given to send function for '${processName}' does not support cookies, but cookies were attached to the data object. Cannot send cookies.`);
                }

                // so we add them to the response cookies
                cookieNames.forEach(name => {
                    let val = data.cookies[name];
                    let options = getProcessDefaultCookieOptions();

                    if (val && val.value !== undefined && val.options !== undefined && Object.keys(val).length === 2) {
                        // using the magic of duck typing, we treat this as the dev wanting to specify cookie options, so grab those
                        options = mergeOptions(val.options, options);
                        val = val.value;
                    }

                    if (val === null) {
                        // assume they want to clear the cookie
                        res.clearCookie(name, options);
                        return;
                    }

                    res.cookie(name, val, options);
                });
                // and remove them from the data
                delete data.cookies;
            }

            sendOk(res, data);
        } catch (ex) {
            writeErrors(res, ex);
        }
    }

    /**
     * Runs the process and will handle/log any errors generated. Use this when you want to start a process without waiting on it or handling its response.
     *
     * @param {object} startingContext - arbitrary object containing needed context for starting the process. A shallow copy is made that is passed to each processor along with any data each returns.
     * @param {boolean} continueOnError - if your process might be able to continue despite errors in prior processors, set this to true; then inspect context.errors as need. Will throw ProcessError on error if not set.
     */
    const fireAndForget = async (startingContext, continueOnError) => {
        try {
            const { errors } = await start(startingContext, continueOnError);
            if (errors.length > 0) { // handle continue on error errors by throwing and logging
                throw new ProcessError(processName, startingContext, errors);
            }
        } catch (ex) {
            if (!ex.isProcessError || !ex.allErrorsLogged()) {
                error(ex);
            }
        }
    }

    /** Gets a node/Express request/response handler function for this process. */
    const getHttpHandler = () => async (req, res, next) => {
        if (!req) {
            throw Error('req parameter is required and should be a node/Express request object.');
        }
        if (!(res && typeof res.status === 'function' && typeof res.send === 'function')) {
            throw Error('res parameter is required and should have a status and send function defined.');
        }
        const context = {
            params: req.parameters || { // supports already coalesced values via another middleware
                ...req.body,
                ...req.query,
                ...req.params,
                ...req.cookies,
            },
            req,
        };
        await send(res, context);

        if (typeof next === 'function') {
            next();
        }
    }

    /**
     * Writes the given error and logs it, as needed.
     *
     * @param {HttpResponse} res - response-shaped object that supports chained status(number).send(data) functions.
     * @param {object} ex - any exception object. Has special handling for ProcessError type.
     */
    const writeErrors = (res, ex) => {
        let handled = false;
        let shouldLog = true;
        if (ex.isProcessError) {
            // try to get the underlying most sever processor error and surface that to the client.
            const processorError = ex.getMostSevereProcessorError() || {};
            const { text, errors, statusCode } = processorError.responseInfo || {};
            sendErrors(res, text || processorError.message || ex.message, errors, statusCode);
            handled = true;
            // we do not need an extra log entry at the process level if we have logged all of the "child" ProcessorError instances
            shouldLog = !ex.allErrorsLogged();
        }


        if (ex.isInvalidProcessError) {
            sendErrors(res, ex.message, ex.details);
            handled = true;
        }

        if (!handled) {
            sendErrors(res, 'Could not complete request.'); // unexpected
            shouldLog = !ex.doNotLog;
        }

        if (shouldLog) {
            error(`Error in process '${processName}':`, ex); // we can't assume it was logged
        }
    }

    const validatePrerequisites = (processor, loaded = processors.flat(Infinity)) => {
        if (processor && Array.isArray(processor.prerequisites)) {
            const missingPrereqs = processor.prerequisites.filter(prereq => !loaded.some(p => p.name === prereq));
            if (missingPrereqs.length > 0) {
                addInvalidProcessor(processor.name, `Prequisites not found before processor in pipeline: ${missingPrereqs.join(',')}`);
            }
        }
    }

    const validatePipeline = (pipeline, allLoaded = [], loadedThisLevel = allLoaded) => {
        if (!Array.isArray(pipeline)) {
            const msg = 'Processor pipeline not valid. Must be an array.';
            invalidConfigs.push(msg);
            error(msg, pipeline);
            return;
        }

        pipeline.forEach(processor => {
            if (Array.isArray(processor)) { // loaded in parallel, so we cannot consider processors loading in parallel to satisfy prereqs
                const newLevel = [];
                validatePipeline(processor, allLoaded, newLevel);
                allLoaded.push(...newLevel);
                return;
            }

            validatePrerequisites(processor, allLoaded);
            loadedThisLevel.push(processor);
        })
    }

    if (processorsPath) {
        const importProcessors = (processorEntries) => {
            if (Array.isArray(processorEntries)) {
                return processorEntries.map(entry => {
                    if (Array.isArray(entry)) {
                        return importProcessors(entry);
                    }

                    let module;
                    try {
                        traceStart('Import ' + entry, processName);
                        module = require(path.join(processorsPath, entry));
                        traceEnd('Import ' + entry, processName);
                    } catch (ex) {
                        console.error(ex)
                        error(`Processor '${entry}' for '${processName}' import exception:`, ex);
                        addInvalidProcessor(entry, 'Module import failure.');
                        return null;
                    }

                    let processor = null;
                    try {
                        processor = createProcessor(entry, module);
                    } catch (ex) {
                        error(`Processor '${entry}' for '${processName}' creation exception:`, ex);
                        addInvalidProcessor(entry, ex.message);
                    }

                    return processor;
                }).filter(p => p); // remove any that had problems being created
            }
        }

        if (!fs.existsSync(String(processorsPath))) {
            invalidConfigs.push('Invalid processors path.');
            error('Given processorsPath does not exist. Was:', processorsPath);
        } else {
            debug(`Registering processors in: '${processorsPath}'`)
            /** if they give us a list of processors to use, we use that; otherwise, we get all in the directory, and we run those all in parallel if so. */
            const processorEntries = pipeline ? pipeline : parallel(fs.readdirSync(processorsPath).map(file => getModuleName(file)));
            processors = importProcessors(processorEntries);
        }
    }

    validatePipeline(processors);

    traceEnd(COMPOSE_TIMER, processName);
    traceWrite(processName);

    const selfExports = {
        register,
        deregister,
        use: getHttpHandler,
        start,
        send,
        writeErrors,
        fireAndForget,
        processName,
    }

    Object.keys(selfExports).forEach(key => {
        this[key] = selfExports[key];
    })

    return selfExports;
}

/**
 * Creates a new process and returns the Express-middleware-like handler for it.
 *
 * This is just a helper and is functionally equivalent to calling compose() and then .use() on the composed process.
 *
 * @param {string} name - dev-friendly name for the logs and whatnot
 * @param {string} pathToProcessor - absolute path to processor (use path.join(__dirname, './somepath') in your code)
 */
const single = (name, pathToProcessor) => {
    const process = compose(name);
    process.register(getModuleName(pathToProcessor), require(pathToProcessor));
    return process.use();
}


module.exports = {
    compose,
    single,
    parallel,
    ProcessorError,
}