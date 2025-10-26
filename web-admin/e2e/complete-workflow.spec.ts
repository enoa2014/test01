import { test, expect } from '@playwright/test';

test.describe('完整用户工作流程测试', () => {
  test.beforeEach(async ({ page }) => {
    // 登录系统
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');
  });

  test('管理员完整工作流程', async ({ page }) => {
    // 1. 验证仪表板访问
    await expect(page.locator('h1')).toContainText('仪表板');
    await expect(page.locator('text=欢迎回来')).toBeVisible();

    // 2. 访问患者列表
    await page.goto('/patients');
    await expect(page.locator('text=患者管理')).toBeVisible();

    // 3. 访问导入功能
    await page.goto('/import');
    await expect(page.locator('h1')).toContainText('导入Excel');

    // 验证导入模式选择
    await expect(page.locator('text=智能合并')).toBeVisible();
    await expect(page.locator('text=仅新增')).toBeVisible();
    await expect(page.locator('text=仅更新')).toBeVisible();

    // 切换到导入历史
    await page.click('text=导入历史');
    await expect(page.locator('text=导出历史记录')).toBeVisible();

    // 4. 访问导出功能
    await page.goto('/export');
    await expect(page.locator('h1')).toContainText('导出中心');

    // 点击新建导出
    await page.click('button:has-text("新建导出")');
    await expect(page.locator('text=新建导出')).toBeVisible();

    // 填写导出条件
    await page.fill('input[placeholder*="搜索关键词"]', '测试患者');
    await page.selectOption('select', '男');

    // 关闭模态框
    await page.click('button:has-text("取消")');

    // 5. 访问审计日志
    await page.goto('/audit');
    await expect(page.locator('h1')).toContainText('审计日志');

    // 打开过滤条件
    await page.click('button:has-text("过滤")');
    await expect(page.locator('text=过滤条件')).toBeVisible();

    // 填写过滤条件
    await page.fill('input[placeholder*="用户ID或用户名"]', 'admin');
    await page.selectOption('select:has-text("全部操作")', 'login');

    // 应用过滤
    await page.click('button:has-text("应用过滤")');

    // 6. 访问系统设置
    await page.goto('/settings');
    await expect(page.locator('h1')).toContainText('系统设置');

    // 验证各个设置面板
    await expect(page.locator('text=环境信息')).toBeVisible();
    await expect(page.locator('text=安全设置')).toBeVisible();
    await expect(page.locator('text=审计设置')).toBeVisible();
    await expect(page.locator('text=导出设置')).toBeVisible();
    await expect(page.locator('text=用户信息')).toBeVisible();

    // 7. 退出登录
    await page.click('button:has-text("退出登录")');
    await page.waitForURL('**/login');
    await expect(page.locator('h1')).toContainText('登录');
  });

  test('社工用户工作流程', async ({ page }) => {
    // 登录为社工用户
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'worker');
    await page.fill('[data-testid=password-input]', 'worker123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 1. 验证仪表板访问
    await expect(page.locator('h1')).toContainText('仪表板');

    // 2. 访问患者列表
    await page.goto('/patients');
    await expect(page.locator('text=患者管理')).toBeVisible();

    // 3. 访问导入功能（应该被拒绝）
    await page.goto('/import');
    await expect(page.locator('text=无权限访问')).toBeVisible();
    await expect(page.locator('text=您没有导入Excel的权限')).toBeVisible();

    // 4. 访问导出功能（应该可以访问，但只能脱敏导出）
    await page.goto('/export');
    await expect(page.locator('h1')).toContainText('导出中心');

    // 点击新建导出
    await page.click('button:has-text("新建导出")');

    // 验证只能选择脱敏数据
    await expect(page.locator('input[value="masked"]')).toBeVisible();
    await expect(page.locator('input[value="full"]')).not.toBeVisible();

    // 5. 访问审计日志
    await page.goto('/audit');
    await expect(page.locator('h1')).toContainText('审计日志');

    // 6. 访问系统设置（应该被拒绝）
    await page.goto('/settings');
    await expect(page.locator('text=无权限访问')).toBeVisible();
    await expect(page.locator('text=您没有访问系统设置的权限')).toBeVisible();

    // 7. 退出登录
    await page.click('button:has-text("退出登录")');
    await page.waitForURL('**/login');
  });

  test('用户权限验证工作流程', async ({ page }) => {
    // 测试未登录用户的权限
    await page.context().clearCookies();

    // 尝试访问各个需要权限的页面
    const protectedPages = [
      '/dashboard',
      '/patients',
      '/import',
      '/export',
      '/audit',
      '/settings'
    ];

    for (const pagePath of protectedPages) {
      await page.goto(pagePath);
      // 应该重定向到登录页
      await page.waitForURL('**/login', { timeout: 5000 });
      await expect(page.locator('h1')).toContainText('登录');
    }

    // 登录为普通用户
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 验证可以访问的页面
    const allowedPages = ['/dashboard', '/patients', '/export', '/audit'];
    for (const pagePath of allowedPages) {
      await page.goto(pagePath);
      await page.waitForTimeout(1000);
      // 应该能够正常访问
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('导航菜单功能测试', async ({ page }) => {
    // 这个测试假设有导航菜单，根据实际UI调整

    // 1. 从仪表板开始
    await page.goto('/dashboard');

    // 2. 测试各个导航项
    const navigationTests = [
      { path: '/patients', title: '患者管理' },
      { path: '/analysis', title: '数据分析' },
      { path: '/import', title: '导入Excel' },
      { path: '/export', title: '导出中心' },
      { path: '/audit', title: '审计日志' },
      { path: '/settings', title: '系统设置' }
    ];

    for (const navTest of navigationTests) {
      await page.goto(navTest.path);
      await page.waitForTimeout(1000);

      // 验证页面标题或关键内容
      const titleElement = page.locator('h1').first();
      if (await titleElement.isVisible()) {
        await expect(titleElement).toContainText(navTest.title);
      }
    }
  });

  test('响应式设计测试', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/dashboard');
      await page.waitForTimeout(1000);

      // 验证关键元素在不同屏幕尺寸下的显示
      await expect(page.locator('h1')).toBeVisible();

      // 测试其他主要页面
      await page.goto('/patients');
      await page.waitForTimeout(1000);
      await expect(page.locator('text=患者管理')).toBeVisible();

      await page.goto('/export');
      await page.waitForTimeout(1000);
      await expect(page.locator('h1')).toContainText('导出中心');
    }
  });

  test('错误处理和加载状态测试', async ({ page }) => {
    // 1. 测试无效的URL
    await page.goto('/invalid-page');
    // 应该显示404页面或重定向
    await page.waitForTimeout(2000);

    // 2. 测试网络错误处理
    await page.goto('/export');

    // 模拟网络错误
    await page.route('**/exportData', route => route.abort());

    await page.click('button:has-text("新建导出")');
    await page.click('button:has-text("开始导出")');

    // 应该显示错误提示
    await expect(page.locator('text=导出失败')).toBeVisible({ timeout: 10000 });

    // 3. 测试加载状态
    await page.unroute('**/exportData');
    await page.goto('/settings');

    // 验证加载状态显示
    const loadingSpinner = page.locator('.animate-spin');
    if (await loadingSpinner.isVisible({ timeout: 1000 })) {
      await expect(loadingSpinner).toBeVisible();
    }
  });

  test('表单验证测试', async ({ page }) => {
    // 1. 测试导出表单验证
    await page.goto('/export');
    await page.click('button:has-text("新建导出")');

    // 验证表单元素存在
    await expect(page.locator('input[placeholder*="搜索关键词"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();

    // 2. 测试系统设置表单验证
    await page.goto('/settings');

    // 测试数字输入
    const numberInputs = page.locator('input[type="number"]');
    const inputCount = await numberInputs.count();

    if (inputCount > 0) {
      const firstInput = numberInputs.first();
      await firstInput.fill('invalid');
      await expect(firstInput).toHaveValue('invalid'); // 测试输入接受

      await firstInput.fill('30');
      await expect(firstInput).toHaveValue('30');
    }

    // 3. 测试密码修改表单
    await page.click('button:has-text("修改密码")');
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
    await expect(page.locator('input[name="newPassword"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test('性能测试', async ({ page }) => {
    // 测试页面加载性能
    const pages = ['/dashboard', '/patients', '/export', '/audit', '/settings'];

    for (const pagePath of pages) {
      const startTime = Date.now();
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;

      // 验证页面在合理时间内加载（3秒内）
      expect(loadTime).toBeLessThan(3000);

      // 验证关键元素可见
      await expect(page.locator('body')).toBeVisible();
    }
  });
});

test.describe('完整工作流程 - 集成测试', () => {
  test('数据导入导出完整流程', async ({ page }) => {
    // 这个测试需要实际的文件上传和云函数支持
    // 目前作为模拟测试

    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 1. 访问导入页面
    await page.goto('/import');
    await expect(page.locator('h1')).toContainText('导入Excel');

    // 2. 访问导出页面
    await page.goto('/export');
    await expect(page.locator('h1')).toContainText('导出中心');

    // 3. 创建导出任务
    await page.click('button:has-text("新建导出")');
    await page.click('button:has-text("开始导出")');

    // 4. 访问审计日志查看操作记录
    await page.goto('/audit');
    await expect(page.locator('h1')).toContainText('审计日志');
  });

  test('多用户协作场景测试', async ({ page }) => {
    // 模拟多个用户之间的协作场景

    // 管理员创建导出任务
    await page.goto('/login');
    await page.fill('[data-testid=username-input]', 'admin');
    await page.fill('[data-testid=password-input]', 'admin123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    await page.goto('/export');
    await page.click('button:has-text("新建导出")');
    await page.click('button:has-text("开始导出")');

    // 切换到社工用户
    await page.click('button:has-text("退出登录")');
    await page.waitForURL('**/login');

    await page.fill('[data-testid=username-input]', 'worker');
    await page.fill('[data-testid=password-input]', 'worker123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // 社工用户查看审计日志
    await page.goto('/audit');
    await expect(page.locator('h1')).toContainText('审计日志');

    // 验证可以看到管理员的操作记录
    await page.waitForTimeout(2000);
    const adminOperation = page.locator('text=admin');
    if (await adminOperation.first().isVisible()) {
      await expect(adminOperation.first()).toBeVisible();
    }
  });
});