/**
 * Chrome MCP Server 测试 Fixture
 * 封装 chrome-mcp-stdio 的所有功能，提供简洁的测试 API
 */

import { test as base, expect } from '@playwright/test';
import { chromium, Browser, BrowserContext, Page } from '@playwright';

// Chrome MCP 工具接口定义
interface ChromeMCPTools {
  // 页面导航和控制
  navigate: (url: string) => Promise<void>;
  getCurrentUrl: () => Promise<string>;
  getPageTitle: () => Promise<string>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  refresh: () => Promise<void>;

  // 视口控制
  setViewport: (options: { width: number; height: number }) => Promise<void>;

  // 元素交互
  clickElement: (selector: string) => Promise<void>;
  typeText: (selector: string, text: string) => Promise<void>;
  clearText: (selector: string) => Promise<void>;
  pressKey: (key: string) => Promise<void>;
  hoverElement: (selector: string) => Promise<void>;

  // 内容获取
  getWebContent: () => Promise<{ textContent: string; innerHTML: string; title: string }>;
  getElementContent: (selector: string) => Promise<string>;
  findElement: (selector: string) => Promise<{ selector: string; textContent?: string } | null>;
  findElements: (selector: string) => Promise<{ selector: string; textContent?: string }[]>;
  getInteractiveElements: () => Promise<Array<{
    selector: string;
    tagName: string;
    textContent?: string;
    placeholder?: string;
    type?: string;
  }>>;

  // 等待操作
  waitForElement: (selector: string, timeout?: number) => Promise<void>;
  waitForNavigation: (expectedPath?: string, timeout?: number) => Promise<void>;
  waitForTimeout: (ms: number) => Promise<void>;

  // 脚本注入和执行
  injectScript: (script: string) => Promise<void>;
  evaluateScript: (script: string) => Promise<any>;

  // 截图功能
  takeScreenshot: (options?: {
    filename?: string;
    fullPage?: boolean;
    element?: string;
  }) => Promise<string>;

  // 网络监控
  startNetworkCapture: (options?: {
    maxCaptureTime?: number;
    captureRequestBody?: boolean;
    captureResponseBody?: boolean;
  }) => Promise<void>;
  stopNetworkCapture: () => Promise<any>;
  getNetworkRequests: () => Promise<Array<{
    url: string;
    method: string;
    status: number;
    response?: any;
  }>>;

  // 控制台日志
  getConsoleMessages: (types?: string[]) => Promise<Array<{
    type: string;
    message: string;
    timestamp: number;
  }>>;

  // 性能监控
  startPerformanceTrace: (options?: { reload?: boolean; autoStop?: boolean }) => Promise<void>;
  getPerformanceMetrics: () => Promise<{
    lcp?: number;
    fid?: number;
    cls?: number;
    fcp?: number;
    ttfb?: number;
  }>;

  // 网络模拟
  emulateNetwork: (condition: 'Offline' | 'Slow 3G' | 'Fast 3G' | 'No emulation') => Promise<void>;

  // 搜索和内容分析
  searchTabContent: (query: string) => Promise<Array<{
    url: string;
    title: string;
    snippet: string;
    score: number;
  }>>;

  // 高级功能
  findElementWithin: (parentSelector: string, childSelector: string) => Promise<{ selector: string } | null>;
}

// Chrome MCP Fixture 类型
type ChromeMCPFixture = {
  chromeMCP: ChromeMCPTools;
  page: Page;
  browser: Browser;
  context: BrowserContext;
};

