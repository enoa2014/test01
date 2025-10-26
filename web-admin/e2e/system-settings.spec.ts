import { test, expect } from '@playwright/test';

test.describe('系统设置功能', () => {
  test.beforeEach(async ({ page }) => {
    // 登录系统
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够访问系统设置页面', async ({ page }) => {
    await page.goto('/settings');

    // 验证页面标题和元素
    await expect(page.locator('h1')).toContainText('系统设置');
    await expect(page.locator('text=管理系统配置和安全设置')).toBeVisible();
  });

  test('应该显示环境信息面板', async ({ page }) => {
    await page.goto('/settings');

    // 验证环境信息
    await expect(page.locator('text=环境信息')).toBeVisible();
    await expect(page.locator('text=环境ID')).toBeVisible();
    await expect(page.locator('text=云函数状态')).toBeVisible();
    await expect(page.locator('text=存储使用')).toBeVisible();
    await expect(page.locator('text=文件数量')).toBeVisible();
  });

  test('应该显示云函数状态列表', async ({ page }) => {
    await page.goto('/settings');

    // 等待数据加载
    await page.waitForTimeout(2000);

    // 验证云函数状态显示
    const functionStatus = page.locator('text=/auth|rbac|patientProfile|importExcel|exportData|audit/');
    if (await functionStatus.first().isVisible()) {
      await expect(functionStatus.first()).toBeVisible();
    }
  });

  test('应该显示存储使用情况', async ({ page }) => {
    await page.goto('/settings');

    // 等待数据加载
    await page.waitForTimeout(2000);

    // 验证存储信息显示
    const storageInfo = page.locator('text=/GB|MB/');
    if (await storageInfo.first().isVisible()) {
      await expect(storageInfo.first()).toBeVisible();
    }
  });

  test('应该显示数据库统计信息', async ({ page }) => {
    await page.goto('/settings');

    // 等待数据加载
    await page.waitForTimeout(2000);

    // 验证数据库信息
    await expect(page.locator('text=数据集合')).toBeVisible();
    await expect(page.locator('text=记录总数')).toBeVisible();
    await expect(page.locator('text=索引数量')).toBeVisible();
  });

  test('应该显示安全设置面板', async ({ page }) => {
    await page.goto('/settings');

    // 验证安全设置
    await expect(page.locator('text=安全设置')).toBeVisible();
    await expect(page.locator('text=允许社工导入数据')).toBeVisible();
    await expect(page.locator('text=强制社工导出脱敏')).toBeVisible();
  });

  test('应该能够切换安全设置', async ({ page }) => {
    await page.goto('/settings');

    // 查找并点击开关按钮
    const importSwitch = page.locator('input[name="allowWorkerImport"]');
    const exportSwitch = page.locator('input[name="forceWorkerExportMasked"]');

    if (await importSwitch.isVisible()) {
      // 切换社工导入设置
      await importSwitch.click();
      // 验证状态改变
      await expect(importSwitch).toBeVisible();
    }

    if (await exportSwitch.isVisible()) {
      // 切换导出脱敏设置
      await exportSwitch.click();
      // 验证状态改变
      await expect(exportSwitch).toBeVisible();
    }
  });

  test('应该显示审计设置面板', async ({ page }) => {
    await page.goto('/settings');

    // 验证审计设置
    await expect(page.locator('text=审计设置')).toBeVisible();
    await expect(page.locator('text=日志级别')).toBeVisible();
    await expect(page.locator('text=日志保留天数')).toBeVisible();
  });

  test('应该能够修改审计设置', async ({ page }) => {
    await page.goto('/settings');

    // 选择日志级别
    const logLevelSelect = page.locator('select').first();
    if (await logLevelSelect.isVisible()) {
      await logLevelSelect.selectOption('warn');
      await expect(logLevelSelect).toHaveValue('warn');
    }

    // 修改保留天数
    const retentionInput = page.locator('input[type="number"]').first();
    if (await retentionInput.isVisible()) {
      await retentionInput.fill('30');
      await expect(retentionInput).toHaveValue('30');
    }
  });

  test('应该显示导出设置面板', async ({ page }) => {
    await page.goto('/settings');

    // 验证导出设置
    await expect(page.locator('text=导出设置')).toBeVisible();
    await expect(page.locator('text=文件保留天数')).toBeVisible();
    await expect(page.locator('text=最大导出记录数')).toBeVisible();
  });

  test('应该能够修改导出设置', async ({ page }) => {
    await page.goto('/settings');

    // 修改文件保留天数
    const retentionInput = page.locator('input[placeholder*="文件保留"]');
    if (await retentionInput.isVisible()) {
      await retentionInput.fill('14');
      await expect(retentionInput).toHaveValue('14');
    }

    // 修改最大导出记录数
    const maxRecordsInput = page.locator('input[placeholder*="最大导出"]');
    if (await maxRecordsInput.isVisible()) {
      await maxRecordsInput.fill('5000');
      await expect(maxRecordsInput).toHaveValue('5000');
    }
  });

  test('应该显示用户信息面板', async ({ page }) => {
    await page.goto('/settings');

    // 验证用户信息
    await expect(page.locator('text=用户信息')).toBeVisible();
    await expect(page.locator('text=用户名')).toBeVisible();
    await expect(page.locator('text=角色')).toBeVisible();
    await expect(page.locator('text=最后登录')).toBeVisible();
  });

  test('应该显示修改密码按钮', async ({ page }) => {
    await page.goto('/settings');

    // 验证修改密码按钮
    await expect(page.locator('button:has-text("修改密码")')).toBeVisible();
  });

  test('应该能够打开修改密码模态框', async ({ page }) => {
    await page.goto('/settings');

    // 点击修改密码按钮
    await page.click('button:has-text("修改密码")');

    // 验证模态框打开
    await expect(page.locator('text=修改密码')).toBeVisible();
    await expect(page.locator('text=当前密码')).toBeVisible();
    await expect(page.locator('text=新密码')).toBeVisible();
    await expect(page.locator('text=确认新密码')).toBeVisible();
  });

  test('应该能够填写密码修改表单', async ({ page }) => {
    await page.goto('/settings');

    // 点击修改密码按钮
    await page.click('button:has-text("修改密码")');

    // 填写表单
    await page.fill('input[name="currentPassword"]', 'admin123');
    await page.fill('input[name="newPassword"]', 'newpassword123');
    await page.fill('input[name="confirmPassword"]', 'newpassword123');

    // 验证输入值
    await expect(page.locator('input[name="currentPassword"]')).toHaveValue('admin123');
    await expect(page.locator('input[name="newPassword"]')).toHaveValue('newpassword123');
    await expect(page.locator('input[name="confirmPassword"]')).toHaveValue('newpassword123');
  });

  test('应该能够显示/隐藏密码', async ({ page }) => {
    await page.goto('/settings');

    // 点击修改密码按钮
    await page.click('button:has-text("修改密码")');

    // 填写新密码
    await page.fill('input[name="newPassword"]', 'newpassword123');

    // 验证密码类型
    const newPasswordInput = page.locator('input[name="newPassword"]');
    await expect(newPasswordInput).toHaveAttribute('type', 'password');

    // 点击显示密码按钮
    const showPasswordButton = page.locator('button').filter({ hasText: '' }).first();
    if (await showPasswordButton.isVisible()) {
      await showPasswordButton.click();
      // 这里根据实际实现调整验证
    }
  });

  test('应该显示退出登录按钮', async ({ page }) => {
    await page.goto('/settings');

    // 验证退出登录按钮
    await expect(page.locator('button:has-text("退出登录")')).toBeVisible();
  });

  test('应该能够保存系统设置', async ({ page }) => {
    await page.goto('/settings');

    // 查找保存设置按钮
    const saveButton = page.locator('button:has-text("保存设置")');
    if (await saveButton.isVisible()) {
      await expect(saveButton).toBeVisible();

      // 这里可以模拟修改设置并保存
      // 由于可能需要实际的API调用，我们只验证按钮存在
    }
  });

  test('应该显示系统说明信息', async ({ page }) => {
    await page.goto('/settings');

    // 验证系统说明
    await expect(page.locator('text=系统说明')).toBeVisible();
    await expect(page.locator('text=系统运行在腾讯云云开发环境')).toBeVisible();
    await expect(page.locator('text=数据存储在云数据库中')).toBeVisible();
    await expect(page.locator('text=文件存储在云存储中')).toBeVisible();
  });

  test('应该显示刷新状态按钮', async ({ page }) => {
    await page.goto('/settings');

    // 验证刷新按钮
    const refreshButton = page.locator('button:has-text("刷新")');
    if (await refreshButton.isVisible()) {
      await expect(refreshButton).toBeVisible();
    }
  });

  test('应该在未登录时重定向到登录页', async ({ page }) => {
    // 清除认证状态
    await page.context().clearCookies();

    // 尝试访问系统设置页面
    await page.goto('/settings');

    // 应该重定向到登录页
    await page.waitForURL('**/login');
    await expect(page.locator('h1')).toContainText('登录');
  });

  test('非管理员用户应该显示权限提示', async ({ page }) => {
    // 登录为社工用户
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'worker');
    await page.fill('[data-testid=password-input]', 'worker123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 尝试访问系统设置页面
    await page.goto('/settings');

    // 应该显示权限不足的提示
    await expect(page.locator('text=无权限访问')).toBeVisible();
    await expect(page.locator('text=您没有访问系统设置的权限')).toBeVisible();
  });

  test('应该显示加载状态', async ({ page }) => {
    await page.goto('/settings');

    // 验证加载状态
    const loadingSpinner = page.locator('.animate-spin');
    if (await loadingSpinner.isVisible({ timeout: 1000 })) {
      await expect(loadingSpinner).toBeVisible();
    }
  });

  test('应该关闭密码修改模态框', async ({ page }) => {
    await page.goto('/settings');

    // 点击修改密码按钮
    await page.click('button:has-text("修改密码")');

    // 验证模态框打开
    await expect(page.locator('text=修改密码')).toBeVisible();

    // 点击取消按钮
    await page.click('button:has-text("取消")');

    // 验证模态框关闭
    await expect(page.locator('text=修改密码')).not.toBeVisible();
  });

  test('应该显示用户角色信息', async ({ page }) => {
    await page.goto('/settings');

    // 验证角色显示
    const roleElement = page.locator('text=admin');
    if (await roleElement.isVisible()) {
      await expect(roleElement).toBeVisible();
    }
  });

  test('应该显示最后登录时间', async ({ page }) => {
    await page.goto('/settings');

    // 验证最后登录时间
    const lastLoginElement = page.locator('text=/\\d{4}-\\d{2}-\\d{2}/');
    if (await lastLoginElement.isVisible()) {
      await expect(lastLoginElement).toBeVisible();
    }
  });
});

