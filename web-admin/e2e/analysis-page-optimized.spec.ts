import { test, expect } from '@playwright/test';

test.describe('统计分析页面 - 优化测试方案', () => {
  test.beforeEach(async ({ page }) => {
    // 监听所有网络请求
    page.on('request', request => {
      console.log('>>', request.method(), request.url());
    });

    page.on('response', response => {
      console.log('<<', response.status(), response.url());
    });

    // 监听失败的请求
    page.on('requestfailed', request => {
      console.log('Request failed:', request.url(), request.failure()?.errorText);
    });
  });

  test('分析页面基础功能和性能测试', async ({ page }) => {
    // 1. 导航到分析页面
    await page.goto('/analysis');

    // 2. 等待页面网络空闲
    await page.waitForLoadState('networkidle');

    // 3. 监控关键请求完成
    const requestFinishedPromise = page.waitForEvent('requestfinished');
    await requestFinishedPromise;

    // 4. 验证页面标题
    await expect(page).toHaveTitle(/管理后台/);

    // 5. 检查是否重定向到正确页面
    const currentUrl = page.url();
    console.log('当前页面 URL:', currentUrl);
    expect(currentUrl).toContain('/analysis');

    // 6. 获取性能指标
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');

      return {
        navigation: {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstByte: navigation.responseStart - navigation.requestStart
        },
        paint: {
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
        }
      };
    });

    console.log('页面性能指标:', performanceMetrics);

    // 性能断言
    expect(performanceMetrics.navigation.domContentLoaded).toBeLessThan(5000);
    expect(performanceMetrics.paint.firstContentfulPaint).toBeLessThan(5000);
  });

  test('网络请求监控和分析', async ({ page }) => {
    const requests = [];
    const responses = [];
    const apiCalls = [];

    // 详细监控网络请求
    page.on('request', request => {
      const requestData = {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        resourceType: request.resourceType(),
        timestamp: Date.now()
      };
      requests.push(requestData);

      if (request.url().includes('tcb-api.tencentcloudapi.com') ||
          request.url().includes('api')) {
        apiCalls.push(requestData);
      }
    });

    page.on('response', response => {
      const responseData = {
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        timestamp: Date.now()
      };
      responses.push(responseData);
    });

    // 导航到分析页面
    await page.goto('/analysis');

    // 等待关键网络请求完成
    await page.waitForResponse(response =>
      response.url().includes('tcb-api.tencentcloudapi.com') &&
      response.status() === 200
    ).catch(() => {
      console.log('未找到预期的 API 响应');
    });

    // 等待页面稳定
    await page.waitForTimeout(5000);

    // 分析网络请求
    console.log('=== 网络请求分析 ===');
    console.log('总请求数:', requests.length);
    console.log('API 调用数:', apiCalls.length);
    console.log('响应数:', responses.length);

    // 分析 API 调用详情
    apiCalls.forEach((call, index) => {
      console.log(`API 调用 ${index + 1}:`, {
        method: call.method,
        url: call.url.split('?')[0], // 只显示基础 URL
        resourceType: call.resourceType
      });
    });

    // 分析响应状态
    const successResponses = responses.filter(r => r.status >= 200 && r.status < 300);
    const errorResponses = responses.filter(r => r.status >= 400);

    console.log('成功响应:', successResponses.length);
    console.log('错误响应:', errorResponses.length);

    if (errorResponses.length > 0) {
      console.log('错误响应详情:');
      errorResponses.forEach(response => {
        console.log(`- ${response.status}: ${response.url}`);
      });
    }

    // 验证至少有一些请求
    expect(requests.length).toBeGreaterThan(0);
  });

  test('错误处理和控制台监控', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    // 监听控制台消息
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      };
      consoleMessages.push(message);

      if (msg.type() === 'error') {
        console.log('Console Error:', message.text);
      }
    });

    // 监听页面错误
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
      console.log('Page Error:', error.message);
    });

    await page.goto('/analysis');

    // 等待页面加载和可能的错误
    await page.waitForTimeout(8000);

    // 分析错误
    console.log('=== 错误分析 ===');
    console.log('控制台消息总数:', consoleMessages.length);
    console.log('页面错误数:', pageErrors.length);

    const errors = consoleMessages.filter(msg => msg.type === 'error');
    const warnings = consoleMessages.filter(msg => msg.type === 'warning');

    console.log('控制台错误数:', errors.length);
    console.log('控制台警告数:', warnings.length);

    if (errors.length > 0) {
      console.log('控制台错误详情:');
      errors.forEach((error, index) => {
        console.log(`错误 ${index + 1}:`, error.text);
        console.log('位置:', error.location);
      });
    }

    if (pageErrors.length > 0) {
      console.log('页面错误详情:');
      pageErrors.forEach((error, index) => {
        console.log(`页面错误 ${index + 1}:`, error.message);
      });
    }

    // 检查页面是否仍然可用
    const pageTitle = await page.title();
    expect(pageTitle).toContain('管理后台');
  });

  test('页面交互和响应式测试', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForTimeout(3000);

    // 测试不同的视口大小
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      console.log(`测试视口: ${viewport.name} (${viewport.width}x${viewport.height})`);

      // 设置视口大小
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);

      // 验证页面标题
      await expect(page).toHaveTitle(/管理后台/);

      // 检查是否有水平滚动
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      console.log(`${viewport.name} 水平滚动:`, hasHorizontalScroll);

      // 截图记录
      await page.screenshot({
        path: `test-results/analysis-${viewport.name.toLowerCase()}-${Date.now()}.png`,
        fullPage: true
      });
    }
  });

  test('使用网络拦截模拟 API 响应', async ({ page }) => {
    // 拦截并模拟 API 响应
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            patients: [],
            statistics: {
              total: 0,
              active: 0,
              discharged: 0
            }
          }
        })
      });
    });

    await page.goto('/analysis');
    await page.waitForTimeout(5000);

    // 验证页面是否正常处理模拟数据
    const pageTitle = await page.title();
    expect(pageTitle).toContain('管理后台');

    console.log('网络拦截测试完成');
  });

  test('内存和性能监控', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 获取内存使用情况
    const memoryUsage = await page.evaluate(() => {
      if (performance.memory) {
        return {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024), // MB
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) // MB
        };
      }
      return null;
    });

    console.log('内存使用情况:', memoryUsage);

    // 获取网络请求计时信息
    const requestFinishedPromise = page.waitForEvent('requestfinished');
    await requestFinishedPromise.then(request => {
      const timing = request.timing();
      console.log('请求计时信息:', {
        startTime: timing.startTime,
        responseEnd: timing.responseEnd,
        duration: timing.responseEnd - timing.startTime
      });
    });

    // 验证内存使用合理
    if (memoryUsage) {
      expect(memoryUsage.used).toBeLessThan(500); // 小于 500MB
    }
  });

  test('页面内容验证', async ({ page }) => {
    await page.goto('/analysis');
    await page.waitForTimeout(5000);

    // 获取页面内容
    const pageContent = await page.content();

    // 检查关键元素是否存在
    const hasAnalysisContent = pageContent.includes('分析') ||
                              pageContent.includes('统计') ||
                              pageContent.includes('数据');

    console.log('页面包含分析内容:', hasAnalysisContent);

    // 检查是否有加载指示器
    const loadingElements = await page.locator('[class*="loading"], [class*="spinner"]').count();
    console.log('加载指示器数量:', loadingElements);

    // 检查是否有错误显示
    const errorElements = await page.locator('[class*="error"], .error-message').count();
    console.log('错误元素数量:', errorElements);

    // 检查页面是否可交互
    const interactiveElements = await page.locator('button, [role="button"], select, input').count();
    console.log('可交互元素数量:', interactiveElements);

    // 验证页面基本可用性
    expect(await page.title()).toContain('管理后台');
  });
});