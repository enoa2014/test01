/**
 * Chrome MCP E2E 测试配置文件
 * 包含测试环境设置、全局配置和自定义匹配器
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  // 测试目录配置
  testDir: './e2e',

  // 测试文件匹配模式
  testMatch: [
    '**/chrome-mcp-*.spec.ts',
    '**/chrome-mcp-*.test.ts'
  ],

  // 忽略的测试文件
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**'
  ],

  // 全局测试设置
  use: {
    // 启用截图
    screenshot: 'only-on-failure',
    // 视频录制（仅在失败时）
    video: 'retain-on-failure',
    // 追踪
    trace: 'retain-on-failure',
    // 全局超时设置
    actionTimeout: 30000,
    navigationTimeout: 30000,
    // 重试次数
    retries: process.env.CI ? 2 : 0,
  },

  // 项目配置
  projects: [
    {
      name: 'chrome-mcp-e2e',
      use: {
        // Chrome 浏览器配置
        browserName: 'chromium',
        // Chrome 启动参数
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-extensions-except',
            '--enable-automation',
            '--enable-features=NetworkService',
            '--force-color-profile=srgb',
            '--disable-gpu',
            '--headless=new',
            '--remote-debugging-port=9222',
            '--user-data-dir=/tmp/chrome-test-profile'
          ],
          // 开发工具端口（用于 chrome-mcp-stdio）
          devtools: true
        },
        // 视口配置
        viewport: { width: 1920, height: 1080 },
        // 忽略 HTTPS 错误
        ignoreHTTPSErrors: true,
        // 权限设置
        permissions: [
          'clipboard-read',
          'clipboard-write',
          'geolocation',
          'microphone',
          'camera'
        ],
        // 用户代理
        userAgent: 'Chrome MCP E2E Tests/1.0.0'
      }
    },
    {
      name: 'chrome-mcp-mobile',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--headless=new',
            '--remote-debugging-port=9223',
            '--user-data-dir=/tmp/chrome-mobile-test-profile'
          ]
        },
        // 移动端视口
        viewport: { width: 375, height: 667 },
        ignoreHTTPSErrors: true,
        // 移动端用户代理
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Chrome MCP E2E Tests/1.0.0 Mobile/15E148',
        // 设备像素比
        deviceScaleFactor: 2,
        // 触摸支持
        hasTouch: true,
        // 移动端权限
        permissions: [
          'clipboard-read',
          'clipboard-write',
          'geolocation'
        ]
      },
      // 仅在移动端测试
      testMatch: '**/chrome-mcp-mobile*.spec.ts'
    },
    {
      name: 'chrome-mcp-tablet',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--headless=new',
            '--remote-debugging-port=9224',
            '--user-data-dir=/tmp/chrome-tablet-test-profile'
          ]
        },
        // 平板视口
        viewport: { width: 768, height: 1024 },
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Chrome MCP E2E Tests/1.0.0 Safari/605.1.15',
        deviceScaleFactor: 2,
        hasTouch: true,
        permissions: [
          'clipboard-read',
          'clipboard-write',
          'geolocation'
        ]
      },
      // 仅在平板测试
      testMatch: '**/chrome-mcp-tablet*.spec.ts'
    },
    {
      name: 'chrome-mcp-performance',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--headless=new',
            '--remote-debugging-port=9225',
            '--user-data-dir=/tmp/chrome-performance-test-profile'
          ]
        },
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        // 性能测试专用设置
        actionTimeout: 60000, // 更长的超时时间
        navigationTimeout: 60000,
        // 禁用不必要的功能以提高性能
        bypassCSP: true
      },
      // 仅在性能测试
      testMatch: '**/chrome-mcp-performance*.spec.ts'
    }
  ],

  // 全局设置
  globalSetup: async () => {
    // 全局测试设置
    console.log('🚀 开始 Chrome MCP E2E 测试套件');
    console.log('📋 测试环境配置完成');
  },

  globalTeardown: async () => {
    // 全局清理
    console.log('🧹 Chrome MCP E2E 测试套件完成');
  },

  // 报告配置
  reporter: [
    ['html', {
      outputFolder: './test-results/html-report',
      open: process.env.CI !== 'true' // CI 环境不自动打开报告
    }],
    ['json', {
      outputFile: './test-results/test-results.json'
    }],
    ['junit', {
      outputFile: './test-results/test-results.xml',
      stripANSIControlSequences: true
    }],
    ['list'], // 控制台输出
    ['line'] // 逐行输出
  ],

  // 输出目录
  outputDir: './test-results',

  // 最大化工作进程数
  fullyParallel: true,

  // 工作进程数
  workers: process.env.CI ? 2 : 4,

  // 限制并发测试数量
  maxFailures: process.env.CI ? 10 : 50,

  // 禁用全局超时
  globalTimeout: process.env.CI ? 600000 : 1200000, // CI: 10分钟，本地: 20分钟

  // 环境变量
  env: {
    // 测试环境
    NODE_ENV: 'test',

    // 调试模式
    DEBUG: process.env.DEBUG || 'pw:api',

    // Chrome MCP 配置
    CHROME_MCP_DEBUG: process.env.CHROME_MCP_DEBUG || 'false',
    CHROME_MCP_TIMEOUT: process.env.CHROME_MCP_TIMEOUT || '30000',

    // 测试数据
    TEST_BASE_URL: process.env.TEST_BASE_URL || 'http://localhost:4174',
    TEST_USER_TOKEN: process.env.TEST_USER_TOKEN || 'mock-test-token',

    // 截图配置
    SCREENSHOT_DIR: './test-results/screenshots',
    VIDEO_DIR: './test-results/videos',

    // 性能测试配置
    PERFORMANCE_TIMEOUT: process.env.PERFORMANCE_TIMEOUT || '300000',

    // 网络模拟配置
    NETWORK_THROTTLE: process.env.NETWORK_THROTTLE || 'false'
  },

  // Web服务器配置（如果需要）
  webServer: {
    command: process.env.TEST_SERVER_COMMAND || 'npm run test:server',
    port: 4174,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },

  // 自定义匹配器
  expect.extend({
    // 自定义匹配器：验证页面标题
    toHaveTitle: async (page, expectedTitle, options) => {
      const title = await page.title();
      const pass = title.includes(expectedTitle);

      return {
        name: 'toHaveTitle',
        pass,
        message: () =>
          pass
            ? `Expected page title to contain "${expectedTitle}"`
            : `Expected page title to contain "${expectedTitle}" but got "${title}"`,
        actual: title,
        expected: expectedTitle
      };
    },

    // 自定义匹配器：验证元素可见性
    toBeVisible: async (element, options) => {
      const isVisible = await element.isVisible();

      return {
        name: 'toBeVisible',
        pass: isVisible,
        message: () =>
          isVisible
            ? `Expected element to be visible`
            : `Expected element to be visible but it's not`,
        actual: isVisible
      };
    },

    // 自定义匹配器：验证网络状态
    toBeOnline: async (page, options) => {
      const isOnline = await page.evaluate(() => navigator.onLine);

      return {
        name: 'toBeOnline',
        pass: isOnline,
        message: () =>
          isOnline
            ? `Expected page to be online`
            : `Expected page to be online but it's offline`,
        actual: isOnline
      };
    },

    // 自定义匹配器：验证控制台错误
    toHaveNoConsoleErrors: async (page, options) => {
      const errors = await page.evaluate(() => {
        const consoleErrors = [];
        const originalError = console.error;

        console.error = function(...args) {
          consoleErrors.push(args.join(' '));
          originalError.apply(console, args);
        };

        return consoleErrors;
      });

      const pass = errors.length === 0;

      return {
        name: 'toHaveNoConsoleErrors',
        pass,
        message: () =>
          pass
            ? `Expected no console errors`
            : `Expected no console errors but found: ${errors.join(', ')}`,
        actual: errors
      };
    },

    // 自定义匹配器：验证 API 响应时间
    toRespondWithin: async (page, apiCall, timeout) => {
      const startTime = Date.now();

      const response = await page.evaluate(async ({ url, options }) => {
        const response = await fetch(url, options);
        return {
          status: response.status,
          time: Date.now() - startTime,
          ok: response.ok
        };
      }, apiCall);

      const pass = response.time <= timeout && response.ok;

      return {
        name: 'toRespondWithin',
        pass,
        message: () =>
          pass
            ? `Expected API call to respond within ${timeout}ms (actual: ${response.time}ms)`
            : `Expected API call to respond within ${timeout}ms but took ${response.time}ms`,
        actual: response.time,
        expected: timeout
      };
    }
  })
});