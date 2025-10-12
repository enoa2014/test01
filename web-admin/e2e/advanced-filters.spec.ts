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

  // 应只包含“李四”（切到表格视图以便断言行数）
  const toTable = page.getByRole('button', { name: /表格视图/ });
  if (await toTable.isVisible()) {
    await toTable.click();
  }
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('李四');

  // 再次打开面板并重置
  await page.getByRole('button', { name: /高级筛选/ }).click();
  await page.getByRole('button', { name: '重置' }).click();
  await page.getByRole('button', { name: '应用筛选' }).click();

  // 恢复后应包含至少 2 条（张三、王五）
  await expect(rows).toHaveCount(3);
});
