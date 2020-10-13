const {
    //ProcessorError,
    compose,
    parallel,
    //single
} = require('./processor');

const Http = {
    Response: {
        cookie: jest.fn(),
        clearCookie: jest.fn(),
        status: jest.fn(() => Http.Response),
        send: jest.fn(),
        writeErrors: jest.fn(),
    },
}

const { logEmitter } = require('./logging');

// logEmitter.on('error', (...args) => console.error(...args))

describe('Processor', () => {

    // TODO: fill in missing tests

    beforeEach(() => {
        Object.keys(Http.Response).forEach(funcName => Http.Response[funcName].mockClear());
    })

    describe('Cookie Handling', () => {
        it('should add cookies from data object to response in send', async () => {
            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = 'bar';
                    }
                });

            const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

            await proc.send(Http.Response, {});

            expect(Http.Response.cookie).toHaveBeenCalledWith('foo', 'bar', undefined); // third param is the unsupplied options in this case
        })


        it('should support providing value with options', async () => {
            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = {
                            value: 'bar',
                            options: {
                                domain: 'mydomain.com',
                            }
                        }
                    }
                });

            const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

            await proc.send(Http.Response, {});

            expect(Http.Response.cookie).toHaveBeenCalledWith('foo', 'bar', {
                domain: 'mydomain.com',
            });
        })

        it('should only should support providing value with options if those are the only props on the cookie value', async () => {
            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = {
                            value: 'bar',
                            options: {
                                domain: 'mydomain.com',
                            },
                            bar: 'baz',
                        }
                    }
                });

            const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

            await proc.send(Http.Response, {});

            expect(Http.Response.cookie).toHaveBeenCalledWith('foo', {
                value: 'bar',
                options: {
                    domain: 'mydomain.com',
                },
                bar: 'baz',
            }, undefined);
        })

        it('should support providing default options for process', async () => {
            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = {
                            value: 'bar',
                            options: null
                        }
                    }
                });

            const proc = compose('Cookie Proc', {
                processors: [cookieProcessor],
                cookieOptions: {
                    domain: 'mydomain.com',
                }
            });

            await proc.send(Http.Response, {});

            expect(Http.Response.cookie).toHaveBeenCalledWith('foo', 'bar', {
                domain: 'mydomain.com',
            });
        })


        it('should support overriding and augmenting default options for process', async () => {
            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = {
                            value: 'bar',
                            options: {
                                expires: 'custom',
                                httpOnly: true,
                            }
                        }
                    }
                });

            const proc = compose('Cookie Proc', {
                processors: [cookieProcessor],
                cookieOptions: {
                    domain: 'mydomain.com',
                    expires: 'default'
                }
            });

            await proc.send(Http.Response, {});

            expect(Http.Response.cookie).toHaveBeenCalledWith('foo', 'bar', {
                domain: 'mydomain.com',
                expires: 'custom',
                httpOnly: true,
            });
        })

        it('should should support clearing no option cookie with null values', async () => {
            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = null;
                    }
                });

            const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

            await proc.send(Http.Response, {});

            expect(Http.Response.clearCookie).toHaveBeenCalledWith('foo', undefined);
        })

        it('should should support clearing cookie with options via null value', async () => {
            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = {
                            value: null,
                            options: {
                                domain: 'mydomain.com',
                            }
                        }
                    }
                });

            const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

            await proc.send(Http.Response, {});

            expect(Http.Response.clearCookie).toHaveBeenCalledWith('foo', {
                domain: 'mydomain.com',
            });
        })

        it('should remove cookies from data response but keep other data', async () => {
            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = 'bar';

                        data.someOtherValue = 'val';
                    }
                });

            const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

            await proc.send(Http.Response, {});

            expect(Http.Response.send).toHaveBeenCalledWith({
                ok: true,
                data: {
                    someOtherValue: 'val',
                },
            });
        })

        it('should prevent cookies object from being turned into a non object', async () => {
            const deleteCookies = mockProcessor('delcookie',
                {
                    process: async (data) => {
                        delete data.cookies;
                    }
                });

            const nullcookie = mockProcessor('nullcookie',
                {
                    process: async (data) => {
                        data.cookies = null;
                    }
                });

            const arrcookie = mockProcessor('arrcookie',
                {
                    process: async (data) => {
                        data.cookies = [];
                    }
                });

            const datecookie = mockProcessor('datecookie',
                {
                    process: async (data) => {
                        data.cookies = new Date();
                    }
                });

            const nonobjcookie = mockProcessor('nonobjcookie',
                {
                    process: async (data) => {
                        data.cookies = 3;
                    }
                });

            const cookieProcessor = mockProcessor('addcookie',
                {
                    process: async (data) => {
                        data.cookies.foo = 'bar';
                    }
                });

            const proc = compose('Cookie Proc', {
                processors: [
                    deleteCookies,
                    cookieProcessor,
                    nullcookie,
                    cookieProcessor,
                    arrcookie,
                    cookieProcessor,
                    datecookie,
                    cookieProcessor,
                    nonobjcookie,
                    cookieProcessor,
                ]
            });

            await proc.send(Http.Response, {});

            expect(Http.Response.cookie).toHaveBeenCalledWith('foo', 'bar', undefined);
        })

    });


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

const mockProcessor = (name, { process, runIf, prerequisites = [] } = {}) => ({
    name,
    process: jest.fn(process || (async (data, context) => ({ data, context }))),
    runIf: jest.fn(runIf || (async () => true)),
    prerequisites
})

const n = {
    getFoo: 'getFoo',
    getBar: 'getBar',
    getBaz: 'getBaz',
    doFoo: 'doFoo',
    doBar: 'doBar',
}
const p = {};

Object.keys(n).forEach(name => {
    p[name] = (...args) => mockProcessor(name, ...args);
});
