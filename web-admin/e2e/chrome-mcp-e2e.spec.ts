/**
 * 基于 Chrome MCP Server 的 Web Admin E2E 测试套件
 * 利用 chrome-mcp-stdio 提供的强大浏览器自动化功能
 *
 * 主要功能：
 * 1. 智能页面内容分析和验证
 * 2. 网络请求监控和调试
 * 3. 语义搜索和内容提取
 * 4. 高级截图和视觉验证
 * 5. 性能监控和分析
 */

import { test, expect } from './fixtures/chrome-mcp-fixture';

test.describe('Web Admin Chrome MCP E2E 测试套件', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 启动网络监控
    await chromeMCP.startNetworkCapture({
      maxCaptureTime: 60000, // 1分钟
      captureRequestBody: true,
      captureResponseBody: true
    });

    // 设置视口
    await chromeMCP.setViewport({
      width: 1920,
      height: 1080
    });
  });

  test.afterEach(async ({ chromeMCP }) => {
    // 停止网络监控并获取数据
    const networkData = await chromeMCP.stopNetworkCapture();
    console.log('网络请求数据:', networkData);

    // 获取控制台日志
    const consoleLogs = await chromeMCP.getConsoleMessages(['error', 'warning']);
    if (consoleLogs.length > 0) {
      console.warn('控制台错误/警告:', consoleLogs);
    }
  });

  test.describe('🔐 登录认证流程', () => {

    test('扫码登录完整流程', async ({ chromeMCP }) => {
      // 导航到登录页
      await chromeMCP.navigate('http://localhost:4174/login');

      // 验证页面加载完成
      const pageTitle = await chromeMCP.getPageTitle();
      expect(pageTitle).toContain('登录');

      // 分析登录页面结构
      const pageContent = await chromeMCP.getWebContent();
      const loginElements = await chromeMCP.getInteractiveElements();

      // 验证关键元素存在
      const hasQRCode = loginElements.some(el =>
        el.selector.includes('qrcode') || el.textContent.includes('二维码')
      );
      const hasRoleSelector = loginElements.some(el =>
        el.selector.includes('role') || el.textContent.includes('角色')
      );

      expect(hasQRCode).toBeTruthy();
      expect(hasRoleSelector).toBeTruthy();

      // 模拟扫码登录（通过直接设置登录状态）
      await chromeMCP.injectScript(`
        // 模拟登录成功状态
        localStorage.setItem('userToken', 'mock-test-token');
        localStorage.setItem('userInfo', JSON.stringify({
          roles: ['admin'],
          username: 'test-admin',
          openId: 'test-openid'
        }));

        // 触发登录成功事件
        window.dispatchEvent(new CustomEvent('login-success'));
      `);

      // 验证登录成功跳转
      await chromeMCP.waitForNavigation('dashboard');
      const currentUrl = await chromeMCP.getCurrentUrl();
      expect(currentUrl).toContain('/dashboard');

      // 截图保存登录状态
      await chromeMCP.takeScreenshot({
        fullPage: true,
        filename: 'login-success-dashboard'
      });
    });

    test('权限控制验证', async ({ chromeMCP }) => {
      // 直接访问需要权限的页面
      await chromeMCP.navigate('http://localhost:4174/users');

      // 验证重定向到登录页
      const currentUrl = await chromeMCP.getCurrentUrl();
      expect(currentUrl).toContain('/login');

      // 获取页面内容分析权限提示
      const pageContent = await chromeMCP.getWebContent();
      const hasPermissionMessage = pageContent.textContent.includes('权限') ||
                                 pageContent.textContent.includes('登录');

      expect(hasPermissionMessage).toBeTruthy();
    });
  });

  test.describe('👥 患者管理核心功能', () => {

    test.beforeEach(async ({ chromeMCP }) => {
      // 模拟登录状态
      await chromeMCP.navigate('http://localhost:4174/login');
      await chromeMCP.injectScript(`
        localStorage.setItem('userToken', 'mock-test-token');
        localStorage.setItem('userInfo', JSON.stringify({
          roles: ['admin'],
          username: 'test-admin'
        }));
      `);
      await chromeMCP.navigate('http://localhost:4174/patients');
    });

    test('患者列表搜索和筛选功能', async ({ chromeMCP }) => {
      // 等待患者列表加载
      await chromeMCP.waitForElement('[data-testid="patient-list"]');

      // 获取可交互元素
      const interactiveElements = await chromeMCP.getInteractiveElements();

      // 查找搜索框
      const searchInput = interactiveElements.find(el =>
        el.tagName === 'INPUT' && el.placeholder?.includes('搜索')
      );

      if (searchInput) {
        // 执行搜索操作
        await chromeMCP.clickElement(searchInput.selector);
        await chromeMCP.typeText(searchInput.selector, '测试患者');
        await chromeMCP.pressKey('Enter');

        // 等待搜索结果
        await chromeMCP.waitForTimeout(2000);

        // 验证搜索结果
        const searchResults = await chromeMCP.getWebContent();
        const hasSearchResults = searchResults.textContent.includes('测试患者') ||
                               searchResults.textContent.includes('无结果');

        expect(hasSearchResults).toBeTruthy();
      }

      // 查找高级筛选按钮
      const filterButton = interactiveElements.find(el =>
        el.textContent.includes('筛选') || el.textContent.includes('高级')
      );

      if (filterButton) {
        await chromeMCP.clickElement(filterButton.selector);

        // 验证筛选面板展开
        const filterPanel = await chromeMCP.findElement('.filter-panel, .advanced-filters');
        expect(filterPanel).toBeTruthy();
      }

      // 截图保存搜索状态
      await chromeMCP.takeScreenshot({
        filename: 'patient-search-filters'
      });
    });

    test('患者状态批量操作', async ({ chromeMCP }) => {
      // 等待患者列表加载
      await chromeMCP.waitForElement('[data-testid="patient-list"]');

      // 查找选择框
      const checkboxes = await chromeMCP.findElements('input[type="checkbox"]');

      if (checkboxes.length > 0) {
        // 选择前几个患者
        for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
          await chromeMCP.clickElement(checkboxes[i].selector);
        }

        // 查找批量操作按钮
        const batchActions = await chromeMCP.findElements('[data-testid="batch-action"]');

        if (batchActions.length > 0) {
          // 测试批量导出
          const exportButton = batchActions.find(el =>
            el.textContent.includes('导出')
          );

          if (exportButton) {
            await chromeMCP.clickElement(exportButton.selector);

            // 监控下载请求
            const networkRequests = await chromeMCP.getNetworkRequests();
            const downloadRequest = networkRequests.find(req =>
              req.url.includes('export') || req.url.includes('download')
            );

            expect(downloadRequest).toBeTruthy();
          }
        }
      }

      // 截图保存批量操作状态
      await chromeMCP.takeScreenshot({
        filename: 'patient-batch-actions'
      });
    });

    test('患者详情查看和编辑', async ({ chromeMCP }) => {
      // 等待患者列表加载
      await chromeMCP.waitForElement('[data-testid="patient-list"]');

      // 查找第一个患者项
      const firstPatient = await chromeMCP.findElement('[data-testid="patient-item"]');

      if (firstPatient) {
        // 点击进入患者详情
        await chromeMCP.clickElement(firstPatient.selector);

        // 验证详情页加载
        await chromeMCP.waitForElement('[data-testid="patient-detail"]');

        // 获取患者详情内容
        const detailContent = await chromeMCP.getWebContent();

        // 验证关键信息字段
        const hasBasicInfo = detailContent.textContent.includes('基本信息') ||
                            detailContent.textContent.includes('姓名') ||
                            detailContent.textContent.includes('年龄');

        const hasMedicalInfo = detailContent.textContent.includes('医疗') ||
                              detailContent.textContent.includes('诊断') ||
                              detailContent.textContent.includes('治疗方案');

        expect(hasBasicInfo).toBeTruthy();
        expect(hasMedicalInfo).toBeTruthy();

        // 查找编辑按钮
        const editButton = await chromeMCP.findElement('button[aria-label*="编辑"], button:has-text("编辑")');

        if (editButton) {
          await chromeMCP.clickElement(editButton.selector);

          // 验证编辑模式
          await chromeMCP.waitForElement('input[readonly="false"], input:not([readonly])');

          // 测试字段编辑
          const nameInput = await chromeMCP.findElement('input[name*="name"], input[placeholder*="姓名"]');

          if (nameInput) {
            await chromeMCP.clearText(nameInput.selector);
            await chromeMCP.typeText(nameInput.selector, '编辑测试姓名');

            // 查找保存按钮
            const saveButton = await chromeMCP.findElement('button:has-text("保存")');

            if (saveButton) {
              await chromeMCP.clickElement(saveButton.selector);

              // 验证保存成功提示
              const successMessage = await chromeMCP.findElement('.success-message, .toast-success');
              expect(successMessage).toBeTruthy();
            }
          }
        }

        // 截图保存患者详情
        await chromeMCP.takeScreenshot({
          filename: 'patient-detail-edit'
        });
      }
    });
  });

  test.describe('📊 数据分析和报表功能', () => {

    test.beforeEach(async ({ chromeMCP }) => {
      // 模拟登录并导航到分析页面
      await chromeMCP.navigate('http://localhost:4174/login');
      await chromeMCP.injectScript(`
        localStorage.setItem('userToken', 'mock-test-token');
        localStorage.setItem('userInfo', JSON.stringify({
          roles: ['social_worker'],
          username: 'test-social-worker'
        }));
      `);
      await chromeMCP.navigate('http://localhost:4174/analysis');
    });

    test('统计数据展示', async ({ chromeMCP }) => {
      // 等待分析页面加载
      await chromeMCP.waitForElement('[data-testid="analysis-dashboard"]');

      // 获取页面内容进行语义分析
      const pageContent = await chromeMCP.getWebContent();

      // 验证统计卡片存在
      const hasStatCards = pageContent.textContent.includes('总数') ||
                          pageContent.textContent.includes('统计') ||
                          pageContent.textContent.includes('概览');

      expect(hasStatCards).toBeTruthy();

      // 查找图表元素
      const charts = await chromeMCP.findElements('canvas, .chart-container, [data-testid="chart"]');

      if (charts.length > 0) {
        // 验证图表渲染
        const chartContent = await chromeMCP.getElementContent(charts[0].selector);
        expect(chartContent).toBeTruthy();

        // 截图保存图表状态
        await chromeMCP.takeScreenshot({
          element: charts[0].selector,
          filename: 'analysis-chart'
        });
      }

      // 查找时间筛选器
      const timeFilter = await chromeMCP.findElement('[data-testid="time-filter"], .date-range');

      if (timeFilter) {
        // 测试时间筛选
        await chromeMCP.clickElement(timeFilter.selector);

        // 选择最近7天
        const recentDaysOption = await chromeMCP.findElement(':has-text("最近7天"), :has-text("7天")');

        if (recentDaysOption) {
          await chromeMCP.clickElement(recentDaysOption.selector);

          // 等待数据更新
          await chromeMCP.waitForTimeout(3000);

          // 验证数据更新
          const updatedContent = await chromeMCP.getWebContent();
          const hasUpdatedData = updatedContent.textContent.includes('最近7天') ||
                               updatedContent.textContent.includes('7天');

          expect(hasUpdatedData).toBeTruthy();
        }
      }

      // 截图保存完整分析页面
      await chromeMCP.takeScreenshot({
        fullPage: true,
        filename: 'analysis-dashboard'
      });
    });

    test('报表导出功能', async ({ chromeMCP }) => {
      // 等待页面加载
      await chromeMCP.waitForElement('[data-testid="analysis-dashboard"]');

      // 查找导出按钮
      const exportButtons = await chromeMCP.findElements('button:has-text("导出"), [data-testid="export"]');

      if (exportButtons.length > 0) {
        await chromeMCP.clickElement(exportButtons[0].selector);

        // 查找导出选项
        const exportOptions = await chromeMCP.findElements('.export-option, .modal-content');

        if (exportOptions.length > 0) {
          // 选择Excel导出
          const excelOption = exportOptions.find(option =>
            option.textContent.includes('Excel') || option.textContent.includes('xlsx')
          );

          if (excelOption) {
            await chromeMCP.clickElement(excelOption.selector);

            // 监控网络请求，确认导出请求
            const networkRequests = await chromeMCP.getNetworkRequests();
            const exportRequest = networkRequests.find(req =>
              req.url.includes('export') && req.url.includes('excel')
            );

            expect(exportRequest).toBeTruthy();
          }
        }
      }

      // 截图保存导出操作
      await chromeMCP.takeScreenshot({
        filename: 'analysis-export'
      });
    });
  });

  test.describe('🔧 权限管理和用户控制', () => {

    test('用户管理（仅管理员）', async ({ chromeMCP }) => {
      // 管理员登录
      await chromeMCP.navigate('http://localhost:4174/login');
      await chromeMCP.injectScript(`
        localStorage.setItem('userToken', 'mock-admin-token');
        localStorage.setItem('userInfo', JSON.stringify({
          roles: ['admin'],
          username: 'test-admin',
          permissions: ['user_manage', 'role_assign']
        }));
      `);

      // 访问用户管理页面
      await chromeMCP.navigate('http://localhost:4174/users');

      // 验证页面加载成功
      await chromeMCP.waitForElement('[data-testid="users-list"]');

      // 获取用户列表内容
      const pageContent = await chromeMCP.getWebContent();

      // 验证用户列表存在
      const hasUserList = pageContent.textContent.includes('用户') ||
                         pageContent.textContent.includes('管理员') ||
                         pageContent.textContent.includes('社工');

      expect(hasUserList).toBeTruthy();

      // 查找创建用户按钮
      const createButton = await chromeMCP.findElement('button:has-text("创建"), button:has-text("新增用户")');

      if (createButton) {
        await chromeMCP.clickElement(createButton.selector);

        // 验证创建用户模态框
        const modal = await chromeMCP.findElement('.modal, .dialog, [data-testid="create-user-modal"]');
        expect(modal).toBeTruthy();

        // 截图保存创建用户界面
        await chromeMCP.takeScreenshot({
          filename: 'create-user-modal'
        });
      }

      // 测试用户状态切换
      const userItems = await chromeMCP.findElements('[data-testid="user-item"]');

      if (userItems.length > 0) {
        const firstUser = userItems[0];

        // 查找状态切换按钮
        const statusButton = await chromeMCP.findElementWithin(firstUser.selector, 'button[title*="状态"], .status-toggle');

        if (statusButton) {
          await chromeMCP.clickElement(statusButton.selector);

          // 验证状态更新
          await chromeMCP.waitForTimeout(1000);
          const updatedUser = await chromeMCP.getElementContent(firstUser.selector);

          // 截图保存状态更新
          await chromeMCP.takeScreenshot({
            filename: 'user-status-toggle'
          });
        }
      }
    });

    test('角色权限验证', async ({ chromeMCP }) => {
      // 不同角色登录测试权限
      const roles = ['social_worker', 'volunteer', 'parent'];

      for (const role of roles) {
        // 清除登录状态
        await chromeMCP.injectScript('localStorage.clear();');

        // 模拟特定角色登录
        await chromeMCP.navigate('http://localhost:4174/login');
        await chromeMCP.injectScript(`
          localStorage.setItem('userToken', 'mock-${role}-token');
          localStorage.setItem('userInfo', JSON.stringify({
            roles: ['${role}'],
            username: 'test-${role}'
          }));
        `);

        // 测试访问管理员页面
        await chromeMCP.navigate('http://localhost:4174/users');

        // 获取当前页面内容
        const pageContent = await chromeMCP.getWebContent();

        // 验证权限提示或重定向
        const hasPermissionDenied = pageContent.textContent.includes('权限') ||
                                  pageContent.textContent.includes('访问') ||
                                  pageContent.textContent.includes('登录');

        expect(hasPermissionDenied).toBeTruthy();

        // 截图保存权限验证
        await chromeMCP.takeScreenshot({
          filename: `permission-denied-${role}`
        });
      }
    });
  });

  test.describe('📱 响应式设计和用户体验', () => {

    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    viewports.forEach(({ width, height, name }) => {
      test(`${name} 响应式布局测试`, async ({ chromeMCP }) => {
        // 设置视口
        await chromeMCP.setViewport({ width, height });

        // 模拟登录
        await chromeMCP.navigate('http://localhost:4174/login');
        await chromeMCP.injectScript(`
          localStorage.setItem('userToken', 'mock-test-token');
          localStorage.setItem('userInfo', JSON.stringify({
            roles: ['admin'],
            username: 'test-admin'
          }));
        `);

        // 测试首页响应式
        await chromeMCP.navigate('http://localhost:4174/dashboard');

        // 等待页面加载
        await chromeMCP.waitForElement('[data-testid="dashboard"]');

        // 分析页面布局
        const pageContent = await chromeMCP.getWebContent();

        // 验证关键元素在当前视口下可见
        const hasNavigation = pageContent.textContent.includes('导航') ||
                            pageContent.querySelector('nav, .navbar, .sidebar');

        const hasMainContent = pageContent.textContent.includes('概览') ||
                             pageContent.querySelector('main, .main-content');

        expect(hasNavigation).toBeTruthy();
        expect(hasMainContent).toBeTruthy();

        // 截图保存响应式布局
        await chromeMCP.takeScreenshot({
          fullPage: true,
          filename: `responsive-${name}`
        });

        // 测试患者列表页面的响应式
        await chromeMCP.navigate('http://localhost:4174/patients');
        await chromeMCP.waitForElement('[data-testid="patient-list"]');

        // 截图保存患者列表响应式
        await chromeMCP.takeScreenshot({
          fullPage: true,
          filename: `patients-responsive-${name}`
        });
      });
    });
  });

  test.describe('🔍 性能和错误处理', () => {

    test('页面加载性能测试', async ({ chromeMCP }) => {
      // 开始性能监控
      await chromeMCP.startPerformanceTrace({
        reload: true,
        autoStop: true
      });

      // 导航到首页
      await chromeMCP.navigate('http://localhost:4174');

      // 等待性能分析完成
      await chromeMCP.waitForTimeout(5000);

      // 获取性能指标
      const performanceData = await chromeMCP.getPerformanceMetrics();

      // 验证关键性能指标
      if (performanceData) {
        // Core Web Vitals 检查
        if (performanceData.lcp) {
          expect(performanceData.lcp).toBeLessThan(2500); // LCP < 2.5s
        }

        if (performanceData.fid) {
          expect(performanceData.fid).toBeLessThan(100); // FID < 100ms
        }

        if (performanceData.cls) {
          expect(performanceData.cls).toBeLessThan(0.1); // CLS < 0.1
        }
      }

      // 截图保存性能状态
      await chromeMCP.takeScreenshot({
        filename: 'performance-test'
      });
    });

    test('网络错误处理测试', async ({ chromeMCP }) => {
      // 模拟网络断开
      await chromeMCP.emulateNetwork('Offline');

      // 尝试访问需要API的页面
      await chromeMCP.navigate('http://localhost:4174/patients');

      // 等待错误处理
      await chromeMCP.waitForTimeout(3000);

      // 获取页面内容
      const pageContent = await chromeMCP.getWebContent();

      // 验证错误提示
      const hasErrorMessage = pageContent.textContent.includes('网络') ||
                            pageContent.textContent.includes('连接') ||
                            pageContent.textContent.includes('错误') ||
                            pageContent.textContent.includes('重试');

      expect(hasErrorMessage).toBeTruthy();

      // 截图保存网络错误状态
      await chromeMCP.takeScreenshot({
        filename: 'network-error'
      });

      // 恢复网络连接
      await chromeMCP.emulateNetwork('No emulation');

      // 测试重试功能
      const retryButton = await chromeMCP.findElement('button:has-text("重试"), button:has-text("刷新")');

      if (retryButton) {
        await chromeMCP.clickElement(retryButton.selector);

        // 等待重试完成
        await chromeMCP.waitForTimeout(5000);

        // 验证页面恢复
        const recoveredContent = await chromeMCP.getWebContent();
        const hasRecovered = !recoveredContent.textContent.includes('网络错误') &&
                           !recoveredContent.textContent.includes('连接失败');

        expect(hasRecovered).toBeTruthy();

        // 截图保存恢复状态
        await chromeMCP.takeScreenshot({
          filename: 'network-recovered'
        });
      }
    });

    test('大数据量加载测试', async ({ chromeMCP }) => {
      // 模拟大数据量场景
      await chromeMCP.navigate('http://localhost:4174/login');
      await chromeMCP.injectScript(`
        localStorage.setItem('userToken', 'mock-test-token');
        localStorage.setItem('userInfo', JSON.stringify({
          roles: ['admin'],
          username: 'test-admin'
        }));
      `);

      // 导航到患者列表
      await chromeMCP.navigate('http://localhost:4174/patients');

      // 开始性能监控
      const startTime = Date.now();

      // 等待页面完全加载
      await chromeMCP.waitForElement('[data-testid="patient-list"]');
      await chromeMCP.waitForTimeout(3000); // 额外等待数据加载

      const loadTime = Date.now() - startTime;

      // 验证加载时间合理
      expect(loadTime).toBeLessThan(10000); // 10秒内加载完成

      // 测试滚动性能
      await chromeMCP.evaluateScript(`
        window.scrollTo(0, document.body.scrollHeight / 2);
      `);

      // 等待滚动完成
      await chromeMCP.waitForTimeout(2000);

      // 继续滚动到底部
      await chromeMCP.evaluateScript(`
        window.scrollTo(0, document.body.scrollHeight);
      `);

      await chromeMCP.waitForTimeout(2000);

      // 截图保存大数据量测试结果
      await chromeMCP.takeScreenshot({
        fullPage: true,
        filename: 'large-data-test'
      });

      // 获取页面大小信息
      const pageInfo = await chromeMCP.evaluateScript(`
        return {
          totalHeight: document.body.scrollHeight,
          visibleHeight: window.innerHeight,
          elementCount: document.querySelectorAll('*').length
        };
      `);

      console.log('页面信息:', pageInfo);

      // 验证页面渲染正常
      expect(pageInfo.totalHeight).toBeGreaterThan(1000);
      expect(pageInfo.elementCount).toBeGreaterThan(100);
    });
  });
});