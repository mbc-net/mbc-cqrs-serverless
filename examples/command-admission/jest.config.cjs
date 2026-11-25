module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@mbc-cqrs-serverless/core$': '<rootDir>/../../packages/core/dist',
  },
}
