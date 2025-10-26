import { test, expect } from '@playwright/test';

test.describe('管理后台空白页面诊断', () => {
  test('诊断管理后台页面显示问题', async ({ page }) => {
    console.log('🔍 开始诊断管理后台空白页面...');

    // 1. 访问首页
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log('📍 当前URL:', currentUrl);

    // 2. 检查页面基本元素
    const title = await page.title();
    console.log('📄 页面标题:', title);

    // 3. 检查页面内容
    const bodyContent = await page.locator('body').textContent();
    console.log('📝 页面内容长度:', bodyContent?.length);

    // 4. 检查是否有React错误边界
    const reactErrorBoundary = await page.locator('[data-testid="error-boundary"], .error-boundary').count();
    if (reactErrorBoundary > 0) {
      console.log('❌ 检测到React错误边界');
      const errorText = await page.locator('[data-testid="error-boundary"], .error-boundary').first().textContent();
      console.log('错误信息:', errorText);
    }

    // 5. 检查控制台错误
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        console.log('❌ 控制台错误:', msg.text());
      }
    });

    // 6. 检查是否有CSS加载问题
    const cssLinks = await page.locator('link[rel="stylesheet"]').count();
    console.log('🎨 CSS链接数量:', cssLinks);

    // 7. 检查是否有JavaScript错误
    const scriptTags = await page.locator('script').count();
    console.log('📜 Script标签数量:', scriptTags);

    // 8. 检查DOM结构
    const mainElement = await page.locator('main, #root, #app, .app').count();
    console.log('🏗️  主要容器元素数量:', mainElement);

    // 9. 检查是否有加载状态
    const loadingElements = await page.locator('.loading, .spinner, [class*="loading"]').count();
    console.log('⏳ 加载元素数量:', loadingElements);

    // 10. 检查登录状态
    if (currentUrl.includes('/login')) {
      console.log('🔑 页面在登录界面');

      // 检查登录表单是否可见
      const loginForm = await page.locator('form').count();
      console.log('📝 登录表单数量:', loginForm);

      // 切换到账号密码登录
      const traditionalButton = await page.locator('button:has-text("账号密码")').first();
      if (await traditionalButton.isVisible()) {
        await traditionalButton.click();
        await page.waitForTimeout(500);
        console.log('✅ 已切换到账号密码登录模式');
      }

      // 检查输入框
      const inputs = await page.locator('input').count();
      console.log('📝 输入框数量:', inputs);

      // 填写登录信息
      const usernameInput = await page.locator('input[name="username"]').first();
      const passwordInput = await page.locator('input[name="password"]').first();

      if (await usernameInput.isVisible() && await passwordInput.isVisible()) {
        await usernameInput.fill('admin');
        await passwordInput.fill('123456');
        console.log('✅ 登录信息填写完成');

        const submitButton = await page.locator('button[type="submit"]').first();
        await submitButton.click();
        console.log('✅ 点击登录按钮');

        // 等待登录完成
        await page.waitForTimeout(3000);

        const afterLoginUrl = page.url();
        console.log('📍 登录后URL:', afterLoginUrl);
      }
    }

    // 11. 最终页面检查
    const finalContent = await page.locator('body').textContent();
    console.log('📝 最终页面内容长度:', finalContent?.length);

    // 12. 检查是否有可见内容
    const visibleElements = await page.locator('*:visible').count();
    console.log('👁️  可见元素数量:', visibleElements);

    // 13. 截图保存
    await page.screenshot({ path: 'debug-blank-page.png', fullPage: true });
    console.log('📸 截图已保存到 debug-blank-page.png');

    // 14. 诊断总结
    console.log('\n📋 诊断总结:');
    console.log('- 页面URL:', currentUrl);
    console.log('- 页面标题:', title);
    console.log('- 内容长度:', finalContent?.length || 0);
    console.log('- 可见元素数量:', visibleElements);
    console.log('- 控制台错误数量:', consoleErrors.length);
    console.log('- CSS链接数量:', cssLinks);
    console.log('- Script标签数量:', scriptTags);

    if ((finalContent?.length || 0) === 0) {
      console.log('❌ 页面完全空白');
    } else if (visibleElements === 0) {
      console.log('❌ 页面有内容但不可见');
    } else {
      console.log('✅ 页面有可见内容');
    }

    if (consoleErrors.length > 0) {
      console.log('❌ 检测到控制台错误，可能导致页面渲染失败');
    }

    console.log('🔍 空白页面诊断完成');
  });
});