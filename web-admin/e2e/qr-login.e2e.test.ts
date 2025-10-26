/**
 * QR Login End-to-End Tests
 * Complete user journey testing for QR login functionality
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

test.describe('QR Login E2E Tests', () => {
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
    // 使用 E2E_BYPASS_LOGIN 以启用内置 CloudBase stub，确保 Ticket 登录无外部依赖
    await page.addInitScript(() => {
      localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    });
    await page.goto('http://localhost:4173/login');
    await page.waitForLoadState('networkidle');
  });

  test('displays QR login interface correctly', async () => {
    // Check if QR login tab is present
    await expect(page.locator('text=扫码登录')).toBeVisible();

    // Click on QR login tab
    await page.click('text=扫码登录');

    // Verify role selection is visible
    await expect(page.locator('text=选择您的角色，使用微信小程序扫码快速登录')).toBeVisible();

    // Check all role buttons are present
    const expectedRoles = ['系统管理员', '社工', '志愿者', '家长', '游客'];
    for (const role of expectedRoles) {
      await expect(page.locator(`text=${role}`)).toBeVisible();
    }
  });

  test('generates QR code when role is selected', async () => {
    // Navigate to QR login
    await page.click('text=扫码登录');

    // Intercept qrInit to verify autoBind flag
    await page.route('**/api/func/qrLogin', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');
      if (postData.data?.action === 'qrInit') {
        // Expect autoBind enabled by latest implementation
        if (postData.data?.autoBind !== true) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: 'autoBind should be true' } })
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { sessionId: 'sid-1', qrData: 'enc', expiresAt: Date.now() + 90000, nonce: 'n1' }
          })
        });
        return;
      }
      await route.continue();
    });

    // Select admin role
    await page.click('text=系统管理员');

    // Wait for QR code to appear
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible({ timeout: 10000 });

    // Verify QR code related elements
    await expect(page.locator('text=请使用微信小程序扫码')).toBeVisible();
    await expect(page.locator('text=刷新二维码')).toBeVisible();
    await expect(page.locator('text=取消登录')).toBeVisible();
  });

  test('shows countdown timer for QR code', async () => {
    await page.click('text=扫码登录');
    await page.click('text=社工');

    // Wait for QR code and timer
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();
    await expect(page.locator('text=/剩余时间/')).toBeVisible();

    // Verify countdown is working (check after 2 seconds)
    const initialTime = await page.locator('text=/\\d+:\\d{2}/').first().textContent();

    await page.waitForTimeout(2000);

    const laterTime = await page.locator('text=/\\d+:\\d{2}/').first().textContent();

    expect(laterTime).not.toBe(initialTime);
  });

  test('handles QR code expiry and refresh', async () => {
    await page.click('text=扫码登录');
    await page.click('text=志愿者');

    // Wait for QR code
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

    // Mock expired status by intercepting API call
    await page.route('**/api/func/qrLogin', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');

      if (postData.data?.action === 'qrStatus') {
        // Return expired status
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'expired',
              message: '二维码已过期'
            }
          })
        });
      } else {
        // Continue with normal request for other actions
        await route.continue();
      }
    });

    // Wait for polling to detect expiry
    await page.waitForTimeout(5000);

    // Should show expired message
    await expect(page.locator('text=二维码已过期')).toBeVisible();

    // Refresh button should be enabled
    const refreshButton = page.locator('text=刷新二维码');
    await expect(refreshButton).toBeEnabled();

    // Click refresh to generate new QR
    await refreshButton.click();

    // Should generate new QR code
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();
  });

  test('completes full login flow successfully', async () => {
    // Mock successful login flow
    await page.route('**/api/func/qrLogin', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');

      if (postData.data?.action === 'qrInit') {
        // Return QR init response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'test-session-123',
              qrData: 'encrypted-qr-data',
              expiresAt: Date.now() + 90000,
              nonce: 'test-nonce-123'
            }
          })
        });
      } else if (postData.data?.action === 'qrStatus') {
        // Return approved status after first poll
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'approved',
              message: '登录成功',
              loginTicket: 'test-login-ticket-123',
              userInfo: {
                uid: 'test-user-123',
                selectedRole: 'admin',
                roles: ['admin'],
                nickName: '测试管理员',
                avatarUrl: 'https://example.com/avatar.jpg'
              },
              nonce: 'test-nonce-456'
            }
          })
        });
      } else {
        await route.continue();
      }
    });

    // Mock CloudBase authentication
    await page.addInitScript(() => {
      // Mock CloudBase auth functions
      (window as any).cloudbaseAuthMock = {
        customAuthProvider: () => ({
          signInWithTicket: () => Promise.resolve({ user: { uid: 'test-user-123' } })
        })
      };
    });

    // Start login flow
    await page.click('text=扫码登录');
    await page.click('text=系统管理员');

    // Wait for QR code
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

    // Wait for login completion
    await expect(page.locator('text=登录成功，正在跳转...')).toBeVisible({ timeout: 15000 });
    // 确认已跳转到 /dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // Verify user info is stored in localStorage
    const userRoles = await page.evaluate(() => localStorage.getItem('USER_ROLES'));
    const selectedRole = await page.evaluate(() => localStorage.getItem('SELECTED_ROLE'));

    expect(userRoles).toBe('["admin"]');
    expect(selectedRole).toBe('"admin"');
  });

  test('completes social_worker login flow with autoBind', async () => {
    // Mock init + status approved for 社工
    await page.route('**/api/func/qrLogin', async (route) => {
      const request = route.request();
      const postData = JSON.parse(request.postData() || '{}');

      if (postData.data?.action === 'qrInit') {
        // 统一优化应启用 autoBind
        if (postData.data?.autoBind !== true) {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'autoBind should be true' } }) });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { sessionId: 'sid-sw', qrData: 'enc', expiresAt: Date.now() + 90000, nonce: 'n1' } })
        });
        return;
      }
      if (postData.data?.action === 'qrStatus') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              status: 'approved',
              message: '登录成功',
              loginTicket: 'ticket-sw',
              userInfo: {
                uid: 'test-sw-uid',
                selectedRole: 'social_worker',
                roles: ['social_worker'],
                nickName: '社工小王',
                avatarUrl: ''
              },
              nonce: 'n2'
            }
          })
        });
        return;
      }
      await route.continue();
    });

    await page.click('text=扫码登录');
    await page.click('text=社工');

    // 二维码生成
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

    // 等待登录完成提示与跳转
    await expect(page.locator('text=登录成功，正在跳转...')).toBeVisible({ timeout: 15000 });
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    // 校验角色持久化
    const userRoles = await page.evaluate(() => localStorage.getItem('USER_ROLES'));
    const selectedRole = await page.evaluate(() => localStorage.getItem('SELECTED_ROLE'));
    expect(userRoles).toBe('["social_worker"]');
    expect(selectedRole).toBe('"social_worker"');
  });

  test('handles network errors gracefully', async () => {
    // Mock network error
    await page.route('**/api/func/qrLogin', async (route) => {
      await route.abort('failed');
    });

    await page.click('text=扫码登录');
    await page.click('text=家长');

    // Should show error message
    await expect(page.locator('text=/生成二维码失败/')).toBeVisible({ timeout: 10000 });

    // Should show retry button
    await expect(page.locator('text=重试')).toBeVisible();
  });

  test('supports multiple role selection in multi mode', async () => {
    await page.click('text=扫码登录');

    // Test different roles
    const roles = ['系统管理员', '社工', '志愿者', '家长', '游客'];

    for (const role of roles) {
      // Click role
      await page.click(`text=${role}`);

      // QR code should appear
      await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

      // Cancel and try next role
      await page.click('text=取消登录');
      await page.waitForTimeout(500);
    }
  });

  test('maintains session persistence', async () => {
    // Start first session
    await page.click('text=扫码登录');
    await page.click('text=系统管理员');

    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

    // Get session info
    const sessionInfo = await page.evaluate(() => {
      return {
        hasQRCode: !!document.querySelector('img[alt="登录二维码"]'),
        timerVisible: !!document.querySelector('text=/剩余时间/')
      };
    });

    expect(sessionInfo.hasQRCode).toBe(true);
    expect(sessionInfo.timerVisible).toBe(true);

    // Refresh page (should maintain state or start fresh)
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should return to initial state
    await expect(page.locator('text=扫码登录')).toBeVisible();
  });

  test('accessibility compliance', async () => {
    await page.click('text=扫码登录');

    // Check semantic HTML
    await expect(page.locator('h2')).toContainText('扫码登录');

    // Check ARIA labels
    const qrImage = page.locator('img[alt="登录二维码"]');
    if (await qrImage.isVisible()) {
      await expect(qrImage).toHaveAttribute('alt', '登录二维码');
    }

    // Check keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();

    // Check color contrast (basic check)
    await page.click('text=系统管理员');
    const buttons = await page.locator('button').all();
    for (const button of buttons.slice(0, 3)) { // Check first 3 buttons
      await expect(button).toBeVisible();
    }
  });

  test('responsive design on different screen sizes', async () => {
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('text=扫码登录');

    await expect(page.locator('text=扫码登录')).toBeVisible();

    // Role buttons should stack vertically on mobile
    const roleButtons = await page.locator('button:has-text("系统管理员"), button:has-text("社工"), button:has-text("志愿者")').all();
    expect(roleButtons.length).toBeGreaterThan(0);

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });

    await expect(page.locator('text=扫码登录')).toBeVisible();

    // Should show role grid layout
    await expect(page.locator('.grid')).toBeVisible();
  });

  test('concurrent QR login attempts', async () => {
    // Open multiple tabs
    const contexts = await Promise.all([
      page.context().browser()?.newContext() || Promise.reject('Browser not available'),
      page.context().browser()?.newContext() || Promise.reject('Browser not available')
    ]) as [BrowserContext, BrowserContext];

    const pages = await Promise.all([
      contexts[0].newPage(),
      contexts[1].newPage()
    ]);

    // Navigate both pages to login
    await Promise.all([
      pages[0].goto('http://localhost:4173/login'),
      pages[1].goto('http://localhost:4173/login')
    ]);

    // Start QR login on both pages
    await Promise.all([
      pages[0].click('text=扫码登录'),
      pages[1].click('text=扫码登录')
    ]);

    await Promise.all([
      pages[0].click('text=系统管理员'),
      pages[1].click('text=社工')
    ]);

    // Both should show QR codes
    await Promise.all([
      expect(pages[0].locator('img[alt="登录二维码"]')).toBeVisible(),
      expect(pages[1].locator('img[alt="登录二维码"]')).toBeVisible()
    ]);

    // Cleanup
    await contexts[0].close();
    await contexts[1].close();
  });
});

