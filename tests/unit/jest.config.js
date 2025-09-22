module.exports = {
  displayName: 'Unit Tests',
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/miniprogram/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/miniprogram_npm/',
    '/tests/e2e/'
  ],
  collectCoverageFrom: [
    'miniprogram/**/*.js',
    '!miniprogram/app.js',
    '!miniprogram/config/**',
    '!miniprogram/**/*.test.js',
    '!miniprogram/miniprogram_npm/**'
  ],
  coverageDirectory: 'coverage/unit',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/miniprogram/$1'
  },
  globals: {
    wx: {},
    App: jest.fn(),
    Page: jest.fn(),
    Component: jest.fn(),
    getApp: jest.fn(),
    getCurrentPages: jest.fn()
  }
};