import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('Dashboard role-based visibility', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  async function stubDashboardApis(page: Page, totals: { approvals?: number; imports?: number; exports?: number; errors?: number; users?: number; patients?: number }) {
    await page.route('**/api/func/rbac', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const action = body?.data?.action;
      if (action === 'listRoleRequests') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: totals.approvals ?? 0 } }) });
      }
      if (action === 'listUsers') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { success: true, data: { items: [], total: totals.users ?? 0 } } }) });
      }
      await route.continue();
    });

    await page.route('**/api/func/audit', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const filters = body?.data?.filters || {};
      const isImport = filters.action === 'import.run';
      const isExport = filters.action === 'export.detail';
      const total = isImport ? (totals.imports ?? 0) : isExport ? (totals.exports ?? 0) : (totals.errors ?? 0);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total } }) });
    });

    await page.route('**/api/func/patientProfile', async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ result: { success: true, patients: [], totalCount: totals.patients ?? 0 } }) });
    });
  }

  test('Admin sees user total and admin quick actions', async () => {
    await page.addInitScript(() => {
      localStorage.setItem('E2E_BYPASS_LOGIN', '1');
      localStorage.setItem('USER_ROLES', JSON.stringify(['admin']));
      localStorage.setItem('SELECTED_ROLE', JSON.stringify('admin'));
    });

    await stubDashboardApis(page, { approvals: 3, imports: 5, exports: 2, errors: 1, users: 42, patients: 100 });

    await page.goto('http://localhost:4173/dashboard');
    await page.waitForLoadState('networkidle');

    // 关键指标
    await expect(page.locator('text=待审批申请')).toBeVisible();
    await expect(page.locator('text=3')).toBeVisible();
    await expect(page.locator('text=用户总数')).toBeVisible();
    await expect(page.locator('text=42')).toBeVisible();
    await expect(page.locator('text=患者总数')).toBeVisible();
    await expect(page.locator('text=100')).toBeVisible();

    // 管理员快捷操作可见
    await expect(page.locator('text=创建邀请')).toBeVisible();
    await expect(page.locator('text=导入数据')).toBeVisible();
    // 共有操作
    await expect(page.locator('text=导出报告')).toBeVisible();
    await expect(page.locator('text=查看审计')).toBeVisible();

    // 角色标签
    await expect(page.locator('text=当前角色')).toBeVisible();
    await expect(page.locator('text=管理员')).toBeVisible();
  });

  test('Social worker does not see user total nor admin quick actions', async () => {
    await page.addInitScript(() => {
      localStorage.setItem('E2E_BYPASS_LOGIN', '1');
      localStorage.setItem('USER_ROLES', JSON.stringify(['social_worker']));
      localStorage.setItem('SELECTED_ROLE', JSON.stringify('social_worker'));
    });

    await stubDashboardApis(page, { approvals: 1, imports: 2, exports: 1, errors: 0, users: 999, patients: 88 });

    await page.goto('http://localhost:4173/dashboard');
    await page.waitForLoadState('networkidle');

    // 不显示“用户总数”卡片
    await expect(page.locator('text=用户总数')).toHaveCount(0);

    // 管理员快捷操作不可见
    await expect(page.locator('text=创建邀请')).toHaveCount(0);
    await expect(page.locator('text=导入数据')).toHaveCount(0);

    // 共有操作仍可见
    await expect(page.locator('text=导出报告')).toBeVisible();
    await expect(page.locator('text=查看审计')).toBeVisible();

    // 指标显示（审批、患者等）
    await expect(page.locator('text=待审批申请')).toBeVisible();
    await expect(page.locator('text=患者总数')).toBeVisible();

    // 角色标签
    await expect(page.locator('text=当前角色')).toBeVisible();
    await expect(page.locator('text=社工')).toBeVisible();
  });
});

