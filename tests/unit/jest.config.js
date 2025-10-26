const path = require('path');
const { fn: jestFn } = require('jest-mock');

const projectRoot = path.resolve(__dirname, '..', '..');

module.exports = {
  rootDir: projectRoot,
  displayName: 'Unit Tests',
  testMatch: ['**/tests/unit/**/*.test.js', '**/wx-project/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/miniprogram_npm/', '/tests/e2e/'],
  // Avoid scanning backup folders accidentally created during dependency troubleshooting
  modulePathIgnorePatterns: ['<rootDir>/node_modules.bak', '<rootDir>/node_modules.bak.*'],
  watchPathIgnorePatterns: ['node_modules.bak', 'node_modules.bak.*'],
  collectCoverageFrom: [
    'wx-project/**/*.js',
    'web-admin/src/**/*.ts',
    'web-admin/src/**/*.tsx',
    '!wx-project/app.js',
    '!wx-project/config/**',
    '!wx-project/**/*.test.js',
    '!wx-project/miniprogram_npm/**',
  ],
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
  },
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [path.join(projectRoot, 'tests', 'unit', 'setup.js')],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/wx-project/$1',
  },
  globals: {
    wx: {},
    App: jestFn(),
    Page: jestFn(),
    Component: jestFn(),
    getApp: jestFn(),
    getCurrentPages: jestFn(),
  },
};
