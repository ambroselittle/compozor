const { error } = require('./logging');

/**
 * Sends status of 200 with the given data/metadata and an ok indicator.
 *
 * @param {object} data - optional data to send as response data.
 * @param {object} metaData - optional metadata to send with response.
 */
function sendOk(data, metaData) {
    try {
        this.status(200).send({
            ok: true, // sometimes we do not want to rely on HTTP status codes to communicate probs, so we have an additional OK flag
            meta: metaData,
            data,
        })
    } catch (ex) {
        error('Could not writeOk:', ex);
        if (!this.headersSent && !this.finished) {
            this.writeErrors('Could not send OK response.');
        }
    }
}

/**
 * Writes the message along with errors to the client with no OK response.
 *
 * @param {string} message - Message to send to client.
 * @param {object} responseErrors - Object or array containing error details to send in response.
 * @param {number} statusCode - Response status code. Default: 500
 */
function sendErrors(message = 'Unable to Complete Request', responseErrors, statusCode = 500) {
    try {
        this.status(statusCode).send({
            ok: false, // also, in case clients do not care to check status codes, they can opt to just check the OK flag
            message,
            errors: responseErrors
        });
    } catch (ex) {
        error('Could not writeErrors:', ex);
        if (!this.headersSent && !this.finished) {
            this.status(500).send(message);
        }
    }
}

/**
 * Adds/binds the sendOk and sendErrors utilities to the given response object for easy use in API functions.
 *
 * @param {HttpResponse} res - response-shaped object that supports chained status(number).send(data) functions.
 */
const bindResponseUtils = res => {
    res.sendOk = sendOk.bind(res);
    res.sendErrors = sendErrors.bind(res);
}

module.exports = {
    /**
     * Sends status of 200 with the given data/metadata and an ok indicator.
     *
     * @param {HttpResponse} res - response-shaped object that supports chained status(number).send(data) functions.
     * @param {object} data - optional data to send as response data.
     * @param {object} metaData - optional metadata to send with response.
     */
    sendOk: (res, ...args) => sendOk.apply(res, args),
    /**
     * Writes the message along with errors to the client with no OK response.
     *
     * @param {HttpResponse} res - response-shaped object that supports chained status(number).send(data) functions.
     * @param {string} message - Message to send to client.
     * @param {object} responseErrors - Object or array containing error details to send in response.
     * @param {number} statusCode - Response status code. Default: 500
     */
    sendErrors: (res, ...args) => sendErrors.apply(res, args),
    bindResponseUtils,

}