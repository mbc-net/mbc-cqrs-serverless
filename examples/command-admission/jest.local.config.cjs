module.exports = {
  ...require('./jest.config.cjs'),
  testMatch: ['**/*.local-test.ts'],
  testTimeout: 15000,
}
