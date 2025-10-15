import { test, expect } from '@playwright/test';

test.describe('Web Admin - Chrome DevTools E2E 测试示例', () => {
  test.beforeEach(async ({ page }) => {
    // 设置性能监控
    await page.goto('/');

    // 开始性能追踪
    await page.context().tracing.start({ screenshots: true, snapshots: true });
  });

  test.afterEach(async ({ page }) => {
    // 停止性能追踪
    await page.context().tracing.stop({ path: `test-results/trace-${Date.now()}.zip` });
  });

  test('登录页面功能和错误处理测试', async ({ page }) => {
    // 1. 验证页面重定向到登录页
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();

    // 2. 验证登录表单元素存在
    await expect(page.getByLabel('用户名')).toBeVisible();
    await expect(page.getByLabel('口令')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();

    // 3. 测试空表单提交
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page.getByRole('button', { name: '登录' })).toBeEnabled();

    // 4. 测试错误凭据
    await page.getByLabel('用户名').fill('wrong-user');
    await page.getByLabel('口令').fill('wrong-pass');
    await page.getByRole('button', { name: '登录' }).click();

    // 等待错误消息出现
    await expect(page.getByText(/用户名不存在|密码错误|登录失败/)).toBeVisible({ timeout: 10000 });

    // 5. 验证表单状态
    await expect(page.getByLabel('用户名')).toHaveValue('wrong-user');
    await expect(page.getByLabel('口令')).toHaveValue('wrong-pass');
  });

  test('网络请求监控测试', async ({ page }) => {
    // 监控网络请求
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    });

    await page.goto('/login');

    // 尝试登录
    await page.getByLabel('用户名').fill('test-user');
    await page.getByLabel('口令').fill('test-pass');
    await page.getByRole('button', { name: '登录' }).click();

    // 等待一段时间让请求完成
    await page.waitForTimeout(3000);

    // 验证是否有登录请求
    const loginRequests = requests.filter(req =>
      req.url.includes('/auth') || req.url.includes('/login')
    );

    console.log('监控到的网络请求:', requests.map(r => ({ url: r.url, method: r.method })));
  });

  test('性能指标测试', async ({ page }) => {
    // 导航到登录页面
    await page.goto('/login');

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');

    // 获取性能指标
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    console.log('性能指标:', performanceMetrics);

    // 验证性能指标在合理范围内
    expect(performanceMetrics.domContentLoaded).toBeLessThan(2000); // 2秒内完成DOM加载
    expect(performanceMetrics.firstContentfulPaint).toBeLessThan(3000); // 3秒内首次内容绘制
  });

  test('控制台错误监控测试', async ({ page }) => {
    const consoleMessages = [];

    // 监听控制台消息
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    await page.goto('/login');

    // 执行一些操作
    await page.getByLabel('用户名').fill('test-user');
    await page.getByLabel('口令').fill('test-pass');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForTimeout(3000);

    // 检查是否有错误消息
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    const warnings = consoleMessages.filter(msg => msg.type === 'warning');

    console.log('控制台错误:', errors);
    console.log('控制台警告:', warnings);

    // 如果有错误，记录详细信息
    if (errors.length > 0) {
      console.error('发现控制台错误:');
      errors.forEach(error => {
        console.error(`- ${error.text} at ${error.location?.url}:${error.location?.lineNumber}`);
      });
    }
  });

  test('响应式设计测试', async ({ page }) => {
    await page.goto('/login');

    // 测试不同屏幕尺寸
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.reload();

      // 验证登录表单在不同尺寸下都可见
      await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
      await expect(page.getByLabel('用户名')).toBeVisible();
      await expect(page.getByLabel('口令')).toBeVisible();
      await expect(page.getByRole('button', { name: '登录' })).toBeVisible();

      // 获取页面截图用于验证
      await page.screenshot({
        path: `test-results/login-${viewport.name.toLowerCase()}-${Date.now()}.png`,
        fullPage: true
      });
    }
  });

  test('可访问性测试', async ({ page }) => {
    await page.goto('/login');

    // 检查页面标题
    const title = await page.title();
    expect(title).toContain('管理后台');

    // 检查主要元素的可访问性属性
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();

    // 检查表单标签
    const usernameInput = page.getByLabel('用户名');
    const passwordInput = page.getByLabel('口令');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // 检查按钮的可访问性
    const loginButton = page.getByRole('button', { name: '登录' });
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();

    // 测试键盘导航
    await usernameInput.focus();
    await page.keyboard.press('Tab');
    await expect(passwordInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(loginButton).toBeFocused();

    // 测试Enter键提交
    await passwordInput.fill('test-pass');
    await page.keyboard.press('Enter');

    // 验证表单提交尝试
    await page.waitForTimeout(2000);
  });
});

// 辅助函数：获取网络请求性能数据
async function getNetworkPerformanceData(page) {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');

    return {
      navigation: {
        dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
        tcpConnect: navigation.connectEnd - navigation.connectStart,
        request: navigation.responseStart - navigation.requestStart,
        response: navigation.responseEnd - navigation.responseStart,
        domProcessing: navigation.domContentLoadedEventStart - navigation.responseEnd,
        domComplete: navigation.loadEventStart - navigation.domContentLoadedEventEnd
      },
      resources: resources.map(resource => ({
        name: resource.name,
        duration: resource.duration,
        size: resource.transferSize || 0
      }))
    };
  });
}