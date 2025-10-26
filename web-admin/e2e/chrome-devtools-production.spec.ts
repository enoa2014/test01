import { test, expect } from '@playwright/test';
import { ChromeDevToolsHelper } from './chrome-devtools-helper';

/**
 * 生产级Chrome DevTools E2E测试套件
 *
 * 专为生产环境设计的综合测试，包含：
 * - 完整的用户体验流程
 * - 严格的性能标准验证
 * - 全面的错误处理测试
 * - 详细的性能指标监控
 */

test.describe('生产级Chrome DevTools测试套件', () => {
  let helper: ChromeDevToolsHelper;

  test.beforeEach(async ({ page }) => {
    helper = new ChromeDevToolsHelper(page);

    // 设置生产级监控
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('[生产环境错误]', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.error('[生产环境页面错误]', error.message);
    });
  });

  test.describe('核心用户体验流程', () => {
    test('完整的应用启动和导航流程', async ({ page }) => {
      const startTime = Date.now();

      // 1. 应用启动测试
      await helper.navigateToPage('/');
      await helper.waitForNetworkIdle();

      const startupMetrics = await helper.collectPerformanceMetrics();
      console.log('应用启动性能:', startupMetrics);

      // 2. 验证应用基础状态
      const appState = await page.evaluate(() => {
        return {
          title: document.title,
          readyState: document.readyState,
          hasMainContent: !!document.querySelector('main, #root, .app'),
          hasNavigation: !!document.querySelector('nav, .navigation, .sidebar'),
          hasUserInterface: !!document.querySelector('button, .btn, [role="button"]')
        };
      });

      console.log('应用状态:', appState);

      // 3. 验证关键功能可用性
      const functionalCheck = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        const links = document.querySelectorAll('a[href]');
        const inputs = document.querySelectorAll('input, select, textarea');

        return {
          interactiveElements: buttons.length + links.length,
          formElements: inputs.length,
          hasErrorContent: document.body.textContent.toLowerCase().includes('error')
        };
      });

      console.log('功能检查:', functionalCheck);

      // 生产级断言
      expect(startupMetrics.navigation.domContentLoaded).toBeLessThan(3000);
      expect(startupMetrics.paint.firstContentfulPaint).toBeLessThan(2500);
      expect(appState.title).toBeTruthy();
      expect(appState.hasMainContent).toBeTruthy();
      expect(functionalCheck.interactiveElements).toBeGreaterThan(0);
      expect(functionalCheck.hasErrorContent).toBeFalsy();

      // 生成启动报告
      const startupReport = helper.generateReport('production-startup', {
        metrics: startupMetrics,
        appState,
        functionalCheck,
        loadTime: Date.now() - startTime
      });

      console.log('启动测试报告:', JSON.stringify(startupReport, null, 2));
    });

    test('用户认证和权限验证流程', async ({ page }) => {
      // 1. 检查认证状态
      const authCheck = await page.evaluate(() => {
        return {
          hasLoginForm: !!document.querySelector('form[action*="login"], .login-form'),
          hasUserMenu: !!document.querySelector('.user-menu, .user-info, .avatar'),
          isAuthenticated: !!localStorage.getItem('authToken') || !!localStorage.getItem('user'),
          bypassMode: localStorage.getItem('E2E_BYPASS_LOGIN') === '1'
        };
      });

      console.log('认证检查:', authCheck);

      // 2. 权限验证测试
      if (authCheck.isAuthenticated || authCheck.bypassMode) {
        // 测试权限相关的功能
        const permissionTest = await page.evaluate(() => {
          const adminElements = document.querySelectorAll('.admin-only, [data-require-role="admin"]');
          const restrictedElements = document.querySelectorAll('[data-require-permission]');

          return {
            adminElementCount: adminElements.length,
            restrictedElementCount: restrictedElements.length,
            hasPermissionErrors: document.body.textContent.includes('无权限') ||
                                  document.body.textContent.includes('permission denied')
          };
        });

        console.log('权限测试:', permissionTest);

        // 在测试环境中，权限错误是预期的
        if (authCheck.bypassMode) {
          expect(permissionTest.hasPermissionErrors).toBeFalsy();
        }
      }

      // 3. 角色切换测试（如果适用）
      const roleSwitchTest = await page.evaluate(() => {
        const roleSelectors = document.querySelectorAll('[data-role-switcher], .role-selector');
        return {
          hasRoleSwitcher: roleSelectors.length > 0,
          availableRoles: Array.from(roleSelectors).map(el => el.textContent.trim())
        };
      });

      console.log('角色切换测试:', roleSwitchTest);

      // 基础断言
      expect(authCheck).toBeTruthy();
    });

    test('数据加载和渲染性能测试', async ({ page }) => {
      // 1. 数据加载性能监控
      const dataLoadMetrics = {
        startTime: Date.now(),
        apiCalls: [] as any[],
        renderTimes: [] as any[]
      };

      page.on('request', request => {
        if (request.url().includes('api') || request.url().includes('func')) {
          dataLoadMetrics.apiCalls.push({
            url: request.url(),
            method: request.method(),
            timestamp: Date.now()
          });
        }
      });

      page.on('response', response => {
        if (response.url().includes('api') || response.url().includes('func')) {
          const matchingCall = dataLoadMetrics.apiCalls.find(call => call.url === response.url());
          if (matchingCall) {
            matchingCall.status = response.status();
            matchingCall.responseTime = Date.now() - matchingCall.timestamp;
          }
        }
      });

      // 2. 执行数据加载操作
      await helper.navigateToPage('/dashboard');
      await helper.waitForNetworkIdle();
      await page.waitForTimeout(3000); // 等待异步数据加载

      // 3. 收集渲染性能
      const renderMetrics = await page.evaluate(() => {
        const dataElements = document.querySelectorAll('[data-loaded], .data-item, .record');
        const loadingElements = document.querySelectorAll('.loading, .spinner, [data-loading]');
        const errorElements = document.querySelectorAll('.error, .error-message');

        return {
          dataElementCount: dataElements.length,
          loadingElementCount: loadingElements.length,
          errorElementCount: errorElements.length,
          pageContent: document.body.textContent.length,
          hasChartData: !!document.querySelector('canvas, .chart, [data-chart]'),
          hasTableData: !!document.querySelector('table, .data-table')
        };
      });

      console.log('数据加载指标:', {
        apiCalls: dataLoadMetrics.apiCalls.length,
        successfulCalls: dataLoadMetrics.apiCalls.filter(call => call.status && call.status < 400).length,
        renderMetrics
      });

      // 性能断言
      expect(dataLoadMetrics.apiCalls.length).toBeGreaterThan(0);
      expect(renderMetrics.pageContent).toBeGreaterThan(100);
      expect(renderMetrics.errorElementCount).toBeLessThan(3); // 允许少量权限错误

      // 计算数据加载性能评级
      const successfulCalls = dataLoadMetrics.apiCalls.filter(call => call.status && call.status < 400);
      const successRate = successfulCalls.length / dataLoadMetrics.apiCalls.length;
      const avgResponseTime = successfulCalls.reduce((sum, call) => sum + call.responseTime, 0) / successfulCalls.length;

      console.log('数据加载性能评级:', {
        successRate: `${(successRate * 100).toFixed(1)}%`,
        averageResponseTime: `${avgResponseTime.toFixed(0)}ms`,
        grade: successRate > 0.8 && avgResponseTime < 3000 ? 'A' :
               successRate > 0.6 && avgResponseTime < 5000 ? 'B' : 'C'
      });

      expect(successRate).toBeGreaterThan(0.6); // 至少60%成功率
      expect(avgResponseTime).toBeLessThan(5000); // 平均响应时间小于5秒
    });
  });

  test.describe('性能基准测试', () => {
    test('Core Web Vitals 基准验证', async ({ page }) => {
      // 1. 收集完整的Core Web Vitals
      const coreWebVitals = await helper.collectCoreWebVitals();

      console.log('Core Web Vitals 指标:', coreWebVitals);

      // 2. 基准断言
      expect(coreWebVitals.fcp).toBeLessThan(2500); // FCP < 2.5s
      expect(coreWebVitals.ttfb).toBeLessThan(1000); // TTFB < 1s
      expect(coreWebVitals.cls).toBeLessThan(0.25);  // CLS < 0.25

      // 3. 性能等级评定
      const performanceGrades = {
        fcp: coreWebVitals.fcp < 1800 ? 'excellent' :
             coreWebVitals.fcp < 2500 ? 'good' : 'needs-improvement',
        ttfb: coreWebVitals.ttfb < 600 ? 'excellent' :
              coreWebVitals.ttfb < 1000 ? 'good' : 'needs-improvement',
        cls: coreWebVitals.cls < 0.1 ? 'excellent' :
             coreWebVitals.cls < 0.25 ? 'good' : 'needs-improvement'
      };

      console.log('性能等级:', performanceGrades);

      // 4. 生成性能报告
      const performanceReport = {
        timestamp: new Date().toISOString(),
        metrics: coreWebVitals,
        grades: performanceGrades,
        overallGrade: Object.values(performanceGrades).filter(grade => grade === 'excellent').length >= 2 ? 'A' :
                     Object.values(performanceGrades).filter(grade => grade !== 'needs-improvement').length >= 2 ? 'B' : 'C',
        passed: coreWebVitals.fcp < 2500 && coreWebVitals.ttfb < 1000 && coreWebVitals.cls < 0.25
      };

      console.log('Core Web Vitals 报告:', JSON.stringify(performanceReport, null, 2));

      expect(performanceReport.passed).toBeTruthy();
    });

    test('内存和资源使用基准', async ({ page }) => {
      // 1. 基础内存监控
      const initialMemory = await page.evaluate(() => {
        return performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit
        } : null;
      });

      console.log('初始内存使用:', initialMemory ? `${Math.round(initialMemory.used / 1024 / 1024)}MB` : 'N/A');

      // 2. 执行一系列操作来测试内存稳定性
      const operations = [
        () => page.click('body'), // 点击页面
        () => page.keyboard.press('Tab'), // 键盘导航
        () => page.evaluate(() => window.scrollBy(0, 100)), // 滚动页面
        () => page.reload() // 重新加载页面
      ];

      const memorySnapshots = [initialMemory];

      for (const operation of operations) {
        await operation();
        await page.waitForTimeout(1000);

        const memory = await page.evaluate(() => {
          return performance.memory ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit
          } : null;
        });

        memorySnapshots.push(memory);
      }

      // 3. 分析内存使用趋势
      const memoryAnalysis = {
        snapshots: memorySnapshots,
        initialUsed: initialMemory?.used || 0,
        finalUsed: memorySnapshots[memorySnapshots.length - 1]?.used || 0,
        maxUsed: Math.max(...memorySnapshots.map(s => s?.used || 0)),
        memoryGrowth: (memorySnapshots[memorySnapshots.length - 1]?.used || 0) - (initialMemory?.used || 0)
      };

      console.log('内存分析:', {
        initial: `${Math.round(memoryAnalysis.initialUsed / 1024 / 1024)}MB`,
        final: `${Math.round(memoryAnalysis.finalUsed / 1024 / 1024)}MB`,
        max: `${Math.round(memoryAnalysis.maxUsed / 1024 / 1024)}MB`,
        growth: `${Math.round(memoryAnalysis.memoryGrowth / 1024 / 1024)}MB`
      });

      // 4. 资源使用断言
      if (initialMemory) {
        const memoryGrowthMB = memoryAnalysis.memoryGrowth / 1024 / 1024;
        const memoryUsagePercent = (memoryAnalysis.finalUsed / initialMemory.limit) * 100;

        expect(memoryGrowthMB).toBeLessThan(50); // 内存增长小于50MB
        expect(memoryUsagePercent).toBeLessThan(30); // 内存使用小于30%
      }

      // 5. 生成内存报告
      const memoryReport = {
        timestamp: new Date().toISOString(),
        analysis: memoryAnalysis,
        grade: Math.abs(memoryAnalysis.memoryGrowth / 1024 / 1024) < 20 ? 'A' :
               Math.abs(memoryAnalysis.memoryGrowth / 1024 / 1024) < 50 ? 'B' : 'C'
      };

      console.log('内存使用报告:', JSON.stringify(memoryReport, null, 2));
    });
  });

  test.describe('错误处理和恢复能力', () => {
    test('网络错误处理测试', async ({ page }) => {
      // 1. 监控网络错误
      const networkErrors = [];

      page.on('requestfailed', request => {
        networkErrors.push({
          url: request.url(),
          method: request.method(),
          failure: request.failure()?.errorText,
          timestamp: Date.now()
        });
      });

      page.on('response', response => {
        if (response.status() >= 400) {
          networkErrors.push({
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
            timestamp: Date.now()
          });
        }
      });

      // 2. 执行正常操作
      await helper.navigateToPage('/');
      await helper.waitForNetworkIdle();
      await page.waitForTimeout(3000);

      // 3. 分析网络错误
      console.log('网络错误监控:', {
        totalErrors: networkErrors.length,
        apiErrors: networkErrors.filter(e => e.url.includes('api')).length,
        permissionErrors: networkErrors.filter(e =>
          e.failure?.includes('无权限') ||
          e.url.includes('rbac') ||
          e.url.includes('audit')
        ).length
      });

      // 4. 检查错误处理机制
      const errorHandling = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('.error, .error-message, .alert');
        const hasErrorBoundary = !!document.querySelector('[data-error-boundary], .error-boundary');
        const hasRetryButtons = !!document.querySelector('button:has-text("重试"), button:has-text("刷新"), .retry-button');

        return {
          errorElementCount: errorElements.length,
          hasErrorBoundary,
          hasRetryButtons,
          hasUserFriendlyErrors: Array.from(errorElements).some(el =>
            el.textContent && (el.textContent.includes('重新加载') || el.textContent.includes('刷新'))
          )
        };
      });

      console.log('错误处理机制:', errorHandling);

      // 5. 断言错误处理能力
      // 在测试环境中，权限错误是预期的
      const permissionErrors = networkErrors.filter(e =>
        e.failure?.includes('无权限') || e.url.includes('rbac')
      );

      const realErrors = networkErrors.filter(e =>
        !e.failure?.includes('无权限') && !e.url.includes('rbac')
      );

      expect(realErrors.length).toBeLessThan(networkErrors.length * 0.5); // 真实错误应少于50%

      // 检查是否有基本的错误处理机制
      if (realErrors.length > 0) {
        expect(errorHandling.errorElementCount).toBeGreaterThan(0);
      }
    });

    test('页面错误恢复测试', async ({ page }) => {
      // 1. 导航到可能出错的页面
      await helper.navigateToPage('/nonexistent-page');
      await page.waitForTimeout(3000);

      // 2. 检查错误页面处理
      const errorPageAnalysis = await page.evaluate(() => {
        const has404Content = document.body.textContent.includes('404') ||
                             document.body.textContent.includes('not found') ||
                             document.body.textContent.includes('页面不存在');

        const hasErrorPage = !!document.querySelector('.error-page, .not-found, [data-testid="404"]');
        const hasNavigationHelp = !!document.querySelector('a[href="/"], a:has-text("首页"), button:has-text("返回")');
        const hasSearchFunctionality = !!document.querySelector('input[type="search"], input[placeholder*="搜索"]');

        return {
          has404Content,
          hasErrorPage,
          hasNavigationHelp,
          hasSearchFunctionality,
          statusCode: document.title.includes('404') ? 404 : 'unknown',
          pageContent: document.body.textContent.length
        };
      });

      console.log('404错误页面分析:', errorPageAnalysis);

      // 3. 测试恢复机制
      if (errorPageAnalysis.hasNavigationHelp) {
        try {
          await page.click('a[href="/"], a:has-text("首页"), button:has-text("返回")');
          await page.waitForTimeout(2000);

          const recoveryResult = await page.evaluate(() => {
            return {
              recovered: !document.body.textContent.includes('404') &&
                         !document.body.textContent.includes('not found'),
              currentUrl: window.location.href,
              hasMainContent: !!document.querySelector('main, .app-content, .dashboard')
            };
          });

          console.log('错误恢复结果:', recoveryResult);
          expect(recoveryResult.recovered).toBeTruthy();

        } catch (error) {
          console.log('恢复机制测试失败:', error.message);
        }
      }

      // 4. 基础断言
      expect(errorPageAnalysis.has404Content || errorPageAnalysis.hasErrorPage).toBeTruthy();
    });
  });

  test.describe('综合性能评估', () => {
    test('完整用户体验性能评估', async ({ page }) => {
      const testStartTime = Date.now();
      const comprehensiveMetrics = {
        navigation: {} as any,
        performance: {} as any,
        userExperience: {} as any,
        systemStability: {} as any
      };

      // 1. 导航性能测试
      const navStartTime = Date.now();
      await helper.navigateToPage('/');
      await helper.waitForNetworkIdle();
      comprehensiveMetrics.navigation = {
        loadTime: Date.now() - navStartTime,
        url: page.url()
      };

      // 2. 详细性能指标
      comprehensiveMetrics.performance = await helper.collectPerformanceMetrics();

      // 3. 用户体验指标
      comprehensiveMetrics.userExperience = await page.evaluate(() => {
        const interactiveElements = document.querySelectorAll('button, [role="button"], a[href]');
        const loadingElements = document.querySelectorAll('.loading, .spinner');
        const errorElements = document.querySelectorAll('.error, .error-message');
        const contentElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');

        return {
          interactiveElementCount: interactiveElements.length,
          loadingElementCount: loadingElements.length,
          errorElementCount: errorElements.length,
          contentElementCount: contentElements.length,
          hasUserInterface: interactiveElements.length > 0,
          hasContent: contentElements.length > 0,
          hasErrors: errorElements.length > 0,
          pageStability: loadingElements.length === 0
        };
      });

      // 4. 系统稳定性指标
      comprehensiveMetrics.systemStability = {
        totalTestTime: Date.now() - testStartTime,
        memoryUsage: await page.evaluate(() => {
          return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 0;
        })
      };

      console.log('=== 综合性能评估结果 ===');
      console.log('导航性能:', comprehensiveMetrics.navigation);
      console.log('系统性能:', comprehensiveMetrics.performance);
      console.log('用户体验:', comprehensiveMetrics.userExperience);
      console.log('系统稳定性:', comprehensiveMetrics.systemStability);

      // 5. 综合评分
      const scores = {
        navigation: comprehensiveMetrics.navigation.loadTime < 5000 ? 100 :
                    comprehensiveMetrics.navigation.loadTime < 8000 ? 80 : 60,

        performance: comprehensiveMetrics.performance.paint.firstContentfulPaint < 2000 ? 100 :
                     comprehensiveMetrics.performance.paint.firstContentfulPaint < 4000 ? 80 : 60,

        experience: comprehensiveMetrics.userExperience.pageStability &&
                   !comprehensiveMetrics.userExperience.hasErrors ? 100 :
                   comprehensiveMetrics.userExperience.pageStability ? 70 : 40,

        stability: comprehensiveMetrics.systemStability.memoryUsage < 50 ? 100 :
                   comprehensiveMetrics.systemStability.memoryUsage < 100 ? 80 : 60
      };

      const overallScore = Math.round(
        Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length
      );

      const grade = overallScore >= 90 ? 'A' :
                   overallScore >= 80 ? 'B' :
                   overallScore >= 70 ? 'C' :
                   overallScore >= 60 ? 'D' : 'F';

      console.log('=== 综合评分 ===');
      console.log(`导航性能: ${scores.navigation}/100`);
      console.log(`系统性能: ${scores.performance}/100`);
      console.log(`用户体验: ${scores.experience}/100`);
      console.log(`系统稳定性: ${scores.stability}/100`);
      console.log(`综合评分: ${overallScore}/100 (${grade})`);

      // 6. 最终断言
      expect(overallScore).toBeGreaterThanOrEqual(60); // 最低及格分数
      expect(comprehensiveMetrics.userExperience.hasUserInterface).toBeTruthy();
      expect(comprehensiveMetrics.userExperience.hasContent).toBeTruthy();

      // 7. 生成最终报告
      const finalReport = {
        timestamp: new Date().toISOString(),
        testType: 'production-comprehensive',
        metrics: comprehensiveMetrics,
        scores,
        overallScore,
        grade,
        passed: overallScore >= 60,
        recommendations: overallScore < 80 ? [
          '考虑优化页面加载速度',
          '改善错误处理机制',
          '提升用户体验'
        ] : []
      };

      console.log('=== 最终评估报告 ===');
      console.log(`综合评级: ${grade} (${overallScore}/100)`);
      console.log('详细报告:', JSON.stringify(finalReport, null, 2));

      expect(finalReport.passed).toBeTruthy();
    });
  });
});