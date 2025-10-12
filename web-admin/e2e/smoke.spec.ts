import { test, expect } from '@playwright/test';

test.describe('Web Admin - Smoke', () => {
  test('redirects to /login and renders form', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
    await expect(page.getByLabel('用户名')).toBeVisible();
    await expect(page.getByLabel('口令')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();
  });

  test('login form shows error with wrong credential (UI path)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('用户名').fill('wrong-user');
    await page.getByLabel('口令').fill('wrong-pass');
    await page.getByRole('button', { name: '登录' }).click();
    // 后端未连通或返回失败时，页面会显示错误提示
    await expect(page.locator('.error-text')).toBeVisible({ timeout: 10_000 });
  });
});

