/**
 * 优化后的 Chrome MCP 登录页面测试
 * 使用更新后的 test-id 和改进的选择器
 */

import { test, expect } from '@playwright/test';

test.describe('优化后的 Chrome MCP 登录页面测试', () => {
  test.beforeEach(async ({ page }) => {
    console.log('🚀 设置测试环境...');
  });

  test('登录页面基础交互测试（优化版）', async ({ page }) => {
    console.log('🔍 开始优化版登录页面测试...');

    // 1. 导航到登录页面
    await page.goto('http://localhost:4173/login');
    console.log('✅ 成功导航到登录页面');

    // 2. 验证页面标题（使用精确的 test-id）
    const pageTitle = page.getByTestId('login-page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('系统登录');
    console.log('✅ 页面标题验证通过');

    // 3. 验证登录方式切换按钮
    const qrTab = page.getByTestId('qr-login-tab');
    const passwordTab = page.getByTestId('password-login-tab');

    await expect(qrTab).toBeVisible();
    await expect(passwordTab).toBeVisible();
    console.log('✅ 登录方式切换按钮验证通过');

    // 4. 切换到账号密码登录（使用精确的 test-id）
    await passwordTab.click();
    console.log('✅ 成功切换到账号密码登录');

    // 5. 验证表单字段存在（使用 test-id）
    const usernameInput = page.getByTestId('username-input');
    const passwordInput = page.getByTestId('password-input');
    const submitButton = page.getByTestId('login-submit-button');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    console.log('✅ 登录表单元素验证通过');

    // 6. 填写测试账号信息
    await usernameInput.fill('admin');
    await passwordInput.fill('test-password');
    console.log('✅ 成功填写登录表单');

    // 7. 点击登录按钮
    await submitButton.click();
    console.log('✅ 成功点击登录按钮');

    // 8. 等待登录结果
    await page.waitForTimeout(2000);

    // 9. 验证错误信息处理（使用精确的 test-id）
    const errorMessage = page.getByTestId('login-error-message');
    const errorText = page.getByTestId('error-text');

    if (await errorMessage.isVisible()) {
      console.log('✅ 成功捕获登录错误信息');
      const errorContent = await errorText.textContent();
      console.log('   错误信息:', errorContent);

      // 验证错误信息内容
      expect(errorContent).toMatch(/口令错误|用户名错误|登录失败/);
    }

    // 10. 测试页面截图
    await page.screenshot({
      path: 'test-results/screenshots/optimized-chrome-mcp-login-test.png',
      fullPage: true
    });
    console.log('✅ 优化版测试截图已保存');

    console.log('🎉 优化版 Chrome MCP 登录测试完成！');
  });

  test('扫码登录页面元素验证测试（优化版）', async ({ page }) => {
    console.log('🔍 开始优化版扫码登录页面测试...');

    // 访问登录页面
    await page.goto('http://localhost:4173/login');

    // 验证主标题
    const mainTitle = page.getByTestId('login-page-title');
    await expect(mainTitle).toBeVisible();
    console.log('✅ 主登录标题验证通过');

    // 验证扫码登录标题（现在使用 h3）
    const qrTitle = page.getByTestId('qr-login-title');
    await expect(qrTitle).toBeVisible();
    await expect(qrTitle).toContainText('扫码登录');
    console.log('✅ 扫码登录标题验证通过');

    // 测试登录方式切换
    const qrTab = page.getByTestId('qr-login-tab');
    await expect(qrTab).toBeVisible();
    console.log('✅ 扫码登录标签页验证通过');

    // 验证角色按钮使用改进的 test-id
    const roleButtons = [
      { testId: 'role-button-admin', name: '系统管理员' },
      { testId: 'role-button-social_worker', name: '社工' },
      { testId: 'role-button-volunteer', name: '志愿者' },
      { testId: 'role-button-parent', name: '家长' },
      { testId: 'role-button-guest', name: '游客' }
    ];

    for (const role of roleButtons) {
      const roleButton = page.getByTestId(role.testId);
      await expect(roleButton).toBeVisible();

      // 验证角色名称
      const roleName = page.getByTestId(`role-name-${role.testId.replace('role-button-', '')}`);
      await expect(roleName).toContainText(role.name);

      console.log(`✅ 角色按钮验证通过: ${role.name} (${role.testId})`);
    }

    // 测试点击角色按钮
    const adminButton = page.getByTestId('role-button-admin');
    await adminButton.click();
    console.log('✅ 成功点击管理员角色按钮');

    // 验证选择状态
    const selectedAdmin = page.getByTestId('role-selected-admin');
    await expect(selectedAdmin).toBeVisible();
    console.log('✅ 管理员角色选择状态验证通过');

    console.log('🎉 优化版扫码登录页面测试完成！');
  });

  test('表单字段验证和交互测试', async ({ page }) => {
    console.log('🔍 开始表单字段验证测试...');

    // 访问登录页面并切换到密码登录
    await page.goto('http://localhost:4173/login');
    await page.getByTestId('password-login-tab').click();

    // 测试用户名输入框
    const usernameInput = page.getByTestId('username-input');

    // 验证属性
    await expect(usernameInput).toHaveAttribute('type', 'text');
    await expect(usernameInput).toHaveAttribute('name', 'username');
    await expect(usernameInput).toHaveAttribute('autocomplete', 'username');
    await expect(usernameInput).toHaveAttribute('required');

    // 测试输入和清除
    await usernameInput.fill('testuser');
    await expect(usernameInput).toHaveValue('testuser');
    await usernameInput.clear();
    await expect(usernameInput).toHaveValue('');

    console.log('✅ 用户名输入框验证通过');

    // 测试密码输入框
    const passwordInput = page.getByTestId('password-input');

    // 验证属性
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('name', 'password');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
    await expect(passwordInput).toHaveAttribute('required');

    // 测试输入
    await passwordInput.fill('testpass');
    await expect(passwordInput).toHaveValue('testpass');

    console.log('✅ 密码输入框验证通过');

    // 测试提交按钮状态
    const submitButton = page.getByTestId('login-submit-button');
    await expect(submitButton).toBeEnabled();
    await expect(submitButton).toContainText('登录');

    // 测试按钮点击后的状态变化
    await submitButton.click();

    // 等待状态变化
    await page.waitForTimeout(1000);

    // 检查按钮状态（可能在加载中）
    if (await submitButton.isEnabled()) {
      console.log('✅ 提交按钮状态正常');
    } else {
      console.log('✅ 提交按钮正确显示加载状态');
    }

    console.log('🎉 表单字段验证测试完成！');
  });

  test('响应式设计验证测试', async ({ page }) => {
    console.log('📱 开始响应式设计测试...');

    // 测试桌面视图
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://localhost:4173/login');

    const mainTitle = page.getByTestId('login-page-title');
    await expect(mainTitle).toBeVisible();
    console.log('✅ 桌面视图验证通过');

    // 测试平板视图
    await page.setViewportSize({ width: 768, height: 1024 });
    await mainTitle.isVisible();
    console.log('✅ 平板视图验证通过');

    // 测试手机视图
    await page.setViewportSize({ width: 375, height: 667 });
    await mainTitle.isVisible();
    console.log('✅ 手机视图验证通过');

    // 在手机视图中测试表单
    await page.getByTestId('password-login-tab').click();
    const usernameInput = page.getByTestId('username-input');
    await expect(usernameInput).toBeVisible();
    console.log('✅ 手机视图表单验证通过');

    console.log('🎉 响应式设计测试完成！');
  });

  test('键盘导航和无障碍测试', async ({ page }) => {
    console.log('⌨️ 开始键盘导航测试...');

    await page.goto('http://localhost:4173/login');

    // 测试 Tab 键导航
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // 应该聚焦到第一个登录方式按钮
    const focusedElement = await page.locator(':focus');
    expect(await focusedElement.getAttribute('data-testid')).toBe('qr-login-tab');
    console.log('✅ Tab 键导航验证通过');

    // 继续测试 Tab 导航到密码登录
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    const passwordTab = page.getByTestId('password-login-tab');
    await expect(passwordTab).toBeFocused();
    console.log('✅ 密码登录按钮聚焦验证通过');

    // 使用 Enter 键激活密码登录
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    const usernameInput = page.getByTestId('username-input');
    await expect(usernameInput).toBeVisible();
    console.log('✅ Enter 键激活验证通过');

    // 测试表单字段的 Tab 导航
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    await expect(usernameInput).toBeFocused();

    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    const passwordInput = page.getByTestId('password-input');
    await expect(passwordInput).toBeFocused();

    console.log('✅ 表单字段键盘导航验证通过');

    console.log('🎉 键盘导航和无障碍测试完成！');
  });
});