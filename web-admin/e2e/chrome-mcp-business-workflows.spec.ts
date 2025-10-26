/**
 * 基于 Chrome MCP Server 的核心业务流程 E2E 测试
 * 覆盖患者管理、数据导入导出、权限管理等关键业务场景
 */

import { test, expect } from './fixtures/chrome-mcp-fixture';

test.describe('🏥 患者管理完整业务流程', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 模拟管理员登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-admin-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'test-admin',
        permissions: ['patient_manage', 'patient_export', 'patient_import']
      }));
    `);
  });

  test('患者完整生命周期：创建 → 管理 → 导出', async ({ chromeMCP }) => {
    // 步骤 1: 导航到患者管理页面
    await chromeMCP.navigate('http://localhost:4174/patients');
    await chromeMCP.waitForElement('[data-testid="patient-list"]');

    // 步骤 2: 创建新患者
    await chromeMCP.clickElement('button:has-text("新增患者"), button:has-text("创建患者")');

    // 验证创建向导打开
    await chromeMCP.waitForElement('[data-testid="patient-wizard"]');

    // 步骤 3: 填写患者基本信息
    await chromeMCP.waitForElement('input[name="name"], input[placeholder*="姓名"]');
    await chromeMCP.typeText('input[name="name"], input[placeholder*="姓名"]', '测试患者001');

    await chromeMCP.waitForElement('input[name="age"], input[placeholder*="年龄"]');
    await chromeMCP.typeText('input[name="age"], input[placeholder*="年龄"]', '35');

    await chromeMCP.waitForElement('select[name="gender"]');
    await chromeMCP.clickElement('select[name="gender"]');
    await chromeMCP.clickElement('option[value="male"], option:has-text("男")');

    await chromeMCP.waitForElement('input[name="phone"], input[placeholder*="电话"]');
    await chromeMCP.typeText('input[name="phone"], input[placeholder*="电话"]', '13800138000');

    await chromeMCP.waitForElement('input[name="idCard"], input[placeholder*="身份证"]');
    await chromeMCP.typeText('input[name="idCard"], input[placeholder*="身份证"]', '110101199001010001');

    // 截图保存基本信息填写
    await chromeMCP.takeScreenshot({
      filename: 'patient-creation-basic-info'
    });

    // 步骤 4: 填写医疗信息
    await chromeMCP.clickElement('button:has-text("下一步"), button[aria-label="下一步"]');

    await chromeMCP.waitForElement('input[name="diagnosis"], textarea[placeholder*="诊断"]');
    await chromeMCP.typeText('input[name="diagnosis"], textarea[placeholder*="诊断"]', '高血压2型');

    await chromeMCP.waitForElement('textarea[name="treatment"], textarea[placeholder*="治疗"]');
    await chromeMCP.typeText('textarea[name="treatment"], textarea[placeholder*="治疗"]', '降压药物治疗 + 生活方式干预');

    await chromeMCP.waitForElement('select[name="status"]');
    await chromeMCP.clickElement('select[name="status"]');
    await chromeMCP.clickElement('option[value="pending"], option:has-text("待入住")');

    // 截图保存医疗信息填写
    await chromeMCP.takeScreenshot({
      filename: 'patient-creation-medical-info'
    });

    // 步骤 5: 提交创建
    await chromeMCP.clickElement('button:has-text("提交"), button[aria-label="提交"]');

    // 验证创建成功
    await chromeMCP.waitForTimeout(2000);
    const successMessage = await chromeMCP.findElement('.success-message, .toast-success');
    expect(successMessage).toBeTruthy();

    // 步骤 6: 验证患者出现在列表中
    await chromeMCP.navigate('http://localhost:4174/patients');
    await chromeMCP.waitForTimeout(2000);

    // 搜索刚创建的患者
    await chromeMCP.clickElement('input[placeholder*="搜索"], input[name="search"]');
    await chromeMCP.typeText('input[placeholder*="搜索"], input[name="search"]', '测试患者001');
    await chromeMCP.pressKey('Enter');

    await chromeMCP.waitForTimeout(2000);

    // 验证搜索结果
    const searchResults = await chromeMCP.getWebContent();
    expect(searchResults.textContent).toContain('测试患者001');

    // 截图保存搜索结果
    await chromeMCP.takeScreenshot({
      filename: 'patient-search-results'
    });

    // 步骤 7: 查看患者详情
    await chromeMCP.clickElement('[data-testid="patient-item"]:has-text("测试患者001")');
    await chromeMCP.waitForElement('[data-testid="patient-detail"]');

    // 验证患者详情信息
    const detailContent = await chromeMCP.getWebContent();
    expect(detailContent.textContent).toContain('测试患者001');
    expect(detailContent.textContent).toContain('35');
    expect(detailContent.textContent).toContain('高血压2型');

    // 截图保存患者详情
    await chromeMCP.takeScreenshot({
      filename: 'patient-detail-view'
    });

    // 步骤 8: 更新患者状态
    await chromeMCP.clickElement('button[aria-label*="状态"], .status-toggle');
    await chromeMCP.waitForElement('[data-testid="status-modal"]');

    await chromeMCP.clickElement('option[value="active"], option:has-text("在住")');
    await chromeMCP.clickElement('button:has-text("确认")');

    // 验证状态更新
    await chromeMCP.waitForTimeout(1000);
    const updatedContent = await chromeMCP.getWebContent();
    expect(updatedContent.textContent).toContain('在住');

    // 截图保存状态更新
    await chromeMCP.takeScreenshot({
      filename: 'patient-status-updated'
    });

    // 步骤 9: 导出患者数据
    await chromeMCP.navigate('http://localhost:4174/patients');

    // 选择刚创建的患者
    await chromeMCP.clickElement('input[type="checkbox"]:first-of-type');

    // 点击导出按钮
    await chromeMCP.clickElement('button:has-text("导出"), [data-testid="export-button"]');

    // 选择导出格式
    await chromeMCP.clickElement('button:has-text("Excel"), option[value="excel"]');

    // 等待导出完成
    await chromeMCP.waitForTimeout(3000);

    // 截图保存导出操作
    await chromeMCP.takeScreenshot({
      filename: 'patient-export-operation'
    });

    // 验证导出完成提示
    const exportMessage = await chromeMCP.findElement('.export-success, .toast-success');
    expect(exportMessage).toBeTruthy();
  });

  test('批量患者操作流程', async ({ chromeMCP }) => {
    // 导航到患者列表
    await chromeMCP.navigate('http://localhost:4174/patients');
    await chromeMCP.waitForElement('[data-testid="patient-list"]');

    // 等待患者列表加载
    await chromeMCP.waitForTimeout(3000);

    // 获取所有患者项
    const patientItems = await chromeMCP.findElements('[data-testid="patient-item"]');

    if (patientItems.length > 0) {
      // 选择前3个患者
      const selectionCount = Math.min(3, patientItems.length);

      for (let i = 0; i < selectionCount; i++) {
        const checkbox = await chromeMCP.findElementWithin(
          patientItems[i].selector,
          'input[type="checkbox"]'
        );

        if (checkbox) {
          await chromeMCP.clickElement(checkbox.selector);
        }
      }

      // 验证选中状态
      const selectedCount = await chromeMCP.evaluateScript(`
        return document.querySelectorAll('input[type="checkbox"]:checked').length;
      `);

      expect(selectedCount).toBeGreaterThan(0);

      // 截图保存批量选择状态
      await chromeMCP.takeScreenshot({
        filename: 'batch-patients-selected'
      });

      // 测试批量导出
      const exportButton = await chromeMCP.findElement('button:has-text("导出选中"), [data-testid="batch-export"]');

      if (exportButton) {
        await chromeMCP.clickElement(exportButton.selector);

        // 选择导出选项
        await chromeMCP.clickElement('button:has-text("Excel"), option[value="excel"]');

        // 等待导出处理
        await chromeMCP.waitForTimeout(5000);

        // 验证导出成功
        const exportSuccess = await chromeMCP.findElement('.export-success, .toast-success');
        expect(exportSuccess).toBeTruthy();

        // 截图保存批量导出结果
        await chromeMCP.takeScreenshot({
          filename: 'batch-export-success'
        });
      }

      // 测试批量状态更新
      const statusButton = await chromeMCP.findElement('button:has-text("批量状态"), [data-testid="batch-status"]');

      if (statusButton) {
        await chromeMCP.clickElement(statusButton.selector);

        await chromeMCP.waitForElement('[data-testid="batch-status-modal"]');

        // 选择新状态
        await chromeMCP.clickElement('option[value="discharged"], option:has-text("已退住")');
        await chromeMCP.clickElement('button:has-text("确认批量更新")');

        // 等待批量更新完成
        await chromeMCP.waitForTimeout(3000);

        // 验证更新成功
        const updateSuccess = await chromeMCP.findElement('.update-success, .toast-success');
        expect(updateSuccess).toBeTruthy();

        // 截图保存批量状态更新
        await chromeMCP.takeScreenshot({
          filename: 'batch-status-update-success'
        });
      }
    } else {
      console.log('没有找到患者数据，跳过批量操作测试');
    }
  });
});

test.describe('📁 数据导入导出业务流程', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 模拟管理员登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-admin-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'test-admin',
        permissions: ['data_import', 'data_export']
      }));
    `);
  });

  test('Excel 数据导入完整流程', async ({ chromeMCP }) => {
    // 导航到导入页面
    await chromeMCP.navigate('http://localhost:4174/import');
    await chromeMCP.waitForElement('[data-testid="import-page"]');

    // 步骤 1: 选择文件上传
    const fileUpload = await chromeMCP.findElement('input[type="file"], [data-testid="file-upload"]');

    if (fileUpload) {
      // 模拟文件选择（实际测试中需要真实文件）
      await chromeMCP.evaluateScript(`
        const fileInput = document.querySelector('input[type="file"], [data-testid="file-upload"]');
        if (fileInput) {
          // 创建模拟文件
          const file = new File(['测试数据内容'], 'test-patients.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });

          // 创建 DataTransfer 对象
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);

          // 设置文件
          fileInput.files = dataTransfer.files;

          // 触发 change 事件
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      `);

      // 截图保存文件选择状态
      await chromeMCP.takeScreenshot({
        filename: 'import-file-selected'
      });

      // 步骤 2: 配置导入选项
      await chromeMCP.waitForElement('[data-testid="import-options"]');

      // 选择导入模式
      await chromeMCP.clickElement('input[name="importMode"][value="append"]');

      // 选择数据映射
      await chromeMCP.clickElement('input[name="mapColumns"][value="auto"]');

      // 截图保存导入配置
      await chromeMCP.takeScreenshot({
        filename: 'import-options-configured'
      });

      // 步骤 3: 开始导入
      await chromeMCP.clickElement('button:has-text("开始导入"), [data-testid="start-import"]');

      // 监控导入进度
      await chromeMCP.waitForElement('[data-testid="import-progress"]');

      let progressValue = 0;
      const maxWaitTime = 60000; // 60秒超时
      const startTime = Date.now();

      while (progressValue < 100 && (Date.now() - startTime) < maxWaitTime) {
        progressValue = await chromeMCP.evaluateScript(`
          const progressBar = document.querySelector('[data-testid="import-progress"] progress, .progress-bar');
          return progressBar ? progressBar.value || 0 : 0;
        `);

        await chromeMCP.waitForTimeout(2000);
      }

      // 截图保存导入进度
      await chromeMCP.takeScreenshot({
        filename: 'import-progress-final'
      });

      // 步骤 4: 验证导入结果
      await chromeMCP.waitForElement('[data-testid="import-results"]');

      const resultsContent = await chromeMCP.getWebContent();
      expect(resultsContent.textContent).toContain('导入完成');

      // 检查导入统计
      const importStats = await chromeMCP.findElement('[data-testid="import-stats"]');
      expect(importStats).toBeTruthy();

      // 截图保存导入结果
      await chromeMCP.takeScreenshot({
        filename: 'import-results-success'
      });

      // 步骤 5: 验证数据在患者列表中显示
      await chromeMCP.navigate('http://localhost:4174/patients');
      await chromeMCP.waitForTimeout(3000);

      // 搜索导入的测试数据
      await chromeMCP.clickElement('input[placeholder*="搜索"]');
      await chromeMCP.typeText('input[placeholder*="搜索"]', '测试数据');
      await chromeMCP.pressKey('Enter');

      await chromeMCP.waitForTimeout(2000);

      // 验证导入的数据
      const searchResults = await chromeMCP.getWebContent();
      const hasImportedData = searchResults.textContent.includes('测试数据') ||
                             searchResults.textContent.includes('导入');

      expect(hasImportedData).toBeTruthy();

      // 截图保存导入数据验证
      await chromeMCP.takeScreenshot({
        filename: 'imported-data-verification'
      });
    } else {
      throw new Error('未找到文件上传控件');
    }
  });

  test('数据导出定制流程', async ({ chromeMCP }) => {
    // 导航到导出页面
    await chromeMCP.navigate('http://localhost:4174/export');
    await chromeMCP.waitForElement('[data-testid="export-page"]');

    // 步骤 1: 选择导出数据范围
    await chromeMCP.clickElement('input[name="exportRange"][value="all"]');

    // 步骤 2: 配置导出字段
    await chromeMCP.waitForElement('[data-testid="field-selector"]');

    // 选择要导出的字段
    const fieldsToSelect = [
      'basic-info',
      'medical-info',
      'contact-info',
      'status-info'
    ];

    for (const field of fieldsToSelect) {
      const checkbox = await chromeMCP.findElement(`input[name="fields"][value="${field}"]`);
      if (checkbox) {
        await chromeMCP.clickElement(checkbox.selector);
      }
    }

    // 截图保存字段选择
    await chromeMCP.takeScreenshot({
      filename: 'export-fields-selected'
    });

    // 步骤 3: 设置导出格式
    await chromeMCP.clickElement('input[name="format"][value="excel"]');

    // 步骤 4: 设置筛选条件
    await chromeMCP.clickElement('[data-testid="advanced-filters"]');

    // 设置日期范围
    const startDate = await chromeMCP.findElement('input[name="startDate"]');
    if (startDate) {
      await chromeMCP.typeText(startDate.selector, '2024-01-01');
    }

    const endDate = await chromeMCP.findElement('input[name="endDate"]');
    if (endDate) {
      await chromeMCP.typeText(endDate.selector, '2024-12-31');
    }

    // 设置状态筛选
    await chromeMCP.clickElement('input[name="statusFilter"][value="active"]');

    // 截图保存筛选条件
    await chromeMCP.takeScreenshot({
      filename: 'export-filters-configured'
    });

    // 步骤 5: 开始导出
    await chromeMCP.clickElement('button:has-text("开始导出"), [data-testid="start-export"]');

    // 监控导出进度
    await chromeMCP.waitForElement('[data-testid="export-progress"]');

    let exportProgress = 0;
    const exportStartTime = Date.now();
    const exportTimeout = 120000; // 2分钟超时

    while (exportProgress < 100 && (Date.now() - exportStartTime) < exportTimeout) {
      exportProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="export-progress"] .progress-value, .progress-bar');
        return progressElement ? parseInt(progressElement.textContent) || 0 : 0;
      `);

      await chromeMCP.waitForTimeout(3000);
    }

    // 截图保存导出完成状态
    await chromeMCP.takeScreenshot({
      filename: 'export-completed'
    });

    // 步骤 6: 下载导出文件
    const downloadButton = await chromeMCP.findElement('a:has-text("下载"), button:has-text("下载")');

    if (downloadButton) {
      await chromeMCP.clickElement(downloadButton.selector);

      // 等待下载开始
      await chromeMCP.waitForTimeout(2000);

      // 截图保存下载操作
      await chromeMCP.takeScreenshot({
        filename: 'export-download-initiated'
      });
    }

    // 验证导出成功消息
    const exportSuccess = await chromeMCP.findElement('.export-success, .toast-success');
    expect(exportSuccess).toBeTruthy();
  });
});

test.describe('🔐 权限管理业务流程', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 超级管理员登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-super-admin-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'super-admin',
        permissions: ['user_manage', 'role_manage', 'system_config']
      }));
    `);
  });

  test('用户创建和角色分配完整流程', async ({ chromeMCP }) => {
    // 导航到用户管理页面
    await chromeMCP.navigate('http://localhost:4174/users');
    await chromeMCP.waitForElement('[data-testid="users-management"]');

    // 步骤 1: 创建新用户
    await chromeMCP.clickElement('button:has-text("创建用户"), [data-testid="create-user"]');

    await chromeMCP.waitForElement('[data-testid="user-creation-form"]');

    // 填写用户基本信息
    await chromeMCP.typeText('input[name="username"], input[placeholder*="用户名"]', 'newuser001');
    await chromeMCP.typeText('input[name="email"], input[placeholder*="邮箱"]', 'newuser001@example.com');
    await chromeMCP.typeText('input[name="phone"], input[placeholder*="电话"]', '13900139000');

    // 设置密码
    await chromeMCP.typeText('input[name="password"], input[placeholder*="密码"]', 'Password123!');
    await chromeMCP.typeText('input[name="confirmPassword"], input[placeholder*="确认密码"]', 'Password123!');

    // 截图保存用户基本信息
    await chromeMCP.takeScreenshot({
      filename: 'user-creation-basic-info'
    });

    // 步骤 2: 分配角色
    await chromeMCP.clickElement('button:has-text("下一步"), [aria-label="下一步"]');

    await chromeMCP.waitForElement('[data-testid="role-assignment"]');

    // 选择用户角色
    const rolesToAssign = ['social_worker', 'volunteer'];

    for (const role of rolesToAssign) {
      const roleCheckbox = await chromeMCP.findElement(`input[name="roles"][value="${role}"]`);
      if (roleCheckbox) {
        await chromeMCP.clickElement(roleCheckbox.selector);
      }
    }

    // 截图保存角色分配
    await chromeMCP.takeScreenshot({
      filename: 'user-role-assignment'
    });

    // 步骤 3: 设置权限
    await chromeMCP.clickElement('button:has-text("下一步"), [aria-label="下一步"]');

    await chromeMCP.waitForElement('[data-testid="permission-assignment"]');

    // 选择权限
    const permissions = [
      'patient_view',
      'patient_edit',
      'report_view'
    ];

    for (const permission of permissions) {
      const permissionCheckbox = await chromeMCP.findElement(`input[name="permissions"][value="${permission}"]`);
      if (permissionCheckbox) {
        await chromeMCP.clickElement(permissionCheckbox.selector);
      }
    }

    // 截图保存权限分配
    await chromeMCP.takeScreenshot({
      filename: 'user-permission-assignment'
    });

    // 步骤 4: 提交用户创建
    await chromeMCP.clickElement('button:has-text("创建用户"), [data-testid="submit-user"]');

    // 验证创建成功
    await chromeMCP.waitForTimeout(2000);
    const userCreationSuccess = await chromeMCP.findElement('.success-message, .toast-success');
    expect(userCreationSuccess).toBeTruthy();

    // 截图保存用户创建成功
    await chromeMCP.takeScreenshot({
      filename: 'user-creation-success'
    });

    // 步骤 5: 验证用户出现在用户列表中
    await chromeMCP.navigate('http://localhost:4174/users');
    await chromeMCP.waitForTimeout(2000);

    // 搜索刚创建的用户
    await chromeMCP.clickElement('input[placeholder*="搜索用户"]');
    await chromeMCP.typeText('input[placeholder*="搜索用户"]', 'newuser001');
    await chromeMCP.pressKey('Enter');

    await chromeMCP.waitForTimeout(2000);

    // 验证搜索结果
    const searchResults = await chromeMCP.getWebContent();
    expect(searchResults.textContent).toContain('newuser001');

    // 截图保存用户搜索结果
    await chromeMCP.takeScreenshot({
      filename: 'user-search-results'
    });

    // 步骤 6: 验证用户详情
    await chromeMCP.clickElement('[data-testid="user-item"]:has-text("newuser001")');
    await chromeMCP.waitForElement('[data-testid="user-detail"]');

    // 验证用户信息
    const userDetail = await chromeMCP.getWebContent();
    expect(userDetail.textContent).toContain('newuser001');
    expect(userDetail.textContent).toContain('newuser001@example.com');

    // 验证角色信息
    expect(userDetail.textContent).toContain('social_worker');
    expect(userDetail.textContent).toContain('volunteer');

    // 截图保存用户详情
    await chromeMCP.takeScreenshot({
      filename: 'user-detail-verification'
    });
  });

  test('角色权限验证流程', async ({ chromeMCP }) => {
    // 导航到角色管理页面
    await chromeMCP.navigate('http://localhost:4174/roles');
    await chromeMCP.waitForElement('[data-testid="roles-management"]');

    // 步骤 1: 查看现有角色
    const existingRoles = await chromeMCP.findElements('[data-testid="role-item"]');

    expect(existingRoles.length).toBeGreaterThan(0);

    // 截图保存现有角色列表
    await chromeMCP.takeScreenshot({
      filename: 'existing-roles-list'
    });

    // 步骤 2: 测试角色权限边界
    // 切换到不同角色进行权限测试
    const rolesToTest = [
      { name: 'social_worker', expectedPages: ['/patients', '/analysis'], restrictedPages: ['/users', '/roles'] },
      { name: 'volunteer', expectedPages: ['/patients'], restrictedPages: ['/users', '/roles', '/analysis'] },
      { name: 'parent', expectedPages: ['/dashboard'], restrictedPages: ['/patients', '/users', '/roles', '/analysis'] }
    ];

    for (const role of rolesToTest) {
      // 清除登录状态
      await chromeMCP.injectScript('localStorage.clear();');

      // 模拟角色登录
      await chromeMCP.navigate('http://localhost:4174/login');
      await chromeMCP.injectScript(`
        localStorage.setItem('userToken', 'mock-${role.name}-token');
        localStorage.setItem('userInfo', JSON.stringify({
          roles: ['${role.name}'],
          username: 'test-${role.name}'
        }));
      `);

      // 测试可访问的页面
      for (const page of role.expectedPages) {
        await chromeMCP.navigate(`http://localhost:4174${page}`);
        await chromeMCP.waitForTimeout(2000);

        const pageContent = await chromeMCP.getWebContent();
        const hasAccess = !pageContent.textContent.includes('权限不足') &&
                         !pageContent.textContent.includes('无权限') &&
                         !pageContent.textContent.includes('登录');

        expect(hasAccess).toBeTruthy();

        // 截图保存角色访问页面
        await chromeMCP.takeScreenshot({
          filename: `${role.name}-access-${page.replace('/', '-')}`
        });
      }

      // 测试受限页面
      for (const page of role.restrictedPages) {
        await chromeMCP.navigate(`http://localhost:4174${page}`);
        await chromeMCP.waitForTimeout(2000);

        const pageContent = await chromeMCP.getWebContent();
        const hasPermissionDenied = pageContent.textContent.includes('权限不足') ||
                                   pageContent.textContent.includes('无权限') ||
                                   pageContent.textContent.includes('访问') ||
                                   pageContent.textContent.includes('登录');

        expect(hasPermissionDenied).toBeTruthy();

        // 截图保存权限拒绝页面
        await chromeMCP.takeScreenshot({
          filename: `${role.name}-denied-${page.replace('/', '-')}`
        });
      }
    }
  });
});