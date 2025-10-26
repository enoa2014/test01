import { test, expect } from '@playwright/test';

test.describe('综合工作流测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置测试环境localStorage以绕过登录
    await page.goto('http://localhost:5178');

    // 等待页面初始化
    await page.waitForTimeout(2000);

    // 设置E2E测试bypass
    await page.evaluate(() => {
      localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    });

    // 检查是否需要登录，如果被重定向到登录页面，则重新访问主页
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // 重新访问主页以应用bypass
      await page.goto('http://localhost:5178');
    }

    // 等待页面加载完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('概览页面基本功能测试', async ({ page }) => {
    // 检查页面标题
    await expect(page).toHaveTitle(/同心源 小家管理后台/);

    // 等待应用完全加载
    await page.waitForTimeout(3000);

    // 检查概览页面元素
    await expect(page.getByRole('heading', { name: '系统概览' })).toBeVisible();

    // 检查统计卡片
    await expect(page.getByText('待审批申请')).toBeVisible();
    await expect(page.getByText('近7日导入')).toBeVisible();
    await expect(page.getByText('近7日导出')).toBeVisible();
    await expect(page.getByText('错误日志')).toBeVisible();
    await expect(page.getByText('患者总数')).toBeVisible();

    // 检查快捷操作
    await expect(page.getByText('快捷操作')).toBeVisible();

    // 检查系统信息
    await expect(page.getByText('系统信息')).toBeVisible();
  });

  test('患者管理功能测试', async ({ page }) => {
    // 点击患者管理
    await page.getByText('患者管理').click();

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 检查患者列表页面
    await expect(page.getByRole('heading', { name: '患者列表' })).toBeVisible();

    // 检查搜索功能
    const searchInput = page.getByPlaceholderText('搜索患者姓名、证件号或联系电话');
    await expect(searchInput).toBeVisible();

    // 检查筛选器
    await expect(page.getByText('全部')).toBeVisible();
    await expect(page.getByText('在住')).toBeVisible();
    await expect(page.getByText('已出院')).toBeVisible();

    // 测试搜索功能
    await searchInput.fill('测试');
    await page.waitForTimeout(1000);

    // 测试筛选功能
    await page.getByText('在住').click();
    await page.waitForTimeout(1000);
  });

  test('导入数据功能测试', async ({ page }) => {
    // 点击导入数据
    await page.getByText('导入数据').click();

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 检查导入页面
    await expect(page.getByRole('heading', { name: '数据导入' })).toBeVisible();

    // 检查导入模式选择
    await expect(page.getByText('智能合并模式')).toBeVisible();
    await expect(page.getByText('全新导入模式')).toBeVisible();

    // 检查文件上传区域
    const uploadArea = page.getByText(/点击选择文件或拖拽文件到此处/);
    await expect(uploadArea).toBeVisible();

    // 检查步骤指示器
    await expect(page.getByText('选择导入模式')).toBeVisible();
    await expect(page.getByText('上传数据文件')).toBeVisible();
    await expect(page.getByText('预览和确认')).toBeVisible();
    await expect(page.getByText('开始导入')).toBeVisible();
  });

  test('导出数据功能测试', async ({ page }) => {
    // 点击导出数据
    await page.getByText('导出数据').click();

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 检查导出页面
    await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible();

    // 检查导出选项
    await expect(page.getByText('导出全部患者')).toBeVisible();
    await expect(page.getByText('导出选中患者')).toBeVisible();

    // 检查表格
    await expect(page.getByRole('table')).toBeVisible();

    // 检查导出按钮
    const exportButton = page.getByRole('button', { name: /导出/i });
    await expect(exportButton).toBeVisible();
  });

  test('操作审计功能测试', async ({ page }) => {
    // 点击操作审计
    await page.getByText('操作审计').click();

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 检查审计页面
    await expect(page.getByRole('heading', { name: '操作审计' })).toBeVisible();

    // 检查筛选器
    await expect(page.getByText('全部类型')).toBeVisible();
    await expect(page.getByText('全部用户')).toBeVisible();
    await expect(page.getByText('时间范围')).toBeVisible();

    // 检查日志列表
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('系统设置功能测试', async ({ page }) => {
    // 点击系统设置
    await page.getByText('系统设置').click();

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 检查设置页面
    await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible();

    // 检查环境信息
    await expect(page.getByText('环境信息')).toBeVisible();

    // 检查其他设置选项
    await expect(page.getByText('云函数管理')).toBeVisible();
    await expect(page.getByText('数据库管理')).toBeVisible();
  });

  test('响应式设计测试', async ({ page }) => {
    // 测试桌面尺寸
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.getByRole('navigation')).toBeVisible();

    // 测试平板尺寸
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.getByRole('navigation')).toBeVisible();

    // 测试手机尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('navigation')).toBeVisible();

    // 恢复桌面尺寸
    await page.setViewportSize({ width: 1200, height: 800 });
  });

  test('无障碍访问测试', async ({ page }) => {
    // 检查页面标题
    await expect(page.getByRole('heading', { name: '系统概览' })).toBeVisible();

    // 检查主要区域的ARIA标签
    const main = page.getByRole('main');
    await expect(main).toBeVisible();

    const navigation = page.getByRole('navigation');
    await expect(navigation).toBeVisible();

    // 检查键盘导航
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    // 检查焦点管理
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('错误处理测试', async ({ page }) => {
    // 监听网络请求
    page.on('response', response => {
      if (response.status() >= 400) {
        console.log(`HTTP错误: ${response.status()} ${response.url()}`);
      }
    });

    // 测试导航到不存在的页面
    await page.goto('http://localhost:4173/non-existent-page');
    await page.waitForTimeout(2000);

    // 检查是否有错误处理
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // 回到主页
    await page.goto('http://localhost:5178');
    await page.waitForLoadState('networkidle');
  });

  test('性能测试', async ({ page }) => {
    // 测量页面加载时间
    const startTime = Date.now();
    await page.goto('http://localhost:5178');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    // 页面加载时间应该在合理范围内（5秒）
    expect(loadTime).toBeLessThan(5000);

    // 测试页面交互响应时间
    const interactionStart = Date.now();
    await page.getByText('患者管理').click();
    await page.waitForLoadState('networkidle');
    const interactionTime = Date.now() - interactionStart;

    // 交互响应时间应该在合理范围内（3秒）
    expect(interactionTime).toBeLessThan(3000);
  });
});

