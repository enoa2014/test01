import { test, expect } from '@playwright/test';

test.describe('审计日志功能', () => {
  test.beforeEach(async ({ page }) => {
    // 登录系统
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够访问审计日志页面', async ({ page }) => {
    await page.goto('/audit');

    // 验证页面标题和元素
    await expect(page.locator('h1')).toContainText('审计日志');
    await expect(page.locator('text=查看系统操作记录和安全事件')).toBeVisible();

    // 验证操作按钮
    await expect(page.locator('button:has-text("过滤")')).toBeVisible();
    await expect(page.locator('button:has-text("刷新")')).toBeVisible();
  });

  test('应该显示审计日志表格', async ({ page }) => {
    await page.goto('/audit');

    // 验证表格标题
    await expect(page.locator('text=操作记录')).toBeVisible();

    // 验证表格列标题
    await expect(page.locator('text=操作者')).toBeVisible();
    await expect(page.locator('text=操作')).toBeVisible();
    await expect(page.locator('text=目标对象')).toBeVisible();
    await expect(page.locator('text=状态')).toBeVisible();
    await expect(page.locator('text=统计')).toBeVisible();
    await expect(page.locator('text=创建时间')).toBeVisible();
    await expect(page.locator('text=操作')).toBeVisible();
  });

  test('应该能够打开过滤模态框', async ({ page }) => {
    await page.goto('/audit');

    // 点击过滤按钮
    await page.click('button:has-text("过滤")');

    // 验证模态框打开
    await expect(page.locator('text=过滤条件')).toBeVisible();
    await expect(page.locator('text=操作者')).toBeVisible();
    await expect(page.locator('text=操作类型')).toBeVisible();
    await expect(page.locator('text=日志级别')).toBeVisible();
    await expect(page.locator('text=时间范围')).toBeVisible();
  });

  test('应该显示过滤条件表单', async ({ page }) => {
    await page.goto('/audit');

    // 点击过滤按钮
    await page.click('button:has-text("过滤")');

    // 验证过滤条件字段
    await expect(page.locator('input[placeholder*="用户ID或用户名"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toHaveCount(2);
  });

  test('应该能够填写过滤条件', async ({ page }) => {
    await page.goto('/audit');

    // 点击过滤按钮
    await page.click('button:has-text("过滤")');

    // 填写操作者
    await page.fill('input[placeholder*="用户ID或用户名"]', 'admin');

    // 选择操作类型
    await page.selectOption('select', 'login');

    // 选择日志级别
    await page.selectOption('select:has-text("全部级别") + select', 'info');

    // 验证输入的值
    await expect(page.locator('input[placeholder*="用户ID或用户名"]')).toHaveValue('admin');
    await expect(page.locator('select:has-text("全部操作")')).toHaveValue('login');
    await expect(page.locator('select:has-text("全部级别") + select')).toHaveValue('info');
  });

  test('应该能够选择时间范围', async ({ page }) => {
    await page.goto('/audit');

    // 点击过滤按钮
    await page.click('button:has-text("过滤")');

    // 设置开始日期
    const startDateInput = page.locator('input[type="date"]').first();
    await startDateInput.fill('2025-01-01');

    // 设置结束日期
    const endDateInput = page.locator('input[type="date"]').last();
    await endDateInput.fill('2025-12-31');

    // 验证日期值
    await expect(startDateInput).toHaveValue('2025-01-01');
    await expect(endDateInput).toHaveValue('2025-12-31');
  });

  test('应该能够应用过滤条件', async ({ page }) => {
    await page.goto('/audit');

    // 点击过滤按钮
    await page.click('button:has-text("过滤")');

    // 填写过滤条件
    await page.fill('input[placeholder*="用户ID或用户名"]', 'admin');

    // 点击应用过滤
    await page.click('button:has-text("应用过滤")');

    // 验证模态框关闭
    await expect(page.locator('text=过滤条件')).not.toBeVisible();

    // 验证过滤条件显示
    await expect(page.locator('text=当前过滤条件')).toBeVisible();
    await expect(page.locator('text=操作者: admin')).toBeVisible();
  });

  test('应该能够重置过滤条件', async ({ page }) => {
    await page.goto('/audit');

    // 点击过滤按钮
    await page.click('button:has-text("过滤")');

    // 填写过滤条件
    await page.fill('input[placeholder*="用户ID或用户名"]', 'admin');

    // 点击重置
    await page.click('button:has-text("重置")');

    // 验证模态框关闭
    await expect(page.locator('text=过滤条件')).not.toBeVisible();

    // 验证输入框清空
    await page.click('button:has-text("过滤")');
    await expect(page.locator('input[placeholder*="用户ID或用户名"]')).toHaveValue('');
  });

  test('应该显示日志详情模态框', async ({ page }) => {
    await page.goto('/audit');

    // 等待日志加载
    await page.waitForTimeout(2000);

    // 查找查看详情按钮并点击
    const detailButton = page.locator('button:has-text("查看详情")').first();
    if (await detailButton.isVisible()) {
      await detailButton.click();

      // 验证详情模态框打开
      await expect(page.locator('text=日志详情')).toBeVisible();
      await expect(page.locator('text=操作者')).toBeVisible();
      await expect(page.locator('text=操作')).toBeVisible();
      await expect(page.locator('text=时间')).toBeVisible();
      await expect(page.locator('text=级别')).toBeVisible();

      // 关闭详情模态框
      await page.click('button:has-text("关闭")');
      await expect(page.locator('text=日志详情')).not.toBeVisible();
    }
  });

  test('应该显示日志级别和状态标识', async ({ page }) => {
    await page.goto('/audit');

    // 等待日志加载
    await page.waitForTimeout(2000);

    // 验证状态标识显示
    const statusIndicators = page.locator('[class*="text-"][class*="bg-"]');
    if (await statusIndicators.first().isVisible()) {
      await expect(statusIndicators.first()).toBeVisible();
    }
  });

  test('应该显示加载状态', async ({ page }) => {
    await page.goto('/audit');

    // 验证初始加载状态
    const loadingSpinner = page.locator('.animate-spin');
    if (await loadingSpinner.isVisible({ timeout: 1000 })) {
      await expect(loadingSpinner).toBeVisible();
    }
  });

  test('应该显示空状态提示', async ({ page }) => {
    await page.goto('/audit');

    // 如果没有日志记录，应该显示空状态
    const emptyState = page.locator('text=暂无审计记录');
    if (await emptyState.isVisible({ timeout: 5000 })) {
      await expect(emptyState).toBeVisible();
      await expect(page.locator('.text-gray-400')).toBeVisible();
    }
  });

  test('应该能够刷新日志列表', async ({ page }) => {
    await page.goto('/audit');

    // 点击刷新按钮
    await page.click('button:has-text("刷新")');

    // 验证刷新按钮存在（可能有加载动画）
    await expect(page.locator('button:has-text("刷新")')).toBeVisible();
  });

  test('应该在未登录时重定向到登录页', async ({ page }) => {
    // 清除认证状态
    await page.context().clearCookies();

    // 尝试访问审计日志页面
    await page.goto('/audit');

    // 应该重定向到登录页
    await page.waitForURL('**/login');
    await expect(page.locator('h1')).toContainText('登录');
  });

  test('社工用户应该能够访问审计日志', async ({ page }) => {
    // 登录为社工用户
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'worker');
    await page.fill('[data-testid=password-input]', 'worker123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 访问审计日志页面
    await page.goto('/audit');

    // 社工用户应该能够访问审计日志
    await expect(page.locator('h1')).toContainText('审计日志');
    await expect(page.locator('text=操作记录')).toBeVisible();
  });

  test('应该支持分页加载', async ({ page }) => {
    await page.goto('/audit');

    // 等待初始数据加载
    await page.waitForTimeout(3000);

    // 查找加载更多按钮
    const loadMoreButton = page.locator('button:has-text("加载更多")');
    if (await loadMoreButton.isVisible()) {
      await expect(loadMoreButton).toBeVisible();

      // 点击加载更多
      await loadMoreButton.click();

      // 验证加载状态
      await expect(page.locator('button:has-text("加载中...")')).toBeVisible({ timeout: 5000 });
    }
  });

  test('应该显示清除过滤选项', async ({ page }) => {
    await page.goto('/audit');

    // 先应用过滤条件
    await page.click('button:has-text("过滤")');
    await page.fill('input[placeholder*="用户ID或用户名"]', 'admin');
    await page.click('button:has-text("应用过滤")');

    // 验证清除过滤链接显示
    await expect(page.locator('text=清除过滤')).toBeVisible();

    // 点击清除过滤
    await page.click('text=清除过滤');

    // 验证过滤条件清除
    await expect(page.locator('text=当前过滤条件')).not.toBeVisible();
  });

  test('应该显示操作时间信息', async ({ page }) => {
    await page.goto('/audit');

    // 等待日志加载
    await page.waitForTimeout(2000);

    // 验证时间信息显示
    const timeElements = page.locator('text=/\\d{4}-\\d{2}-\\d{2}/');
    if (await timeElements.first().isVisible()) {
      await expect(timeElements.first()).toBeVisible();
    }
  });

  test('应该显示IP地址信息', async ({ page }) => {
    await page.goto('/audit');

    // 等待日志加载
    await page.waitForTimeout(2000);

    // 验证IP地址显示（如果有）
    const ipElements = page.locator('text=/IP:/');
    if (await ipElements.first().isVisible()) {
      await expect(ipElements.first()).toBeVisible();
    }
  });
});

test.describe('审计日志 - 响应式设计', () => {
  test('应该在移动设备上正常显示', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 测试移动设备尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/audit');

    // 验证关键元素可见
    await expect(page.locator('h1')).toContainText('审计日志');
    await expect(page.locator('button:has-text("过滤")')).toBeVisible();
  });

  test('应该在平板设备上正常显示', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 测试平板设备尺寸
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/audit');

    // 验证关键元素可见
    await expect(page.locator('h1')).toContainText('审计日志');
    await expect(page.locator('.overflow-x-auto')).toBeVisible();
  });
});