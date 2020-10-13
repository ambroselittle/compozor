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
    constructor(processName, startingContext, errorsFromProcessors) {
        super(`Error executing process '${processName}'.`);
        this.startingContext = startingContext || {};
        // these can be more than one in the case of parallel processors.
        this.errorsFromProcessors = errorsFromProcessors || [];
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
}

/** This is used to surface invalid configuration issues with relevant data attached on the details property. */
class InvalidProcessError extends Error {
    constructor(processName, details) {
        super(`Process '${processName}' has invalid configuration. See logs for details.`);
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
     *              errors: { code: 300, message: 'Whatevs' },
     *              statusCode: 400,
     *          })
     */
    constructor(message, responseInfo = {}) {
        super(message);
        this.responseInfo = responseInfo;
        this.isProcessorError = true;
    }
}

module.exports = {
    ProcessError,
    ProcessorError,
    InvalidProcessError,
}