test.describe('数据流测试', () => {
  test('完整数据导入导出流程', async ({ page }) => {
    // 开始从主页
    await page.goto('http://localhost:5178');
    await page.waitForLoadState('networkidle');

    // 1. 进入导入页面
    await page.getByText('导入数据').click();
    await page.waitForLoadState('networkidle');

    // 2. 选择导入模式
    await page.getByText('智能合并模式').click();

    // 3. 模拟文件上传（这里只是测试UI，不实际上传）
    const uploadArea = page.getByText(/点击选择文件或拖拽文件到此处/);
    await expect(uploadArea).toBeVisible();

    // 4. 进入导出页面
    await page.getByText('导出数据').click();
    await page.waitForLoadState('networkidle');

    // 5. 检查导出功能
    await expect(page.getByRole('heading', { name: '数据导出' })).toBeVisible();
    await expect(page.getByText('导出全部患者')).toBeVisible();
  });

  test('用户权限验证流程', async ({ page }) => {
    // 访问需要权限的页面
    await page.goto('http://localhost:5178');
    await page.waitForLoadState('networkidle');

    // 检查用户是否已登录（通过检查页面内容）
    const mainHeading = page.getByRole('heading', { name: '系统概览' });

    if (await mainHeading.isVisible()) {
      // 如果可以访问概览页面，说明用户已登录
      console.log('用户已登录，可以访问管理功能');

      // 测试各个需要权限的页面
      const pages = [
        { name: '患者管理', selector: 'text=患者管理' },
        { name: '导入数据', selector: 'text=导入数据' },
        { name: '导出数据', selector: 'text=导出数据' },
        { name: '操作审计', selector: 'text=操作审计' },
        { name: '系统设置', selector: 'text=系统设置' }
      ];

      for (const pageItem of pages) {
        await page.goto('http://localhost:5178');
        await page.waitForLoadState('networkidle');

        await page.locator(pageItem.selector).click();
        await page.waitForLoadState('networkidle');

        // 检查是否成功访问页面
        const body = page.locator('body');
        await expect(body).toBeVisible();
      }
    } else {
      // 如果用户未登录，应该能看到登录界面或错误信息
      console.log('用户未登录或权限不足');
    }
  });
});