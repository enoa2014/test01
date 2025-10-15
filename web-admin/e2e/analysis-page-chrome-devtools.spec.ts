import { test, expect } from '@playwright/test';

test.describe('统计分析页面 - Chrome DevTools 测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置测试前的监控
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    // 存储到页面上下文供后续使用
    await page.evaluate(() => {
      window.testConsoleMessages = [];
    });
  });

  test('分析页面基础功能测试', async ({ page }) => {
    // 1. 导航到分析页面
    await page.goto('/analysis');

    // 2. 等待页面加载
    await page.waitForLoadState('networkidle');

    // 3. 监控页面加载过程
    const loadingPerformance = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstByte: navigation.responseStart - navigation.requestStart
      };
    });

    console.log('页面加载性能:', loadingPerformance);

    // 4. 检查页面标题和基本元素
    const pageTitle = await page.title();
    expect(pageTitle).toContain('管理后台');

    // 5. 监控网络请求
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    });

    // 6. 等待一段时间让数据加载
    await page.waitForTimeout(5000);

    // 7. 分析网络请求
    const apiRequests = requests.filter(req =>
      req.url.includes('tcb-api.tencentcloudapi.com') ||
      req.url.includes('api') ||
      req.url.includes('cloudbase')
    );

    console.log('发现 API 请求数量:', apiRequests.length);
    apiRequests.forEach((req, index) => {
      console.log(`API 请求 ${index + 1}:`, req.method, req.url);
    });
  });

  test('错误处理和页面状态监控', async ({ page }) => {
    const errors = [];
    const warnings = [];

    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push({
          text: msg.text(),
          location: msg.location()
        });
      } else if (msg.type() === 'warning') {
        warnings.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // 导航到分析页面
    await page.goto('/analysis');

    // 等待页面稳定
    await page.waitForTimeout(5000);

    // 检查错误和警告
    console.log('控制台错误数量:', errors.length);
    console.log('控制台警告数量:', warnings.length);

    if (errors.length > 0) {
      console.log('发现的错误:');
      errors.forEach((error, index) => {
        console.log(`错误 ${index + 1}:`, error.text);
        console.log('位置:', error.location);
      });
    }

    if (warnings.length > 0) {
      console.log('发现的警告:');
      warnings.forEach((warning, index) => {
        console.log(`警告 ${index + 1}:`, warning.text);
      });
    }

    // 检查页面是否显示了错误信息
    const errorElements = await page.locator('.error, .error-message, [data-testid="error"]').count();
    if (errorElements > 0) {
      console.log('页面显示的错误元素数量:', errorElements);
    }
  });

  test('数据加载和渲染测试', async ({ page }) => {
    // 监控数据加载状态
    let dataLoaded = false;
    let renderStartTime = Date.now();

    page.on('response', response => {
      if (response.url().includes('tcb-api.tencentcloudapi.com')) {
        console.log('API 响应状态:', response.status());
        if (response.status() === 200) {
          dataLoaded = true;
          renderStartTime = Date.now();
        }
      }
    });

    await page.goto('/analysis');

    // 等待数据加载
    await page.waitForTimeout(8000);

    // 检查页面是否包含预期的分析元素
    const analysisElements = await page.locator('[class*="chart"], [class*="panel"], [class*="analysis"]').count();
    console.log('分析相关元素数量:', analysisElements);

    // 检查是否有数据展示元素
    const dataElements = await page.locator('[class*="data"], [class*="stat"], [class*="metric"]').count();
    console.log('数据展示元素数量:', dataElements);

    // 获取页面内容快照
    const pageContent = await page.content();
    const hasContent = pageContent.includes('分析') || pageContent.includes('统计') || pageContent.includes('数据');
    console.log('页面是否包含分析内容:', hasContent);

    // 检查加载状态指示器
    const loadingElements = await page.locator('[class*="loading"], [class*="spinner"]').count();
    console.log('加载指示器元素数量:', loadingElements);
  });

  test('交互功能测试', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForTimeout(5000);

    // 尝试点击可能的交互元素
    const clickableElements = [
      'button',
      '[role="button"]',
      '.tab',
      '[class*="filter"]',
      '[class*="select"]',
      '[class*="toggle"]'
    ];

    for (const selector of clickableElements) {
      try {
        const elements = await page.locator(selector).count();
        if (elements > 0) {
          console.log(`发现 ${selector} 元素数量:`, elements);

          // 尝试点击第一个元素
          const firstElement = page.locator(selector).first();
          if (await firstElement.isVisible()) {
            await firstElement.click();
            console.log(`成功点击 ${selector} 元素`);
            await page.waitForTimeout(1000);
          }
        }
      } catch (error) {
        console.log(`点击 ${selector} 元素时出错:`, error.message);
      }
    }

    // 测试键盘导航
    try {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      console.log('键盘导航测试完成');
    } catch (error) {
      console.log('键盘导航测试出错:', error.message);
    }
  });

  test('性能指标收集', async ({ page }) => {
    await page.goto('/analysis');

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 收集性能指标
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource');

      return {
        navigation: {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          domInteractive: navigation.domInteractive - navigation.navigationStart,
          firstByte: navigation.responseStart - navigation.requestStart
        },
        paint: {
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
        },
        resources: {
          total: resources.length,
          totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
          jsFiles: resources.filter(r => r.name.endsWith('.js')).length,
          cssFiles: resources.filter(r => r.name.endsWith('.css')).length
        },
        memory: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null
      };
    });

    console.log('=== 分析页面性能指标 ===');
    console.log('导航性能:', performanceMetrics.navigation);
    console.log('绘制性能:', performanceMetrics.paint);
    console.log('资源统计:', performanceMetrics.resources);
    console.log('内存使用:', performanceMetrics.memory);

    // 性能断言
    expect(performanceMetrics.navigation.domContentLoaded).toBeLessThan(5000);
    expect(performanceMetrics.paint.firstContentfulPaint).toBeLessThan(5000);
    expect(performanceMetrics.resources.total).toBeGreaterThan(0);
  });

  test('响应式设计测试', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForTimeout(3000);

    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 1366, height: 768, name: 'Laptop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      console.log(`测试 ${viewport.name} 尺寸: ${viewport.width}x${viewport.height}`);

      // 设置视口大小
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);

      // 检查页面是否正常显示
      const pageTitle = await page.title();
      expect(pageTitle).toContain('管理后台');

      // 获取页面截图
      await page.screenshot({
        path: `test-results/analysis-${viewport.name.toLowerCase()}-${Date.now()}.png`,
        fullPage: true
      });

      // 检查是否有水平滚动条
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      console.log(`${viewport.name} 是否有水平滚动:`, hasHorizontalScroll);
      expect(hasHorizontalScroll).toBeFalsy();
    }
  });

  test('API 接口调用分析', async ({ page }) => {
    const apiCalls = [];
    const responses = [];

    // 监听所有请求
    page.on('request', request => {
      if (request.url().includes('tcb-api.tencentcloudapi.com') ||
          request.url().includes('api')) {
        apiCalls.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          timestamp: Date.now()
        });
      }
    });

    // 监听所有响应
    page.on('response', response => {
      if (response.url().includes('tcb-api.tencentcloudapi.com') ||
          response.url().includes('api')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          timestamp: Date.now()
        });
      }
    });

    await page.goto('/analysis');
    await page.waitForTimeout(8000);

    console.log('=== API 调用分析 ===');
    console.log('API 调用数量:', apiCalls.length);
    console.log('API 响应数量:', responses.length);

    // 分析 API 调用
    apiCalls.forEach((call, index) => {
      console.log(`API 调用 ${index + 1}:`, {
        method: call.method,
        url: call.url.split('?')[0], // 只显示基础URL
        timestamp: new Date(call.timestamp).toISOString()
      });
    });

    // 分析响应状态
    const successResponses = responses.filter(r => r.status >= 200 && r.status < 300);
    const errorResponses = responses.filter(r => r.status >= 400);

    console.log('成功响应数量:', successResponses.length);
    console.log('错误响应数量:', errorResponses.length);

    if (errorResponses.length > 0) {
      console.log('错误响应详情:');
      errorResponses.forEach(response => {
        console.log(`- ${response.status}: ${response.url}`);
      });
    }
  });
});