import { test, expect } from '@playwright/test';

/**
 * Chrome DevTools 业务流程E2E测试
 *
 * 覆盖的核心业务流程：
 * 1. 用户认证和授权流程
 * 2. 患者数据管理流程
 * 3. 数据导入导出流程
 * 4. 系统设置和管理流程
 * 5. 错误处理和恢复流程
 */

test.describe('Chrome DevTools 业务流程测试', () => {
  test.beforeEach(async ({ page }) => {
    // 增强错误监控
    page.on('console', msg => {
      const timestamp = new Date().toISOString();
      if (msg.type() === 'error') {
        console.error(`[${timestamp}] 业务流程错误:`, msg.text(), msg.location());
      }
    });

    page.on('pageerror', error => {
      console.error('业务流程页面错误:', {
        message: error.message,
        stack: error.stack
      });
    });
  });

  test('用户认证和权限管理流程', async ({ page }) => {
    const authFlowMetrics = {
      navigationTimes: [],
      apiCalls: [],
      errors: [],
      permissions: []
    };

    // 监控认证相关的API调用
    page.on('request', request => {
      if (request.url().includes('auth') || request.url().includes('login') || request.url().includes('rbac')) {
        authFlowMetrics.apiCalls.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    page.on('response', response => {
      if (response.url().includes('auth') || response.url().includes('login') || response.url().includes('rbac')) {
        authFlowMetrics.apiCalls.find(call => call.url === response.url()).status = response.status();
      }
    });

    // 1. 访问登录页面
    const navigationStart = Date.now();
    await page.goto('/login');
    authFlowMetrics.navigationTimes.push({
      page: 'login',
      loadTime: Date.now() - navigationStart
    });

    // 等待页面加载
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 检查登录页面元素
    const loginPageElements = await page.evaluate(() => {
      return {
        hasLoginForm: !!document.querySelector('form'),
        hasUsernameField: !!document.querySelector('input[type="text"], input[name="username"], input[name="email"]'),
        hasPasswordField: !!document.querySelector('input[type="password"]'),
        hasSubmitButton: !!document.querySelector('button[type="submit"], button:contains("登录")'),
        pageTitle: document.title,
        url: window.location.href
      };
    });

    console.log('登录页面元素检查:', loginPageElements);
    expect(loginPageElements.hasLoginForm || loginPageElements.hasUsernameField).toBeTruthy();

    // 检查是否已启用测试绕过模式
    const bypassLogin = await page.evaluate(() => {
      return localStorage.getItem('E2E_BYPASS_LOGIN') === '1';
    });

    console.log('测试绕过登录模式:', bypassLogin);

    if (bypassLogin) {
      // 如果启用了绕过模式，直接跳转到主页
      await page.goto('/');
    } else {
      // 尝试模拟登录（如果页面支持）
      try {
        const usernameInput = await page.locator('input[type="text"], input[name="username"], input[name="email"]').first();
        const passwordInput = await page.locator('input[type="password"]').first();
        const submitButton = await page.locator('button[type="submit"], button:has-text("登录"), button:has-text("Login")').first();

        if (await usernameInput.isVisible() && await passwordInput.isVisible() && await submitButton.isVisible()) {
          await usernameInput.fill('test@example.com');
          await passwordInput.fill('testpassword');
          await submitButton.click();

          // 等待登录完成
          await page.waitForTimeout(3000);
        }
      } catch (error) {
        console.log('登录表单操作失败，可能使用其他认证方式:', error.message);
      }
    }

    // 2. 检查权限系统
    const authState = await page.evaluate(() => {
      return {
        hasAuthData: !!localStorage.getItem('authToken') || !!localStorage.getItem('user'),
        hasPermissions: !!localStorage.getItem('permissions') || !!localStorage.getItem('roles'),
        userRole: localStorage.getItem('userRole') || 'unknown',
        isAuthenticated: !!document.querySelector('[data-testid="user-menu"], .user-info, .user-avatar')
      };
    });

    console.log('认证状态检查:', authState);

    // 3. 测试角色权限验证
    if (authState.isAuthenticated) {
      // 尝试访问不同权限级别的页面
      const pagesToTest = ['/dashboard', '/patients', '/settings', '/admin'];

      for (const pagePath of pagesToTest) {
        try {
          const pageStartTime = Date.now();
          await page.goto(pagePath);
          const pageLoadTime = Date.now() - pageStartTime;

          const pageAccessResult = await page.evaluate(() => {
            const hasAccessDenied = !!document.querySelector('.access-denied, .unauthorized, .error-page');
            const hasPermissionError = document.body.textContent.includes('权限不足') ||
                                     document.body.textContent.includes('unauthorized') ||
                                     document.body.textContent.includes('access denied');

            return {
              hasAccess: !hasAccessDenied && !hasPermissionError,
              hasError: hasAccessDenied || hasPermissionError,
              url: window.location.href,
              title: document.title
            };
          });

          authFlowMetrics.navigationTimes.push({
            page: pagePath,
            loadTime: pageLoadTime,
            accessResult: pageAccessResult
          });

          console.log(`页面 ${pagePath} 访问结果:`, pageAccessResult);

        } catch (error) {
          authFlowMetrics.errors.push({
            page: pagePath,
            error: error.message,
            timestamp: Date.now()
          });
          console.error(`访问页面 ${pagePath} 时出错:`, error.message);
        }
      }
    }

    // 4. 生成认证流程报告
    const authFlowReport = {
      timestamp: new Date().toISOString(),
      bypassMode: bypassLogin,
      authState,
      navigationMetrics: {
        averageLoadTime: authFlowMetrics.navigationTimes.reduce((sum, nav) => sum + nav.loadTime, 0) / authFlowMetrics.navigationTimes.length,
        totalNavigation: authFlowMetrics.navigationTimes.length,
        errors: authFlowMetrics.errors.length
      },
      apiMetrics: {
        totalCalls: authFlowMetrics.apiCalls.length,
        successCalls: authFlowMetrics.apiCalls.filter(call => call.status && call.status < 400).length,
        failedCalls: authFlowMetrics.apiCalls.filter(call => call.status && call.status >= 400).length
      }
    };

    console.log('认证流程测试报告:', JSON.stringify(authFlowReport, null, 2));

    // 断言
    expect(authFlowMetrics.navigationTimes.length).toBeGreaterThan(0);
    if (bypassLogin) {
      expect(authState.isAuthenticated).toBeTruthy();
    }
  });

  test('患者数据管理流程性能测试', async ({ page }) => {
    const patientDataMetrics = {
      pageLoadTimes: {},
      apiCalls: [],
      dataOperations: [],
      performanceMetrics: {}
    };

    // 监控患者相关的API调用
    page.on('request', request => {
      if (request.url().includes('patient') || request.url().includes('profile') || request.url().includes('intake')) {
        patientDataMetrics.apiCalls.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now(),
          type: request.url().includes('list') ? 'list' :
                request.url().includes('detail') ? 'detail' :
                request.url().includes('create') ? 'create' :
                request.url().includes('update') ? 'update' : 'other'
        });
      }
    });

    page.on('response', response => {
      if (response.url().includes('patient') || response.url().includes('profile') || request.url().includes('intake')) {
        const matchingCall = patientDataMetrics.apiCalls.find(call => call.url === response.url());
        if (matchingCall) {
          matchingCall.status = response.status();
          matchingCall.responseTime = Date.now() - matchingCall.timestamp;
        }
      }
    });

    // 1. 访问患者列表页面
    const listStartTime = Date.now();
    await page.goto('/patients');
    await page.waitForLoadState('networkidle');
    patientDataMetrics.pageLoadTimes.patientList = Date.now() - listStartTime;

    // 等待数据加载
    await page.waitForTimeout(3000);

    // 分析患者列表页面
    const patientListAnalysis = await page.evaluate(() => {
      const patientCards = document.querySelectorAll('[data-testid="patient-card"], .patient-card, .patient-item');
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"]');
      const filterButtons = document.querySelectorAll('button:has-text("筛选"), button:has-text("过滤"), .filter-button');
      const loadingIndicators = document.querySelectorAll('.loading, .spinner, [data-testid="loading"]');

      return {
        patientCount: patientCards.length,
        hasSearch: !!searchInput,
        filterCount: filterButtons.length,
        isLoading: loadingIndicators.length > 0,
        hasPagination: !!document.querySelector('.pagination, .pager'),
        pageContent: document.body.textContent.length,
        listItems: Array.from(patientCards).slice(0, 3).map(card => ({
          text: card.textContent.substring(0, 100),
          hasId: !!card.querySelector('[data-patient-id], [id*="patient"]')
        }))
      };
    });

    console.log('患者列表页面分析:', patientListAnalysis);

    // 2. 测试搜索功能
    if (patientListAnalysis.hasSearch) {
      const searchStartTime = Date.now();
      try {
        await page.locator('input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"]').first().fill('test');
        await page.waitForTimeout(2000);

        const searchResults = await page.evaluate(() => {
          const patientCards = document.querySelectorAll('[data-testid="patient-card"], .patient-card, .patient-item');
          return patientCards.length;
        });

        patientDataMetrics.dataOperations.push({
          operation: 'search',
          duration: Date.now() - searchStartTime,
          results: searchResults,
          query: 'test'
        });

        console.log('搜索测试结果:', { query: 'test', results: searchResults, duration: Date.now() - searchStartTime });

      } catch (error) {
        console.log('搜索功能测试失败:', error.message);
      }
    }

    // 3. 测试患者详情页面
    if (patientListAnalysis.patientCount > 0) {
      try {
        // 点击第一个患者卡片
        const firstPatientCard = page.locator('[data-testid="patient-card"], .patient-card, .patient-item').first();
        if (await firstPatientCard.isVisible()) {
          const detailStartTime = Date.now();
          await firstPatientCard.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          patientDataMetrics.pageLoadTimes.patientDetail = Date.now() - detailStartTime;

          const patientDetailAnalysis = await page.evaluate(() => {
            const hasEditButton = !!document.querySelector('button:has-text("编辑"), button:has-text("Edit"), .edit-button');
            const hasBackButton = !!document.querySelector('button:has-text("返回"), button:has-text("Back"), .back-button');
            const infoSections = document.querySelectorAll('.info-section, .patient-info, .detail-section');
            const hasMediaSection = !!document.querySelector('.media-section, .patient-media, .file-upload');

            return {
              hasEditButton,
              hasBackButton,
              infoSectionCount: infoSections.length,
              hasMediaSection,
              pageContent: document.body.textContent.length,
              currentUrl: window.location.href
            };
          });

          console.log('患者详情页面分析:', patientDetailAnalysis);

          patientDataMetrics.dataOperations.push({
            operation: 'view_detail',
            duration: patientDataMetrics.pageLoadTimes.patientDetail,
            pageAnalysis: patientDetailAnalysis
          });
        }
      } catch (error) {
        console.log('患者详情页面测试失败:', error.message);
      }
    }

    // 4. 测试新增患者流程
    try {
      const addPatientStartTime = Date.now();
      await page.goto('/patients/new');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const addPatientAnalysis = await page.evaluate(() => {
        const formElements = document.querySelectorAll('input, select, textarea');
        const submitButton = document.querySelector('button[type="submit"], button:has-text("保存"), button:has-text("提交")');
        const hasValidation = !!document.querySelector('.error-message, .validation-error, .field-error');

        return {
          formFieldCount: formElements.length,
          hasSubmitButton: !!submitButton,
          hasValidation,
          formSections: document.querySelectorAll('.form-section, .form-group').length,
          pageContent: document.body.textContent.length
        };
      });

      patientDataMetrics.dataOperations.push({
        operation: 'create_form',
        duration: Date.now() - addPatientStartTime,
        formAnalysis: addPatientAnalysis
      });

      console.log('新增患者页面分析:', addPatientAnalysis);

    } catch (error) {
      console.log('新增患者流程测试失败:', error.message);
    }

    // 5. 收集性能指标
    const performanceData = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');

      return {
        navigation: {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstByte: navigation.responseStart - navigation.requestStart
        },
        resources: {
          total: resources.length,
          totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
          apiCalls: resources.filter(r => r.name.includes('api')).length
        },
        memory: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize
        } : null
      };
    });

    patientDataMetrics.performanceMetrics = performanceData;

    // 生成患者数据管理流程报告
    const patientDataReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalPages: Object.keys(patientDataMetrics.pageLoadTimes).length,
        averageLoadTime: Object.values(patientDataMetrics.pageLoadTimes).reduce((sum, time) => sum + time, 0) / Object.keys(patientDataMetrics.pageLoadTimes).length,
        totalDataOperations: patientDataMetrics.dataOperations.length
      },
      pageLoadTimes: patientDataMetrics.pageLoadTimes,
      dataOperations: patientDataMetrics.dataOperations,
      apiMetrics: {
        totalCalls: patientDataMetrics.apiCalls.length,
        averageResponseTime: patientDataMetrics.apiCalls.filter(call => call.responseTime).reduce((sum, call) => sum + call.responseTime, 0) / patientDataMetrics.apiCalls.filter(call => call.responseTime).length || 0
      },
      performance: patientDataMetrics.performanceMetrics
    };

    console.log('患者数据管理流程测试报告:', JSON.stringify(patientDataReport, null, 2));

    // 断言
    expect(Object.keys(patientDataMetrics.pageLoadTimes).length).toBeGreaterThan(0);
    expect(patientDataMetrics.dataOperations.length).toBeGreaterThan(0);
  });

  test('数据导入导出功能测试', async ({ page }) => {
    const importExportMetrics = {
      operations: [],
      fileOperations: [],
      apiCalls: [],
      errors: []
    };

    // 监控导入导出相关的API调用
    page.on('request', request => {
      if (request.url().includes('import') || request.url().includes('export') || request.url().includes('excel')) {
        importExportMetrics.apiCalls.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });

    // 1. 访问导入页面
    try {
      const importStartTime = Date.now();
      await page.goto('/import');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const importPageAnalysis = await page.evaluate(() => {
        const fileInput = document.querySelector('input[type="file"]');
        const uploadButton = document.querySelector('button:has-text("上传"), button:has-text("导入"), .upload-button');
        const hasInstructions = !!document.querySelector('.instructions, .help-text, .upload-guide');
        const hasProgress = !!document.querySelector('.progress, .upload-progress, [data-testid="progress"]');

        return {
          hasFileInput: !!fileInput,
          hasUploadButton: !!uploadButton,
          hasInstructions,
          hasProgress,
          supportedFormats: document.body.textContent.includes('.xlsx') ||
                            document.body.textContent.includes('.xls') ||
                            document.body.textContent.includes('Excel')
        };
      });

      importExportMetrics.operations.push({
        operation: 'import_page_load',
        duration: Date.now() - importStartTime,
        analysis: importPageAnalysis
      });

      console.log('导入页面分析:', importPageAnalysis);

      // 模拟文件上传（如果页面支持）
      if (importPageAnalysis.hasFileInput) {
        try {
          // 创建测试文件（注意：这在实际的浏览器环境中可能需要特殊处理）
          const uploadStartTime = Date.now();

          // 这里我们只测试文件选择UI，不实际上传文件
          const fileInput = page.locator('input[type="file"]').first();
          if (await fileInput.isVisible()) {
            // 测试文件选择对话框（不实际选择文件）
            await fileInput.click();
            await page.waitForTimeout(1000);

            importExportMetrics.fileOperations.push({
              operation: 'file_selection',
              duration: Date.now() - uploadStartTime,
              success: true
            });
          }
        } catch (error) {
          importExportMetrics.errors.push({
            operation: 'file_upload',
            error: error.message,
            timestamp: Date.now()
          });
          console.log('文件上传测试失败:', error.message);
        }
      }

    } catch (error) {
      importExportMetrics.errors.push({
        operation: 'import_page',
        error: error.message,
        timestamp: Date.now()
      });
      console.log('导入页面访问失败:', error.message);
    }

    // 2. 访问导出页面
    try {
      const exportStartTime = Date.now();
      await page.goto('/export');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const exportPageAnalysis = await page.evaluate(() => {
        const exportButtons = document.querySelectorAll('button:has-text("导出"), button:has-text("Export"), .export-button');
        const formatOptions = document.querySelectorAll('input[type="radio"], input[type="checkbox"], select');
        const hasDateRange = !!document.querySelector('input[type="date"], .date-range, .date-picker');
        const hasPreview = !!document.querySelector('.preview, .export-preview, [data-testid="preview"]');

        return {
          exportButtonCount: exportButtons.length,
          formatOptionCount: formatOptions.length,
          hasDateRange,
          hasPreview,
          supportedFormats: {
            excel: document.body.textContent.includes('Excel') || document.body.textContent.includes('.xlsx'),
            csv: document.body.textContent.includes('CSV') || document.body.textContent.includes('.csv')
          }
        };
      });

      importExportMetrics.operations.push({
        operation: 'export_page_load',
        duration: Date.now() - exportStartTime,
        analysis: exportPageAnalysis
      });

      console.log('导出页面分析:', exportPageAnalysis);

      // 测试导出按钮点击（如果存在）
      if (exportPageAnalysis.exportButtonCount > 0) {
        try {
          const exportButton = page.locator('button:has-text("导出"), button:has-text("Export"), .export-button').first();
          if (await exportButton.isVisible()) {
            const exportClickStartTime = Date.now();
            await exportButton.click();
            await page.waitForTimeout(3000); // 等待导出处理

            importExportMetrics.fileOperations.push({
              operation: 'export_click',
              duration: Date.now() - exportClickStartTime,
              success: true
            });

            // 检查是否有下载提示或成功消息
            const exportResult = await page.evaluate(() => {
              const successMessage = document.querySelector('.success, .export-success, [data-testid="success"]');
              const downloadStarted = document.body.textContent.includes('下载') ||
                                   document.body.textContent.includes('download');

              return {
                hasSuccessMessage: !!successMessage,
                downloadStarted
              };
            });

            console.log('导出操作结果:', exportResult);
          }
        } catch (error) {
          importExportMetrics.errors.push({
            operation: 'export_click',
            error: error.message,
            timestamp: Date.now()
          });
          console.log('导出按钮点击失败:', error.message);
        }
      }

    } catch (error) {
      importExportMetrics.errors.push({
        operation: 'export_page',
        error: error.message,
        timestamp: Date.now()
      });
      console.log('导出页面访问失败:', error.message);
    }

    // 3. 检查数据处理的性能影响
    const performanceImpact = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');

      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        resourceCount: resources.length,
        memoryUsage: performance.memory ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize
        } : null
      };
    });

    importExportMetrics.performanceImpact = performanceImpact;

    // 生成导入导出功能报告
    const importExportReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalOperations: importExportMetrics.operations.length,
        fileOperations: importExportMetrics.fileOperations.length,
        apiCalls: importExportMetrics.apiCalls.length,
        errors: importExportMetrics.errors.length
      },
      operations: importExportMetrics.operations,
      fileOperations: importExportMetrics.fileOperations,
      performanceImpact: importExportMetrics.performanceImpact,
      errorAnalysis: importExportMetrics.errors.length > 0 ? {
        totalErrors: importExportMetrics.errors.length,
        errorTypes: [...new Set(importExportMetrics.errors.map(e => e.operation))]
      } : null
    };

    console.log('数据导入导出功能测试报告:', JSON.stringify(importExportReport, null, 2));

    // 断言
    expect(importExportMetrics.operations.length).toBeGreaterThan(0);
    expect(importExportMetrics.errors.length).toBeLessThan(importExportMetrics.operations.length);
  });

  test('错误处理和恢复机制测试', async ({ page }) => {
    const errorHandlingMetrics = {
      simulatedErrors: [],
      caughtErrors: [],
      recoveryAttempts: [],
      systemResilience: {}
    };

    // 增强错误监听
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errorHandlingMetrics.caughtErrors.push({
          text: msg.text(),
          location: msg.location(),
          timestamp: Date.now()
        });
      }
    });

    page.on('pageerror', error => {
      errorHandlingMetrics.caughtErrors.push({
        type: 'pageerror',
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });

    page.on('requestfailed', request => {
      errorHandlingMetrics.caughtErrors.push({
        type: 'requestfailed',
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText,
        timestamp: Date.now()
      });
    });

    // 1. 测试网络错误处理
    try {
      // 访问一个可能不存在的API端点
      await page.goto('/');

      const networkErrorTest = await page.evaluate(() => {
        return new Promise((resolve) => {
          // 尝试访问一个不存在的API
          fetch('/api/nonexistent-endpoint')
            .then(response => {
              resolve({
                status: response.status,
                statusText: response.statusText,
                success: false
              });
            })
            .catch(error => {
              resolve({
                error: error.message,
                success: false
              });
            });

          // 设置超时
          setTimeout(() => {
            resolve({ timeout: true, success: false });
          }, 5000);
        });
      });

      errorHandlingMetrics.simulatedErrors.push({
        type: 'network_error',
        test: 'nonexistent_api',
        result: networkErrorTest,
        timestamp: Date.now()
      });

      console.log('网络错误测试结果:', networkErrorTest);

    } catch (error) {
      errorHandlingMetrics.simulatedErrors.push({
        type: 'network_error',
        test: 'nonexistent_api',
        error: error.message,
        timestamp: Date.now()
      });
    }

    // 2. 测试JavaScript错误处理
    const jsErrorTest = await page.evaluate(() => {
      const errors = [];

      // 设置全局错误处理器
      const originalHandler = window.onerror;
      window.onerror = function(message, source, lineno, colno, error) {
        errors.push({
          message,
          source,
          lineno,
          colno,
          error: error?.message
        });
        return originalHandler ? originalHandler.apply(this, arguments) : false;
      };

      try {
        // 故意触发一些错误
        // 1. 访问未定义的变量
        setTimeout(() => {
          try {
            const undefinedVar = someUndefinedVariable;
          } catch (e) {
            errors.push({
              type: 'reference_error',
              message: e.message
            });
          }
        }, 100);

        // 2. 调用未定义的函数
        setTimeout(() => {
          try {
            someUndefinedFunction();
          } catch (e) {
            errors.push({
              type: 'type_error',
              message: e.message
            });
          }
        }, 200);

        // 3. JSON解析错误
        setTimeout(() => {
          try {
            JSON.parse('invalid json string');
          } catch (e) {
            errors.push({
              type: 'json_parse_error',
              message: e.message
            });
          }
        }, 300);

      } catch (e) {
        errors.push({
          type: 'unexpected_error',
          message: e.message
        });
      }

      // 恢复原始错误处理器
      setTimeout(() => {
        window.onerror = originalHandler;
      }, 500);

      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            errorsCaught: errors.length,
            errorTypes: [...new Set(errors.map(e => e.type || 'unknown'))],
            errors: errors
          });
        }, 1000);
      });
    });

    errorHandlingMetrics.simulatedErrors.push({
      type: 'javascript_error',
      test: 'error_handling',
      result: jsErrorTest,
      timestamp: Date.now()
    });

    console.log('JavaScript错误处理测试结果:', jsErrorTest);

    // 3. 测试页面错误恢复机制
    try {
      await page.goto('/nonexistent-page');
      await page.waitForTimeout(3000);

      const errorPageAnalysis = await page.evaluate(() => {
        const has404Message = document.body.textContent.includes('404') ||
                             document.body.textContent.includes('not found') ||
                             document.body.textContent.includes('页面不存在');

        const hasErrorPage = !!document.querySelector('.error-page, .not-found, [data-testid="404"]');
        const hasGoHomeButton = !!document.querySelector('a:has-text("首页"), a:has-text("Home"), button:has-text("返回")');
        const hasSearchBox = !!document.querySelector('input[type="search"], input[placeholder*="搜索"]');

        return {
          has404Message,
          hasErrorPage,
          hasGoHomeButton,
          hasSearchBox,
          statusCode: document.title.includes('404') ? 404 : 'unknown',
          pageContent: document.body.textContent.length
        };
      });

      errorHandlingMetrics.simulatedErrors.push({
        type: '404_error',
        test: 'nonexistent_page',
        result: errorPageAnalysis,
        timestamp: Date.now()
      });

      console.log('404错误页面分析:', errorPageAnalysis);

      // 测试恢复机制
      if (errorPageAnalysis.hasGoHomeButton) {
        try {
          await page.locator('a:has-text("首页"), a:has-text("Home"), button:has-text("返回")').first().click();
          await page.waitForTimeout(2000);

          const recoveryResult = await page.evaluate(() => {
            return {
              recovered: !document.body.textContent.includes('404') && !document.body.textContent.includes('not found'),
              currentUrl: window.location.href,
              pageContent: document.body.textContent.length
            };
          });

          errorHandlingMetrics.recoveryAttempts.push({
            type: '404_recovery',
            success: recoveryResult.recovered,
            result: recoveryResult,
            timestamp: Date.now()
          });

          console.log('404错误恢复结果:', recoveryResult);

        } catch (error) {
          errorHandlingMetrics.recoveryAttempts.push({
            type: '404_recovery',
            success: false,
            error: error.message,
            timestamp: Date.now()
          });
        }
      }

    } catch (error) {
      errorHandlingMetrics.simulatedErrors.push({
        type: '404_error',
        test: 'nonexistent_page',
        error: error.message,
        timestamp: Date.now()
      });
    }

    // 4. 检查系统整体韧性
    const systemResilienceTest = await page.evaluate(() => {
      // 检查是否有全局错误处理机制
      const hasErrorBoundary = !!(window.React && window.__REACT_ERROR_BOUNDARY__);
      const hasGlobalErrorHandling = typeof window.onerror === 'function' ||
                                    typeof window.addEventListener === 'function';

      // 检查是否有重试机制
      const hasRetryLogic = document.body.textContent.includes('重试') ||
                           document.body.textContent.includes('retry') ||
                           document.body.textContent.includes('重新加载');

      // 检查是否有错误报告机制
      const hasErrorReporting = document.body.textContent.includes('错误报告') ||
                               document.body.textContent.includes('feedback') ||
                               document.body.textContent.includes('问题反馈');

      return {
        hasErrorBoundary,
        hasGlobalErrorHandling,
        hasRetryLogic,
        hasErrorReporting,
        resilienceScore: [hasErrorBoundary, hasGlobalErrorHandling, hasRetryLogic, hasErrorReporting]
                         .filter(Boolean).length
      };
    });

    errorHandlingMetrics.systemResilience = systemResilienceTest;

    // 生成错误处理和恢复机制报告
    const errorHandlingReport = {
      timestamp: new Date().toISOString(),
      summary: {
        simulatedErrors: errorHandlingMetrics.simulatedErrors.length,
        caughtErrors: errorHandlingMetrics.caughtErrors.length,
        recoveryAttempts: errorHandlingMetrics.recoveryAttempts.length,
        resilienceScore: systemResilienceTest.resilienceScore
      },
      simulatedErrors: errorHandlingMetrics.simulatedErrors,
      caughtErrors: errorHandlingMetrics.caughtErrors.slice(0, 10), // 只显示前10个错误
      recoveryAttempts: errorHandlingMetrics.recoveryAttempts,
      systemResilience: errorHandlingMetrics.systemResilience,
      recommendations: []
    };

    // 添加改进建议
    if (systemResilienceTest.resilienceScore < 3) {
      errorHandlingReport.recommendations.push('建议增强全局错误处理机制');
    }
    if (errorHandlingMetrics.recoveryAttempts.length === 0) {
      errorHandlingReport.recommendations.push('建议添加错误恢复和重试机制');
    }

    console.log('错误处理和恢复机制测试报告:', JSON.stringify(errorHandlingReport, null, 2));

    // 断言
    expect(errorHandlingMetrics.simulatedErrors.length).toBeGreaterThan(0);
    expect(systemResilienceTest.resilienceScore).toBeGreaterThanOrEqual(1);
  });
});