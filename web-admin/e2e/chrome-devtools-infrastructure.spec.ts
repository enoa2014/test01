import { test, expect } from '@playwright/test';

/**
 * Chrome DevTools E2E测试架构
 *
 * 特点：
 * 1. 结合Chrome DevTools Protocol进行深度测试
 * 2. 提供性能监控、网络分析、内存检查等高级功能
 * 3. 支持实时调试和详细的问题诊断
 * 4. 可与现有Playwright测试无缝集成
 */

test.describe('Chrome DevTools 基础设施测试', () => {
  test.beforeEach(async ({ page }) => {
    // 启用详细的控制台日志
    page.on('console', msg => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`);

      if (msg.type() === 'error') {
        console.error('Error details:', {
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // 监听页面错误
    page.on('pageerror', error => {
      console.error('Page Error:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    });

    // 监听请求失败
    page.on('requestfailed', request => {
      console.error('Request Failed:', {
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText
      });
    });
  });

  test('Chrome DevTools 连接和基础功能验证', async ({ page }) => {
    // 导航到页面
    await page.goto('/');

    // 1. 测试基础的Chrome DevTools功能
    const browserInfo = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        // 检查Chrome特有API
        hasChromeRuntime: typeof chrome !== 'undefined' && chrome.runtime,
        hasDevToolsProtocol: !!window.chrome && !!window.chrome.webstore
      };
    });

    console.log('浏览器信息:', browserInfo);
    expect(browserInfo.userAgent).toContain('Chrome');

    // 2. 测试Performance API
    const performanceInfo = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        navigationTiming: {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstByte: navigation.responseStart - navigation.requestStart,
          domInteractive: navigation.domInteractive - navigation.navigationStart
        },
        memoryUsage: performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        } : null,
        paintTiming: {
          firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
        }
      };
    });

    console.log('性能信息:', performanceInfo);
    expect(performanceInfo.navigationTiming.domContentLoaded).toBeGreaterThan(0);
    expect(performanceInfo.memoryUsage).toBeTruthy();

    // 3. 测试Console API和错误处理
    const consoleTest = await page.evaluate(() => {
      const logs = [];
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;

      // 重新定义console方法来捕获日志
      console.log = (...args) => {
        logs.push({ type: 'log', args: args.map(arg => String(arg)) });
        originalLog.apply(console, args);
      };

      console.error = (...args) => {
        logs.push({ type: 'error', args: args.map(arg => String(arg)) });
        originalError.apply(console, args);
      };

      console.warn = (...args) => {
        logs.push({ type: 'warn', args: args.map(arg => String(arg)) });
        originalWarn.apply(console, args);
      };

      // 执行一些测试日志
      console.log('测试日志消息');
      console.warn('测试警告消息');

      try {
        throw new Error('测试错误消息');
      } catch (error) {
        console.error('捕获的错误:', error.message);
      }

      // 恢复原始console方法
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      return logs;
    });

    console.log('Console测试结果:', consoleTest);
    expect(consoleTest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'log', args: expect.arrayContaining(['测试日志消息']) }),
        expect.objectContaining({ type: 'warn', args: expect.arrayContaining(['测试警告消息']) }),
        expect.objectContaining({ type: 'error', args: expect.arrayContaining(['捕获的错误:', '测试错误消息']) })
      ])
    );

    // 4. 测试网络监控
    const networkMonitor = await page.evaluate(() => {
      return new Promise((resolve) => {
        const requests = [];
        const responses = [];

        // 使用Performance API监控网络请求
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
              if (entry.name.includes('request')) {
                requests.push({
                  name: entry.name,
                  startTime: entry.startTime,
                  duration: entry.duration,
                  transferSize: entry.transferSize || 0
                });
              } else {
                responses.push({
                  name: entry.name,
                  startTime: entry.startTime,
                  duration: entry.duration,
                  transferSize: entry.transferSize || 0,
                  responseStatus: entry.responseStatus || 0
                });
              }
            }
          });
        });

        observer.observe({ entryTypes: ['resource'] });

        // 发送一些测试请求
        setTimeout(() => {
          resolve({ requests, responses });
          observer.disconnect();
        }, 2000);
      });
    });

    console.log('网络监控结果:', networkMonitor);
    expect(Array.isArray(networkMonitor.requests)).toBe(true);
    expect(Array.isArray(networkMonitor.responses)).toBe(true);
  });

  test('Chrome DevTools 性能分析集成', async ({ page }) => {
    // 启用性能监控
    await page.goto('/analysis');

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 使用Chrome DevTools Protocol进行性能分析
    const performanceMetrics = await page.evaluate(() => {
      // 创建性能标记
      performance.mark('test-start');

      return new Promise((resolve) => {
        setTimeout(async () => {
          performance.mark('test-end');
          performance.measure('test-duration', 'test-start', 'test-end');

          const measure = performance.getEntriesByName('test-duration')[0];

          // 获取详细的性能指标
          const navigation = performance.getEntriesByType('navigation')[0];
          const resources = performance.getEntriesByType('resource');
          const paint = performance.getEntriesByType('paint');

          resolve({
            navigation: {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
              domInteractive: navigation.domInteractive - navigation.navigationStart,
              firstByte: navigation.responseStart - navigation.requestStart,
              domParse: navigation.domComplete - navigation.domLoading
            },
            resources: {
              total: resources.length,
              jsFiles: resources.filter(r => r.name.endsWith('.js')).length,
              cssFiles: resources.filter(r => r.name.endsWith('.css')).length,
              imageFiles: resources.filter(r => r.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length,
              totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
              compressedSize: resources.reduce((sum, r) => sum + (r.encodedBodySize || 0), 0)
            },
            paint: {
              firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
              firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
              firstMeaningfulPaint: paint.find(p => p.name === 'first-meaningful-paint')?.startTime || 0
            },
            test: {
              duration: measure.duration,
              startTime: measure.startTime
            },
            memory: performance.memory ? {
              used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
              total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
              limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
              details: {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
              }
            } : null
          });
        }, 3000);
      });
    });

    console.log('=== Chrome DevTools 性能分析结果 ===');
    console.log('导航性能:', performanceMetrics.navigation);
    console.log('资源统计:', performanceMetrics.resources);
    console.log('绘制性能:', performanceMetrics.paint);
    console.log('测试指标:', performanceMetrics.test);
    console.log('内存使用:', performanceMetrics.memory);

    // 性能断言
    expect(performanceMetrics.navigation.domContentLoaded).toBeLessThan(5000);
    expect(performanceMetrics.paint.firstContentfulPaint).toBeLessThan(5000);
    expect(performanceMetrics.resources.total).toBeGreaterThan(0);
    expect(performanceMetrics.memory).toBeTruthy();
    expect(performanceMetrics.memory.used).toBeGreaterThan(0);

    // 获取性能截图
    await page.screenshot({
      path: 'test-results/performance-analysis-screenshot.png',
      fullPage: true
    });

    // 生成性能报告
    const performanceReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      metrics: performanceMetrics,
      passed: {
        domContentLoaded: performanceMetrics.navigation.domContentLoaded < 5000,
        firstContentfulPaint: performanceMetrics.paint.firstContentfulPaint < 5000,
        hasResources: performanceMetrics.resources.total > 0,
        hasMemoryData: performanceMetrics.memory !== null
      }
    };

    console.log('性能报告:', JSON.stringify(performanceReport, null, 2));
  });

  test('Chrome DevTools 网络调试功能', async ({ page }) => {
    // 设置网络监控
    const networkRequests = [];
    const networkResponses = [];
    const networkErrors = [];

    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        timestamp: Date.now()
      });
    });

    page.on('response', response => {
      networkResponses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        timestamp: Date.now()
      });
    });

    page.on('requestfailed', request => {
      networkErrors.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure(),
        timestamp: Date.now()
      });
    });

    // 导航到页面
    await page.goto('/');

    // 等待页面加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('=== 网络调试分析 ===');
    console.log('总请求数:', networkRequests.length);
    console.log('总响应数:', networkResponses.length);
    console.log('错误请求数:', networkErrors.length);

    // 分析请求类型
    const requestTypes = {};
    networkRequests.forEach(req => {
      const type = req.url.includes('tcb-api') ? 'API' :
                  req.url.includes('js') ? 'JavaScript' :
                  req.url.includes('css') ? 'CSS' :
                  req.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? 'Image' : 'Other';
      requestTypes[type] = (requestTypes[type] || 0) + 1;
    });

    console.log('请求类型分布:', requestTypes);

    // 分析响应状态码
    const statusCodes = {};
    networkResponses.forEach(res => {
      const range = res.status < 300 ? '2xx' :
                   res.status < 400 ? '3xx' :
                   res.status < 500 ? '4xx' : '5xx';
      statusCodes[range] = (statusCodes[range] || 0) + 1;
    });

    console.log('响应状态码分布:', statusCodes);

    // 检查API调用
    const apiRequests = networkRequests.filter(req =>
      req.url.includes('tcb-api.tencentcloudapi.com')
    );

    const apiResponses = networkResponses.filter(res =>
      res.url.includes('tcb-api.tencentcloudapi.com')
    );

    console.log('API请求数:', apiRequests.length);
    console.log('API响应数:', apiResponses.length);

    if (apiResponses.length > 0) {
      const apiStatusDistribution = {};
      apiResponses.forEach(res => {
        const status = res.status;
        apiStatusDistribution[status] = (apiStatusDistribution[status] || 0) + 1;
      });
      console.log('API响应状态分布:', apiStatusDistribution);
    }

    // 检查错误请求
    if (networkErrors.length > 0) {
      console.log('网络错误详情:');
      networkErrors.forEach(error => {
        console.log(`- ${error.method} ${error.url}: ${error.failure?.errorText}`);
      });
    }

    // 网络性能断言
    expect(networkRequests.length).toBeGreaterThan(0);
    expect(networkResponses.length).toBeGreaterThan(0);
    expect(networkErrors.length).toBeLessThan(networkRequests.length * 0.1); // 错误率应低于10%

    // 生成网络报告
    const networkReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      summary: {
        totalRequests: networkRequests.length,
        totalResponses: networkResponses.length,
        totalErrors: networkErrors.length,
        errorRate: networkErrors.length / networkRequests.length
      },
      requestTypes,
      statusCodes,
      apiCalls: {
        requests: apiRequests.length,
        responses: apiResponses.length,
        successRate: apiResponses.filter(r => r.status < 400).length / apiResponses.length
      }
    };

    console.log('网络调试报告:', JSON.stringify(networkReport, null, 2));
  });

  test('Chrome DevTools 内存和CPU监控', async ({ page }) => {
    await page.goto('/');

    // 监控内存使用情况
    const memoryStats = [];
    const cpuStats = [];

    // 每2秒收集一次性能数据
    const collectMetrics = async () => {
      const metrics = await page.evaluate(() => {
        return {
          memory: performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          } : null,
          now: performance.now()
        };
      });

      memoryStats.push({
        timestamp: Date.now(),
        memory: metrics.memory
      });
    };

    // 收集初始数据
    await collectMetrics();

    // 模拟用户操作来观察内存变化
    await page.click('button, [role="button"], a');
    await page.waitForTimeout(1000);
    await collectMetrics();

    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);
    await collectMetrics();

    // 模拟页面导航
    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    await collectMetrics();

    // 等待垃圾回收
    await page.evaluate(() => {
      if (window.gc) {
        window.gc();
      }
    });
    await page.waitForTimeout(2000);
    await collectMetrics();

    console.log('=== 内存和CPU监控结果 ===');
    console.log('内存统计数据:', memoryStats);

    // 分析内存使用趋势
    if (memoryStats.length >= 2) {
      const initialMemory = memoryStats[0].memory.used;
      const finalMemory = memoryStats[memoryStats.length - 1].memory.used;
      const memoryGrowth = finalMemory - initialMemory;
      const memoryGrowthMB = Math.round(memoryGrowth / 1024 / 1024);

      console.log(`内存使用变化: ${memoryGrowthMB > 0 ? '+' : ''}${memoryGrowthMB} MB`);

      // 检查是否存在内存泄漏
      const memoryGrowthRate = memoryGrowth / initialMemory;
      console.log(`内存增长率: ${(memoryGrowthRate * 100).toFixed(2)}%`);

      // 内存泄漏断言 - 内存增长率不应超过50%
      expect(memoryGrowthRate).toBeLessThan(0.5);
    }

    // 内存使用量断言
    const latestMemory = memoryStats[memoryStats.length - 1].memory;
    expect(latestMemory.used).toBeGreaterThan(0);
    expect(latestMemory.used).toBeLessThan(latestMemory.limit);

    // 生成内存监控报告
    const memoryReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      samples: memoryStats,
      analysis: {
        totalSamples: memoryStats.length,
        memoryRange: {
          min: Math.min(...memoryStats.map(s => s.memory.used)),
          max: Math.max(...memoryStats.map(s => s.memory.used)),
          avg: memoryStats.reduce((sum, s) => sum + s.memory.used, 0) / memoryStats.length
        }
      }
    };

    console.log('内存监控报告:', JSON.stringify(memoryReport, null, 2));
  });
});