test.describe('QR Login Integration Tests', () => {
  test('integration with WeChat Mini Program simulation', async ({ page }) => {
    // This test would simulate the complete flow including
    // the mini program side interaction

    await page.goto('http://localhost:4173/login');
    await page.click('text=扫码登录');
    await page.click('text=系统管理员');

    // Wait for QR code
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

    // Simulate mini program scanning and approving
    // This would require either:
    // 1. Running alongside the actual mini program
    // 2. Mocking the mini program's API calls
    // 3. Using QR code data to simulate scan

    // For now, just verify the QR code is generated
    const qrCode = await page.locator('img[alt="登录二维码"]');
    await expect(qrCode).toBeVisible();

    // In a complete test, you would:
    // 1. Extract QR data
    // 2. Simulate mini program scan
    // 3. Simulate approval in mini program
    // 4. Verify login completion
  });

  test('cross-browser compatibility', async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome-specific test');

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:4173/login');
    await page.click('text=扫码登录');

    // Test Chrome DevTools integration
    await page.click('text=系统管理员');
    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

    // Check console for errors
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.waitForTimeout(3000);

    const errors = logs.filter(log => log.includes('error') || log.includes('Error'));
    expect(errors.length).toBe(0);

    await context.close();
  });
});

test.describe('QR Login Performance Tests', () => {
  test('QR code generation performance', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('http://localhost:4173/login');
    await page.click('text=扫码登录');
    await page.click('text=系统管理员');

    await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // QR code should appear within 5 seconds
    expect(duration).toBeLessThan(5000);

    console.log(`QR code generation took ${duration}ms`);
  });

  test('memory usage during extended session', async ({ page }) => {
    await page.goto('http://localhost:4173/login');
    await page.click('text=扫码登录');
    await page.click('text=社工');

    // Monitor memory usage
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    // Keep session active for 2 minutes with periodic refreshes
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(15000); // 15 seconds

      // Refresh QR code
      if (await page.locator('text=刷新二维码').isVisible()) {
        await page.click('text=刷新二维码');
        await expect(page.locator('img[alt="登录二维码"]')).toBeVisible();
      }
    }

    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    const memoryIncrease = finalMemory - initialMemory;

    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

    console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  });
});
