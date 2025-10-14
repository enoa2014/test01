module.exports = {
  rootDir: '../../',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/service/**/*.spec.js'],
  testTimeout: 15000,
  verbose: true,
  resetModules: true,
  // Avoid scanning backup folders created during dependency troubleshooting
  modulePathIgnorePatterns: ['<rootDir>/node_modules.bak', '<rootDir>/node_modules.bak.*'],
  watchPathIgnorePatterns: ['node_modules.bak', 'node_modules.bak.*'],
  moduleNameMapper: {
    '^ci-info$': '<rootDir>/tests/service/__mocks__/ci-info.js'
  }
};
