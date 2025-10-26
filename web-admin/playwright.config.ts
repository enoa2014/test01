import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

// Playwright config for web-admin app
const thisDir = path.dirname(fileURLToPath(new URL(import.meta.url)));

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:4174',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'npm run dev:all',
    port: 4174,
    reuseExistingServer: true,
    cwd: thisDir,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: {
          ignoreHTTPSErrors: true,
          // 移除不支持的 'storage' 权限
          // permissions: [],
          // 添加localStorage的初始化
          storageState: {
            origins: [{
              origin: 'http://localhost:4174',
              localStorage: [
                { name: 'E2E_BYPASS_LOGIN', value: '1' },
                { name: 'USER_ROLES', value: JSON.stringify(['admin']) },
                { name: 'SELECTED_ROLE', value: JSON.stringify('admin') }
              ]
            }]
          }
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        contextOptions: {
          ignoreHTTPSErrors: true,
          // 移除不支持的 'storage' 权限
          // permissions: [],
          storageState: {
            origins: [{
              origin: 'http://localhost:4174',
              localStorage: [
                { name: 'E2E_BYPASS_LOGIN', value: '1' },
                { name: 'USER_ROLES', value: JSON.stringify(['admin']) },
                { name: 'SELECTED_ROLE', value: JSON.stringify('admin') }
              ]
            }]
          }
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        contextOptions: {
          ignoreHTTPSErrors: true,
          // 移除不支持的 'storage' 权限
          // permissions: [],
          storageState: {
            origins: [{
              origin: 'http://localhost:4174',
              localStorage: [
                { name: 'E2E_BYPASS_LOGIN', value: '1' },
                { name: 'USER_ROLES', value: JSON.stringify(['admin']) },
                { name: 'SELECTED_ROLE', value: JSON.stringify('admin') }
              ]
            }]
          }
        },
      },
    },
  ],
});
