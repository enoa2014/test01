/**
 * Chrome DevTools E2E测试辅助工具
 *
 * 提供通用的测试辅助函数和工具方法
 */

export interface PerformanceMetrics {
  navigation: {
    domContentLoaded: number;
    loadComplete: number;
    firstByte: number;
  };
  resources: {
    total: number;
    totalSize: number;
    jsFiles: number;
    cssFiles: number;
    imageFiles: number;
  };
  paint: {
    firstPaint: number;
    firstContentfulPaint: number;
    firstMeaningfulPaint?: number;
  };
  memory: {
    used: number;
    total: number;
    limit: number;
  } | null;
}

export interface NetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
  status?: number;
  responseTime?: number;
  size?: number;
}

export interface ConsoleMessage {
  timestamp: number;
  type: 'log' | 'warn' | 'error' | 'info';
  text: string;
  location?: any;
}

export interface ErrorInfo {
  timestamp: number;
  type: 'pageerror' | 'console' | 'requestfailed';
  message: string;
  stack?: string;
  location?: any;
  url?: string;
  method?: string;
}

export class ChromeDevToolsHelper {
  private page: any;
  private metrics: {
    requests: NetworkRequest[];
    consoleMessages: ConsoleMessage[];
    errors: ErrorInfo[];
    performanceMarks: Record<string, number>;
  };

  constructor(page: any) {
    this.page = page;
    this.metrics = {
      requests: [],
      consoleMessages: [],
      errors: [],
      performanceMarks: {}
    };
    this.setupMonitoring();
  }

