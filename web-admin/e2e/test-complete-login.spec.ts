import { test, expect } from '@playwright/test';

test.describe('完整登录流程测试', () => {
  test('测试完整的admin登录和页面访问', async ({ page }) => {
    console.log('🔐 开始完整登录流程测试...');

    // 1. 访问首页
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    console.log('✅ 首页加载完成');

    // 2. 检查是否已登录
    const currentUrl = page.url();
    console.log('📍 当前URL:', currentUrl);

    if (currentUrl.includes('/login')) {
      console.log('🔑 需要登录，执行登录流程...');

      // 3. 切换到账号密码登录模式（默认是扫码登录）
      await page.waitForTimeout(1000); // 等待页面完全加载
      const traditionalLoginButton = await page.locator('button:has-text("账号密码")').first();
      if (await traditionalLoginButton.isVisible()) {
        await traditionalLoginButton.click();
        console.log('✅ 已切换到账号密码登录模式');
        await page.waitForTimeout(500);
      } else {
        console.log('⚠️  未找到账号密码按钮，可能已经是账号密码模式');
      }

      // 4. 填写登录信息
      await page.waitForSelector('input[name="username"], input[type="text"], input[placeholder*="用户"], input[placeholder*="账号"]', { timeout: 5000 });

      // 尝试多种可能的用户名输入框选择器
      const usernameSelectors = [
        'input[name="username"]',
        'input[type="text"]',
        'input[placeholder*="用户"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="用户名"]',
        'input#username'
      ];

      let usernameField = null;
      for (const selector of usernameSelectors) {
        try {
          usernameField = await page.locator(selector).first();
          if (await usernameField.isVisible()) {
            console.log(`✅ 找到用户名输入框: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (!usernameField) {
        console.log('❌ 未找到用户名输入框，尝试其他方法...');
        // 打印页面中所有输入框
        const allInputs = await page.locator('input').all();
        console.log(`📝 页面中共有 ${allInputs.length} 个输入框`);

        for (let i = 0; i < allInputs.length; i++) {
          const input = allInputs[i];
          const placeholder = await input.getAttribute('placeholder');
          const name = await input.getAttribute('name');
          const type = await input.getAttribute('type');
          const id = await input.getAttribute('id');
          console.log(`  输入框 ${i + 1}: placeholder="${placeholder}", name="${name}", type="${type}", id="${id}"`);
        }
      }

      // 4. 填写用户名
      if (usernameField) {
        await usernameField.fill('admin');
        console.log('✅ 用户名填写完成');
      }

      // 5. 填写密码
      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[placeholder*="密码"]',
        'input#password'
      ];

      let passwordField = null;
      for (const selector of passwordSelectors) {
        try {
          passwordField = await page.locator(selector).first();
          if (await passwordField.isVisible()) {
            console.log(`✅ 找到密码输入框: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (passwordField) {
        await passwordField.fill('123456');
        console.log('✅ 密码填写完成');
      }

      // 6. 点击登录按钮
      const buttonSelectors = [
        'button[type="submit"]',
        'button:has-text("登录")',
        'button:has-text("Login")',
        'button:has-text("登 录")',
        '.login-btn',
        '.btn-primary'
      ];

      let loginButton = null;
      for (const selector of buttonSelectors) {
        try {
          loginButton = await page.locator(selector).first();
          if (await loginButton.isVisible()) {
            console.log(`✅ 找到登录按钮: ${selector}`);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (loginButton) {
        await loginButton.click();
        console.log('✅ 点击登录按钮');
      } else {
        console.log('❌ 未找到登录按钮');
      }

      // 7. 等待登录完成
      await page.waitForTimeout(3000);

      // 8. 检查登录结果
      const afterLoginUrl = page.url();
      console.log('📍 登录后URL:', afterLoginUrl);

      if (afterLoginUrl.includes('/dashboard')) {
        console.log('✅ 登录成功，已跳转到dashboard');
      } else if (afterLoginUrl.includes('/login')) {
        console.log('❌ 登录失败，仍在登录页面');

        // 检查是否有错误信息
        const errorMessages = await page.locator('.error, .alert, [role="alert"]').all();
        if (errorMessages.length > 0) {
          for (let i = 0; i < errorMessages.length; i++) {
            const errorText = await errorMessages[i].textContent();
            console.log(`❌ 错误信息 ${i + 1}: ${errorText}`);
          }
        }
      } else {
        console.log('🤔 登录后跳转到其他页面:', afterLoginUrl);
      }

    } else {
      console.log('✅ 用户已经登录');
    }

    // 9. 测试页面访问权限
    const testPages = [
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/patients', name: '患者管理' },
      { path: '/invites', name: '邀请管理' },
      { path: '/settings', name: '系统设置' },
      { path: '/export', name: '数据导出' }
    ];

    console.log('\n🧭 测试页面访问权限...');
    const accessiblePages = [];
    const inaccessiblePages = [];

    for (const pageInfo of testPages) {
      try {
        await page.goto(`http://localhost:5173${pageInfo.path}`);
        await page.waitForTimeout(1000);

        const finalUrl = page.url();
        const pageTitle = await page.title();

        if (finalUrl.includes('/login')) {
          console.log(`🚫 ${pageInfo.name}: 被重定向到登录页面`);
          inaccessiblePages.push(pageInfo);
        } else if (finalUrl.includes('/dashboard') && pageInfo.path !== '/dashboard') {
          console.log(`🚫 ${pageInfo.name}: 被重定向到dashboard`);
          inaccessiblePages.push(pageInfo);
        } else {
          console.log(`✅ ${pageInfo.name}: 可以访问 (${pageTitle})`);
          accessiblePages.push(pageInfo);
        }

        // 检查页面是否有权限错误
        const hasPermissionError = await page.locator('body:has-text("权限不足"), body:has-text("403"), body:has-text("Forbidden")').count();
        if (hasPermissionError > 0) {
          console.log(`  ❌ 页面显示权限错误`);
          inaccessiblePages.push(pageInfo);
        }

      } catch (error) {
        console.log(`❌ ${pageInfo.name}: 访问失败 - ${error.message}`);
        inaccessiblePages.push(pageInfo);
      }
    }

    // 10. 总结测试结果
    console.log('\n📋 登录流程测试总结:');
    console.log(`✅ 可访问页面: ${accessiblePages.length} 个`);
    accessiblePages.forEach(page => console.log(`  - ${page.name}`));

    console.log(`🚫 不可访问页面: ${inaccessiblePages.length} 个`);
    inaccessiblePages.forEach(page => console.log(`  - ${page.name}`));

    if (accessiblePages.length >= 3) {
      console.log('🎉 登录和权限测试基本通过！');
    } else if (accessiblePages.length === 1) {
      console.log('⚠️  只能访问Dashboard，需要进一步检查权限配置');
    } else {
      console.log('❌ 登录或权限配置存在问题');
    }

    console.log('🔐 完整登录流程测试完成');
  });
});