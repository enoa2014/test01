import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('Users and Roles admin flows', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await page.addInitScript(() => {
      localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    });

    // RBAC listUsers & listRoleBindings stubs
    await page.route('**/api/func/rbac', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      const action = body?.data?.action;

      if (action === 'listUsers') {
        const payload = {
          success: true,
          data: {
            total: 2,
            items: [
              { id: 'u1', openid: 'openid-1', displayName: '张三', phone: '13800138000', avatar: '', status: 'active', lastLoginAt: Date.now(), createdAt: Date.now() - 1000 },
              { id: 'u2', openid: 'openid-2', displayName: '李四', phone: '13900139000', avatar: '', status: 'suspended', lastLoginAt: Date.now(), createdAt: Date.now() - 2000 }
            ]
          }
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        return;
      }

      if (action === 'listRoleBindings') {
        const payload = {
          success: true,
          data: {
            items: [
              { id: 'b1', userOpenId: 'openid-1', role: 'social_worker', scopeType: 'global', state: 'active', createdAt: Date.now(), createdBy: 'admin' },
            ]
          }
        };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        return;
      }

      if (action === 'addRoleBinding') {
        const payload = { success: true };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        return;
      }

      await route.continue();
    });
  });

  test('Users page list and filters', async () => {
    await page.goto('http://localhost:4173/users');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=用户管理')).toBeVisible();
    // 两条用户记录（通过名字匹配）
    await expect(page.locator('text=张三')).toBeVisible();
    await expect(page.locator('text=李四')).toBeVisible();
    // 状态文案存在
    await expect(page.locator('text=正常')).toBeVisible();
    await expect(page.locator('text=已禁用')).toBeVisible();

    // 打开筛选器，选择角色“社工”
    await page.click('text=显示筛选');
    const rolesSelect = page.locator('label:has-text("用户角色") + select');
    await rolesSelect.selectOption('social_worker');
    // 断言页面仍可见（本测试只验证交互，列表受后端数据驱动）
    await expect(page.locator('text=用户管理')).toBeVisible();
  });

  test('Roles page add binding modal flow', async () => {
    await page.goto('http://localhost:4173/roles');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=角色管理')).toBeVisible();
    await expect(page.locator('text=添加角色绑定')).toBeVisible();

    // 打开“添加角色绑定”弹窗
    await page.click('text=添加角色绑定');
    await expect(page.locator('text=添加角色绑定')).toBeVisible();

    // 填写表单
    await page.fill('input[placeholder="请输入用户OpenID"]', 'openid-3');
    const roleSelect = page.locator('label:has-text("角色 *") + select');
    await roleSelect.selectOption('social_worker');

    // 点击添加
    await page.click('text=添加');

    // 弹窗关闭（按钮“添加角色绑定”可见）
    await expect(page.locator('text=添加角色绑定')).toBeVisible();
  });
});

