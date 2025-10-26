import { test, expect } from '@playwright/test';

test.describe('登录权限调试测试', () => {
  test('调试 admin 登录后权限问题', async ({ page }) => {
    console.log('🔍 开始调试登录权限问题...');

    // 1. 访问首页
    await page.goto('http://localhost:5173');
    console.log('✅ 页面加载完成');

    // 2. 检查控制台错误
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('❌ 控制台错误:', msg.text());
      }
    });

    // 3. 检查网络请求
    const responses = [];
    page.on('response', (response) => {
      responses.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method()
      });

      if (response.url().includes('/api/func/')) {
        console.log(`🌐 API请求: ${response.request().method()} ${response.url()} - ${response.status()}`);
      }
    });

    // 4. 等待登录表单加载
    await page.waitForSelector('form', { timeout: 5000 });
    console.log('✅ 登录表单加载完成');

    // 5. 填写登录信息
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', '123456');
    console.log('✅ 登录信息填写完成');

    // 6. 点击登录按钮
    await page.click('button[type="submit"]');
    console.log('✅ 点击登录按钮');

    // 7. 等待登录完成
    await page.waitForTimeout(2000);

    // 8. 检查登录状态
    const currentUrl = page.url();
    console.log('📍 当前URL:', currentUrl);

    // 9. 检查用户信息和权限
    const userInfo = await page.evaluate(() => {
      // 检查 localStorage 中的用户信息
      const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      let user = null;
      try {
        user = userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        console.error('解析用户信息失败:', e);
      }

      // 检查权限相关的全局变量
      const userRole = window.userRole;
      const permissions = window.permissions;
      const isAdmin = window.isAdmin;

      return {
        user,
        userRole,
        permissions,
        isAdmin,
        localStorageKeys: Object.keys(localStorage),
        sessionStorageKeys: Object.keys(sessionStorage)
      };
    });

    console.log('👤 用户信息:', JSON.stringify(userInfo, null, 2));

    // 10. 检查导航菜单项
    const navigationItems = await page.locator('nav a, .nav-link, [role="menuitem"]').all();
    console.log('🧭 导航菜单项数量:', navigationItems.length);

    for (let i = 0; i < navigationItems.length; i++) {
      const item = navigationItems[i];
      const text = await item.textContent();
      const href = await item.getAttribute('href');
      const isVisible = await item.isVisible();
      const isEnabled = await item.isEnabled();

      console.log(`  ${i + 1}. "${text}" - href: ${href} - 可见: ${isVisible} - 可用: ${isEnabled}`);
    }

    // 11. 尝试访问其他页面
    const testPages = [
      '/patients',
      '/invites',
      '/settings',
      '/export',
      '/audit'
    ];

    for (const testPage of testPages) {
      try {
        await page.goto(`http://localhost:5173${testPage}`);
        await page.waitForTimeout(1000);

        const pageUrl = page.url();
        const pageTitle = await page.title();

        // 检查是否被重定向到登录页或其他页面
        if (pageUrl.includes('/login')) {
          console.log(`🚫 ${testPage}: 被重定向到登录页面`);
        } else if (pageUrl.includes('/dashboard')) {
          console.log(`🚫 ${testPage}: 被重定向到dashboard`);
        } else {
          console.log(`✅ ${testPage}: 可以访问 (${pageTitle})`);
        }

        // 检查页面内容
        const hasContent = await page.locator('body').textContent();
        const hasError = hasContent?.includes('403') || hasContent?.includes('无权限') || hasContent?.includes('Forbidden');

        if (hasError) {
          console.log(`  ❌ 页面显示权限错误: ${hasContent.substring(0, 100)}...`);
        }

      } catch (error) {
        console.log(`❌ ${testPage}: 访问失败 - ${error.message}`);
      }
    }

    // 12. 分析网络请求
    console.log('\n📊 网络请求分析:');
    const apiRequests = responses.filter(r => r.url.includes('/api/func/'));
    console.log(`总共发起了 ${apiRequests.length} 个API请求`);

    for (const req of apiRequests) {
      console.log(`  ${req.method} ${req.url} - ${req.status}`);
    }

    // 13. 等待一段时间观察控制台输出
    console.log('\n⏳ 等待 5 秒观察控制台输出...');
    await page.waitForTimeout(5000);

    console.log('🔍 调试完成');
  });
});