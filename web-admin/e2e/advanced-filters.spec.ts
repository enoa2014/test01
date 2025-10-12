import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    } catch {}
  });
});

test('Advanced filters: filter by status (待入住) and reset', async ({ page }) => {
  await page.goto('/patients');
  // 打开面板
  await page.getByRole('button', { name: /高级筛选/ }).click();
  // 点击“待入住”状态芯片
  await page.getByText('住户状态').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '待入住' }).click();
  // 应用筛选
  await page.getByRole('button', { name: '应用筛选' }).click();

  // 应只包含“李四”
  await expect(page.getByText('李四')).toBeVisible();
  await expect(page.getByText('张三')).toHaveCount(0);
  await expect(page.getByText('王五')).toHaveCount(0);

  // 再次打开面板并重置
  await page.getByRole('button', { name: /高级筛选/ }).click();
  await page.getByRole('button', { name: '重置' }).click();
  await page.getByRole('button', { name: '应用筛选' }).click();

  // 恢复包含“张三”和“王五”
  await expect(page.getByText('张三')).toBeVisible();
  await expect(page.getByText('王五')).toBeVisible();
});

