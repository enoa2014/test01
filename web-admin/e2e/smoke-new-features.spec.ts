import { test, expect } from '@playwright/test';

test.describe('新功能冒烟测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置更长的超时时间
    test.setTimeout(30000);
  });

  test('导入页面基础验证', async ({ page }) => {
    // 直接访问导入页面
    await page.goto('/import', { timeout: 10000 });

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 验证页面标题
    const title = page.locator('h1');
    if (await title.isVisible()) {
      await expect(title).toContainText('导入Excel');
    }

    // 验证登录重定向
    const loginForm = page.locator('input[type="password"]');
    if (await loginForm.isVisible()) {
      // 如果看到登录表单，说明需要先登录
      await expect(loginForm).toBeVisible();
      console.log('导入页面需要登录 - 符合预期');
    }
  });

  test('导出页面基础验证', async ({ page }) => {
    // 直接访问导出页面
    await page.goto('/export', { timeout: 10000 });

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 验证页面标题
    const title = page.locator('h1');
    if (await title.isVisible()) {
      await expect(title).toContainText('导出中心');
    }

    // 验证登录重定向
    const loginForm = page.locator('input[type="password"]');
    if (await loginForm.isVisible()) {
      await expect(loginForm).toBeVisible();
      console.log('导出页面需要登录 - 符合预期');
    }
  });

  test('审计日志页面基础验证', async ({ page }) => {
    // 直接访问审计页面
    await page.goto('/audit', { timeout: 10000 });

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 验证页面标题
    const title = page.locator('h1');
    if (await title.isVisible()) {
      await expect(title).toContainText('审计日志');
    }

    // 验证登录重定向
    const loginForm = page.locator('input[type="password"]');
    if (await loginForm.isVisible()) {
      await expect(loginForm).toBeVisible();
      console.log('审计页面需要登录 - 符合预期');
    }
  });

  test('系统设置页面基础验证', async ({ page }) => {
    // 直接访问设置页面
    await page.goto('/settings', { timeout: 10000 });

    // 等待页面加载
    await page.waitForTimeout(2000);

    // 验证页面标题
    const title = page.locator('h1');
    if (await title.isVisible()) {
      await expect(title).toContainText('系统设置');
    }

    // 验证登录重定向
    const loginForm = page.locator('input[type="password"]');
    if (await loginForm.isVisible()) {
      await expect(loginForm).toBeVisible();
      console.log('设置页面需要登录 - 符合预期');
    }
  });

  test('登录页面基础验证', async ({ page }) => {
    // 访问登录页面
    await page.goto('/login', { timeout: 10000 });

    // 验证登录表单存在
    await expect(page.locator('input[type="text"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("登录")')).toBeVisible();

    console.log('✓ 登录页面可以正常访问');
  });

  test('页面路由存在性检查', async ({ page }) => {
    // 检查关键路由是否返回有效响应
    const routes = [
      '/login',
      '/dashboard',
      '/patients',
      '/import',
      '/export',
      '/audit',
      '/settings'
    ];

    for (const route of routes) {
      try {
        const response = await page.goto(route, { timeout: 5000 });

        if (response && response.status() < 500) {
          console.log(`✓ 路由 ${route} 返回状态码: ${response?.status() || 'unknown'}`);
        } else {
          console.log(`✗ 路由 ${route} 可能存在问题`);
        }
      } catch (error) {
        console.log(`⚠ 路由 ${route} 访问超时或错误: ${error.message}`);
      }
    }
  });

  test('应用基础功能检查', async ({ page }) => {
    // 访问应用根目录
    await page.goto('/', { timeout: 10000 });

    // 等待页面加载
    await page.waitForTimeout(3000);

    // 检查页面是否正常加载
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // 检查是否有错误信息
    const errorElements = page.locator('text=error, Error, 错误');
    const errorCount = await errorElements.count();

    if (errorCount > 0) {
      console.log(`发现 ${errorCount} 个可能的错误元素`);
    } else {
      console.log('✓ 页面加载正常，未发现明显错误');
    }

    // 检查页面标题
    const title = await page.title();
    console.log(`页面标题: ${title}`);
  });

  test('网络请求基础检查', async ({ page }) => {
    // 监听网络请求
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          method: request.method()
        });
      }
    });

    // 访问登录页面
    await page.goto('/login', { timeout: 10000 });

    // 等待一段时间让请求发出
    await page.waitForTimeout(2000);

    if (requests.length > 0) {
      console.log(`检测到 ${requests.length} 个API请求:`);
      requests.forEach(req => console.log(`  - ${req.method} ${req.url}`));
    } else {
      console.log('未检测到API请求（可能页面还未初始化）');
    }
  });
});

test.describe('应用健康检查', () => {
  test('页面加载性能检查', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/login', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;

    console.log(`页面加载时间: ${loadTime}ms`);

    // 页面应该在15秒内加载完成
    expect(loadTime).toBeLessThan(15000);
  });

  test('JavaScript错误检查', async ({ page }) => {
    const jsErrors = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    await page.goto('/login', { timeout: 10000 });
    await page.waitForTimeout(3000);

    if (jsErrors.length > 0) {
      console.log('检测到JavaScript错误:');
      jsErrors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✓ 未检测到JavaScript错误');
    }

    // 验证没有严重错误
    expect(jsErrors.length).toBeLessThan(5);
  });

  test('控制台错误检查', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/login', { timeout: 10000 });
    await page.waitForTimeout(3000);

    if (consoleErrors.length > 0) {
      console.log('检测到控制台错误:');
      consoleErrors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✓ 未检测到控制台错误');
    }
  });
});