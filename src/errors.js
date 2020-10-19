const isRealObj = require('./isRealObj');

/** Error messaages used in errors. */
const Errors = {
    ProcessNameNotString: processName => `processName must be a string. Was: ${typeof processName}; ${String(processName)}`,
    ProcessErrorMessage: processName => `Error executing process '${processName}'.`,
    ErrorsFromProcesssorsNotArray: processName => `errorsFromProcessors supplied to process '${processName} must be an array.`,
    InvalidProcessErrorMessage: processName => `Process '${processName}' has invalid configuration. See logs for details.`,
    ResponseInfoNotObject: () => 'responseInfo parameter, if defined, must be an object.',
}

/**
 * Thrown when process encounters an error and cannot continue.
 *
 * Has:
 *
 *   - startingContext {object} - the initial context the process was given, which can be useful for repro/diagnostics
 *   - errorsFromProcessors {object[]} - one or more errors encountered by the processors. Each structured as:
 *      {
                occurredIn: processorName,
                message: ex.message,
                ex,
        }
 *
 * */
class ProcessError extends Error {
    constructor(processName, startingContext, errorsFromProcessors = []) {
        if (typeof processName !== 'string') {
            throw new Error(Errors.ProcessNameNotString(processName));
        }
        super(Errors.ProcessErrorMessage(processName));
        this.startingContext = startingContext || {};
        // these can be more than one in the case of parallel processors.
        if (!Array.isArray(errorsFromProcessors)) {
            throw new Error(Errors.ErrorsFromProcesssorsNotArray(processName));
        }
        this.errorsFromProcessors = errorsFromProcessors;
        this.isProcessError = true;
    }

    /**
     * Because a process error can be caused by errors in more than one processor (in case of parallel pipelines), this function allows getting the ProcessorError with the greatest (most severe) status code.
     *
     * Note: If none of the errorsFromProcessors are ProcessorError instances, it will return null.
    */
    getMostSevereProcessorError() {
        let mostSevere;
        if (this.errorsFromProcessors && this.errorsFromProcessors.length > 0) {
            const processorErrors = this.errorsFromProcessors.map(errInfo => errInfo.ex).filter(ex => ex && ex.isProcessorError);
            mostSevere = processorErrors.reduce((mostSevere, ex) => !mostSevere ? ex : (ex.responseInfo.statusCode > mostSevere.responseInfo.statusCode ? ex : mostSevere), null);
        }
        return mostSevere;
    }

    /** Gets if there are no internal ProcessorErrors or all of them have been marked as doNotLog. */
    allErrorsLogged() {
        return this.errorsFromProcessors.length === 0 || this.errorsFromProcessors.every(err => err.ex.doNotLog);
    }
}

/** This is used to surface invalid configuration issues with relevant data attached on the details property. */
class InvalidProcessError extends Error {
    constructor(processName, details) {
        if (typeof processName !== 'string') {
            throw new Error(Errors.ProcessNameNotString(processName));
        }
        super(Errors.InvalidProcessErrorMessage(processName));
        this.details = details;
        this.isInvalidProcessError = true;
    }
}

/** Use this to report a problem within a processor, when you want to contribute to the response with data and/or error status code. */
class ProcessorError extends Error {
    /**
     *
     * @param {string} message - message to pass along in response and for logging
     * @param {object} responseInfo - optional info to inform the server response:
     *      - {string} text - text message to send back in error response. Can use message param if not given.
     *      - {object} errors - data to serialize as JSON in error response
     *      - {number} statusCode - status code to associate with this error
     *
     *      Ex:  throw new ProcessorError('Could not do the thing', {
     *              text: 'Thing was bad.',
     *              errors: { validationCode: 300, message: 'Whatevs' },
     *              statusCode: 400,
     *          })
     */
    constructor(message, responseInfo = {}) {
        super(message);
        this.isProcessorError = true;
        if (!isRealObj(responseInfo)) {
            throw Error(Errors.ResponseInfoNotObject())
        }
        this.responseInfo = responseInfo;
        // ensure status code is set and valid
        this.responseInfo.statusCode = parseInt(this.responseInfo.statusCode, 10);
        // default statusCode to 500
        if (isNaN(this.responseInfo.statusCode) || this.responseInfo.statusCode <= 0) {
            this.responseInfo.statusCode = 500;
        }
        // we only want to log things classified as internal server (i.e. not validation errors)
        this.doNotLog = this.responseInfo.statusCode < 500;
    }
}

module.exports = {
    Errors,
    ProcessError,
    ProcessorError,
    InvalidProcessError,
}