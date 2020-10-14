
module.exports = {
    process: async (data, context) => {
        data.step1 = true;

        return { data, context };
    }
}