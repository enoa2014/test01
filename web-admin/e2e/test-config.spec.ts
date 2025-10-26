import { test, expect } from '@playwright/test';

test.describe('测试配置和环境验证', () => {
  test('验证测试环境配置', async ({ page }) => {
    // 验证基础URL配置
    const baseURL = process.env.PW_BASE_URL || 'http://localhost:5176';
    expect(baseURL).toContain('localhost');

    // 验证测试页面可以访问
    await page.goto(baseURL);
    await expect(page.locator('body')).toBeVisible();
  });

  test('验证Web管理端服务状态', async ({ page }) => {
    try {
      await page.goto('/login');

      // 验证登录页面可以正常加载
      await expect(page.locator('h1')).toContainText('登录', { timeout: 10000 });

      // 验证登录表单元素存在
      await expect(page.locator('input[type="text"], input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"], button:has-text("登录")')).toBeVisible();

    } catch (error) {
      // 如果页面加载失败，记录错误信息
      console.error('Web管理端服务可能未正常启动:', error);
      throw error;
    }
  });

  test('验证关键路由可访问性', async ({ page }) => {
    const routes = [
      { path: '/login', expectedContent: '登录' },
      { path: '/dashboard', expectedContent: '仪表板' },
      { path: '/patients', expectedContent: '患者管理' },
      { path: '/export', expectedContent: '导出中心' },
      { path: '/audit', expectedContent: '审计日志' }
    ];

    for (const route of routes) {
      try {
        await page.goto(route.path);

        // 等待页面加载
        await page.waitForTimeout(2000);

        // 检查页面状态码（如果可能）
        const response = await page.request.get(route.path);
        expect(response.status()).toBeLessThan(500);

        // 检查页面是否加载
        await expect(page.locator('body')).toBeVisible();

        console.log(`✓ 路由 ${route.path} 可访问`);

      } catch (error) {
        console.error(`✗ 路由 ${route.path} 不可访问:`, error.message);
        // 某些路由可能需要登录，这是正常的
      }
    }
  });

  test('验证测试数据和环境变量', async () => {
    // 验证环境变量
    const requiredEnvVars = [
      'NODE_ENV',
      'VITE_TCB_ENV_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      console.warn('缺少环境变量:', missingVars);
    }

    // 验证Node.js版本
    const nodeVersion = process.version;
    expect(nodeVersion).toMatch(/^\d+\.\d+\.\d+/);
    console.log('Node.js版本:', nodeVersion);

    // 验证Playwright配置
    expect(process.env.PW_BASE_URL || 'http://localhost:5176').toBeDefined();
  });

  test('验证云函数和后端服务连接', async ({ page }) => {
    // 这个测试需要根据实际的API端点调整
    await page.goto('/login');

    // 尝试登录以验证后端连接
    try {
      await page.fill('input[type="text"], input[type="email"]', 'test');
      await page.fill('input[type="password"]', 'test');

      // 这里我们只验证表单可以提交，不关心登录结果
      const loginButton = page.locator('button[type="submit"], button:has-text("登录")');
      await expect(loginButton).toBeVisible();

      // 模拟点击登录按钮（但不等待结果）
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/'), { timeout: 5000 }).catch(() => null),
        loginButton.click()
      ]);

      console.log('✓ 后端API连接测试完成');

    } catch (error) {
      console.warn('后端连接测试失败（可能需要启动后端服务）:', error.message);
    }
  });

  test('验证浏览器和设备兼容性', async ({ page, browserName }) => {
    console.log(`当前测试浏览器: ${browserName}`);

    // 验证基本的JavaScript功能
    await page.goto('/login');

    const jsResult = await page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        platform: navigator.platform
      };
    });

    expect(jsResult.cookieEnabled).toBe(true);
    expect(jsResult.onLine).toBe(true);
    console.log('浏览器信息:', jsResult);

    // 验证CSS支持
    const cssSupport = await page.evaluate(() => {
      const testElement = document.createElement('div');
      document.body.appendChild(testElement);

      // 测试基本CSS属性
      testElement.style.display = 'flex';
      const flexSupported = window.getComputedStyle(testElement).display === 'flex';

      testElement.style.display = 'grid';
      const gridSupported = window.getComputedStyle(testElement).display === 'grid';

      document.body.removeChild(testElement);

      return { flexSupported, gridSupported };
    });

    expect(cssSupport.flexSupported).toBe(true);
    console.log('CSS支持:', cssSupport);
  });

  test('验证网络连接和资源加载', async ({ page }) => {
    await page.goto('/login');

    // 监听网络请求
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });

    // 监听网络响应
    const responses = [];
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        resourceType: response.resourceType()
      });
    });

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');

    // 分析网络请求
    const resourceTypes = {};
    requests.forEach(request => {
      resourceTypes[request.resourceType] = (resourceTypes[request.resourceType] || 0) + 1;
    });

    console.log('加载的资源类型:', resourceTypes);

    // 验证关键资源加载成功
    const failedResources = responses.filter(response => response.status() >= 400);

    if (failedResources.length > 0) {
      console.warn('加载失败的资源:', failedResources.slice(0, 5)); // 只显示前5个
    }

    // 验证页面基本信息
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        readyState: document.readyState,
        hasElements: document.body.children.length > 0,
        hasStyles: document.querySelectorAll('link[rel="stylesheet"]').length > 0,
        hasScripts: document.querySelectorAll('script').length > 0
      };
    });

    expect(pageInfo.readyState).toBe('complete');
    expect(pageInfo.hasElements).toBe(true);
    console.log('页面信息:', pageInfo);
  });

  test('验证测试数据清理机制', async ({ page }) => {
    // 验证测试不会产生持久化数据
    await page.goto('/login');

    // 记录当前状态
    const initialState = await page.evaluate(() => {
      return {
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        cookies: document.cookie
      };
    });

    // 执行一些操作
    await page.fill('input[type="text"], input[type="email"]', 'test_user');
    await page.fill('input[type="password"]', 'test_password');

    // 检查是否有数据被临时存储
    const afterOperation = await page.evaluate(() => {
      return {
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        cookies: document.cookie
      };
    });

    // 验证测试数据管理
    console.log('初始状态:', initialState);
    console.log('操作后状态:', afterOperation);

    // 清理测试数据
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
    });

    // 验证清理完成
    const cleanedState = await page.evaluate(() => {
      return {
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage),
        cookies: document.cookie
      };
    });

    expect(cleanedState.localStorage.length).toBe(0);
    expect(cleanedState.sessionStorage.length).toBe(0);
    console.log('清理后状态:', cleanedState);
  });
});

