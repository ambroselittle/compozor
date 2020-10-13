const {
    //ProcessorError,
    compose,
    // parallel,
    //single
} = require('../src/processor');

const {
    mockProcessor,
    HttpResponse,
    disableErrorLogging,
    enableErrorLogging,

} = require('./utils');

describe('Cookie Handling', () => {


    beforeEach(enableErrorLogging);

    it('should add cookies from data object to response in send', async () => {
        const res = new HttpResponse();
        const cookieProcessor = mockProcessor('addcookie',
            {
                process: async (data) => {
                    data.cookies.foo = 'bar';
                }
            });

        const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

        await proc.send(res, {});

        expect(res.cookie).toHaveBeenCalledWith('foo', 'bar', undefined); // third param is the unsupplied options in this case
    })


    it('should support providing value with options', async () => {
        const res = new HttpResponse();

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

        await proc.send(res, {});

        expect(res.cookie).toHaveBeenCalledWith('foo', 'bar', {
            domain: 'mydomain.com',
        });
    })

    it('should only should support providing value with options if those are the only props on the cookie value', async () => {
        const res = new HttpResponse();
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

        await proc.send(res, {});

        expect(res.cookie).toHaveBeenCalledWith('foo', {
            value: 'bar',
            options: {
                domain: 'mydomain.com',
            },
            bar: 'baz',
        }, undefined);
    })

    it('should support providing default options for process', async () => {
        const res = new HttpResponse();
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

        await proc.send(res, {});

        expect(res.cookie).toHaveBeenCalledWith('foo', 'bar', {
            domain: 'mydomain.com',
        });
    })


    it('should support overriding and augmenting default options for process', async () => {
        const res = new HttpResponse();
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

        await proc.send(res, {});

        expect(res.cookie).toHaveBeenCalledWith('foo', 'bar', {
            domain: 'mydomain.com',
            expires: 'custom',
            httpOnly: true,
        });
    })

    it('should should support clearing no option cookie with null values', async () => {
        const res = new HttpResponse();
        const cookieProcessor = mockProcessor('addcookie',
            {
                process: async (data) => {
                    data.cookies.foo = null;
                }
            });

        const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

        await proc.send(res, {});

        expect(res.clearCookie).toHaveBeenCalledWith('foo', undefined);
    })

    it('should should support clearing cookie with options via null value', async () => {
        const res = new HttpResponse();
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

        await proc.send(res, {});

        expect(res.clearCookie).toHaveBeenCalledWith('foo', {
            domain: 'mydomain.com',
        });
    })

    it('should remove cookies from data response but keep other data', async () => {
        const res = new HttpResponse();
        const cookieProcessor = mockProcessor('addcookie',
            {
                process: async (data) => {
                    data.cookies.foo = 'bar';

                    data.someOtherValue = 'val';
                }
            });

        const proc = compose('Cookie Proc', { processors: [cookieProcessor] });

        await proc.send(res, {});

        expect(res.send).toHaveBeenCalledWith({
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


        disableErrorLogging();

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
        const res = new HttpResponse();

        await proc.send(res, {});

        expect(res.cookie).toHaveBeenCalledWith('foo', 'bar', undefined);
    })

});

