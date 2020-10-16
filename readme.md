# Lightweight Process/Routine Composition
An API-oriented framework for composing units of work into readable, maintainable, and testable processes.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


  - [Values](#values)
    - [Modularization](#modularization)
    - [Composability](#composability)
    - [Understandability/Readability](#understandabilityreadability)
    - [Testability](#testability)
    - [Reusability](#reusability)
    - [Error Handling](#error-handling)
    - [Minimizing Cognitive Load](#minimizing-cognitive-load)
- [Using/In Practice](#usingin-practice)
  - [The Process](#the-process)
    - [Starting a Process](#starting-a-process)
    - [Send/Pipe Process to Response](#sendpipe-process-to-response)
    - [Fire and Forget](#fire-and-forget)
    - [Continue On Error](#continue-on-error)
  - [The Processor](#the-processor)
    - [What Do Processors Do?](#what-do-processors-do)
    - [Why Data and Context?](#why-data-and-context)
    - [Managing Processor Dependencies](#managing-processor-dependencies)
    - [Controlling the HTTP Response](#controlling-the-http-response)
    - [Sending Cookies in Response](#sending-cookies-in-response)
  - [Single Processor Endpoints](#single-processor-endpoints)
    - [Migrating from Single to Composed](#migrating-from-single-to-composed)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Values

### Modularization
The goal is to isolate and modularize, as much as possible, discrete units of work in the solution. In an ideal world, these could all run independently and in parallel, though admittedly that will not always be achievable.

### Composability
Because each module is as isolated as it can be, it should be possible to compose them in more than one way, and to use them in more than one process/context.

### Understandability/Readability
Having named, modularized units of work allows for an easy-to-read composition. For example:

```js
const newSurvey = compose('Start New Survey', {
    processorsPath,
    pipeline: [
        'getSurveyStatus',
        'validateCanProceed',
        parallel(
            'getQuestions',
            'getSurveyDetails',
            'getRespondentDetails',
        ),
        'formatQuestions',
        'restorePriorAnswers',
        'cleanResponse',
    ],
});
```

This makes the flow of the program more declarative and thus more easy to understand at a high level, while making it relatively easy to drill into component parts.

### Testability
Working strictly with Express or a similar HTTP-oriented framework, if we want to test our API functionality, we often either have to mock request/response objects, or we have to manually break things out to make them more testable.

This framework does the latter, but also adds some consistency around how that it is done. Because each processor module has a well-defined yet flexible interface, it leads us into writing code that is more testable, where each unit of work only needs what it needs to do its work, either via the `data` or `context` parameters/return values. These are much simpler to supply on average than mocking request and response objects.

### Reusability
Although related to composability, this value in part hinges on the consistent processor module interface. For example, if you follow a convention of naming modules that get data from other sources, you can easily create utilities like we do in this project with snapshots and schema verification to collectively run/test across _all_ getters, without manually coding tests for each. Because these are just node modules, you can import them yourself directly and call whatever they export as usual. But you are guaranteed to have a `process(data, context) => {data, context}` export, so you can write generic code that relies on that.

### Error Handling
It also implicitly supports error handling, to the extent that individual modules don't need to worry too much about, at least, top level try-catch, nor worry about avoiding unhandled promise errors and sending proper HTTP responses. Each processor (or set of parallel processors) runs in its own automatically error-handled context.

Additionally, if you use the `process.send` function, it will automatically catch and send any exceptions to the client, and it supports easily supplying custom message, status code, and optionally errors data back through the HTTP Response.

### Minimizing Cognitive Load
Standard node modules require you to think about what to export and how to name each export for each module. You then have to import/require each module and/or function individually, which makes the easy path to just stuff everything together or to have a haphazard grouping.

This framework intends to make the easy path to be modularization, to get as close to one function per module as possible, and for the name of the module to say what it does so that it's obvious both looking at the project file explorer and also when dealing with composed processes.

You don't have to import a module/function and then call, repetitively passing in the same/similar parameters to individual functions. You just say, 'use this as the next step in the process', and it gets any accumulated context and data up to that point, thus freeing your brain from worrying about passing parameters around and refactoring function parameter lists when you find you need to change/add something.

**Caveats/Drawback**: There can be implicit/dynamic contracts between some modules, so that's a drawback to this approach. If a processor relies on some prior state, it needs to ensure it has it--but this is effectively no different from parameter checking in functions. This is mitigated by using the `prerequisites` and `runIf` optional exports covered below under [**Managing Processor Dependencies**](#managing-processor-dependencies).

Also, because you easily control the pipeline, you can have an early processor ensure the needed context is there, and choose to just assume it will be there for later processors.

Overall, the trade off of only seeing/thinking about/focusing on small units of work at a time and not having the overhead of manually importing, calling, passing parameters to functions seems like a win, especially when you add the practical benefits of testability and composability.


# Using/In Practice

## The Process
A process is just a composed set of one or more processors. These can be executed in sequence or parallel or a combination.

To define a composite process, you call `compose`. The simplest form is just naming it:
```js
const myProc = compose('Some Process');
```

The name is just for logging. If you do the above, the process will have no processors, and so it won't actually do anything. But you can add arbitrary processors programmatically:
```js
myProc.register('doSomething', (data, context) => ({data, context}));
```

Now if you call `myProc.start` or `myProc.send`, it will execute 'doSomething'. That's ok, but it really doesn't get us much past just manually calling functions.

The biggest value of this is composing one or more functions in a declarative way. To do that, you would:
```js
const myProc = compose('Do A Lot', {
    processorsPath: require('path').join(__dirname, './processors'),
    pipeline: [
        'validateIncoming',
        parallel(
            'getSomething',
            'getSomethingElse',
        ),
        'formatResponse',
    ],
});
```

If you specify a `pipeline`, you can explicitly control the order of things. That's probably most common, unless all of your processors can be run independently and in parallel, in which case, you can just give it the `processorsPath`, and it will run all processors in that directory.

**Consider Parallelizing**: If you do have multiple processors that can run independently, you can use the `parallel` grouping function. Because Node is (sorta) single threaded, this is mostly useful if you have multiple async operations, so it can initiate requests for all of them together. The framework uses `Promise.all` under the covers for this, and _handily_ you don't have to deal with destructuring an array and whatnot, yourself--each processor just does its own thing more or less independently and self-coherently without knowing it's in a parallel request set. It is worth parallelizing as much as you can (i.e., anything not explicitly dependent on ordering), because even if it's not obviously async, you still give node and lower level stuff a chance to schedule chunks of instructions to run on different cores/threads/processors.

Now you have a process defined, but it won't actually do anything until you start it.

### Starting a Process
There are three ways to kick off a process.

If you are going to manually handle error handling and writing the response and whatnot yourself, you can call `start`:
```js
const { data } = await myProc.start({ ...startingContext });
// do something with the data
```
The first/main parameter for `start` is a `startingContext` object. This is essentially a grab bag of parameters useful to your processors, so you can pass in whatever the processor(s) need, such as parameters from an HTTP Request, auth user info, etc.

At the end of the process, assuming no errors, it will return an object with a `data` property that will contain any data that your processors thought was useful to provide by way of response.

### Send/Pipe Process to Response
Probably the most common use case is to use this framework as part of an HTTP Request/Response pipeline. In that case, you can instead use `send`:
```js
await myProc.send(res, { ...context });
```

This is just saving you some trouble. It will:

1) Automatically send a 200 response with the resultant `data`, if everything goes off without error.
2) Automatically add a try-catch and write an HTTP error (500) if an error occurs in any processor.

As noted in the Controlling the HTTP Response section, processors can customize the response error/message/data if need be by just throwing a `ProcessorError`.

Gone are the days of forgetting to wrap your endpoint functionality in try-catches and having unhandled promises tie up your server responses. Just write the code your processor needs to do.

### Fire and Forget
If you have one or more processors that you just want to kick off and not have later processors in your process wait on it (because by default each step in a process is blocking/awaited), there is a `fireAndForget` function that works the same as `start`. What it adds is automatic error handling and logging for you so that you can safely fire and forget.

### Continue On Error
If your procssors can function truly independently, you may want to pass `true` for `continueOnError` to `process.start`, `process.fireAndForget`, or `process.send`. If true, the process will finish out the whole process, rather than stopping at the first error (the default behavior). Using `start` will return an `errors` array in addition to `data` from its return value. You can inpect that and act accordingly. Using `send` with `continueOnError` will still send an HTTP error if any processors error; however, it will also attempt to run all processors through. Using with `fireAndForget` will work the same as `start` and just automatically log any errors for you.

**Note:** Parallel (grouped) processors will all always execute together, and if one fails, it will be reported as a single aggregate step failure if any failed.

## The Processor
Processors are nothing more than node modules that export _at least_ this signature:
```js
module.exports = {
    process: (data, context) => {
        // do your thing here

        data.foo = "bar";

        return { data, context };
    }
}
```

While it is good practice to always return the data/context, the framework will use its reference to the `data` and `context` objects it gave you, if you forget. If you do return values, it will spread any properties it gets back for those objects over the existing values. Processors can of course also use `delete` as needed to remove things from either object.

**WARNING:** These are not pure functions, and if you change values on either `data` or `context` that will impact processors down the line. Normally, this should feel 'natural', but keep in mind that things are definitely not immutable and will cause side effects, especially for any deep/nested objects.

### What Do Processors Do?

Typically, a processor will either:

- get some data and append it to the `data` object
- get some data and append it to the `context` object
- modify stuff previously added to `data` and/or `context` by prior processors
- perform some action to affect external state (e.g., update a database)

Or it can do a mixture of all of these.

### Why Data and Context?
You can imagine that we could just pass one object in and out. The value of having separate objects is so that a process can pass information between processors without impacting the resultant data set. So:

- `data` - is intended to be returned to clients, i.e., it is the response data. Using `process.send` will automatically write data as the response content, for example.
- `context` - is intended only to be used by processors to manipulate and inform their behavior (such as parameters, current user info, etc.)

An example of context is having an initial processor that goes and gets some basic information about a domain object based on an ID passed in a request parameter. It can attach that to the `context` so subsequent processors can access that information without getting it again themselves, or having to pass it to every function that needs it (as would be the case without the Processor framework).

Or you may want to separate your 'getter' to get some raw data from a data source, and attach that to context, then have a later processor format/transform/aggregate it for consumption by your clients. In fact, doing this is the recommended approach to keep things as modularized and declarative as possible.

### Managing Processor Dependencies
There are two facilities built into this framework to help mitigate against the problem of implicit dependencies between processors.

#### Prerequisite Processors (`prerequisites`)
If your process requires that some other processor(s) be run _before_ it in the process, you may specify this as `prerequisites` in  your module's exports:
```js
module.exports = {
    prerequisites: [
        'getSomething',
        'tweakSomething',
    ],

    process: async (data, context) => ({ data, context }),
}
```

Any processor specified as a prerequisite must then be declared in the processor pipeline prior to this processor. This is validated at process composition time, and the process will permanently fail on any call to `start`, `send`, or `fireAndForget` as long as the configuration error persists. This makes it pretty obvious to the dev that they messed it up, if they take out a prereq. It also makes it obvious when working on a processor that it has those dependencies, so it is a win win.

This must be an array of strings that map to the names of expected processors in the process. It will throw a `InvalidProcessError` on `start` if a prerequisite is missing. The `send` function will automatically convert this to an HTTP error response. The framework will also skip executing a later processor if one of its dependencies errored out (and you are using `continueOnError`).

#### Conditional Execution (`runIf`)
If your process should only run under certain conditions, you can use the `runIf` export.

Signature: `async (data, context) => boolean;` (or truthy value, indicating whether or not to exec this processor)

Ex:
```js
module.exports = {
    prerequisites: [
        'getSomething',
        'tweakSomething',
    ],
    runIf: async (data, context) => data.theDataNeeded && context.someImportantContext,
    process: async (data, context) => ({ data, context }),
}
```

While you can always add `if` blocks in your processor that achieve the same thing, what makes this nice is you can avoid wrapping your whole processor code in an `if` block or having to have a `return { data, context}` up front. (Depending on how you wrote your `if`...)

It also makes it obvious what state is required for the processor to function, so it is a good declarative-ish compliment to `prerequisites` to declare dependencies.

**It is a recommended best practice to define both of these if a dependency exists.**

Note: We may add an option in the future to automatically throw if `runIf` evaluates to false (making it a hard rather than a soft requirement). This is another reason to use `runIf` for any state that your processor needs to function. It makes it easier to opt into that feature and stop the whole process if this check fails.

### Controlling the HTTP Response
One of the values of this framework is that we're not passing around request/response objects everywhere, but of course that leaves us needing to control the HTTP response somehow, when that's appropriate.

Given that this framework is API-oriented, it still assumes a basic request/response interface, with the request equivalent coming in as `context` and the response equivalent going out as `data`. As such, the normal way to control the response will be to return `data` that ultimately goes out on a 200 HTTP response.

Where you may want to change that default behavior is with errors. And to do that, the framework allows individual processors to simply throw a `ProcessorError`.

```js
const { ProcessorError } = require('./processor'); // path to the processor module may need to change

module.exports = {
    process: (data, context) => {

        if (someConditionRequiringCustomResponse) {
            throw new ProcessorError('The message to send.', {
                statusCode: 400,
                errors: {
                    failureCode: 'BAD_THING',
                }
            });
        }

        return { data, context };
    }
}
```

If you are using `process.send`, it will automatically look for this error type and ensure it writes out the HTTP error `statusCode` you provide, along with any arbitrary `errors` object in the response data. The message itself will be sent as the `message` property in the response data.

If you use `process.start`, you will want to try-catch and look for `ex.isProcessError`, which will have a `errorsFromProcessors` property, if it was caused by throwing a `ProcessorError`. That is an array of one or more errors thrown by the processors in the process. You can use the `getMostSevereProcessorError` function on it, which will return the processor error with the highest status code (assuming that, say, 500+ is worse than 400-500, for example). The built in `process.send` uses this function to determine what error status code to send.

`ProcessorError` also has a `startingContext` property that may be useful for logging to figure out the incoming paramaters that produced the error.

### Sending Cookies in Response
You can of course use your own middleware, but if you have a simple name/value pair to send, you can set it on `data.cookies`. **The `cookies` property on the data object is reserved for this purpose**, so you cannot use it as a property to send arbitrary data back to clients. The processor will take any keys on the `data.cookies` object and set them on the response for you automatically, if you use `processor.send`. If you need more control, use `processor.start` instead inside of your own middleware.

It will use the `Response.cookie` default values for options (e.g., from Express). If you need to customize those, you can set the value of your cookie using an object shaped like this:
```js
data.cookies.myCookie = {
    value: 'some arbitrary cookie value',
    options: {
        // any options supported by Response.cookie
        doomain: 'mydomain.com', // for example
    }
}
```
If you go this route, you must at least supply both `value` and `options` properties. **If the cookie object has those _and only those_ properties defined**, processor will assume your intent is to customize the cookie, rather than send the data as-is (JSON.stringified, which is the normal way it would be treated if an object).

You may also supply the `cookieOptions` option in `compose` options, if you want to supply default options for cookies set in the process. This can be an object or a function to call (in case you need to calculate cookie options at runtime, like an expiration time). We merge the options given for a particular cookie with the defaults, and the more specific take precedence. See https://expressjs.com/en/api.html#res.cookie for options, if you are using Express.

#### To Clear a Cookie
You can use the same approach to clear a cookie, just set the value to null. This can be done with or without options. Keep in mind that browsers require the same options when clearing as were used when setting, with a few exceptions (such as expires). See Response.clearCookie docs for details.

Note: Processor can only do so much to protect things. If a processor attempts to change `data.cookies` into a non-object, it will be set. And as with other `data` manipulations, processors can stomp on each other's values, so it is up to the process dev to ensure this does not happen.

## Single Processor Endpoints
While the main benefit of this framework is composing more elaborate processes, it may be worthwhile to use this framework even for the simplest cases to take advantage of the automatic error handling if nothing else.  Starting your endpoint this way also makes it easier to test later, if you decide to, and/or to expand later to a more robust but modularized process. Plus, it makes it that much easier to compose that particular processsor with others in your solution if the need arises, as we show below.

The way to do a simple, single-processor endpoint is with the `single` factory function, which will return a standard node/Express HTTP request/response handler, used like so:

```js
const routes = require('express').Router()
const { single } = require('./processor');
routes.get('/foo/:fooId', single('Get Foo', './processors/getFoo'))
```
The first parameter to `single` is a friendly name for the process used for logging. The second is the path to a single processor to use for the request.

`single` will automatically merge the request body, querystring, and route parameters (in that order of precedence) into a single `params` object that is passed as the context to the processor. (It will also attach the request as `req`, should you need it.) So `getFoo` might look like so:

```js
module.exports = {
    process: (data, context) => {
        // connect to db to get data
        data = someDataFromDb;

        return { data, context };
    }
}
```

### Migrating from Single to Composed

Let's say you later need to add data from another source for that endpoint, you just add another processor that gets its own data and change `single` to `compose`.

Example:
```js
const routes = require('express').Router()
const { compose, parallel } = require('./processor');

const getFooBar = compose('Get FooBar', {
    processorsPath: require('path').join(__dirname, './processors'),
    pipeline: [
        parallel(
            'getFoo',
            'getBar',
        ),
        'mergeFooBar',
    ],
});

routes.get('/foo/:fooId', getFooBar.use())
```

Using `compose` like this should be familiar from above. We added parallel retrieval for the old `getFoo` and the new `getBar`, and then we modularized the merging of the two sources into the `mergeFooBar` processor that will make sure the data is aggregated from the two sources exactly how we want it to be. Best of all, each of these is independently testable and composable. We don't have to worry about error handling in each processor, nor do we worry about manually res.send anything. It's all done for us, and we can focus on what each module actually needs to do to contribute to the whole.

The last thing here is we call `.use()` on the composed process. This does essentially the same thing as `single` in that it will merge the request parameters and pass them in as `context`. Of course that is syntactic sugar. You can easily write your own handler to customize how the process gets initiated using `start` or `send` yourself.
