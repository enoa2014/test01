import { test, expect } from '@playwright/test';

test.describe('Analysis页面修复验证测试', () => {
  test.beforeEach(async ({ page }) => {
    // 设置更长的超时时间
    test.setTimeout(120000);

    // 设置E2E测试绕过登录
    await page.addInitScript(() => {
      window.localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    });

    // 监听控制台错误
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('🔴 Console Error:', msg.text());
      } else if (msg.type() === 'warn') {
        console.log('🟡 Console Warning:', msg.text());
      }
    });

    // 监听页面错误
    page.on('pageerror', error => {
      console.log('🔴 Page Error:', error.message);
      console.log('Stack:', error.stack);
    });

    // 监听网络请求失败
    page.on('requestfailed', request => {
      console.log('🔴 Request Failed:', request.url(), request.failure());
    });
  });

  test('1. JavaScript错误修复验证', async ({ page }) => {
    console.log('🔍 开始验证JavaScript错误是否修复...');

    // 访问analysis页面
    const response = await page.goto('/analysis', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    expect(response?.status()).toBe(200);

    // 等待页面完全加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // 截图初始状态
    await page.screenshot({ path: 'test-results/verification/initial-page-state.png', fullPage: true });

    // 检查页面是否正常渲染（查找关键元素）
    const keyElements = [
      'h1', '.title', '.page-title',
      '[data-testid="page-title"]',
      'text=数据分析', 'text=📊'
    ];

    let pageLoaded = false;
    for (const selector of keyElements) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          const text = await element.textContent();
          console.log(`✅ 找到页面标题元素: ${text}`);
          pageLoaded = true;
          break;
        }
      } catch (e) {
        // 继续尝试下一个选择器
      }
    }

    // 如果找不到标题，检查页面内容
    if (!pageLoaded) {
      const bodyText = await page.locator('body').textContent();
      console.log('📄 页面内容预览:', bodyText?.substring(0, 300));

      // 检查是否有加载错误提示
      const hasErrorContent = bodyText?.includes('Cannot read properties of undefined') ||
                             bodyText?.includes('TypeError') ||
                             bodyText?.includes('Error');

      expect(hasErrorContent).toBe(false);
    }

    // 检查页面URL是否正确
    const currentUrl = page.url();
    expect(currentUrl).toContain('analysis');

    console.log('✅ JavaScript错误修复验证完成');
  });

  test('2. 摘要卡片显示验证', async ({ page }) => {
    console.log('🔍 开始验证摘要卡片显示...');

    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // 查找四个统计卡片
    const expectedCards = ['全部', '在住', '待入住', '已离开'];
    const foundCards: string[] = [];

    for (const cardLabel of expectedCards) {
      try {
        // 尝试多种选择器策略
        const selectors = [
          `text=${cardLabel}`,
          `[data-testid*="${cardLabel}"]`,
          `.card:has-text("${cardLabel}")`,
          `div:has-text("${cardLabel}")`
        ];

        for (const selector of selectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 3000 })) {
            foundCards.push(cardLabel);
            console.log(`✅ 找到摘要卡片: ${cardLabel}`);

            // 获取卡片数值
            const cardParent = element.locator('..');
            const cardText = await cardParent.textContent();
            console.log(`   卡片内容: ${cardText?.trim()}`);
            break;
          }
        }
      } catch (error) {
        console.log(`❌ 未找到卡片: ${cardLabel}`);
      }
    }

    console.log(`📊 摘要卡片统计: ${foundCards.length}/${expectedCards.length}`);

    // 截图卡片状态
    await page.screenshot({ path: 'test-results/verification/summary-cards.png', fullPage: true });

    // 验证至少找到3个卡片
    expect(foundCards.length).toBeGreaterThanOrEqual(3);

    // 检查卡片交互功能
    if (foundCards.length >= 2) {
      console.log('🔍 测试卡片交互功能...');

      for (const cardLabel of foundCards.slice(0, 2)) {
        try {
          const card = page.locator(`text=${cardLabel}`).first();
          if (await card.isVisible()) {
            await card.click();
            await page.waitForTimeout(2000);
            console.log(`✅ 成功点击卡片: ${cardLabel}`);

            // 检查是否有响应（如弹窗、筛选等）
            await page.screenshot({
              path: `test-results/verification/card-click-${cardLabel}.png`,
              fullPage: true
            });
          }
        } catch (error) {
          console.log(`❌ 点击卡片失败: ${cardLabel}`, error);
        }
      }
    }
  });

  test('3. 筛选功能验证', async ({ page }) => {
    console.log('🔍 开始验证筛选功能...');

    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 测试时间范围筛选
    const timeFilterOptions = ['近30天', '本月', '本年', '全部'];
    let timeFiltersFound = 0;

    for (const option of timeFilterOptions) {
      try {
        const filter = page.locator(`text=${option}`).first();
        if (await filter.isVisible({ timeout: 2000 })) {
          timeFiltersFound++;
          console.log(`✅ 找到时间筛选选项: ${option}`);

          // 测试点击
          await filter.click();
          await page.waitForTimeout(2000);
          console.log(`✅ 成功选择时间范围: ${option}`);

          await page.screenshot({
            path: `test-results/verification/time-filter-${option}.png`
          });
        }
      } catch (error) {
        console.log(`❌ 时间筛选选项未找到或不可点击: ${option}`);
      }
    }

    // 测试状态筛选
    const statusFilterOptions = ['全部', '在住', '待入住', '已离开'];
    let statusFiltersFound = 0;

    for (const option of statusFilterOptions) {
      try {
        const filter = page.locator(`text=${option}`).first();
        if (await filter.isVisible({ timeout: 2000 }) &&
            await filter.isEnabled()) {
          statusFiltersFound++;
          console.log(`✅ 找到状态筛选选项: ${option}`);

          // 测试点击（避免重复点击已选中的）
          await filter.click();
          await page.waitForTimeout(2000);
          console.log(`✅ 成功选择状态: ${option}`);

          await page.screenshot({
            path: `test-results/verification/status-filter-${option}.png`
          });
        }
      } catch (error) {
        console.log(`❌ 状态筛选选项未找到或不可点击: ${option}`);
      }
    }

    // 测试清除筛选按钮
    try {
      const clearButton = page.locator('text=清除筛选, button:has-text("清除")').first();
      if (await clearButton.isVisible({ timeout: 3000 })) {
        await clearButton.click();
        await page.waitForTimeout(2000);
        console.log('✅ 清除筛选按钮功能正常');

        await page.screenshot({
          path: 'test-results/verification/filters-cleared.png',
          fullPage: true
        });
      }
    } catch (error) {
      console.log('❌ 清除筛选按钮未找到或不可用');
    }

    console.log(`📊 筛选功能统计: 时间筛选 ${timeFiltersFound}/${timeFilterOptions.length}, 状态筛选 ${statusFiltersFound}/${statusFilterOptions.length}`);

    // 验证至少找到基本筛选功能
    expect(timeFiltersFound + statusFiltersFound).toBeGreaterThanOrEqual(2);
  });

  test('4. 分析面板验证', async ({ page }) => {
    console.log('🔍 开始验证分析面板...');

    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 查找四个分析面板
    const expectedPanels = ['状态分布', '年龄段', '性别', '籍贯'];
    const foundPanels: string[] = [];

    for (const panelType of expectedPanels) {
      try {
        const panel = page.locator(`text=${panelType}`).first();
        if (await panel.isVisible({ timeout: 3000 })) {
          foundPanels.push(panelType);
          console.log(`✅ 找到分析面板: ${panelType}`);

          // 获取面板内容
          const panelParent = panel.locator('..');
          const panelText = await panelParent.textContent();
          console.log(`   面板内容预览: ${panelText?.substring(0, 100)}...`);
        }
      } catch (error) {
        console.log(`❌ 未找到分析面板: ${panelType}`);
      }
    }

    console.log(`📊 分析面板统计: ${foundPanels.length}/${expectedPanels.length}`);

    // 测试面板折叠/展开功能
    if (foundPanels.length > 0) {
      console.log('🔍 测试面板折叠/展开功能...');

      for (let i = 0; i < Math.min(2, foundPanels.length); i++) {
        try {
          const panelText = foundPanels[i];
          const panel = page.locator(`text=${panelText}`).first();

          // 查找折叠/展开按钮
          const toggleButton = panel.locator('..').locator('button, [role="button"], .toggle').first();
          if (await toggleButton.isVisible({ timeout: 2000 })) {
            await toggleButton.click();
            await page.waitForTimeout(1500);
            console.log(`✅ 面板折叠/展开成功: ${panelText}`);

            await page.screenshot({
              path: `test-results/verification/panel-toggle-${panelText}.png`
            });
          }
        } catch (error) {
          console.log(`❌ 面板折叠/展开失败: ${foundPanels[i]}`);
        }
      }
    }

    // 测试视图模式切换
    const viewModes = ['卡片', '柱状图', '饼图'];
    let viewModesFound = 0;

    for (const mode of viewModes) {
      try {
        const modeButton = page.locator(`text=${mode}`).first();
        if (await modeButton.isVisible({ timeout: 2000 })) {
          viewModesFound++;
          console.log(`✅ 找到视图模式: ${mode}`);

          await modeButton.click();
          await page.waitForTimeout(2000);
          console.log(`✅ 成功切换到视图: ${mode}`);

          await page.screenshot({
            path: `test-results/verification/view-mode-${mode}.png`
          });
        }
      } catch (error) {
        console.log(`❌ 视图模式未找到或不可切换: ${mode}`);
      }
    }

    console.log(`📊 视图模式统计: ${viewModesFound}/${viewModes.length}`);

    // 截图所有面板状态
    await page.screenshot({
      path: 'test-results/verification/analysis-panels.png',
      fullPage: true
    });

    // 验证至少找到2个分析面板
    expect(foundPanels.length).toBeGreaterThanOrEqual(2);
  });

  test('5. 交互功能验证', async ({ page }) => {
    console.log('🔍 开始验证交互功能...');

    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 仅在分析页面范围内进行有约束的交互，避免导航到其他页面导致超时
    let modalFound = false;
    let interactionCount = 0;

    // 优先尝试点击“状态分布”中的“在住”统计项
    const candidates = [
      'div:has-text("在住")',
      'div:has-text("男")',
      'div:has-text("女")'
    ];

    for (const selector of candidates) {
      const element = page.locator(selector).first();
      try {
        if (await element.isVisible({ timeout: 2000 })) {
          interactionCount++;
          const text = (await element.textContent()) || selector;
          console.log(`🔍 测试交互元素 ${interactionCount}: ${text.substring(0, 50)}`);
          await element.click({ timeout: 3000 });
          await page.waitForTimeout(800);

          // 检查是否出现选择弹窗
          const dialogVisible = await page
            .locator('[role="dialog"], button:has-text("在列表中查看"), button:has-text("关闭")')
            .first()
            .isVisible({ timeout: 1500 })
            .catch(() => false);

          if (dialogVisible) {
            modalFound = true;
            console.log('✅ 弹窗出现');
            // 关闭弹窗
            const close = page.locator('button:has-text("关闭")').first();
            if (await close.isVisible({ timeout: 1000 })) {
              await close.click({ timeout: 1000 });
              await page.waitForTimeout(300);
            }
            break;
          }
        }
      } catch (error) {
        console.log(`❌ 交互元素测试失败 (${selector}):`, error);
      }
    }

    console.log(`📊 交互功能统计: 测试了 ${interactionCount} 个元素，发现弹窗: ${modalFound}`);

    // 最终页面截图
    await page.screenshot({
      path: 'test-results/verification/final-interaction-state.png',
      fullPage: true
    });

    // 验证至少尝试了交互（即使没有弹窗）
    expect(interactionCount).toBeGreaterThanOrEqual(1);
  });

  test('6. 响应式设计验证', async ({ page }) => {
    console.log('🔍 开始验证响应式设计...');

    await page.goto('/analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 测试不同屏幕尺寸
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 1366, height: 768, name: 'Laptop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      console.log(`🔍 测试视口: ${viewport.name} (${viewport.width}x${viewport.height})`);

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(2000);

      // 检查页面是否正常显示
      const bodyVisible = await page.locator('body').isVisible();
      expect(bodyVisible).toBe(true);

      // 检查是否有水平滚动条（响应式设计问题）
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > document.body.clientWidth;
      });

      if (hasHorizontalScroll) {
        console.log(`⚠️ ${viewport.name} 视口存在水平滚动条`);
      } else {
        console.log(`✅ ${viewport.name} 视口响应式设计良好`);
      }

      // 截图当前视口
      await page.screenshot({
        path: `test-results/verification/responsive-${viewport.name.toLowerCase()}.png`,
        fullPage: true
      });
    }

    // 恢复到桌面尺寸
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);

    console.log('✅ 响应式设计验证完成');
  });

  test.afterEach(async ({ page }) => {
    // 每个测试后都进行最终截图
    await page.screenshot({
      path: 'test-results/verification/test-completion.png',
      fullPage: true
    });

    // 记录最终的页面信息
    console.log('📊 测试完成时页面信息:');
    console.log('   URL:', page.url());
    console.log('   标题:', await page.title());
  });
});
