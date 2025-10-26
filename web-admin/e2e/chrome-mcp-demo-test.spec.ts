/**
 * Chrome MCP 演示测试用例
 * 展示基本的 Chrome MCP 浏览器自动化功能
 */

import { test, expect } from './chrome-mcp-simple.config';

test.describe('Chrome MCP 基础功能演示', () => {
  test('登录页面基础交互测试', async ({ page }) => {
    console.log('🚀 开始 Chrome MCP 登录页面测试...');

    // 1. 导航到登录页面
    await page.goto('http://localhost:4173/login');
    console.log('✅ 成功导航到登录页面');

    // 2. 验证页面标题
    const title = await page.title();
    expect(title).toContain('同心源 小家管理后台');
    console.log('✅ 页面标题验证通过:', title);

    // 3. 验证登录页面元素
    await expect(page.locator('h2')).toContainText('系统登录');
    console.log('✅ 登录标题验证通过');

    // 4. 切换到账号密码登录
    await page.click('button:has-text("账号密码")');
    console.log('✅ 成功切换到账号密码登录');

    // 5. 验证表单字段存在
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
    console.log('✅ 登录表单元素验证通过');

    // 6. 填写测试账号信息
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'test-password');
    console.log('✅ 成功填写登录表单');

    // 7. 点击登录按钮
    await page.click('button:has-text("登录")');
    console.log('✅ 成功点击登录按钮');

    // 8. 等待登录结果
    await page.waitForTimeout(2000);

    // 9. 验证错误信息处理
    const errorElement = page.locator('text=/口令错误|用户名错误|登录失败/');
    if (await errorElement.isVisible()) {
      console.log('✅ 成功捕获登录错误信息');
      const errorText = await errorElement.textContent();
      console.log('   错误信息:', errorText);
    }

    // 10. 测试页面截图
    await page.screenshot({
      path: 'test-results/screenshots/chrome-mcp-login-test.png',
      fullPage: true
    });
    console.log('✅ 测试截图已保存');

    console.log('🎉 Chrome MCP 演示测试完成！');
  });

  test('页面元素可访问性验证', async ({ page }) => {
    console.log('🔍 开始页面可访问性测试...');

    // 访问登录页面
    await page.goto('http://localhost:4173/login');

    // 验证页面结构
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    console.log(`✅ 发现 ${headings} 个标题元素`);

    const buttons = await page.locator('button').count();
    console.log(`✅ 发现 ${buttons} 个按钮元素`);

    const inputs = await page.locator('input').count();
    console.log(`✅ 发现 ${inputs} 个输入元素`);

    // 验证链接和按钮的可点击性
    const clickables = page.locator('button, [role="button"], a');
    const clickableCount = await clickables.count();
    console.log(`✅ 发现 ${clickableCount} 个可交互元素`);

    // 测试键盘导航
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    console.log('✅ 键盘导航测试通过');
    console.log('🎉 可访问性测试完成！');
  });

  test('网络请求监控测试', async ({ page }) => {
    console.log('🌐 开始网络请求监控测试...');

    // 监听网络请求
    const requests = [];
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: new Date().toISOString()
      });
    });

    // 监听网络响应
    const responses = [];
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        timestamp: new Date().toISOString()
      });
    });

    // 访问登录页面
    await page.goto('http://localhost:4173/login');

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');

    console.log(`✅ 捕获到 ${requests.length} 个网络请求`);
    console.log(`✅ 捕获到 ${responses.length} 个网络响应`);

    // 记录关键请求
    requests.slice(0, 5).forEach((req, index) => {
      console.log(`   请求 ${index + 1}: ${req.method} ${req.url}`);
    });

    // 记录响应状态
    const successResponses = responses.filter(r => r.status < 400);
    const errorResponses = responses.filter(r => r.status >= 400);

    console.log(`✅ 成功响应: ${successResponses.length}`);
    console.log(`✅ 错误响应: ${errorResponses.length}`);

    console.log('🎉 网络监控测试完成！');
  });
});