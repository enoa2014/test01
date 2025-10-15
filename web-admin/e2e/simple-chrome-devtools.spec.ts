import { test, expect } from '@playwright/test';

test.describe('Web Admin - 简单 Chrome DevTools 测试', () => {
  test('基础页面交互测试', async ({ page }) => {
    // 1. 访问应用
    await page.goto('/');

    // 2. 验证重定向到登录页
    await expect(page).toHaveURL(/.*login/);

    // 3. 验证登录页面元素
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
    await expect(page.getByLabel('用户名')).toBeVisible();
    await expect(page.getByLabel('口令')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('网络请求监控', async ({ page }) => {
    const requests = [];

    // 监听所有网络请求
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method()
      });
    });

    await page.goto('/login');

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');

    console.log('网络请求:', requests.map(r => `${r.method} ${r.url}`));
    expect(requests.length).toBeGreaterThan(0);
  });

  test('控制台消息监控', async ({ page }) => {
    const consoleMessages = [];

    // 监听控制台消息
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      }
    });

    await page.goto('/login');

    // 执行一些操作
    await page.getByLabel('用户名').fill('test-user');
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForTimeout(2000);

    console.log('控制台错误和警告:', consoleMessages);
  });

  test('响应式设计验证', async ({ page }) => {
    await page.goto('/login');

    // 测试移动端尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();

    // 测试桌面端尺寸
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
  });
});