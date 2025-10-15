import { test, expect, type Page } from '@playwright/test';

// 辅助函数：等待页面加载完成
async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // 额外等待确保所有组件渲染完成
}

// 辅助函数：截图并保存
async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/analysis-${name}-${Date.now()}.png`,
    fullPage: true
  });
}

test.describe('数据分析页面测试', () => {
  test.beforeEach(async ({ page }) => {
    // 先进行登录
    await page.goto('http://localhost:5177/login');
    await page.waitForLoadState('networkidle');

    // 填写登录信息（根据实际登录表单调整）
    await page.fill('input[placeholder*="用户名"], input[name="username"], input[type="text"]', 'admin');
    await page.fill('input[placeholder*="口令"], input[name="password"], input[type="password"]', 'admin');

    // 点击登录按钮
    await page.click('button[type="submit"], button:has-text("登录")');

    // 等待登录完成
    await page.waitForTimeout(2000);

    // 导航到分析页面
    await page.goto('http://localhost:5177/analysis');
    await waitForPageLoad(page);
  });

  test('页面是否正常加载和显示', async ({ page }) => {
    console.log('测试页面加载...');

    // 检查页面标题
    await expect(page.locator('h1')).toContainText('数据分析');

    // 检查页面基本结构
    await expect(page.locator('text=全面的住户数据统计与分析')).toBeVisible();

    // 等待数据加载完成
    await page.waitForSelector('text=全部', { timeout: 10000 });

    await takeScreenshot(page, 'page-load');
    console.log('✅ 页面加载测试通过');
  });

  test('摘要卡片是否正确显示统计数据', async ({ page }) => {
    console.log('测试摘要卡片...');

    // 等待摘要卡片加载
    await page.waitForSelector('[data-testid="summary-card"], div:has-text("全部")', { timeout: 10000 });

    // 检查四个摘要卡片是否存在
    const summaryCards = page.locator('div:has-text("全部"), div:has-text("在住"), div:has-text("待入住"), div:has-text("已离开")');
    await expect(summaryCards).toHaveCount(4);

    // 检查卡片内容
    await expect(page.locator('text=全部')).toBeVisible();
    await expect(page.locator('text=在住')).toBeVisible();
    await expect(page.locator('text=待入住')).toBeVisible();
    await expect(page.locator('text=已离开')).toBeVisible();

    // 检查描述文本
    await expect(page.locator('text=当前住户总量')).toBeVisible();
    await expect(page.locator('text=近 30 天内仍在住的住户')).toBeVisible();
    await expect(page.locator('text=待随访 / 待安排的住户')).toBeVisible();
    await expect(page.locator('text=已出院或离家的住户')).toBeVisible();

    await takeScreenshot(page, 'summary-cards');
    console.log('✅ 摘要卡片测试通过');
  });

  test('筛选功能是否正常工作', async ({ page }) => {
    console.log('测试筛选功能...');

    // 等待筛选控件加载
    await page.waitForSelector('text=时间范围', { timeout: 10000 });

    // 测试时间范围筛选
    const timeRangeButtons = page.locator('button:has-text("近30天"), button:has-text("本月"), button:has-text("本年"), button:has-text("全部")');
    await expect(timeRangeButtons).toHaveCount(4);

    // 点击"近30天"筛选
    await page.click('button:has-text("近30天")');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'time-range-filter');

    // 测试状态筛选
    const statusButtons = page.locator('button:has-text("在住"), button:has-text("待入住"), button:has-text("已离开")');
    await expect(statusButtons).toHaveCount(3);

    // 点击"在住"状态筛选
    await page.click('button:has-text("在住")');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'status-filter');

    // 检查清除筛选按钮是否出现
    await expect(page.locator('button:has-text("清除筛选")')).toBeVisible();

    // 点击清除筛选
    await page.click('button:has-text("清除筛选")');
    await page.waitForTimeout(1000);

    console.log('✅ 筛选功能测试通过');
  });

  test('分析面板是否显示', async ({ page }) => {
    console.log('测试分析面板...');

    // 等待分析面板加载
    await page.waitForSelector('text=状态分布', { timeout: 15000 });

    // 检查四个分析面板是否存在
    await expect(page.locator('text=状态分布')).toBeVisible();
    await expect(page.locator('text=按年龄段分析')).toBeVisible();
    await expect(page.locator('text=按性别分析')).toBeVisible();
    await expect(page.locator('text=按籍贯分析')).toBeVisible();

    // 检查面板内容
    await expect(page.locator('text=共')).toBeVisible(); // 检查统计人数显示

    await takeScreenshot(page, 'analysis-panels');
    console.log('✅ 分析面板测试通过');
  });

  test('三种视图模式切换是否正常', async ({ page }) => {
    console.log('测试视图模式切换...');

    // 等待分析面板加载
    await page.waitForSelector('text=状态分布', { timeout: 15000 });

    // 找到第一个面板的视图切换按钮
    const viewModes = page.locator('button:has-text("卡片"), button:has-text("柱状图"), button:has-text("圆饼图")').first();
    await expect(viewModes).toHaveCount(3);

    // 测试切换到柱状图
    await page.click('button:has-text("柱状图").first');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'bar-chart-view');

    // 测试切换到圆饼图
    await page.click('button:has-text("圆饼图").first');
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'pie-chart-view');

    // 切换回卡片视图
    await page.click('button:has-text("卡片").first');
    await page.waitForTimeout(1000);

    console.log('✅ 视图模式切换测试通过');
  });

  test('点击统计项是否能弹出选择弹窗', async ({ page }) => {
    console.log('测试统计项点击弹窗...');

    // 等待数据加载
    await page.waitForSelector('text=状态分布', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // 尝试点击摘要卡片
    const summaryCard = page.locator('div:has-text("在住")').first();
    if (await summaryCard.isVisible()) {
      await summaryCard.click();
      await page.waitForTimeout(1000);

      // 检查是否出现弹窗
      const modalVisible = await page.locator('text=在住住户, text=共').isVisible().catch(() => false);
      if (modalVisible) {
        await takeScreenshot(page, 'selection-modal');

        // 关闭弹窗
        await page.click('button:has-text("关闭")');
        await page.waitForTimeout(500);
      }
    }

    // 尝试点击分析面板中的统计项
    const statItem = page.locator('div:has-text("在住"), div:has-text("男"), div:has-text("女")').first();
    if (await statItem.isVisible()) {
      await statItem.click();
      await page.waitForTimeout(1000);

      // 检查是否出现弹窗
      const modalVisible = await page.locator('text=在列表中查看, button:has-text("关闭")').isVisible().catch(() => false);
      if (modalVisible) {
        await takeScreenshot(page, 'stat-selection-modal');

        // 关闭弹窗
        await page.click('button:has-text("关闭")');
        await page.waitForTimeout(500);
      }
    }

    console.log('✅ 统计项点击弹窗测试完成');
  });

  test('面板折叠功能是否正常', async ({ page }) => {
    console.log('测试面板折叠功能...');

    // 等待分析面板加载
    await page.waitForSelector('text=状态分布', { timeout: 15000 });

    // 找到折叠/展开按钮
    const collapseButton = page.locator('button:has-text("收起"), button:has-text("展开")').first();
    await expect(collapseButton).toBeVisible();

    // 点击收起
    await collapseButton.click();
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'panel-collapsed');

    // 再次点击展开
    await collapseButton.click();
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'panel-expanded');

    console.log('✅ 面板折叠功能测试通过');
  });

  test('响应式设计是否正常', async ({ page }) => {
    console.log('测试响应式设计...');

    // 测试桌面尺寸
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'desktop-view');

    // 测试平板尺寸
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'tablet-view');

    // 测试手机尺寸
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    await takeScreenshot(page, 'mobile-view');

    // 恢复桌面尺寸
    await page.setViewportSize({ width: 1200, height: 800 });

    console.log('✅ 响应式设计测试通过');
  });

  test('检查控制台错误', async ({ page }) => {
    console.log('检查控制台错误...');

    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log('Console error:', msg.text());
      }
    });

    page.on('pageerror', error => {
      errors.push(error.message);
      console.log('Page error:', error.message);
    });

    // 等待页面完全加载
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);

    if (errors.length > 0) {
      console.log('❌ 发现控制台错误:');
      errors.forEach(error => console.log('  -', error));
    } else {
      console.log('✅ 未发现控制台错误');
    }
  });
});

test.describe('数据分析页面性能测试', () => {
  test('页面加载性能', async ({ page }) => {
    console.log('测试页面加载性能...');

    const startTime = Date.now();

    // 开始导航
    await page.goto('http://localhost:5177/analysis');

    // 等待主要内容加载
    await page.waitForSelector('text=数据分析', { timeout: 30000 });
    await page.waitForSelector('text=状态分布', { timeout: 30000 });

    const loadTime = Date.now() - startTime;
    console.log(`页面加载时间: ${loadTime}ms`);

    // 检查性能指标
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0,
      };
    });

    console.log('性能指标:', performanceMetrics);

    await takeScreenshot(page, 'performance-test');

    // 断言页面加载时间在合理范围内
    expect(loadTime).toBeLessThan(10000); // 10秒内加载完成
  });
});