import { test, expect, BrowserContext, Page } from '@playwright/test';

test.describe('Invites - social_worker flow', () => {
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
    // 启用 E2E_BYPASS_LOGIN，使用内置 stub
    await page.addInitScript(() => {
      localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    });

    // 拦截 /api/func/rbac 调用，构造内存邀清单
    const invites: any[] = [];
    await page.route('**/api/func/rbac', async (route) => {
      const postData = JSON.parse(route.request().postData() || '{}');
      const action = postData?.data?.action;
      if (action === 'listInvites') {
        const body = { success: true, data: { items: invites.slice().reverse(), total: invites.length } };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }
      if (action === 'createInvite') {
        const code = Math.random().toString(36).slice(2, 10).toUpperCase();
        const invite = {
          id: 'e2e-' + Date.now(),
          code,
          role: postData.data.role,
          scopeId: null,
          usesLeft: postData.data.uses || 1,
          expiresAt: null,
          state: 'active',
          createdBy: 'e2e',
          createdAt: Date.now(),
          sharePath: `pages/auth/invite-code/index?code=${code}`,
        };
        invites.push(invite);
        const body = { success: true, data: { code, inviteId: invite.id, sharePath: invite.sharePath } };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }
      if (action === 'generateInviteQr') {
        const body = { success: true, data: { url: 'data:image/png;base64,UUU=' } };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }
      if (action === 'revokeInvite') {
        const id = postData?.data?.inviteId;
        const idx = invites.findIndex((it: any) => it.id === id);
        if (idx >= 0) invites[idx].state = 'revoked';
        const body = { success: true };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }
      await route.continue();
    });
    await page.goto('http://localhost:4173/invites');
    await page.waitForLoadState('networkidle');
  });

  test('create social_worker invite and generate QR', async () => {
    // 进入邀请管理页
    await expect(page.locator('text=邀请管理')).toBeVisible();

    // 点击“创建邀请码”
    await page.click('text=创建邀请码');

    // 选择角色=社工
    const roleSelect = page.locator('select');
    await roleSelect.selectOption('social_worker');

    // 使用次数=1
    const usesInput = page.locator('input[type="number"]');
    await usesInput.fill('1');

    // 点击“创建”
    await page.click('text=创建', { timeout: 10000 });

    // 弹窗展示成功信息
    await expect(page.locator('text=邀请码创建成功')).toBeVisible({ timeout: 10000 });

    // 显示生成的二维码（由 stub 返回 base64）
    const qrThumb = page.locator('img[alt="QR"]');
    await expect(qrThumb).toBeVisible();

    // 关闭创建成功弹窗（点击右上角 ×）
    await page.locator('button:has-text("×")').first().click();

    // 列表应包含新邀请码，并可生成二维码
    await expect(page.locator('text=社工')).toBeVisible();
    const genBtn = page.locator('text=生成二维码').first();
    await expect(genBtn).toBeVisible();
    await genBtn.click();

    // 预览弹窗出现并可关闭
    await expect(page.locator('text=二维码预览')).toBeVisible();
    await page.click('text=关闭');

    // 撤销第一条邀请
    const revokeBtn = page.locator('text=撤销').first();
    await expect(revokeBtn).toBeVisible();
    await revokeBtn.click();

    // 状态显示“已撤销”
    await expect(page.locator('text=已撤销')).toBeVisible();

    // 过滤到“已撤销”
    const stateSelect = page.locator('label:has-text("状态") + select');
    await stateSelect.selectOption('revoked');

    // 仅显示撤销记录（存在“已撤销”标记，且无“生成二维码”按钮）
    await expect(page.locator('text=已撤销')).toBeVisible();
    await expect(page.locator('text=生成二维码')).toHaveCount(0);
  });
});
