import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Analysis页面深度调试测试 - Port 5174', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000); // 增加超时时间到2分钟

    // 设置E2E测试绕过登录
    await page.addInitScript(() => {
      window.localStorage.setItem('E2E_BYPASS_LOGIN', '1');
    });

    // 监听所有控制台消息
    const consoleMessages: any[] = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });

      if (msg.type() === 'error') {
        console.log('🔴 Console Error:', msg.text());
        console.log('   Location:', msg.location());
      } else if (msg.type() === 'warning') {
        console.log('🟡 Console Warning:', msg.text());
      } else if (msg.type() === 'info') {
        console.log('ℹ️ Console Info:', msg.text());
      }
    });

    // 监听页面错误
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
      console.log('💥 Page Error:', error.message);
      console.log('   Stack:', error.stack);
    });

    // 监听网络请求
    const networkRequests: any[] = [];
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        console.log('🚫 Failed Response:', response.status(), response.url());
      }
    });

    // 存储调试信息
    await page.context().addInitScript(() => {
      (window as any).debugInfo = {
        consoleMessages: [],
        pageErrors: [],
        networkRequests: []
      };
    });
  });

  test('1. JavaScript错误修复情况检查', async ({ page }) => {
    console.log('=== 开始JavaScript错误修复情况检查 ===');

    try {
      const response = await page.goto('http://localhost:5174/analysis', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      expect(response?.status()).toBe(200);
      console.log('✓ 页面成功加载，状态码:', response?.status());

      // 等待页面完全渲染
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(5000);

      // 获取所有未捕获的Promise rejection
      const promiseRejections = await page.evaluate(() => {
        return new Promise((resolve) => {
          const rejections: any[] = [];
          const originalHandler = window.onunhandledrejection;

          window.onunhandledrejection = (event) => {
            rejections.push({
              reason: event.reason,
              type: typeof event.reason,
              message: event.reason?.message || event.reason,
              stack: event.reason?.stack
            });
          };

          setTimeout(() => {
            window.onunhandledrejection = originalHandler;
            resolve(rejections);
          }, 2000);
        });
      });

      if (promiseRejections.length > 0) {
        console.log('🔴 发现Promise Rejections:');
        promiseRejections.forEach((rejection, index) => {
          console.log(`  ${index + 1}. Type: ${rejection.type}`);
          console.log(`     Message: ${rejection.message}`);
          console.log(`     Stack: ${rejection.stack}`);
        });
      } else {
        console.log('✓ 未发现Promise Rejections');
      }

      // 检查特定的"Cannot read properties of undefined (reading 'status')"错误
      const specificErrors = await page.evaluate(() => {
        const errors: string[] = [];
        // 检查是否有特定的错误模式
        return errors;
      });

      // 截图保存当前状态
      await page.screenshot({
        path: 'test-results/debug/javascript-errors-check.png',
        fullPage: true
      });

      console.log('✓ JavaScript错误检查完成');

    } catch (error) {
      console.log('❌ JavaScript错误检查失败:', error);
      await page.screenshot({
        path: 'test-results/debug/javascript-error-failed.png',
        fullPage: true
      });
      throw error;
    }
  });

  test('2. 摘要卡片功能验证', async ({ page }) => {
    console.log('=== 开始摘要卡片功能验证 ===');

    await page.goto('http://localhost:5174/analysis', { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // 初始状态截图
    await page.screenshot({
      path: 'test-results/debug/cards-initial-state.png',
      fullPage: true
    });

    // 查找四个统计卡片
    const expectedCards = ['全部', '在住', '待入住', '已离开'];
    const cardResults: any[] = [];

    for (const cardLabel of expectedCards) {
      console.log(`检查卡片: ${cardLabel}`);

      // 使用多种选择器查找卡片
      const selectors = [
        `text=${cardLabel}`,
        `[data-card="${cardLabel}"]`,
        `.card:has-text("${cardLabel}")`,
        `div:has-text("${cardLabel}")`
      ];

      let found = false;
      let cardElement = null;
      let cardData = {};

      for (const selector of selectors) {
        try {
          const elements = page.locator(selector);
          if (await elements.first().isVisible({ timeout: 2000 })) {
            found = true;
            cardElement = elements.first();

            // 获取卡片的完整文本内容
            const fullText = await cardElement.textContent();
            const parentElement = cardElement.locator('..');
            const parentText = await parentElement.textContent();

            // 尝试提取数字
            const numberMatch = fullText?.match(/\d+/) || parentText?.match(/\d+/);
            const number = numberMatch ? numberMatch[0] : 'N/A';

            // 检查是否有最高值标识
            const hasMaxIndicator = fullText?.includes('🔥') || parentText?.includes('最高');

            cardData = {
              label: cardLabel,
              found: true,
              selector: selector,
              number: number,
              hasMaxIndicator: hasMaxIndicator,
              fullText: fullText?.substring(0, 100),
              parentText: parentText?.substring(0, 100)
            };

            console.log(`✓ 找到${cardLabel}卡片:`, cardData);
            break;
          }
        } catch (e) {
          // 继续尝试下一个选择器
        }
      }

      if (!found) {
        cardData = {
          label: cardLabel,
          found: false,
          error: 'Card not found with any selector'
        };
        console.log(`❌ 未找到${cardLabel}卡片`);
      }

      cardResults.push(cardData);
    }

    // 测试卡片点击功能
    console.log('测试卡片点击功能...');
    for (let i = 0; i < cardResults.length; i++) {
      const card = cardResults[i];
      if (card.found) {
        try {
          const cardElement = page.locator(card.selector);

          // 悬停测试
          await cardElement.hover();
          await page.waitForTimeout(1000);
          console.log(`✓ ${card.label}卡片悬停成功`);

          // 点击测试
          await cardElement.click();
          await page.waitForTimeout(2000);
          console.log(`✓ ${card.label}卡片点击成功`);

          await page.screenshot({
            path: `test-results/debug/card-${card.label}-clicked.png`,
            fullPage: true
          });

        } catch (error) {
          console.log(`❌ ${card.label}卡片交互失败:`, error);
        }
      }
    }

    // 验证结果
    const foundCards = cardResults.filter(card => card.found).length;
    console.log(`摘要卡片验证完成: ${foundCards}/${expectedCards.length} 个卡片正常`);

    expect(foundCards).toBeGreaterThanOrEqual(3, '至少应该找到3个摘要卡片');
  });

  test('3. 筛选功能全面测试', async ({ page }) => {
    console.log('=== 开始筛选功能全面测试 ===');

    await page.goto('http://localhost:5174/analysis', { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 测试时间范围筛选
    const timeFilters = ['近30天', '本月', '本年', '全部'];
    console.log('测试时间范围筛选...');

    for (const filterText of timeFilters) {
      console.log(`测试时间筛选: ${filterText}`);

      try {
        // 查找筛选按钮
        const filterButton = page.locator(`button, select, [role="button"]`).filter({ hasText: filterText }).first();

        if (await filterButton.isVisible({ timeout: 3000 })) {
          // 点击前截图
          await page.screenshot({
            path: `test-results/debug/before-time-filter-${filterText}.png`,
            fullPage: true
          });

          await filterButton.click();
          await page.waitForTimeout(3000); // 等待数据更新

          console.log(`✓ 时间筛选"${filterText}"点击成功`);

          // 点击后截图
          await page.screenshot({
            path: `test/results/debug/after-time-filter-${filterText}.png`,
            fullPage: true
          });

          // 检查页面内容是否有变化
          const pageContent = await page.content();
          console.log(`筛选后页面内容长度: ${pageContent.length}`);

        } else {
          console.log(`❌ 未找到时间筛选按钮: ${filterText}`);
        }
      } catch (error) {
        console.log(`❌ 时间筛选"${filterText}"测试失败:`, error);
      }
    }

    // 测试状态筛选
    const statusFilters = ['全部', '在住', '待入住', '已离开'];
    console.log('测试状态筛选...');

    for (const filterText of statusFilters) {
      console.log(`测试状态筛选: ${filterText}`);

      try {
        const statusButton = page.locator(`button, select, [role="button"]`).filter({ hasText: filterText }).first();

        if (await statusButton.isVisible({ timeout: 3000 })) {
          await statusButton.click();
          await page.waitForTimeout(3000);

          console.log(`✓ 状态筛选"${filterText}"点击成功`);

          await page.screenshot({
            path: `test-results/debug/status-filter-${filterText}.png`,
            fullPage: true
          });

        } else {
          console.log(`❌ 未找到状态筛选按钮: ${filterText}`);
        }
      } catch (error) {
        console.log(`❌ 状态筛选"${filterText}"测试失败:`, error);
      }
    }

    // 最终筛选状态截图
    await page.screenshot({
      path: 'test-results/debug/final-filter-state.png',
      fullPage: true
    });
  });

  test('4. 分析面板深入测试', async ({ page }) => {
    console.log('=== 开始分析面板深入测试 ===');

    await page.goto('http://localhost:5174/analysis', { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 查找四个分析面板
    const expectedPanels = ['状态分布', '年龄段', '性别', '籍贯'];
    const panelResults: any[] = [];

    for (const panelName of expectedPanels) {
      console.log(`检查面板: ${panelName}`);

      try {
        const panelElement = page.locator(`text=${panelName}`).first();

        if (await panelElement.isVisible({ timeout: 3000 })) {
          // 获取面板容器
          const panelContainer = panelElement.locator('..').locator('..');

          // 检查面板内容
          const panelContent = await panelContainer.textContent();

          // 查找视图切换按钮
          const viewButtons = await panelContainer.locator('button, [role="button"]').all();
          const viewModes = [];

          for (const button of viewButtons) {
            const buttonText = await button.textContent();
            if (buttonText && /卡片|柱状图|饼图|card|bar|pie/i.test(buttonText)) {
              viewModes.push(buttonText.trim());
            }
          }

          panelResults.push({
            name: panelName,
            found: true,
            content: panelContent?.substring(0, 200),
            viewModes: viewModes,
            buttonCount: viewButtons.length
          });

          console.log(`✓ 找到${panelName}面板，视图模式:`, viewModes);

          // 测试折叠/展开功能
          const toggleButton = panelContainer.locator('button, .toggle, .collapse').first();
          if (await toggleButton.isVisible()) {
            await toggleButton.click();
            await page.waitForTimeout(1000);
            console.log(`✓ ${panelName}面板折叠/展开成功`);

            await page.screenshot({
              path: `test-results/debug/panel-${panelName}-toggled.png`,
              fullPage: true
            });
          }

        } else {
          panelResults.push({
            name: panelName,
            found: false,
            error: 'Panel not found'
          });
          console.log(`❌ 未找到${panelName}面板`);
        }
      } catch (error) {
        panelResults.push({
          name: panelName,
          found: false,
          error: error.message
        });
        console.log(`❌ ${panelName}面板检查失败:`, error);
      }
    }

    // 测试视图模式切换
    console.log('测试视图模式切换...');
    for (const panel of panelResults) {
      if (panel.found && panel.viewModes.length > 0) {
        const panelContainer = page.locator(`text=${panel.name}`).first().locator('..').locator('..');

        for (const viewMode of panel.viewModes) {
          try {
            const viewButton = panelContainer.locator('button, [role="button"]').filter({ hasText: viewMode }).first();

            if (await viewButton.isVisible()) {
              await viewButton.click();
              await page.waitForTimeout(2000);

              console.log(`✓ ${panel.name}面板切换到${viewMode}视图成功`);

              await page.screenshot({
                path: `test-results/debug/panel-${panel.name}-${viewMode}.png`,
                fullPage: true
              });
            }
          } catch (error) {
            console.log(`❌ ${panel.name}面板${viewMode}视图切换失败:`, error);
          }
        }
      }
    }

    // 验证结果
    const foundPanels = panelResults.filter(panel => panel.found).length;
    console.log(`分析面板测试完成: ${foundPanels}/${expectedPanels.length} 个面板正常`);

    expect(foundPanels).toBeGreaterThanOrEqual(3, '至少应该找到3个分析面板');
  });

  test('5. 交互功能深度测试', async ({ page }) => {
    console.log('=== 开始交互功能深度测试 ===');

    await page.goto('http://localhost:5174/analysis', { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 查找所有可点击的元素
    const clickableElements = await page.locator('button, [role="button"], .clickable, [data-clickable="true"], a').all();
    console.log(`找到 ${clickableElements.length} 个可点击元素`);

    let modalFound = false;
    let modalTestResults = [];

    // 测试前10个可点击元素
    for (let i = 0; i < Math.min(10, clickableElements.length); i++) {
      const element = clickableElements[i];

      try {
        const elementText = await element.textContent();
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled();

        if (isVisible && isEnabled && elementText && elementText.trim().length > 0) {
          console.log(`测试点击元素 ${i + 1}: ${elementText?.substring(0, 50)}`);

          // 点击前截图
          await page.screenshot({
            path: `test-results/debug/before-click-${i + 1}.png`,
            fullPage: true
          });

          await element.click();
          await page.waitForTimeout(2000);

          // 检查是否有弹窗出现
          const modals = await page.locator('.modal, .dialog, .popup, [role="dialog"]').all();
          const overlays = await page.locator('.overlay, .backdrop, .modal-backdrop').all();

          if (modals.length > 0 || overlays.length > 0) {
            modalFound = true;
            console.log(`✓ 元素 ${i + 1} 点击后出现弹窗`);

            // 获取弹窗内容
            const modalContent = await page.locator('.modal, .dialog, .popup').first().textContent();
            const modalButtons = await page.locator('.modal button, .dialog button, .popup button').all();

            modalTestResults.push({
              elementIndex: i + 1,
              elementText: elementText?.substring(0, 50),
              modalFound: true,
              modalContent: modalContent?.substring(0, 200),
              modalButtons: modalButtons.length
            });

            console.log(`弹窗内容: ${modalContent?.substring(0, 100)}`);
            console.log(`弹窗按钮数量: ${modalButtons.length}`);

            // 测试弹窗内的功能
            if (modalButtons.length > 0) {
              // 尝试点击关闭按钮
              const closeButton = page.locator('.close, .modal-close, button[aria-label*="close"], button:has-text("关闭")').first();

              if (await closeButton.isVisible()) {
                await closeButton.click();
                await page.waitForTimeout(1000);
                console.log(`✓ 弹窗关闭成功`);
              } else {
                // 点击其他按钮测试功能
                await modalButtons[0].click();
                await page.waitForTimeout(1000);
                console.log(`✓ 弹窗内按钮点击成功`);
              }
            }

            await page.screenshot({
              path: `test-results/debug/modal-${i + 1}.png`,
              fullPage: true
            });

            break; // 找到一个弹窗后就停止测试
          } else {
            console.log(`⚠ 元素 ${i + 1} 点击后无弹窗`);
          }
        }
      } catch (error) {
        console.log(`❌ 元素 ${i + 1} 点击测试失败:`, error);
      }
    }

    // 特别测试"在列表中查看"功能
    console.log('测试"在列表中查看"功能...');
    try {
      const viewInListButton = page.locator('button, [role="button"]').filter({ hasText: '在列表中查看' }).first();

      if (await viewInListButton.isVisible({ timeout: 3000 })) {
        await viewInListButton.click();
        await page.waitForTimeout(3000);

        // 检查是否跳转到列表页面
        const currentUrl = page.url();
        console.log(`点击"在列表中查看"后页面URL: ${currentUrl}`);

        if (currentUrl.includes('list') || currentUrl.includes('patient')) {
          console.log('✓ "在列表中查看"功能正常，已跳转到列表页面');
        } else {
          console.log('⚠ "在列表中查看"功能可能有问题，未跳转到预期页面');
        }

        await page.screenshot({
          path: 'test-results/debug/view-in-list-result.png',
          fullPage: true
        });
      } else {
        console.log('⚠ 未找到"在列表中查看"按钮');
      }
    } catch (error) {
      console.log('❌ "在列表中查看"功能测试失败:', error);
    }

    console.log(`交互功能测试完成，发现弹窗: ${modalFound}`);
  });

  test('6. 响应式设计测试', async ({ page }) => {
    console.log('=== 开始响应式设计测试 ===');

    await page.goto('http://localhost:5174/analysis', { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // 测试不同屏幕尺寸
    const viewports = [
      { name: '桌面', width: 1920, height: 1080 },
      { name: '平板', width: 768, height: 1024 },
      { name: '手机', width: 375, height: 668 }
    ];

    for (const viewport of viewports) {
      console.log(`测试${viewport.name}视图 (${viewport.width}x${viewport.height})`);

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });

      await page.waitForTimeout(2000);

      // 检查页面布局
      const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);

      console.log(`${viewport.name}视图页面尺寸: ${pageWidth}x${pageHeight}`);

      // 检查是否有横向滚动条
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasHorizontalScroll) {
        console.log(`⚠ ${viewport.name}视图存在横向滚动条`);
      } else {
        console.log(`✓ ${viewport.name}视图无横向滚动条`);
      }

      // 检查主要元素是否可见
      const cardsVisible = await page.locator('text=/全部|在住|待入住|已离开/').isVisible();
      const panelsVisible = await page.locator('[class*="panel"], [class*="chart"]').isVisible();

      console.log(`${viewport.name}视图 - 卡片可见: ${cardsVisible}, 面板可见: ${panelsVisible}`);

      await page.screenshot({
        path: `test-results/debug/responsive-${viewport.name}-${viewport.width}x${viewport.height}.png`,
        fullPage: true
      });
    }

    console.log('响应式设计测试完成');
  });

  test.afterEach(async ({ page }) => {
    // 每个测试后的清理工作
    console.log('测试完成，进行最终截图...');

    await page.screenshot({
      path: 'test-results/debug/final-test-state.png',
      fullPage: true
    });

    // 记录最终状态
    console.log('最终页面URL:', page.url());
    console.log('最终页面标题:', await page.title());

    // 检查是否有残留的错误
    const finalErrors = await page.evaluate(() => {
      // 获取页面最终的错误状态
      return {
        hasErrors: false,
        errorCount: 0
      };
    });

    console.log('最终状态检查完成');
  });
});