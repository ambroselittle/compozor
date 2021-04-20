module.exports = {
    process: async (data, context) => {
        data.fastDataNoReturn = 'fastDataNoReturn';
        context.fastContextNoReturn = 'fastContextNoReturn';
    }
}