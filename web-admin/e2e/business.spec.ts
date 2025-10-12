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
    // 直接进入列表页（bypass 模式下 ProtectedRoute 放行）
    await page.goto('/patients');

    // 等待页面工具栏加载完成（高级筛选按钮）
    await expect(page.getByRole('button', { name: /高级筛选/ })).toBeVisible();

    // 搜索“张三”应过滤到仅包含“张三”的卡片
    const search = page.getByPlaceholder('搜索姓名 / 证件号 / 电话 / 医院 / 诊断');
    await search.fill('张三');
    await expect(page.getByText('张三')).toBeVisible();
    await expect(page.getByText('李四')).toHaveCount(0);

    // 清空搜索，恢复到包含“李四”
    await search.fill('');
    await expect(page.getByText('李四')).toBeVisible();

    // 在“李四”的卡片上点击状态徽章（随访）
    const liSiCard = page.locator('div', { hasText: '李四' }).first();
    await expect(liSiCard).toBeVisible();
    // 徽章文案为“随访”（对应 careStatus=pending）
    await liSiCard.getByText('随访', { exact: true }).click();

    // 在弹窗中选择“已离开”，并确认
    await page.getByText('已离开', { exact: true }).click();
    await page.getByRole('button', { name: '确认调整' }).click();

    // 验证“李四”卡片中出现“已离开”
    await expect(liSiCard.getByText('已离开', { exact: true })).toBeVisible();
  });
});
