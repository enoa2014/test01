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
  test('进入列表页，搜索/视图切换/打开状态弹窗（数据无关）', async ({ page }) => {
    // 直接进入列表页（bypass 或真实云端均可）
    await page.goto('/patients');

    // 工具栏可见
    await expect(page.getByRole('button', { name: /高级筛选/ })).toBeVisible();

    // 若当前为表格视图，切到“卡片视图”便于获取首个卡片名称
    const toCard = page.getByRole('button', { name: /卡片视图/ });
    if (await toCard.isVisible()) {
      await toCard.click();
    }

    // 等待卡片渲染，记录基线数量
    const cards = page.locator('.patient-card-modern');
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const initialCount = await cards.count();
    expect(initialCount).toBeGreaterThan(0);

    // 取首个卡片的标题作为搜索关键词（若不可用则回退为前2个可见字符）
    let query = (await page.locator('.patient-card-modern h3').first().textContent())?.trim() || '';
    if (!query || query.length < 2) {
      const raw = (await cards.first().textContent())?.trim() || '';
      query = raw.slice(0, 2);
    }

    const search = page.getByPlaceholder(/搜索/);
    await search.fill(query);
    await page.waitForTimeout(800);

    // 过滤后至少有 1 个卡片，且数量不大于初始数量
    const filteredCount = await cards.count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // 清空搜索，应恢复到不小于过滤前的数量
    await search.fill('');
    await page.waitForTimeout(800);
    const restoredCount = await cards.count();
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);

    // 切换到表格视图并验证有数据行
    const toTable = page.getByRole('button', { name: /表格视图/ });
    if (await toTable.isVisible()) {
      await toTable.click();
    }
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    // 打开首行状态弹窗并关闭（不做写操作）
    await rows.first().locator('.status-pill').first().click();
    await expect(page.getByText('调整状态')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
  });
});
