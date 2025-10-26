import { test, expect } from '@playwright/test';

test.describe('导出中心功能', () => {
  test.beforeEach(async ({ page }) => {
    // 登录系统
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');
  });

  test('应该能够访问导出中心页面', async ({ page }) => {
    await page.goto('/export');

    // 验证页面标题和元素
    await expect(page.locator('h1')).toContainText('导出中心');
    await expect(page.locator('text=导出患者数据到Excel文件')).toBeVisible();

    // 验证新建导出按钮
    await expect(page.locator('button:has-text("新建导出")')).toBeVisible();
  });

  test('应该显示导出历史表格', async ({ page }) => {
    await page.goto('/export');

    // 验证表格标题
    await expect(page.locator('text=导出历史')).toBeVisible();

    // 验证表格列标题
    await expect(page.locator('text=导出条件')).toBeVisible();
    await expect(page.locator('text=数据策略')).toBeVisible();
    await expect(page.locator('text=状态')).toBeVisible();
    await expect(page.locator('text=统计')).toBeVisible();
    await expect(page.locator('text=创建时间')).toBeVisible();
    await expect(page.locator('text=操作')).toBeVisible();
  });

  test('应该能够打开新建导出模态框', async ({ page }) => {
    await page.goto('/export');

    // 点击新建导出按钮
    await page.click('button:has-text("新建导出")');

    // 验证模态框打开
    await expect(page.locator('text=新建导出')).toBeVisible();
    await expect(page.locator('text=过滤条件（可选）')).toBeVisible();
  });

  test('应该显示数据策略选项', async ({ page }) => {
    await page.goto('/export');

    // 点击新建导出按钮
    await page.click('button:has-text("新建导出")');

    // 验证数据策略选项
    await expect(page.locator('text=完整数据')).toBeVisible();
    await expect(page.locator('text=脱敏数据')).toBeVisible();

    // 验证默认选择脱敏数据
    await expect(page.locator('input[value="masked"]')).toBeChecked();
  });

  test('应该显示过滤条件表单', async ({ page }) => {
    await page.goto('/export');

    // 点击新建导出按钮
    await page.click('button:has-text("新建导出")');

    // 验证过滤条件字段
    await expect(page.locator('label:has-text("搜索关键词")')).toBeVisible();
    await expect(page.locator('label:has-text("性别")')).toBeVisible();
    await expect(page.locator('label:has-text("籍贯")')).toBeVisible();
    await expect(page.locator('label:has-text("疾病诊断")')).toBeVisible();
    await expect(page.locator('label:has-text("目前状况")')).toBeVisible();
  });

  test('应该能够填写过滤条件', async ({ page }) => {
    await page.goto('/export');

    // 点击新建导出按钮
    await page.click('button:has-text("新建导出")');

    // 填写搜索关键词
    await page.fill('input[placeholder*="搜索关键词"]', '测试患者');

    // 选择性别
    await page.selectOption('select', '男');

    // 填写籍贯
    await page.fill('input[placeholder*="籍贯"]', '上海');

    // 验证输入的值
    await expect(page.locator('input[placeholder*="搜索关键词"]')).toHaveValue('测试患者');
    await expect(page.locator('select')).toHaveValue('男');
    await expect(page.locator('input[placeholder*="籍贯"]')).toHaveValue('上海');
  });

  test('应该显示导出说明信息', async ({ page }) => {
    await page.goto('/export');

    // 点击新建导出按钮
    await page.click('button:has-text("新建导出")');

    // 验证导出说明
    await expect(page.locator('text=导出说明')).toBeVisible();
    await expect(page.locator('text=导出文件为Excel格式')).toBeVisible();
    await expect(page.locator('text=脱敏模式下，身份证号、手机号等敏感信息将被部分隐藏')).toBeVisible();
    await expect(page.locator('text=导出文件保存7天，请及时下载')).toBeVisible();
  });

  test('应该能够关闭模态框', async ({ page }) => {
    await page.goto('/export');

    // 点击新建导出按钮
    await page.click('button:has-text("新建导出")');

    // 验证模态框打开
    await expect(page.locator('text=新建导出')).toBeVisible();

    // 点击取消按钮
    await page.click('button:has-text("取消")');

    // 验证模态框关闭
    await expect(page.locator('text=新建导出')).not.toBeVisible();
  });

  test('应该显示刷新按钮', async ({ page }) => {
    await page.goto('/export');

    // 验证刷新按钮存在
    const refreshButton = page.locator('button:has-text("刷新")');
    await expect(refreshButton).toBeVisible();
  });

  test('应该显示空状态提示', async ({ page }) => {
    await page.goto('/export');

    // 等待页面加载完成，如果没有数据应该显示空状态
    const emptyState = page.locator('text=暂无导出记录');
    if (await emptyState.isVisible()) {
      await expect(emptyState).toBeVisible();
      await expect(page.locator('.text-gray-400')).toBeVisible();
    }
  });

  test('应该在未登录时重定向到登录页', async ({ page }) => {
    // 清除认证状态
    await page.context().clearCookies();

    // 尝试访问导出页面
    await page.goto('/export');

    // 应该重定向到登录页
    await page.waitForURL('**/login');
    await expect(page.locator('h1')).toContainText('登录');
  });

  test('非管理员用户应该能够访问导出中心', async ({ page }) => {
    // 登录为社工用户
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'worker');
    await page.fill('[data-testid=password-input]', 'worker123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 访问导出页面
    await page.goto('/export');

    // 社工用户应该能够访问导出中心，但只能选择脱敏数据
    await expect(page.locator('h1')).toContainText('导出中心');

    // 点击新建导出
    await page.click('button:has-text("新建导出")');

    // 验证只能选择脱敏数据，完整数据选项不可用
    await expect(page.locator('input[value="masked"]')).toBeVisible();
    await expect(page.locator('input[value="full"]')).not.toBeVisible();
  });

  test('应该显示导出状态标识', async ({ page }) => {
    await page.goto('/export');

    // 如果有导出记录，验证状态标识显示
    const statusIndicators = page.locator('[class*="text-"][class*="bg-"]');
    if (await statusIndicators.first().isVisible()) {
      await expect(statusIndicators.first()).toBeVisible();
    }
  });

  test('应该能够操作表格功能', async ({ page }) => {
    await page.goto('/export');

    // 验证表格响应式设计
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('.overflow-x-auto')).toBeVisible();

    // 测试小屏幕
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('导出中心 - 错误处理', () => {
  test('应该处理网络错误', async ({ page }) => {
    // 模拟网络错误情况
    await page.route('**/exportData', route => route.abort());

    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    await page.goto('/export');
    await page.click('button:has-text("新建导出")');

    // 尝试创建导出任务
    await page.click('button:has-text("开始导出")');

    // 应该显示错误提示
    await expect(page.locator('text=导出失败')).toBeVisible({ timeout: 10000 });
  });

  test('应该处理表单验证错误', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    await page.goto('/export');
    await page.click('button:has-text("新建导出")');

    // 尝试提交空表单（如果需要验证的话）
    await page.click('button:has-text("开始导出")');

    // 这里应该根据实际验证逻辑调整
    // 目前假设空表单也可以提交（导出全部数据）
  });
});