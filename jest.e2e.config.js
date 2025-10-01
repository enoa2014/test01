module.exports = {
  preset: '@mpflow/plugin-e2e-test',
  bail: 1,
  verbose: true,
  testMatch: ['<rootDir>/tests/e2e/**/*.(spec|test).{js,ts}'],
  moduleFileExtensions: ['js', 'ts'],
  transform: {
    '^.+\\.(j|t)s$': [
      'babel-jest',
      { configFile: require.resolve('./babel.config.js') }
    ]
  },
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{js,ts}',
    '!**/__test(s)?__/**'
  ],
  testEnvironment: '<rootDir>/tests/e2e/env.js',
  testEnvironmentOptions: {
    wsEndpoint: process.env.WX_DEVTOOLS_WS || 'ws://127.0.0.1:9421',
    ...(process.env.WX_DEVTOOLS_CLI ? { cliPath: process.env.WX_DEVTOOLS_CLI } : {}),
    ...(process.env.WX_MINIAPP_PROJECT ? { projectPath: process.env.WX_MINIAPP_PROJECT } : {})
  },
  setupFilesAfterEnv: [
    '<rootDir>/tests/e2e/setup.js',
    require.resolve('@mpflow/plugin-e2e-test/lib/testSetup.js'),
    '<rootDir>/tests/e2e/setup-resources.js'
  ],
  maxWorkers: 1
};
