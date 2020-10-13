let config = {
    testRegex: "((\\.|/*.)(spec))\\.js?$",
    roots: ['<rootDir>/src/'],
    setupFilesAfterEnv: ["jest-expect-message"], // lets us pass custom message to expects
}

module.exports = config;