import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    } catch {}
  });
});

test('Export selected shows fileId alert', async ({ page, context }) => {
  await page.goto('/patients');
  // 切到表格视图
  const toTable = page.getByRole('button', { name: /表格视图/ });
  if (await toTable.isVisible()) {
    await toTable.click();
  }
  // 勾选“张三”
  const rowZhang = page.locator('tbody tr', { hasText: '张三' }).first();
  await expect(rowZhang).toBeVisible();
  await rowZhang.getByRole('checkbox').check();

  // 捕获 alert 对话框
  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: '导出选中' }).click();
  const dlg = await dialogPromise;
  expect(dlg.message()).toMatch(/导出成功，文件ID：/);
  await dlg.accept();
});

test('Delete single and bulk delete', async ({ page }) => {
  await page.goto('/patients');
  // 表格视图
  const toTable = page.getByRole('button', { name: /表格视图/ });
  if (await toTable.isVisible()) {
    await toTable.click();
  }

  // 删除单条：张三
  const rowZhang = page.locator('tbody tr', { hasText: '张三' }).first();
  await expect(rowZhang).toBeVisible();
  const confirm1 = page.waitForEvent('dialog');
  await rowZhang.getByRole('button', { name: '删除' }).click();
  const dlg1 = await confirm1;
  expect(dlg1.message()).toMatch(/确认删除该住户/);
  await dlg1.accept();
  await expect(page.getByText('删除成功')).toBeVisible();
  await expect(page.getByText('张三')).toHaveCount(0);

  // 批量删除：勾选剩余两条并删除
  const rows = page.locator('tbody tr');
  await rows.nth(0).getByRole('checkbox').check();
  await rows.nth(1).getByRole('checkbox').check();
  const confirm2 = page.waitForEvent('dialog');
  await page.getByRole('button', { name: '删除选中' }).click();
  const dlg2 = await confirm2;
  expect(dlg2.message()).toMatch(/确认删除选中的/);
  await dlg2.accept();
  await expect(page.getByText('批量删除成功')).toBeVisible();
});

