
module.exports = {
    process: async (data, context) => {
        data.sidestep = true;

        return { data, context };
    }
}