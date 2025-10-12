import { test, expect } from '@playwright/test';

// 使用本地存储的 E2E_BYPASS_LOGIN=1 启用客户端 stub，避免依赖真实云环境
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    } catch {}
  });
});

test.describe('Web Admin - Business Flow', () => {
  test('login via bypass, filter list, edit status from list', async ({ page }) => {
    // 走登录页 UI，确保用户态建立
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
    await page.getByLabel('用户名').fill('e2e');
    await page.getByLabel('口令').fill('e2e');
    await page.getByRole('button', { name: '登录' }).click();
    // 直接访问列表页（ProtectedRoute 在 bypass 模式下允许进入）
    await page.goto('/patients');

    // 确认列表渲染出至少 3 条（来自 stub）
    await expect(page.locator('table')).toBeVisible();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);

    // 搜索“张三”应过滤到 1 条
    await page.getByPlaceholder('搜索姓名 / 证件号 / 电话 / 医院 / 诊断').fill('张三');
    // 输入触发布局与筛选，需要一点时间
    await expect(rows).toHaveCount(1);

    // 清空搜索，回到 3 条
    await page.getByPlaceholder('搜索姓名 / 证件号 / 电话 / 医院 / 诊断').fill('');
    await expect(rows).toHaveCount(3);

    // 在行内“状态”列点击 pill，打开对话框
    const statusCell = rows.nth(1).locator('td').nth(6); // 第二行的状态列
    const pill = statusCell.locator('.status-pill');
    await expect(pill).toBeVisible();
    await pill.click();

    // 选择“已离开”，并确认调整
    await page.getByText('已离开', { exact: true }).click();
    await page.getByRole('button', { name: '确认调整' }).click();

    // 断言该行 pill 文案更新为“已退住”
    await expect(statusCell.locator('.status-pill.gray')).toHaveText('已退住');
  });
});
