module.exports = {
    process: async (data, context) => {
        data.modifyAndReturnData = 'modifyAndReturnData';
        context.modifyAndReturnContext = 'modifyAndReturnContext';

        return { data, context };
    }
}