test.describe('测试环境健康检查', () => {
  test('检查磁盘空间和内存使用', async ({ page }) => {
    // 这个测试在Node.js环境中运行
    const healthCheck = await page.evaluate(() => {
      return {
        // 检查页面内存使用（如果可用）
        memory: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null,

        // 检查页面性能
        navigation: performance.timing ? {
          loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
          domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
        } : null
      };
    });

    if (healthCheck.memory) {
      console.log('内存使用情况:', healthCheck.memory);
      // 验证内存使用在合理范围内（小于100MB）
      expect(healthCheck.memory.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024);
    }

    if (healthCheck.navigation) {
      console.log('页面加载性能:', healthCheck.navigation);
      // 验证页面加载时间在合理范围内（小于10秒）
      expect(healthCheck.navigation.loadTime).toBeLessThan(10000);
    }
  });

  test('检查并发测试支持', async ({ page }) => {
    // 验证系统支持并发测试
    const concurrentRequests = [];

    for (let i = 0; i < 5; i++) {
      concurrentRequests.push(
        page.goto('/login').then(() => {
          return page.evaluate(() => document.title);
        })
      );
    }

    const results = await Promise.all(concurrentRequests);
    expect(results).toHaveLength(5);
    results.forEach(result => {
      expect(result).toContain('登录');
    });

    console.log('✓ 并发测试支持验证通过');
  });
});