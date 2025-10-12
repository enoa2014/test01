const path = require('path');
const { fn: jestFn } = require('jest-mock');

const projectRoot = path.resolve(__dirname, '..', '..');

module.exports = {
  rootDir: projectRoot,
  displayName: 'Unit Tests',
  testMatch: ['**/tests/unit/**/*.test.js', '**/miniprogram/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/miniprogram_npm/', '/tests/e2e/'],
  collectCoverageFrom: [
    'miniprogram/**/*.js',
    'web-admin/src/**/*.ts',
    'web-admin/src/**/*.tsx',
    '!miniprogram/app.js',
    '!miniprogram/config/**',
    '!miniprogram/**/*.test.js',
    '!miniprogram/miniprogram_npm/**',
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
    '^@/(.*)$': '<rootDir>/miniprogram/$1',
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
