
module.exports = {
    process: async (data, context) => {
        data.step2 = true;

        data.step1AlreadySet = data.step1;

        return { data, context };
    }
}