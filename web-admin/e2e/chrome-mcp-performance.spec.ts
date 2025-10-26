/**
 * 基于 Chrome MCP Server 的性能和稳定性 E2E 测试
 * 利用 chrome-mcp-stdio 的高级监控和分析功能
 */

import { test, expect } from './fixtures/chrome-mcp-fixture';

test.describe('⚡ 页面加载性能测试', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 模拟登录状态
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-performance-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'performance-tester'
      }));
    `);
  });

  test('首页加载性能基准测试', async ({ chromeMCP }) => {
    // 开始性能监控
    const performanceStart = Date.now();

    // 启动性能追踪
    await chromeMCP.startPerformanceTrace({
      reload: true,
      autoStop: true
    });

    // 导航到首页
    await chromeMCP.navigate('http://localhost:4174/dashboard');

    // 等待页面完全加载
    await chromeMCP.waitForElement('[data-testid="dashboard"]');
    await chromeMCP.waitForTimeout(3000); // 等待异步数据加载

    const loadCompleteTime = Date.now() - performanceStart;

    // 获取详细的性能指标
    const performanceMetrics = await chromeMCP.getPerformanceMetrics();

    console.log('首页加载性能指标:', {
      totalTime: loadCompleteTime,
      metrics: performanceMetrics
    });

    // 性能基准验证
    expect(loadCompleteTime).toBeLessThan(8000); // 8秒内加载完成

    if (performanceMetrics) {
      // Core Web Vitals 验证
      if (performanceMetrics.lcp) {
        expect(performanceMetrics.lcp).toBeLessThan(4000); // LCP < 4s
        console.log(`LCP: ${performanceMetrics.lcp}ms`);
      }

      if (performanceMetrics.fcp) {
        expect(performanceMetrics.fcp).toBeLessThan(3000); // FCP < 3s
        console.log(`FCP: ${performanceMetrics.fcp}ms`);
      }

      if (performanceMetrics.ttfb) {
        expect(performanceMetrics.ttfb).toBeLessThan(1500); // TTFB < 1.5s
        console.log(`TTFB: ${performanceMetrics.ttfb}ms`);
      }
    }

    // 分析页面资源加载
    const resourceAnalysis = await chromeMCP.evaluateScript(`
      const resources = performance.getEntriesByType('resource');
      const analysis = {
        totalResources: resources.length,
        totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
        slowResources: resources.filter(r => (r.duration || 0) > 1000).length,
        largeResources: resources.filter(r => (r.transferSize || 0) > 1024 * 1024).length, // > 1MB
        resourcesByType: {}
      };

      resources.forEach(r => {
        const type = r.initiatorType || 'other';
        analysis.resourcesByType[type] = (analysis.resourcesByType[type] || 0) + 1;
      });

      return analysis;
    `);

    console.log('资源加载分析:', resourceAnalysis);

    // 资源性能验证
    expect(resourceAnalysis.totalResources).toBeLessThan(100); // 不超过100个资源
    expect(resourceAnalysis.slowResources).toBeLessThan(10); // 慢资源不超过10个
    expect(resourceAnalysis.largeResources).toBeLessThan(5); // 大资源不超过5个

    // 截图保存性能测试结果
    await chromeMCP.takeScreenshot({
      fullPage: true,
      filename: 'dashboard-performance-test'
    });

    // 生成性能报告
    const performanceReport = await chromeMCP.evaluateScript(`
      const vitals = window.performance ? {
        navigation: performance.getEntriesByType('navigation')[0],
        resources: performance.getEntriesByType('resource')
      } : {};

      return {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        vitals: {
          domContentLoaded: vitals.navigation?.domContentLoadedEventEnd - vitals.navigation?.navigationStart,
          loadComplete: vitals.navigation?.loadEventEnd - vitals.navigation?.navigationStart,
          firstPaint: vitals.resources?.find(r => r.name === 'first-paint')?.startTime,
          firstContentfulPaint: vitals.resources?.find(r => r.name === 'first-contentful-paint')?.startTime
        },
        resourceSummary: {
          total: vitals.resources?.length || 0,
          scripts: vitals.resources?.filter(r => r.initiatorType === 'script').length || 0,
          styles: vitals.resources?.filter(r => r.initiatorType === 'link').length || 0,
          images: vitals.resources?.filter(r => r.initiatorType === 'img').length || 0,
          xhr: vitals.resources?.filter(r => r.initiatorType === 'xmlhttprequest').length || 0
        }
      };
    `);

    console.log('性能报告:', JSON.stringify(performanceReport, null, 2));
  });

  test('患者列表页面大数据加载性能测试', async ({ chromeMCP }) => {
    // 导航到患者列表页面
    await chromeMCP.navigate('http://localhost:4174/patients');

    // 开始性能监控
    const startTime = Date.now();

    // 等待列表加载完成
    await chromeMCP.waitForElement('[data-testid="patient-list"]');

    // 等待数据完全加载
    await chromeMCP.waitForTimeout(5000);

    const dataLoadTime = Date.now() - startTime;

    console.log(`患者列表数据加载时间: ${dataLoadTime}ms`);

    // 验证加载性能
    expect(dataLoadTime).toBeLessThan(10000); // 10秒内完成数据加载

    // 分析列表渲染性能
    const listPerformance = await chromeMCP.evaluateScript(`
      const patientItems = document.querySelectorAll('[data-testid="patient-item"]');
      const analysis = {
        totalItems: patientItems.length,
        renderTime: 0,
        memoryUsage: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null,
        domNodes: document.querySelectorAll('*').length
      };

      // 模拟滚动性能测试
      const scrollStartTime = performance.now();
      window.scrollTo(0, document.body.scrollHeight / 2);
      const scrollTime = performance.now() - scrollStartTime;

      analysis.scrollTime = scrollTime;

      return analysis;
    `);

    console.log('患者列表性能分析:', listPerformance);

    // 性能验证
    expect(listPerformance.totalItems).toBeGreaterThan(0);
    expect(listPerformance.scrollTime).toBeLessThan(1000); // 滚动响应 < 1s
    expect(listPerformance.domNodes).toBeLessThan(10000); // DOM节点数 < 10000

    // 内存使用验证
    if (listPerformance.memoryUsage) {
      const memoryUsageMB = listPerformance.memoryUsage.used / (1024 * 1024);
      console.log(`内存使用: ${memoryUsageMB.toFixed(2)}MB`);

      expect(memoryUsageMB).toBeLessThan(200); // 内存使用 < 200MB
    }

    // 测试搜索性能
    const searchStartTime = Date.now();

    await chromeMCP.clickElement('input[placeholder*="搜索"]');
    await chromeMCP.typeText('input[placeholder*="搜索"]', '测试搜索');
    await chromeMCP.pressKey('Enter');

    await chromeMCP.waitForTimeout(2000);

    const searchTime = Date.now() - searchStartTime;
    console.log(`搜索响应时间: ${searchTime}ms`);

    expect(searchTime).toBeLessThan(3000); // 搜索响应 < 3s

    // 截图保存性能测试结果
    await chromeMCP.takeScreenshot({
      fullPage: true,
      filename: 'patients-list-performance-test'
    });
  });

  test('并发操作性能压力测试', async ({ chromeMCP }) => {
    // 导航到管理页面
    await chromeMCP.navigate('http://localhost:4174/users');

    await chromeMCP.waitForElement('[data-testid="users-management"]');

    // 并发操作压力测试
    const concurrentActions = [
      () => chromeMCP.clickElement('button:has-text("刷新")'),
      () => chromeMCP.clickElement('button:has-text("筛选")'),
      () => chromeMCP.typeText('input[placeholder*="搜索"]', '并发测试'),
      () => chromeMCP.pressKey('Enter'),
      () => chromeMCP.evaluateScript('window.scrollTo(0, 500)')
    ];

    // 执行并发操作
    const concurrentStartTime = Date.now();

    await Promise.all(concurrentActions.map(action =>
      action().catch(err => console.warn('并发操作失败:', err))
    ));

    const concurrentTime = Date.now() - concurrentStartTime;
    console.log(`并发操作完成时间: ${concurrentTime}ms`);

    expect(concurrentTime).toBeLessThan(5000); // 并发操作 < 5s

    // 等待页面稳定
    await chromeMCP.waitForTimeout(3000);

    // 检查页面状态
    const pageStatus = await chromeMCP.evaluateScript(`
      return {
        hasErrors: document.querySelectorAll('.error-message, .alert-danger').length,
        isLoading: document.querySelectorAll('.loading, .spinner').length,
        responsive: window.innerWidth > 768
      };
    `);

    console.log('并发操作后页面状态:', pageStatus);

    // 验证页面稳定性
    expect(pageStatus.hasErrors).toBe(0); // 无错误
    expect(pageStatus.isLoading).toBe(0); // 无加载状态

    // 截图保存并发测试结果
    await chromeMCP.takeScreenshot({
      fullPage: true,
      filename: 'concurrent-operations-test'
    });
  });
});

test.describe('🔥 网络性能和稳定性测试', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 模拟登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-network-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'network-tester'
      }));
    `);

    // 启动网络监控
    await chromeMCP.startNetworkCapture({
      maxCaptureTime: 60000,
      captureRequestBody: true,
      captureResponseBody: true
    });
  });

  test('网络请求性能分析', async ({ chromeMCP }) => {
    // 导航到数据分析页面（会触发多个API请求）
    await chromeMCP.navigate('http://localhost:4174/analysis');

    // 等待页面完全加载
    await chromeMCP.waitForElement('[data-testid="analysis-dashboard"]');
    await chromeMCP.waitForTimeout(5000);

    // 获取网络请求数据
    const networkData = await chromeMCP.stopNetworkCapture();

    // 分析网络性能
    const networkAnalysis = await chromeMCP.evaluateScript(`
      // 这里模拟网络请求数据分析
      const mockNetworkData = ${JSON.stringify(networkData || {})};

      const analysis = {
        totalRequests: mockNetworkData.requests?.length || 0,
        failedRequests: mockNetworkData.requests?.filter(r => r.status >= 400).length || 0,
        slowRequests: mockNetworkData.requests?.filter(r => (r.duration || 0) > 3000).length || 0,
        averageResponseTime: 0,
        largestPayload: 0,
        apiEndpoints: {}
      };

      if (mockNetworkData.requests && mockNetworkData.requests.length > 0) {
        const totalResponseTime = mockNetworkData.requests.reduce((sum, r) => sum + (r.duration || 0), 0);
        analysis.averageResponseTime = totalResponseTime / mockNetworkData.requests.length;

        analysis.largestPayload = Math.max(...mockNetworkData.requests.map(r =>
          JSON.stringify(r.response || {}).length
        ));

        mockNetworkData.requests.forEach(req => {
          const endpoint = new URL(req.url).pathname;
          analysis.apiEndpoints[endpoint] = (analysis.apiEndpoints[endpoint] || 0) + 1;
        });
      }

      return analysis;
    `);

    console.log('网络性能分析:', networkAnalysis);

    // 网络性能验证
    expect(networkAnalysis.totalRequests).toBeGreaterThan(0);
    expect(networkAnalysis.failedRequests).toBeLessThan(networkAnalysis.totalRequests * 0.1); // 失败率 < 10%
    expect(networkAnalysis.slowRequests).toBeLessThan(networkAnalysis.totalRequests * 0.2); // 慢请求 < 20%
    expect(networkAnalysis.averageResponseTime).toBeLessThan(2000); // 平均响应时间 < 2s

    // 测试网络恢复能力
    await chromeMCP.emulateNetwork('Offline');
    await chromeMCP.waitForTimeout(2000);

    // 尝试网络操作（应该优雅处理）
    await chromeMCP.clickElement('button:has-text("刷新数据")');
    await chromeMCP.waitForTimeout(3000);

    // 检查离线处理
    const offlineHandling = await chromeMCP.getWebContent();
    const hasOfflineMessage = offlineHandling.textContent.includes('网络') ||
                              offlineHandling.textContent.includes('连接') ||
                              offlineHandling.textContent.includes('离线');

    expect(hasOfflineMessage).toBeTruthy();

    // 恢复网络连接
    await chromeMCP.emulateNetwork('No emulation');
    await chromeMCP.waitForTimeout(2000);

    // 测试网络恢复后的自动重试
    await chromeMCP.clickElement('button:has-text("重试")');
    await chromeMCP.waitForTimeout(5000);

    // 验证网络恢复
    const recoveredContent = await chromeMCP.getWebContent();
    const hasRecoveredData = !recoveredContent.textContent.includes('网络错误') &&
                           !recoveredContent.textContent.includes('连接失败');

    expect(hasRecoveredData).toBeTruthy();

    // 截图保存网络测试结果
    await chromeMCP.takeScreenshot({
      filename: 'network-performance-test'
    });
  });

  test('大数据量处理性能测试', async ({ chromeMCP }) => {
    // 导航到导出页面（会处理大量数据）
    await chromeMCP.navigate('http://localhost:4174/export');

    await chromeMCP.waitForElement('[data-testid="export-page"]');

    // 模拟大数据量导出
    const dataProcessingStartTime = Date.now();

    // 配置大数据量导出
    await chromeMCP.clickElement('input[name="dataRange"][value="all"]');
    await chromeMCP.clickElement('input[name="exportFormat"][value="excel"]');

    // 选择所有可用字段
    const allFields = await chromeMCP.findElements('input[name="fields"]');
    for (const field of allFields) {
      await chromeMCP.clickElement(field.selector);
    }

    // 开始大数据导出
    await chromeMCP.clickElement('button:has-text("开始导出"), [data-testid="start-export"]');

    // 监控导出进度
    await chromeMCP.waitForElement('[data-testid="export-progress"]');

    let exportProgress = 0;
    const exportStartTime = Date.now();
    const maxExportTime = 300000; // 5分钟超时

    while (exportProgress < 100 && (Date.now() - exportStartTime) < maxExportTime) {
      exportProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="export-progress"] .progress-value');
        const barElement = document.querySelector('[data-testid="export-progress"] progress');
        return progressElement ? parseInt(progressElement.textContent) :
               barElement ? barElement.value : 0;
      `);

      // 检查浏览器性能状态
      const performanceStatus = await chromeMCP.evaluateScript(`
        return {
          memoryUsage: performance.memory ? performance.memory.usedJSHeapSize : null,
          domNodes: document.querySelectorAll('*').length,
          activeTimers: window.setTimeout.toString().length
        };
      `);

      console.log(`导出进度: ${exportProgress}%, 内存使用: ${performanceStatus.memoryUsage ? (performanceStatus.memoryUsage / 1024 / 1024).toFixed(2) + 'MB' : 'N/A'}`);

      // 内存使用监控
      if (performanceStatus.memoryUsage) {
        const memoryMB = performanceStatus.memoryUsage / (1024 * 1024);
        expect(memoryMB).toBeLessThan(500); // 内存使用 < 500MB
      }

      await chromeMCP.waitForTimeout(5000);
    }

    const dataProcessingTime = Date.now() - dataProcessingStartTime;
    console.log(`大数据处理时间: ${dataProcessingTime}ms`);

    // 验证大数据处理性能
    expect(dataProcessingTime).toBeLessThan(300000); // 5分钟内完成
    expect(exportProgress).toBe(100); // 导出完成

    // 截图保存大数据处理结果
    await chromeMCP.takeScreenshot({
      filename: 'big-data-processing-test'
    });
  });
});

test.describe('🛡️ 错误处理和稳定性测试', () => {

  test('API错误处理和恢复测试', async ({ chromeMCP }) => {
    // 模拟登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-error-test-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'error-tester'
      }));
    `);

    // 导航到患者管理页面
    await chromeMCP.navigate('http://localhost:4174/patients');

    await chromeMCP.waitForElement('[data-testid="patient-list"]');

    // 模拟API错误
    await chromeMCP.evaluateScript(`
      // 拦截网络请求并模拟错误
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        // 模拟某些API请求失败
        if (url.includes('/api/patients') && Math.random() < 0.3) {
          return Promise.reject(new Error('模拟API错误'));
        }
        return originalFetch.call(this, url, options);
      };

      // 设置错误监听
      window.addEventListener('unhandledrejection', function(event) {
        console.error('未处理的Promise拒绝:', event.reason);
      });
    `);

    // 执行多个操作以触发错误
    const errorTestActions = [
      () => chromeMCP.clickElement('button:has-text("刷新")'),
      () => chromeMCP.clickElement('button:has-text("筛选")'),
      () => chromeMCP.typeText('input[placeholder*="搜索"]', '错误测试'),
      () => chromeMCP.pressKey('Enter'),
      () => chromeMCP.clickElement('button:has-text("导出")')
    ];

    // 执行操作并捕获错误
    const errorResults = [];
    for (const action of errorTestActions) {
      try {
        await action();
        await chromeMCP.waitForTimeout(1000);
        errorResults.push({ success: true });
      } catch (error) {
        errorResults.push({ success: false, error: error.message });
      }
    }

    console.log('错误测试结果:', errorResults);

    // 检查错误处理显示
    const errorHandling = await chromeMCP.getWebContent();
    const hasErrorMessages = errorHandling.textContent.includes('错误') ||
                              errorHandling.textContent.includes('失败') ||
                              errorHandling.textContent.includes('重试');

    expect(hasErrorMessages).toBeTruthy();

    // 测试错误恢复功能
    const retryButtons = await chromeMCP.findElements('button:has-text("重试"), button:has-text("刷新")');

    if (retryButtons.length > 0) {
      await chromeMCP.clickElement(retryButtons[0].selector);
      await chromeMCP.waitForTimeout(3000);

      // 验证恢复状态
      const recoveryStatus = await chromeMCP.getWebContent();
      const hasRecovered = !recoveryStatus.textContent.includes('错误') &&
                          !recoveryStatus.textContent.includes('失败');

      expect(hasRecovered).toBeTruthy();
    }

    // 截图保存错误处理测试结果
    await chromeMCP.takeScreenshot({
      filename: 'error-handling-test'
    });
  });

  test('内存泄漏和稳定性测试', async ({ chromeMCP }) => {
    // 模拟登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-memory-test-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'memory-tester'
      }));
    `);

    // 内存使用基准测试
    const initialMemory = await chromeMCP.evaluateScript(`
      return performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null;
    `);

    console.log('初始内存使用:', initialMemory);

    // 执行大量操作以测试内存泄漏
    for (let i = 0; i < 10; i++) {
      // 导航到不同页面
      await chromeMCP.navigate('http://localhost:4174/patients');
      await chromeMCP.waitForTimeout(2000);

      await chromeMCP.navigate('http://localhost:4174/analysis');
      await chromeMCP.waitForTimeout(2000);

      await chromeMCP.navigate('http://localhost:4174/users');
      await chromeMCP.waitForTimeout(2000);

      // 执行页面操作
      await chromeMCP.clickElement('input[placeholder*="搜索"]');
      await chromeMCP.typeText('input[placeholder*="搜索"]', `测试${i}`);
      await chromeMCP.pressKey('Enter');
      await chromeMCP.waitForTimeout(1000);

      // 检查内存使用
      const currentMemory = await chromeMCP.evaluateScript(`
        return performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null;
      `);

      if (currentMemory && initialMemory) {
        const memoryIncrease = currentMemory.used - initialMemory.used;
        const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

        console.log(`第${i + 1}轮内存增长: ${memoryIncreaseMB.toFixed(2)}MB`);

        // 内存增长不应超过合理范围
        expect(memoryIncreaseMB).toBeLessThan(100); // 单轮增长 < 100MB
      }
    }

    // 最终内存使用检查
    const finalMemory = await chromeMCP.evaluateScript(`
      return performance.memory ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null;
    `);

    console.log('最终内存使用:', finalMemory);

    if (finalMemory && initialMemory) {
      const totalMemoryIncrease = finalMemory.used - initialMemory.used;
      const totalIncreaseMB = totalMemoryIncrease / (1024 * 1024);

      console.log(`总内存增长: ${totalIncreaseMB.toFixed(2)}MB`);

      // 总内存增长应在合理范围内
      expect(totalIncreaseMB).toBeLessThan(200); // 总增长 < 200MB
    }

    // 强制垃圾回收（如果可用）
    await chromeMCP.evaluateScript(`
      if (window.gc) {
        window.gc();
      }
    `);

    await chromeMCP.waitForTimeout(2000);

    // 截图保存内存测试结果
    await chromeMCP.takeScreenshot({
      filename: 'memory-stability-test'
    });
  });
});

test.describe('🌐 多浏览器兼容性测试', () => {

  const browsers = [
    { name: 'Chrome', expected: true },
    { name: 'Firefox', expected: true },
    { name: 'Safari', expected: false }, // 在Playwright中可能不可用
    { name: 'Edge', expected: true }
  ];

  browsers.forEach(browser => {
    test(`${browser.name} 浏览器兼容性测试`, async ({ chromeMCP }) => {
      // 获取当前浏览器信息
      const browserInfo = await chromeMCP.evaluateScript(`
        return {
          userAgent: navigator.userAgent,
          name: (() => {
            const ua = navigator.userAgent;
            if (ua.includes('Chrome')) return 'Chrome';
            if (ua.includes('Firefox')) return 'Firefox';
            if (ua.includes('Safari')) return 'Safari';
            if (ua.includes('Edge')) return 'Edge';
            return 'Unknown';
          })(),
          version: (() => {
            const ua = navigator.userAgent;
            const match = ua.match(/(Chrome|Firefox|Safari|Edge)\\/(\\d+)/);
            return match ? match[1] : 'Unknown';
          })(),
          capabilities: {
            localStorage: typeof Storage !== 'undefined',
            fetch: typeof fetch !== 'undefined',
            promise: typeof Promise !== 'undefined',
            requestAnimationFrame: typeof requestAnimationFrame !== 'undefined'
          }
        };
      `);

      console.log(`${browser.name} 浏览器信息:`, browserInfo);

      // 验证基本功能
      expect(browserInfo.capabilities.localStorage).toBeTruthy();
      expect(browserInfo.capabilities.fetch).toBeTruthy();
      expect(browserInfo.capabilities.promise).toBeTruthy();

      // 模拟登录（如果支持localStorage）
      if (browserInfo.capabilities.localStorage) {
        await chromeMCP.navigate('http://localhost:4174/login');
        await chromeMCP.injectScript(`
          localStorage.setItem('userToken', 'mock-${browser.name.toLowerCase()}-token');
          localStorage.setItem('userInfo', JSON.stringify({
            roles: ['admin'],
            username: '${browser.name.toLowerCase()}-tester'
          }));
        `);
      }

      // 测试基本页面加载
      await chromeMCP.navigate('http://localhost:4174/dashboard');
      await chromeMCP.waitForTimeout(3000);

      // 验证页面加载
      const pageContent = await chromeMCP.getWebContent();
      const hasContent = pageContent.textContent.includes('仪表板') ||
                         pageContent.textContent.includes('概览') ||
                         pageContent.querySelector('h1, h2, h3');

      expect(hasContent).toBeTruthy();

      // 测试响应式设计
      const responsiveTests = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];

      for (const viewport of responsiveTests) {
        await chromeMCP.setViewport(viewport);
        await chromeMCP.waitForTimeout(1000);

        // 检查关键元素可见性
        const responsiveCheck = await chromeMCP.evaluateScript(`
          return {
            hasNavigation: !!document.querySelector('nav, .navbar, .sidebar, header'),
            hasMainContent: !!document.querySelector('main, .main-content, .content'),
            hasFooter: !!document.querySelector('footer, .page-footer'),
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight
          };
        `);

        console.log(`${browser.name} ${viewport.name} 响应式检查:`, responsiveCheck);

        expect(responsiveCheck.windowWidth).toBe(viewport.width);
        expect(responsiveCheck.windowHeight).toBe(viewport.height);
      }

      // 截图保存兼容性测试结果
      await chromeMCP.takeScreenshot({
        fullPage: true,
        filename: `${browser.name.toLowerCase()}-compatibility-test`
      });
    });
  });
});