  /**
   * 设置监控和事件监听
   */
  private setupMonitoring(): void {
    // 监听网络请求
    this.page.on('request', (request: any) => {
      this.metrics.requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        timestamp: Date.now()
      });
    });

    this.page.on('response', (response: any) => {
      const matchingRequest = this.metrics.requests.find(req => req.url === response.url());
      if (matchingRequest) {
        matchingRequest.status = response.status();
        matchingRequest.responseTime = Date.now() - matchingRequest.timestamp;
        matchingRequest.size = parseInt(response.headers()['content-length'] || '0');
      }
    });

    this.page.on('requestfailed', (request: any) => {
      this.metrics.errors.push({
        timestamp: Date.now(),
        type: 'requestfailed',
        message: request.failure()?.errorText || 'Request failed',
        url: request.url(),
        method: request.method()
      });
    });

    // 监听控制台消息
    this.page.on('console', (msg: any) => {
      this.metrics.consoleMessages.push({
        timestamp: Date.now(),
        type: msg.type() as any,
        text: msg.text(),
        location: msg.location()
      });

      if (msg.type() === 'error') {
        this.metrics.errors.push({
          timestamp: Date.now(),
          type: 'console',
          message: msg.text(),
          location: msg.location()
        });
      }
    });

    // 监听页面错误
    this.page.on('pageerror', (error: Error) => {
      this.metrics.errors.push({
        timestamp: Date.now(),
        type: 'pageerror',
        message: error.message,
        stack: error.stack
      });
    });
  }

  /**
   * 导航到页面并等待加载
   */
  async navigateToPage(url: string, options: { timeout?: number; waitUntil?: string } = {}): Promise<void> {
    const { timeout = 30000, waitUntil = 'networkidle' } = options;

    await this.page.goto(url, {
      timeout,
      waitUntil: waitUntil as any
    });

    // 等待额外的时间确保页面稳定
    await this.page.waitForTimeout(2000);
  }

  /**
   * 收集性能指标
   */
  async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const paint = performance.getEntriesByType('paint') as PerformancePaintTiming[];

      return {
        navigation: {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstByte: navigation.responseStart - navigation.requestStart
        },
        resources: {
          total: resources.length,
          totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
          jsFiles: resources.filter(r => r.name.endsWith('.js')).length,
          cssFiles: resources.filter(r => r.name.endsWith('.css')).length,
          imageFiles: resources.filter(r => r.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length
        },
        paint: {
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          firstMeaningfulPaint: paint.find(p => p.name === 'first-meaningful-paint')?.startTime
        },
        memory: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null
      };
    });
  }

  /**
   * 收集Core Web Vitals指标
   */
  async collectCoreWebVitals(): Promise<any> {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals: any = {
          lcp: 0,
          fid: 0,
          cls: 0,
          ttfb: 0,
          fcp: 0
        };

        // LCP
        if ('PerformanceObserver' in window) {
          try {
            const lcpObserver = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              vitals.lcp = lastEntry.startTime;
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
          } catch (e) {
            console.log('LCP observer not supported');
          }

          // FID
          try {
            const fidObserver = new PerformanceObserver((list) => {
              list.getEntries().forEach((entry: any) => {
                if (entry.name === 'first-input') {
                  vitals.fid = entry.processingStart - entry.startTime;
                }
              });
            });
            fidObserver.observe({ entryTypes: ['first-input'] });
          } catch (e) {
            console.log('FID observer not supported');
          }

          // CLS
          try {
            const clsObserver = new PerformanceObserver((list) => {
              list.getEntries().forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                  vitals.cls += entry.value;
                }
              });
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
          } catch (e) {
            console.log('CLS observer not supported');
          }
        }

        // TTFB and FCP
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        vitals.ttfb = navigation.responseStart - navigation.requestStart;

        const paintEntries = performance.getEntriesByType('paint') as PerformancePaintTiming[];
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        vitals.fcp = fcpEntry ? fcpEntry.startTime : 0;

        // 等待一小段时间确保指标收集完成
        setTimeout(() => {
          resolve(vitals);
        }, 2000);
      });
    });
  }

  /**
   * 设置性能标记
   */
  async setPerformanceMark(name: string): Promise<void> {
    await this.page.evaluate((markName: string) => {
      performance.mark(markName);
    }, name);

    this.metrics.performanceMarks[name] = Date.now();
  }

  /**
   * 测量性能标记之间的时间
   */
  async measurePerformance(markName: string, startMark: string, endMark?: string): Promise<number> {
    return await this.page.evaluate((name: string, start: string, end?: string) => {
      try {
        performance.measure(name, start, end);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        return measure.duration;
      } catch (error) {
        console.error('Performance measure error:', error);
        return 0;
      }
    }, markName, startMark, endMark);
  }

  /**
   * 等待网络空闲
   */
  async waitForNetworkIdle(timeout: number = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
    await this.page.waitForTimeout(1000); // 额外等待确保网络稳定
  }

  /**
   * 截图并保存
   */
  async takeScreenshot(options: { path?: string; fullPage?: boolean } = {}): Promise<Buffer> {
    const { path, fullPage = true } = options;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = `test-results/screenshot-${timestamp}.png`;

    return await this.page.screenshot({
      path: path || defaultPath,
      fullPage
    });
  }

  /**
   * 检查页面元素是否存在
   */
  async checkElementExists(selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 等待元素出现并点击
   */
  async waitAndClick(selector: string, options: { timeout?: number; force?: boolean } = {}): Promise<void> {
    const { timeout = 10000, force = false } = options;

    await this.page.waitForSelector(selector, { timeout });
    await this.page.click(selector, { force });
    await this.page.waitForTimeout(500); // 等待点击后的反应
  }

  /**
   * 安全地填充表单字段
   */
  async safeFill(selector: string, value: string, options: { delay?: number; clear?: boolean } = {}): Promise<void> {
    const { delay = 100, clear = true } = options;

    try {
      const element = this.page.locator(selector);
      if (await element.isVisible()) {
        if (clear) {
          await element.clear();
        }
        await element.fill(value);
        if (delay > 0) {
          await this.page.waitForTimeout(delay);
        }
      }
    } catch (error) {
      console.warn(`Failed to fill element ${selector}:`, error.message);
    }
  }

  /**
   * 监控特定URL的API调用
   */
  async monitorApiCall(urlPattern: string, timeout: number = 10000): Promise<NetworkRequest | null> {
    return new Promise((resolve) => {
      let found = false;

      const checkRequest = (request: any) => {
        if (request.url().includes(urlPattern) && !found) {
          found = true;
          const apiRequest: NetworkRequest = {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            timestamp: Date.now()
          };

          // 监听响应
          request.response().then((response: any) => {
            apiRequest.status = response.status();
            apiRequest.responseTime = Date.now() - apiRequest.timestamp;
            resolve(apiRequest);
          }).catch(() => {
            resolve(apiRequest);
          });

          this.page.off('request', checkRequest);
        }
      };

      this.page.on('request', checkRequest);

      // 设置超时
      setTimeout(() => {
        if (!found) {
          this.page.off('request', checkRequest);
          resolve(null);
        }
      }, timeout);
    });
  }

  /**
   * 等待特定控制台消息
   */
  async waitForConsoleMessage(messagePattern: string, messageType: string = 'log', timeout: number = 10000): Promise<ConsoleMessage | null> {
    return new Promise((resolve) => {
      let found = false;

      const checkMessage = (msg: any) => {
        if (msg.type() === messageType && msg.text().includes(messagePattern) && !found) {
          found = true;
          const consoleMessage: ConsoleMessage = {
            timestamp: Date.now(),
            type: msg.type(),
            text: msg.text(),
            location: msg.location()
          };
          resolve(consoleMessage);
          this.page.off('console', checkMessage);
        }
      };

      this.page.on('console', checkMessage);

      // 设置超时
      setTimeout(() => {
        if (!found) {
          this.page.off('console', checkMessage);
          resolve(null);
        }
      }, timeout);
    });
  }

  /**
   * 获取当前收集的指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      summary: {
        totalRequests: this.metrics.requests.length,
        totalErrors: this.metrics.errors.length,
        totalConsoleMessages: this.metrics.consoleMessages.length,
        successfulRequests: this.metrics.requests.filter(r => r.status && r.status < 400).length,
        failedRequests: this.metrics.requests.filter(r => r.status && r.status >= 400).length
      }
    };
  }

  /**
   * 重置收集的指标
   */
  resetMetrics(): void {
    this.metrics = {
      requests: [],
      consoleMessages: [],
      errors: [],
      performanceMarks: {}
    };
  }

  /**
   * 生成测试报告
   */
  generateReport(testName: string, additionalData?: any): any {
    const metrics = this.getMetrics();
    const timestamp = new Date().toISOString();

    return {
      testName,
      timestamp,
      metrics,
      additionalData,
      performance: {
        totalRequests: metrics.summary.totalRequests,
        errorRate: metrics.summary.totalRequests > 0 ? metrics.summary.failedRequests / metrics.summary.totalRequests : 0,
        consoleErrors: metrics.errors.filter(e => e.type === 'console').length,
        pageErrors: metrics.errors.filter(e => e.type === 'pageerror').length
      }
    };
  }

  /**
   * 模拟网络条件
   */
  async simulateNetworkCondition(options: {
    offline?: boolean;
    downloadThroughput?: number;
    uploadThroughput?: number;
    latency?: number;
  }): Promise<void> {
    const context = this.page.context();
    await context.route('**/*', (route) => {
      if (options.offline) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // 注意：Playwright还支持更详细的网络条件模拟
    // 这里提供基础实现
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.resetMetrics();
  }
}

/**
 * 便捷的断言辅助函数
 */
export class PerformanceAssertions {
  static assertPageLoadTime(metrics: PerformanceMetrics, maxTime: number): void {
    expect(metrics.navigation.domContentLoaded).toBeLessThan(maxTime);
  }

  static assertFirstContentfulPaint(metrics: PerformanceMetrics, maxTime: number): void {
    expect(metrics.paint.firstContentfulPaint).toBeLessThan(maxTime);
  }

  static assertMemoryUsage(metrics: PerformanceMetrics, maxMemoryMB: number): void {
    if (metrics.memory) {
      const usedMemoryMB = metrics.memory.used / (1024 * 1024);
      expect(usedMemoryMB).toBeLessThan(maxMemoryMB);
    }
  }

  static assertNoConsoleErrors(helper: ChromeDevToolsHelper): void {
    const metrics = helper.getMetrics();
    const consoleErrors = metrics.errors.filter(e => e.type === 'console');
    expect(consoleErrors.length).toBe(0);
  }

  static assertNoPageErrors(helper: ChromeDevToolsHelper): void {
    const metrics = helper.getMetrics();
    const pageErrors = metrics.errors.filter(e => e.type === 'pageerror');
    expect(pageErrors.length).toBe(0);
  }

  static assertApiSuccess(helper: ChromeDevToolsHelper, urlPattern: string): void {
    const metrics = helper.getMetrics();
    const apiCalls = metrics.requests.filter(req => req.url.includes(urlPattern));
    const successfulCalls = apiCalls.filter(req => req.status && req.status < 400);
    expect(successfulCalls.length).toBeGreaterThan(0);
  }
}

/**
 * 常用的测试配置
 */
export const TestConfig = {
  PERFORMANCE_THRESHOLDS: {
    PAGE_LOAD_TIME: 5000,
    FIRST_CONTENTFUL_PAINT: 3000,
    MEMORY_USAGE: 100, // MB
    API_RESPONSE_TIME: 5000
  },

  TIMEOUTS: {
    NAVIGATION: 30000,
    ELEMENT_WAIT: 10000,
    NETWORK_IDLE: 5000,
    API_CALL: 10000
  },

  SELECTORS: {
    LOADING_INDICATORS: '.loading, .spinner, [data-testid="loading"]',
    ERROR_MESSAGES: '.error, .error-message, [data-testid="error"]',
    SUCCESS_MESSAGES: '.success, .success-message, [data-testid="success"]',
    BUTTONS: 'button, [role="button"]',
    INPUTS: 'input, textarea, select',
    MODALS: '.modal, .dialog, [role="dialog"]'
  }
};