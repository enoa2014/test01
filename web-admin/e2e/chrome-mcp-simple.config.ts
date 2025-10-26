/**
 * Chrome MCP E2E 测试简化配置文件
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: [
    '**/chrome-mcp-*.spec.ts',
    '**/chrome-mcp-*.test.ts'
  ],

  timeout: 60000,
  expect: {
    timeout: 10000
  },

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,

  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['junit', { outputFile: 'test-results/test-results.xml' }],
    ['list']
  ],

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    actionTimeout: 30000,
    navigationTimeout: 30000
  },

  projects: [
    {
      name: 'chrome-mcp-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chrome-mcp-mobile',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'chrome-mcp-tablet',
      use: { ...devices['iPad Pro'] },
    }
  ],

  webServer: {
    command: 'npm run dev:serve',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});