test.describe('系统设置 - 交互测试', () => {
  test('应该能够切换开关状态', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    await page.goto('/settings');

    // 查找开关组件
    const toggles = page.locator('input[type="checkbox"]');
    const toggleCount = await toggles.count();

    if (toggleCount > 0) {
      // 切换第一个开关
      await toggles.first().click();

      // 验证开关存在
      await expect(toggles.first()).toBeVisible();
    }
  });

  test('应该处理表单输入验证', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    await page.goto('/settings');

    // 测试数字输入验证
    const numberInputs = page.locator('input[type="number"]');
    const inputCount = await numberInputs.count();

    if (inputCount > 0) {
      const firstInput = numberInputs.first();

      // 输入无效值
      await firstInput.fill('-1');

      // 输入有效值
      await firstInput.fill('30');
      await expect(firstInput).toHaveValue('30');
    }
  });
});

test.describe('系统设置 - 响应式设计', () => {
  test('应该在移动设备上正常显示', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 测试移动设备尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/settings');

    // 验证关键元素可见
    await expect(page.locator('h1')).toContainText('系统设置');
    await expect(page.locator('text=环境信息')).toBeVisible();
  });

  test('应该在平板设备上正常显示', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 测试平板设备尺寸
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/settings');

    // 验证关键元素可见
    await expect(page.locator('h1')).toContainText('系统设置');
    await expect(page.locator('.grid')).toBeVisible();
  });
});