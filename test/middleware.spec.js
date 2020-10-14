const { compose, parallel } = require('../src/processor');
const { HttpResponse, enableErrorLogging, disableErrorLogging, mockProcessor } = require('./utils');
const { getOkContent, getErrorContent } = require('../src/response');
const { ProcessorError } = require('../src/errors');

describe('Middleware Usage', () => {

    it('should allow using composed process as Express-like middleware', async () => {
        const process = compose('Use');
        process.register('foo', (data) => { data.foo = 'bar' });
        process.register('bar', (data) => { data.bar = 'foo' });
        const res = new HttpResponse();
        const next = jest.fn();

        const middleware = process.use();

        expect(typeof middleware).toBe('function');

        await middleware({}, res, next);

        const expectedResponseData = getOkContent({ foo: 'bar', bar: 'foo' });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(expectedResponseData);
        expect(next).toHaveBeenCalled();

    });

    it('should allow not providing next function', async () => {
        const process = compose('Use no Next');
        process.register('foo', (data) => { data.foo = 'bar' });
        const res = new HttpResponse();

        const middleware = process.use();

        expect(typeof middleware).toBe('function');

        await middleware({}, res);

        const expectedResponseData = getOkContent({ foo: 'bar' });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(expectedResponseData);

    });

    it('should combine request body, query, params, and cookies into single params obj on context', async () => {
        const process = compose('Combine Request Param Sources on Context');

        const body = { bodyParamVal: 'body' };
        const query = { qsParamVal: 'qs' };
        const params = { paramsVal: 'param' };
        const cookies = { cookieName: 'cookieVal' }

        // each one expects the source various source params to be combined onto context.params
        process.register('body', (data, context) => { data.body = context.params.bodyParamVal });
        process.register('query', (data, context) => { data.query = context.params.qsParamVal });
        process.register('params', (data, context) => { data.params = context.params.paramsVal });
        process.register('cookies', (data, context) => { data.cookieVal = context.params.cookieName });

        const middleware = process.use();
        expect(typeof middleware).toBe('function');

        const req = { // request-like object with all the supported params sources
            body,
            query,
            params,
            cookies,
        }
        const res = new HttpResponse();

        await middleware(req, res);

        const expectedResponseData = getOkContent({
            body: body.bodyParamVal,
            query: query.qsParamVal,
            params: params.paramsVal,
            cookieVal: cookies.cookieName,
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(expectedResponseData);
    });

    it('should allow substituting an app-provided set of parameters', async () => {
        // this is in case apps want to customize coalescing, massaging, augmenting, etc. instead of taking as-is
        // they can add a prior middleware that does this, for instance
        const process = compose('Combine Request Param Sources on Context');

        const body = { bodyParamVal: 'body' };
        const customParams = { custParamVal: 'foo' };

        process.register('custParam', (data, context) => {
            data.body = context.params.bodyParamVal;
            data.custParam = context.params.custParamVal;
        });

        const middleware = process.use();
        expect(typeof middleware).toBe('function');

        const req = { // request-like object
            body, // should be ignored and not sent in as context
        }
        const res = new HttpResponse();

        const customCoalescerMiddleware = (req) => {
            req.parameters = customParams;
        }

        // imagine composing a route where the middleware is supplied in this order..
        await customCoalescerMiddleware(req, res);
        await middleware(req, res);

        const expectedResponseData = getOkContent({
            custParam: req.parameters.custParamVal,
        });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(expectedResponseData);

    });

});