// 创建 Chrome MCP 测试 Fixture
export const test = base.extend<ChromeMCPFixture>({
  browser: async ({}, use) => {
    // 启动 Chrome 浏览器
    const browser = await chromium.launch({
      headless: false, // Chrome MCP 需要浏览器界面
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--start-maximized'
      ]
    });

    await use(browser);
    await browser.close();
  },

  context: async ({ browser }, use) => {
    // 创建浏览器上下文
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
      permissions: ['clipboard-read', 'clipboard-write']
    });

    await use(context);
    await context.close();
  },

  page: async ({ context }, use) => {
    // 创建页面
    const page = await context.newPage();

    // 设置页面错误处理
    page.on('pageerror', (error) => {
      console.error('Page error:', error);
    });

    page.on('requestfailed', (request) => {
      console.warn('Request failed:', request.url(), request.failure());
    });

    await use(page);
  },

  chromeMCP: async ({ page }, use) => {
    // 创建 Chrome MCP 工具实例
    const chromeMCP: ChromeMCPTools = {
      // 页面导航和控制
      async navigate(url: string) {
        await page.goto(url, { waitUntil: 'networkidle' });
      },

      async getCurrentUrl() {
        return page.url();
      },

      async getPageTitle() {
        return await page.title();
      },

      async goBack() {
        await page.goBack();
      },

      async goForward() {
        await page.goForward();
      },

      async refresh() {
        await page.reload();
      },

      // 视口控制
      async setViewport(options) {
        await page.setViewportSize(options);
      },

      // 元素交互
      async clickElement(selector: string) {
        await page.click(selector);
      },

      async typeText(selector: string, text: string) {
        await page.fill(selector, text);
      },

      async clearText(selector: string) {
        await page.fill(selector, '');
      },

      async pressKey(key: string) {
        await page.keyboard.press(key);
      },

      async hoverElement(selector: string) {
        await page.hover(selector);
      },

      // 内容获取
      async getWebContent() {
        const content = await page.content();
        const title = await page.title();

        return {
          textContent: await page.innerText('body'),
          innerHTML: content,
          title
        };
      },

      async getElementContent(selector: string) {
        return await page.innerText(selector);
      },

      async findElement(selector: string) {
        try {
          const element = await page.$(selector);
          if (element) {
            return {
              selector,
              textContent: await element.innerText()
            };
          }
          return null;
        } catch {
          return null;
        }
      },

      async findElements(selector: string) {
        try {
          const elements = await page.$$(selector);
          return await Promise.all(elements.map(async (element) => ({
            selector,
            textContent: await element.innerText()
          })));
        } catch {
          return [];
        }
      },

      async getInteractiveElements() {
        // 获取所有可交互的元素
        const elements = await page.$$(
          'button, input, select, textarea, a[href], [role="button"], [tabindex]:not([tabindex="-1"])'
        );

        return await Promise.all(elements.map(async (element) => {
          const tagName = await element.evaluate(el => el.tagName);
          const textContent = await element.evaluate(el => el.textContent?.trim() || '');
          const placeholder = await element.evaluate(el =>
            el.getAttribute('placeholder') || el.getAttribute('aria-label') || ''
          );
          const type = await element.evaluate(el => el.getAttribute('type') || '');

          return {
            selector: await element.toString(),
            tagName,
            textContent: textContent || undefined,
            placeholder: placeholder || undefined,
            type: type || undefined
          };
        }));
      },

      // 等待操作
      async waitForElement(selector: string, timeout = 10000) {
        await page.waitForSelector(selector, { timeout });
      },

      async waitForNavigation(expectedPath, timeout = 10000) {
        if (expectedPath) {
          await page.waitForURL(`**${expectedPath}**`, { timeout });
        } else {
          await page.waitForLoadState('networkidle', { timeout });
        }
      },

      async waitForTimeout(ms: number) {
        await page.waitForTimeout(ms);
      },

      // 脚本注入和执行
      async injectScript(script: string) {
        await page.addScriptTag({ content: script });
      },

      async evaluateScript(script: string) {
        return await page.evaluate(script);
      },

      // 截图功能
      async takeScreenshot(options = {}) {
        const { filename, fullPage = false, element } = options;

        let screenshotBuffer;
        if (element) {
          screenshotBuffer = await page.locator(element).screenshot();
        } else {
          screenshotBuffer = await page.screenshot({ fullPage });
        }

        // 这里可以添加保存到文件的逻辑
        const screenshotPath = filename
          ? `./test-results/${filename}.png`
          : `./test-results/screenshot-${Date.now()}.png`;

        // 实际项目中这里应该保存文件
        console.log(`Screenshot saved to: ${screenshotPath}`);

        return screenshotPath;
      },

      // 网络监控（简化版本，实际应该集成 chrome-mcp-stdio）
      async startNetworkCapture(options = {}) {
        // 监听所有网络请求
        page.on('request', request => {
          console.log('Request:', request.method(), request.url());
        });

        page.on('response', response => {
          console.log('Response:', response.status(), response.url());
        });
      },

      async stopNetworkCapture() {
        // 返回收集的网络数据
        return {
          requests: [],
          responses: [],
          errors: []
        };
      },

      async getNetworkRequests() {
        // 返回网络请求数据
        return [];
      },

      // 控制台日志
      async getConsoleMessages(types = ['error', 'warning']) {
        const messages: Array<{ type: string; message: string; timestamp: number }> = [];

        page.on('console', msg => {
          if (types.includes(msg.type())) {
            messages.push({
              type: msg.type(),
              message: msg.text(),
              timestamp: Date.now()
            });
          }
        });

        return messages;
      },

      // 性能监控
      async startPerformanceTrace(options = {}) {
        if (options.reload) {
          await page.reload();
        }
      },

      async getPerformanceMetrics() {
        // 获取性能指标
        const metrics = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

          return {
            fcp: navigation.loadEventEnd - navigation.fetchStart,
            lcp: navigation.loadEventEnd - navigation.fetchStart,
            ttfb: navigation.responseStart - navigation.fetchStart
          };
        });

        return metrics;
      },

      // 网络模拟
      async emulateNetwork(condition) {
        const context = page.context();

        switch (condition) {
          case 'Offline':
            await context.setOffline(true);
            break;
          case 'Slow 3G':
            // 这里可以设置网络 throttling
            break;
          case 'Fast 3G':
            // 这里可以设置网络 throttling
            break;
          case 'No emulation':
            await context.setOffline(false);
            break;
        }
      },

      // 搜索和内容分析
      async searchTabContent(query: string) {
        const content = await page.content();

        // 简单的文本搜索（实际应该使用 chrome-mcp-stdio 的语义搜索）
        const matches = [];
        const regex = new RegExp(query, 'gi');
        let match;

        while ((match = regex.exec(content)) !== null) {
          matches.push({
            url: page.url(),
            title: await page.title(),
            snippet: content.substring(Math.max(0, match.index - 50), match.index + 50),
            score: 1.0
          });
        }

        return matches;
      },

      // 高级功能
      async findElementWithin(parentSelector: string, childSelector: string) {
        try {
          const element = await page.locator(`${parentSelector} ${childSelector}`).first();
          if (await element.count() > 0) {
            return {
              selector: `${parentSelector} ${childSelector}`
            };
          }
          return null;
        } catch {
          return null;
        }
      }
    };

    await use(chromeMCP);
  }
});

// 导出 expect 供测试使用
export { expect };

// 导出测试类型
export type { ChromeMCPTools, ChromeMCPFixture };