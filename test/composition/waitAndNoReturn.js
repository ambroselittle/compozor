const { sleep } = require('../utils');

module.exports = {
    process: async (data, context) => {
        await sleep(3); // should be enough to ensure other step can execute before it

        data.slowDataNoReturn = 'slowDataNoReturn';
        context.slowContextNoReturn = 'slowContextNoReturn';
    }
}