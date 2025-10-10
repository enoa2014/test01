module.exports = {
  rootDir: '../../',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/service/**/*.spec.js'],
  testTimeout: 15000,
  verbose: true,
  resetModules: true,
  moduleNameMapper: {
    '^ci-info$': '<rootDir>/tests/service/__mocks__/ci-info.js'
  }
};
