let config = {
    testRegex: "((\\.|/*.)(spec))\\.js?$",
    roots: ['<rootDir>/test/'],
    setupFilesAfterEnv: ["jest-expect-message", './test/setup.js'], // lets us pass custom message to expects
}

module.exports = config;