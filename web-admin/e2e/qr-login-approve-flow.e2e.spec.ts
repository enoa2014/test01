import { test, expect, BrowserContext, Page } from '@playwright/test';

/**
 * E2E: 完整扫码登录 + 审批链路（parseQR + qrApprove + 票据登录 + 跳转）
 * 通过路由拦截在浏览器侧维护内存会话，模拟小程序扫码与审批过程。
 */

test.describe('QR Login Approve Flow E2E', () => {
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

    // 在浏览器内维护临时会话状态
    const sessions: Record<string, any> = {};

    await page.route('**/api/func/qrLogin', async (route) => {
      const req = route.request();
      const payload = JSON.parse(req.postData() || '{}');
      const data = payload?.data || {};
      const action = data?.action;

      // 返回统一响应结构
      const ok = (body: any) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

      if (action === 'qrInit') {
        const sessionId = 'sid-ui';
        const qrData = 'enc-' + sessionId; // 测试中不做真实加解密
        sessions[sessionId] = {
          status: 'pending',
          qrData,
          approveNonce: '',
          role: data?.type || 'admin',
          createdAt: Date.now(),
          expiresAt: Date.now() + 90_000,
        };
        return ok({ success: true, data: { sessionId, qrData, expiresAt: sessions[sessionId].expiresAt, nonce: 'n1' } });
      }

      if (action === 'qrStatus') {
        const { sessionId } = data;
        const s = sessions[sessionId];
        if (!s) return ok({ success: false, error: { code: 'SESSION_NOT_FOUND', message: '会话不存在' } });
        if (s.status === 'approved') {
          return ok({
            success: true,
            data: {
              status: 'approved',
              message: '登录成功',
              loginTicket: 'ticket-' + sessionId,
              userInfo: {
                uid: 'uid-' + sessionId,
                selectedRole: s.role,
                roles: [s.role],
                nickName: s.role === 'social_worker' ? '社工小王' : '系统管理员',
                avatarUrl: ''
              },
              nonce: 'n2'
            }
          });
        }
        return ok({ success: true, data: { status: 'waiting', message: '等待扫码' } });
      }

      if (action === 'parseQR') {
        const { qrData } = data;
        const sessionId = (qrData || '').replace('enc-', '');
        const s = sessions[sessionId];
        if (!s) return ok({ success: false, error: { code: 'INVALID_QR_CODE', message: '二维码无效' } });
        s.approveNonce = 'nonce-' + Math.random().toString(36).slice(2, 8);
        return ok({ success: true, data: { valid: true, sessionInfo: { sessionId, type: s.role, status: s.status, createdAt: s.createdAt, expiresAt: s.expiresAt }, approveNonce: s.approveNonce } });
      }

      if (action === 'qrApprove') {
        const { sessionId, approveNonce, userInfo, loginMode } = data;
        const s = sessions[sessionId];
        if (!s) return ok({ success: false, error: { code: 'SESSION_NOT_FOUND', message: '会话不存在' } });
        if (!approveNonce || approveNonce !== s.approveNonce) {
          return ok({ success: false, error: { code: 'INVALID_APPROVE_NONCE', message: '审批令牌无效' } });
        }
        s.status = 'approved';
        s.role = userInfo?.selectedRole || s.role || 'admin';
        return ok({ success: true, data: { confirmed: true, message: '登录确认成功', loginTicket: 'ticket-' + sessionId, userInfo: { uid: 'uid-' + sessionId, role: s.role }, sessionInfo: { expiresAt: s.expiresAt, refreshToken: 'r1' } } });
      }

      // 默认放行
      await route.continue();
    });

    await page.goto('http://localhost:4173/login');
    await page.waitForLoadState('networkidle');
  });

  test('complete flow: init -> parse -> approve -> status approved -> ticket login -> redirect', async () => {
    // 1) 打开扫码页，选择“社工”生成二维码
    await page.click('text=扫码登录');
    await page.click('text=社工');
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

    // 2) 以固定会话 ID（sid-ui）模拟 parse 与 approve
    const parsed = await page.request.post('http://localhost:4173/api/func/qrLogin', {
      data: { data: { action: 'parseQR', qrData: 'enc-sid-ui' } }
    });
    const parsedJson: any = await parsed.json();
    const approveNonce = parsedJson?.data?.approveNonce;

    const approved = await page.request.post('http://localhost:4173/api/func/qrLogin', {
      data: { data: { action: 'qrApprove', sessionId: 'sid-ui', approveNonce, userInfo: { selectedRole: 'social_worker', nickName: '社工小王' }, loginMode: 'full' } }
    });
    const approvedJson: any = await approved.json();
    expect(approvedJson?.success).toBeTruthy();

    // 4) 页面端轮询应拿到 approved 并进行票据登录与跳转
    await expect(page.locator('text=登录成功，正在跳转...')).toBeVisible({ timeout: 15000 });
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 5) 断言角色持久化
    const userRoles = await page.evaluate(() => localStorage.getItem('USER_ROLES'));
    const selectedRole = await page.evaluate(() => localStorage.getItem('SELECTED_ROLE'));
    expect(userRoles).toBe('["social_worker"]');
    expect(selectedRole).toBe('"social_worker"');
  });
});
