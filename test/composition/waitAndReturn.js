const { sleep } = require('../utils');

module.exports = {
    process: async (data, context) => {
        await sleep(5); // should be enough to ensure other step can execute before it

        data.slowDataAndReturn = 'slowDataAndReturn';
        context.slowContextAndReturn = 'slowContextAndReturn';

        return { data, context };
    }
}