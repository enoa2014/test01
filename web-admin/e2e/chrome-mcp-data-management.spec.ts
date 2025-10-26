/**
 * 基于 Chrome MCP Server 的数据管理 E2E 测试
 * 专注于数据导入导出、文件管理、数据处理等核心数据操作
 */

import { test, expect } from './fixtures/chrome-mcp-fixture';

test.describe('📊 Excel 数据导入高级测试', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 模拟数据管理员登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-data-admin-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'data-admin',
        permissions: ['data_import', 'data_export', 'patient_manage']
      }));
    `);

    // 启动网络监控以跟踪数据处理请求
    await chromeMCP.startNetworkCapture({
      maxCaptureTime: 120000,
      captureRequestBody: true,
      captureResponseBody: true
    });
  });

  test('复杂 Excel 文件导入流程', async ({ chromeMCP }) => {
    // 导航到导入页面
    await chromeMCP.navigate('http://localhost:4174/import');
    await chromeMCP.waitForElement('[data-testid="import-page"]');

    // 步骤 1: 模拟上传复杂 Excel 文件
    await chromeMCP.evaluateScript(`
      // 创建模拟的复杂 Excel 数据
      const complexExcelData = {
        worksheets: [
          {
            name: '患者基本信息',
            data: [
              ['姓名', '年龄', '性别', '电话', '身份证号', '入院日期', '诊断', '科室'],
              ['张三', '45', '男', '13800138001', '110101197901010001', '2024-01-15', '高血压', '心内科'],
              ['李四', '32', '女', '13800138002', '110101199201010002', '2024-02-20', '糖尿病', '内分泌科'],
              ['王五', '58', '男', '13800138003', '110101196501010003', '2024-03-10', '冠心病', '心内科'],
              ['赵六', '28', '女', '13800138004', '110101199501010004', '2024-04-05', '肺炎', '呼吸科']
            ]
          },
          {
            name: '治疗记录',
            data: [
              ['患者姓名', '治疗方案', '开始日期', '医生', '状态'],
              ['张三', '降压药物治疗', '2024-01-16', '医生A', '进行中'],
              ['李四', '胰岛素治疗', '2024-02-21', '医生B', '进行中'],
              ['王五', '抗血小板治疗', '2024-03-11', '医生A', '进行中']
            ]
          }
        ]
      };

      // 模拟文件上传
      const fileInput = document.querySelector('input[type="file"], [data-testid="file-upload"]');
      if (fileInput) {
        const file = new File([JSON.stringify(complexExcelData)], 'complex-patients.xlsx', {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);

    // 验证文件选择
    await chromeMCP.waitForElement('[data-testid="file-selected"]');
    const selectedFile = await chromeMCP.findElement('[data-testid="selected-file-name"]');
    expect(selectedFile).toBeTruthy();

    // 截图保存文件选择状态
    await chromeMCP.takeScreenshot({
      filename: 'complex-excel-file-selected'
    });

    // 步骤 2: 数据预览和验证
    await chromeMCP.waitForElement('[data-testid="data-preview"]');

    // 验证数据预览显示多个工作表
    const previewContent = await chromeMCP.getWebContent();
    expect(previewContent.textContent).toContain('患者基本信息');
    expect(previewContent.textContent).toContain('治疗记录');

    // 截图保存数据预览
    await chromeMCP.takeScreenshot({
      filename: 'excel-data-preview'
    });

    // 步骤 3: 配置数据映射
    await chromeMCP.clickElement('button:has-text("配置映射"), [data-testid="configure-mapping"]');

    await chromeMCP.waitForElement('[data-testid="field-mapping"]');

    // 验证自动映射
    const autoMappedFields = await chromeMCP.findElements('[data-testid="mapped-field"]');
    expect(autoMappedFields.length).toBeGreaterThan(0);

    // 手动调整映射
    const nameMapping = await chromeMCP.findElement('[data-field="姓名"]');
    if (nameMapping) {
      await chromeMCP.clickElement(nameMapping.selector);
      await chromeMCP.clickElement('option[value="patient_name"]');
    }

    const diagnosisMapping = await chromeMCP.findElement('[data-field="诊断"]');
    if (diagnosisMapping) {
      await chromeMCP.clickElement(diagnosisMapping.selector);
      await chromeMCP.clickElement('option[value="primary_diagnosis"]');
    }

    // 截图保存数据映射配置
    await chromeMCP.takeScreenshot({
      filename: 'excel-field-mapping-configured'
    });

    // 步骤 4: 设置导入选项
    await chromeMCP.clickElement('button:has-text("下一步"), [data-testid="next-step"]');

    await chromeMCP.waitForElement('[data-testid="import-options"]');

    // 选择导入模式
    await chromeMCP.clickElement('input[name="importMode"][value="update_existing"]');

    // 设置冲突处理
    await chromeMCP.clickElement('input[name="conflictHandling"][value="skip_conflicts"]');

    // 设置验证规则
    await chromeMCP.clickElement('input[name="validation"][value="strict_validation"]');

    // 截图保存导入选项
    await chromeMCP.takeScreenshot({
      filename: 'complex-import-options'
    });

    // 步骤 5: 开始导入处理
    await chromeMCP.clickElement('button:has-text("开始导入"), [data-testid="start-complex-import"]');

    // 监控导入进度
    await chromeMCP.waitForElement('[data-testid="import-progress"]');

    let importProgress = 0;
    const importStartTime = Date.now();
    const maxImportTime = 180000; // 3分钟超时

    while (importProgress < 100 && (Date.now() - importStartTime) < maxImportTime) {
      importProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="import-progress"] .progress-value');
        const barElement = document.querySelector('[data-testid="import-progress"] progress');
        return progressElement ? parseInt(progressElement.textContent) :
               barElement ? barElement.value : 0;
      `);

      // 检查导入状态
      const importStatus = await chromeMCP.evaluateScript(`
        const statusElement = document.querySelector('[data-testid="import-status"]');
        return statusElement ? statusElement.textContent : '';
      `);

      console.log(`导入进度: ${importProgress}%, 状态: ${importStatus}`);

      await chromeMCP.waitForTimeout(3000);
    }

    // 截图保存导入完成状态
    await chromeMCP.takeScreenshot({
      filename: 'complex-import-completed'
    });

    // 步骤 6: 验证导入结果
    await chromeMCP.waitForElement('[data-testid="import-results"]');

    const resultsContent = await chromeMCP.getWebContent();
    expect(resultsContent.textContent).toContain('导入完成');

    // 验证导入统计
    const importStats = await chromeMCP.getElementContent('[data-testid="import-stats"]');
    expect(importStats).toContain('成功');
    expect(importStats).toContain('失败');

    // 验证工作表导入情况
    const worksheetResults = await chromeMCP.findElements('[data-testid="worksheet-result"]');
    expect(worksheetResults.length).toBeGreaterThanOrEqual(2);

    // 截图保存详细导入结果
    await chromeMCP.takeScreenshot({
      filename: 'complex-import-detailed-results'
    });

    // 步骤 7: 验证数据完整性
    await chromeMCP.navigate('http://localhost:4174/patients');
    await chromeMCP.waitForTimeout(3000);

    // 搜索导入的患者
    await chromeMCP.clickElement('input[placeholder*="搜索"]');
    await chromeMCP.typeText('input[placeholder*="搜索"]', '张三');
    await chromeMCP.pressKey('Enter');

    await chromeMCP.waitForTimeout(2000);

    const searchResults = await chromeMCP.getWebContent();
    expect(searchResults.textContent).toContain('张三');
    expect(searchResults.textContent).toContain('45');
    expect(searchResults.textContent).toContain('高血压');

    // 截图保存数据验证结果
    await chromeMCP.takeScreenshot({
      filename: 'imported-data-verification'
    });

    // 获取网络请求数据
    const networkData = await chromeMCP.stopNetworkCapture();
    const cloudFunctionRequests = networkData.requests?.filter(req =>
      req.url.includes('patientIntake') || req.url.includes('readExcel')
    );

    expect(cloudFunctionRequests.length).toBeGreaterThan(0);
    console.log('云函数调用次数:', cloudFunctionRequests.length);
  });

  test('批量数据更新和同步测试', async ({ chromeMCP }) => {
    // 导航到数据管理页面
    await chromeMCP.navigate('http://localhost:4174/data-sync');
    await chromeMCP.waitForElement('[data-testid="data-sync-page"]');

    // 步骤 1: 选择同步源
    await chromeMCP.clickElement('button:has-text("选择数据源"), [data-testid="select-data-source"]');

    await chromeMCP.waitForElement('[data-testid="data-source-selector"]');

    // 选择 Excel 同步源
    await chromeMCP.clickElement('input[name="dataSource"][value="excel"]');

    // 选择同步模式
    await chromeMCP.clickElement('input[name="syncMode"][value="incremental"]');

    // 截图保存数据源选择
    await chromeMCP.takeScreenshot({
      filename: 'data-source-selection'
    });

    // 步骤 2: 配置同步规则
    await chromeMCP.clickElement('button:has-text("配置规则"), [data-testid="configure-sync-rules"]');

    await chromeMCP.waitForElement('[data-testid="sync-rules"]');

    // 设置匹配规则
    await chromeMCP.clickElement('input[name="matchField"][value="id_card"]');
    await chromeMCP.typeText('input[name="updateStrategy"], [data-testid="update-strategy"]', 'merge_with_existing');

    // 设置冲突解决
    await chromeMCP.clickElement('input[name="conflictResolution"][value="keep_newer"]');

    // 截图保存同步规则配置
    await chromeMCP.takeScreenshot({
      filename: 'sync-rules-configured'
    });

    // 步骤 3: 执行数据同步
    await chromeMCP.clickElement('button:has-text("开始同步"), [data-testid="start-sync"]');

    // 监控同步进度
    await chromeMCP.waitForElement('[data-testid="sync-progress"]');

    let syncProgress = 0;
    const syncStartTime = Date.now();
    const maxSyncTime = 120000; // 2分钟超时

    while (syncProgress < 100 && (Date.now() - syncStartTime) < maxSyncTime) {
      syncProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="sync-progress"] .sync-progress-value');
        return progressElement ? parseInt(progressElement.textContent) : 0;
      `);

      // 检查同步日志
      const syncLog = await chromeMCP.evaluateScript(`
        const logElement = document.querySelector('[data-testid="sync-log"]');
        return logElement ? logElement.textContent : '';
      `);

      console.log(`同步进度: ${syncProgress}%, 日志: ${syncLog}`);

      await chromeMCP.waitForTimeout(2000);
    }

    // 截图保存同步完成状态
    await chromeMCP.takeScreenshot({
      filename: 'data-sync-completed'
    });

    // 步骤 4: 验证同步结果
    await chromeMCP.waitForElement('[data-testid="sync-results"]');

    const syncResults = await chromeMCP.getWebContent();
    expect(syncResults.textContent).toContain('同步完成');

    // 验证同步统计
    const syncStats = await chromeMCP.getElementContent('[data-testid="sync-stats"]');
    expect(syncStats).toContain('新增');
    expect(syncStats).toContain('更新');
    expect(syncStats).toContain('跳过');

    // 截图保存同步结果
    await chromeMCP.takeScreenshot({
      filename: 'data-sync-results'
    });
  });
});

test.describe('📤 高级数据导出测试', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 模拟数据管理员登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-data-admin-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'data-admin',
        permissions: ['data_export', 'patient_view', 'report_generate']
      }));
    `);
  });

  test('多格式数据导出测试', async ({ chromeMCP }) => {
    // 导航到导出页面
    await chromeMCP.navigate('http://localhost:4174/export');
    await chromeMCP.waitForElement('[data-testid="export-page"]');

    // 步骤 1: 设置导出参数
    await chromeMCP.waitForElement('[data-testid="export-configuration"]');

    // 选择数据范围
    await chromeMCP.clickElement('input[name="dataRange"][value="filtered"]');

    // 设置筛选条件
    await chromeMCP.clickElement('[data-testid="date-range-filter"]');

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

    // 截图保存导出参数设置
    await chromeMCP.takeScreenshot({
      filename: 'export-parameters-configured'
    });

    // 步骤 2: 测试 Excel 导出
    await chromeMCP.clickElement('[data-testid="excel-export-tab"]');

    await chromeMCP.waitForElement('[data-testid="excel-export-options"]');

    // 配置 Excel 导出选项
    await chromeMCP.clickElement('input[name="includeCharts"][value="true"]');
    await chromeMCP.clickElement('input[name="includeImages"][value="true"]');
    await chromeMCP.clickElement('input[name="multiSheet"][value="true"]');

    // 选择要导出的字段
    const excelFields = [
      'basic_info',
      'medical_info',
      'treatment_history',
      'contact_info',
      'status_history'
    ];

    for (const field of excelFields) {
      const fieldCheckbox = await chromeMCP.findElement(`input[name="excelFields"][value="${field}"]`);
      if (fieldCheckbox) {
        await chromeMCP.clickElement(fieldCheckbox.selector);
      }
    }

    // 截图保存 Excel 导出配置
    await chromeMCP.takeScreenshot({
      filename: 'excel-export-configured'
    });

    // 开始 Excel 导出
    await chromeMCP.clickElement('button:has-text("导出Excel"), [data-testid="export-excel"]');

    // 监控导出进度
    await chromeMCP.waitForElement('[data-testid="excel-export-progress"]');

    let excelProgress = 0;
    const excelStartTime = Date.now();
    const excelTimeout = 90000; // 1.5分钟超时

    while (excelProgress < 100 && (Date.now() - excelStartTime) < excelTimeout) {
      excelProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="excel-export-progress"] .progress-value');
        return progressElement ? parseInt(progressElement.textContent) : 0;
      `);

      await chromeMCP.waitForTimeout(2000);
    }

    // 验证 Excel 导出完成
    const excelComplete = await chromeMCP.findElement('[data-testid="excel-export-complete"]');
    expect(excelComplete).toBeTruthy();

    // 下载 Excel 文件
    const excelDownload = await chromeMCP.findElement('a[download*="xlsx"], button:has-text("下载Excel")');
    if (excelDownload) {
      await chromeMCP.clickElement(excelDownload.selector);
      await chromeMCP.waitForTimeout(2000);
    }

    // 截图保存 Excel 导出结果
    await chromeMCP.takeScreenshot({
      filename: 'excel-export-completed'
    });

    // 步骤 3: 测试 PDF 报告导出
    await chromeMCP.clickElement('[data-testid="pdf-export-tab"]');

    await chromeMCP.waitForElement('[data-testid="pdf-export-options"]');

    // 配置 PDF 导出选项
    await chromeMCP.clickElement('input[name="reportType"][value="comprehensive"]');
    await chromeMCP.clickElement('input[name="includeCharts"][value="true"]');
    await chromeMCP.clickElement('input[name="includeImages"][value="true"]');

    // 设置 PDF 样式
    await chromeMCP.clickElement('input[name="pdfStyle"][value="professional"]');

    // 截图保存 PDF 导出配置
    await chromeMCP.takeScreenshot({
      filename: 'pdf-export-configured'
    });

    // 开始 PDF 导出
    await chromeMCP.clickElement('button:has-text("导出PDF"), [data-testid="export-pdf"]');

    // 监控 PDF 导出进度
    await chromeMCP.waitForElement('[data-testid="pdf-export-progress"]');

    let pdfProgress = 0;
    const pdfStartTime = Date.now();
    const pdfTimeout = 120000; // 2分钟超时

    while (pdfProgress < 100 && (Date.now() - pdfStartTime) < pdfTimeout) {
      pdfProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="pdf-export-progress"] .progress-value');
        return progressElement ? parseInt(progressElement.textContent) : 0;
      `);

      await chromeMCP.waitForTimeout(3000);
    }

    // 验证 PDF 导出完成
    const pdfComplete = await chromeMCP.findElement('[data-testid="pdf-export-complete"]');
    expect(pdfComplete).toBeTruthy();

    // 下载 PDF 文件
    const pdfDownload = await chromeMCP.findElement('a[download*="pdf"], button:has-text("下载PDF")');
    if (pdfDownload) {
      await chromeMCP.clickElement(pdfDownload.selector);
      await chromeMCP.waitForTimeout(2000);
    }

    // 截图保存 PDF 导出结果
    await chromeMCP.takeScreenshot({
      filename: 'pdf-export-completed'
    });

    // 步骤 4: 测试 CSV 数据导出
    await chromeMCP.clickElement('[data-testid="csv-export-tab"]');

    await chromeMCP.waitForElement('[data-testid="csv-export-options"]');

    // 配置 CSV 导出选项
    await chromeMCP.clickElement('input[name="csvFormat"][value="utf8"]');
    await chromeMCP.clickElement('input[name="delimiter"][value="comma"]');

    // 选择要导出的数据表
    await chromeMCP.clickElement('input[name="exportTables"][value="patients"]');
    await chromeMCP.clickElement('input[name="exportTables"][value="treatments"]');

    // 截图保存 CSV 导出配置
    await chromeMCP.takeScreenshot({
      filename: 'csv-export-configured'
    });

    // 开始 CSV 导出
    await chromeMCP.clickElement('button:has-text("导出CSV"), [data-testid="export-csv"]');

    // 监控 CSV 导出进度
    await chromeMCP.waitForElement('[data-testid="csv-export-progress"]');

    let csvProgress = 0;
    const csvStartTime = Date.now();
    const csvTimeout = 60000; // 1分钟超时

    while (csvProgress < 100 && (Date.now() - csvStartTime) < csvTimeout) {
      csvProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="csv-export-progress"] .progress-value');
        return progressElement ? parseInt(progressElement.textContent) : 0;
      `);

      await chromeMCP.waitForTimeout(1000);
    }

    // 验证 CSV 导出完成
    const csvComplete = await chromeMCP.findElement('[data-testid="csv-export-complete"]');
    expect(csvComplete).toBeTruthy();

    // 下载 CSV 文件
    const csvDownload = await chromeMCP.findElement('a[download*="csv"], button:has-text("下载CSV")');
    if (csvDownload) {
      await chromeMCP.clickElement(csvDownload.selector);
      await chromeMCP.waitForTimeout(2000);
    }

    // 截图保存 CSV 导出结果
    await chromeMCP.takeScreenshot({
      filename: 'csv-export-completed'
    });

    // 步骤 5: 验证导出历史
    await chromeMCP.clickElement('[data-testid="export-history-tab"]');

    await chromeMCP.waitForElement('[data-testid="export-history"]');

    // 验证导出记录
    const exportHistory = await chromeMCP.findElements('[data-testid="export-record"]');
    expect(exportHistory.length).toBeGreaterThanOrEqual(3);

    // 检查导出文件详情
    const firstExportRecord = exportHistory[0];
    const recordContent = await chromeMCP.getElementContent(firstExportRecord.selector);
    expect(recordContent).toContain('导出');
    expect(recordContent).toContain('完成');

    // 截图保存导出历史
    await chromeMCP.takeScreenshot({
      filename: 'export-history-verification'
    });
  });

  test('自定义报表生成测试', async ({ chromeMCP }) => {
    // 导航到报表页面
    await chromeMCP.navigate('http://localhost:4174/reports');
    await chromeMCP.waitForElement('[data-testid="reports-page"]');

    // 步骤 1: 创建自定义报表
    await chromeMCP.clickElement('button:has-text("创建报表"), [data-testid="create-report"]');

    await chromeMCP.waitForElement('[data-testid="report-creator"]');

    // 设置报表基本信息
    await chromeMCP.typeText('input[name="reportName"], [data-testid="report-name"]', '患者综合分析报表');
    await chromeMCP.typeText('textarea[name="reportDescription"], [data-testid="report-description"]', '包含患者基本信息、治疗记录和统计分析的综合报表');

    // 截图保存报表基本信息
    await chromeMCP.takeScreenshot({
      filename: 'report-basic-info'
    });

    // 步骤 2: 配置数据源
    await chromeMCP.clickElement('button:has-text("下一步"), [data-testid="next-step"]');

    await chromeMCP.waitForElement('[data-testid="data-source-config"]');

    // 选择数据表
    await chromeMCP.clickElement('input[name="dataSource"][value="patients"]');
    await chromeMCP.clickElement('input[name="dataSource"][value="treatments"]');
    await chromeMCP.clickElement('input[name="dataSource"][value="visits"]');

    // 设置关联关系
    await chromeMCP.clickElement('input[name="relationship"][value="patient_treatments"]');

    // 截图保存数据源配置
    await chromeMCP.takeScreenshot({
      filename: 'report-data-source-config'
    });

    // 步骤 3: 配置报表字段
    await chromeMCP.clickElement('button:has-text("下一步"), [data-testid="next-step"]');

    await chromeMCP.waitForElement('[data-testid="field-selector"]');

    // 选择要包含的字段
    const fieldsToInclude = [
      'patient_name',
      'age',
      'gender',
      'diagnosis',
      'admission_date',
      'treatment_plan',
      'doctor_name',
      'department',
      'status'
    ];

    for (const field of fieldsToInclude) {
      const fieldCheckbox = await chromeMCP.findElement(`input[name="fields"][value="${field}"]`);
      if (fieldCheckbox) {
        await chromeMCP.clickElement(fieldCheckbox.selector);
      }
    }

    // 设置字段显示名称
    await chromeMCP.evaluateScript(`
      const fieldMappings = {
        'patient_name': '患者姓名',
        'age': '年龄',
        'gender': '性别',
        'diagnosis': '诊断',
        'admission_date': '入院日期',
        'treatment_plan': '治疗方案',
        'doctor_name': '主治医生',
        'department': '科室',
        'status': '当前状态'
      };

      Object.entries(fieldMappings).forEach(([field, displayName]) => {
        const input = document.querySelector(\`input[name="display_${field}"]\`);
        if (input) {
          input.value = displayName;
        }
      });
    `);

    // 截图保存字段配置
    await chromeMCP.takeScreenshot({
      filename: 'report-field-config'
    });

    // 步骤 4: 配置筛选和排序
    await chromeMCP.clickElement('button:has-text("下一步"), [data-testid="next-step"]');

    await chromeMCP.waitForElement('[data-testid="filter-sort-config"]');

    // 设置默认筛选条件
    await chromeMCP.clickElement('input[name="defaultFilter"][value="active_patients"]');

    // 设置排序规则
    await chromeMCP.clickElement('select[name="sortBy"]');
    await chromeMCP.clickElement('option[value="admission_date"]');

    await chromeMCP.clickElement('select[name="sortOrder"]');
    await chromeMCP.clickElement('option[value="desc"]');

    // 截图保存筛选排序配置
    await chromeMCP.takeScreenshot({
      filename: 'report-filter-sort-config'
    });

    // 步骤 5: 配置可视化
    await chromeMCP.clickElement('button:has-text("下一步"), [data-testid="next-step"]');

    await chromeMCP.waitForElement('[data-testid="visualization-config"]');

    // 选择图表类型
    await chromeMCP.clickElement('input[name="chartType"][value="bar"]');
    await chromeMCP.clickElement('input[name="chartType"][value="pie"]');
    await chromeMCP.clickElement('input[name="chartType"][value="line"]');

    // 设置图表数据源
    await chromeMCP.evaluateScript(`
      const chartConfigs = {
        'bar': {
          xAxis: 'department',
          yAxis: 'count',
          title: '各科室患者分布'
        },
        'pie': {
          valueField: 'gender',
          title: '患者性别分布'
        },
        'line': {
          xAxis: 'admission_date',
          yAxis: 'count',
          title: '入院趋势分析'
        }
      };

      Object.entries(chartConfigs).forEach(([chartType, config]) => {
        const configElement = document.querySelector(\`[data-chart-type="${chartType}"]\`);
        if (configElement) {
          configElement.dataset.config = JSON.stringify(config);
        }
      });
    `);

    // 截图保存可视化配置
    await chromeMCP.takeScreenshot({
      filename: 'report-visualization-config'
    });

    // 步骤 6: 生成报表
    await chromeMCP.clickElement('button:has-text("生成报表"), [data-testid="generate-report"]');

    // 监控报表生成进度
    await chromeMCP.waitForElement('[data-testid="report-generation-progress"]');

    let reportProgress = 0;
    const reportStartTime = Date.now();
    const reportTimeout = 180000; // 3分钟超时

    while (reportProgress < 100 && (Date.now() - reportStartTime) < reportTimeout) {
      reportProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="report-generation-progress"] .progress-value');
        return progressElement ? parseInt(progressElement.textContent) : 0;
      `);

      await chromeMCP.waitForTimeout(3000);
    }

    // 验证报表生成完成
    await chromeMCP.waitForElement('[data-testid="report-preview"]');

    // 截图保存生成的报表
    await chromeMCP.takeScreenshot({
      fullPage: true,
      filename: 'generated-custom-report'
    });

    // 步骤 7: 验证报表内容
    const reportContent = await chromeMCP.getWebContent();
    expect(reportContent.textContent).toContain('患者综合分析报表');
    expect(reportContent.textContent).toContain('患者姓名');
    expect(reportContent.textContent).toContain('年龄');
    expect(reportContent.textContent).toContain('诊断');

    // 验证图表渲染
    const charts = await chromeMCP.findElements('canvas, .chart-container');
    expect(charts.length).toBeGreaterThanOrEqual(3);

    // 截图保存图表详情
    for (let i = 0; i < Math.min(charts.length, 3); i++) {
      await chromeMCP.takeScreenshot({
        element: charts[i].selector,
        filename: `report-chart-${i + 1}`
      });
    }

    // 步骤 8: 导出生成的报表
    await chromeMCP.clickElement('button:has-text("导出报表"), [data-testid="export-report"]');

    await chromeMCP.waitForElement('[data-testid="export-options"]');

    // 选择导出格式
    await chromeMCP.clickElement('input[name="exportFormat"][value="pdf"]');
    await chromeMCP.clickElement('input[name="includeData"][value="true"]');
    await chromeMCP.clickElement('input[name="includeCharts"][value="true"]');

    // 开始导出
    await chromeMCP.clickElement('button:has-text("确认导出"), [data-testid="confirm-export"]');

    // 等待导出完成
    await chromeMCP.waitForTimeout(5000);

    // 验证导出成功
    const exportSuccess = await chromeMCP.findElement('.export-success, .toast-success');
    expect(exportSuccess).toBeTruthy();

    // 截图保存报表导出结果
    await chromeMCP.takeScreenshot({
      filename: 'custom-report-export-success'
    });
  });
});

test.describe('🗂️ 媒体文件管理测试', () => {

  test.beforeEach(async ({ chromeMCP }) => {
    // 模拟管理员登录
    await chromeMCP.navigate('http://localhost:4174/login');
    await chromeMCP.injectScript(`
      localStorage.setItem('userToken', 'mock-media-admin-token');
      localStorage.setItem('userInfo', JSON.stringify({
        roles: ['admin'],
        username: 'media-admin',
        permissions: ['media_upload', 'media_download', 'media_manage']
      }));
    `);
  });

  test('患者媒体文件上传和管理', async ({ chromeMCP }) => {
    // 导航到患者详情页面
    await chromeMCP.navigate('http://localhost:4174/patients');
    await chromeMCP.waitForElement('[data-testid="patient-list"]');

    // 选择第一个患者
    const firstPatient = await chromeMCP.findElement('[data-testid="patient-item"]');
    if (firstPatient) {
      await chromeMCP.clickElement(firstPatient.selector);
      await chromeMCP.waitForElement('[data-testid="patient-detail"]');
    }

    // 步骤 1: 上传医疗图片
    await chromeMCP.clickElement('[data-testid="media-tab"]');
    await chromeMCP.waitForElement('[data-testid="media-manager"]');

    await chromeMCP.clickElement('button:has-text("上传文件"), [data-testid="upload-button"]');

    await chromeMCP.waitForElement('[data-testid="upload-modal"]');

    // 模拟文件上传
    await chromeMCP.evaluateScript(`
      const fileInput = document.querySelector('input[type="file"], [data-testid="file-input"]');
      if (fileInput) {
        // 创建模拟的医疗图片文件
        const imageFiles = [
          new File(['模拟X光图片数据'], 'xray_001.jpg', { type: 'image/jpeg' }),
          new File(['模拟CT扫描数据'], 'ct_scan_001.jpg', { type: 'image/jpeg' }),
          new File(['模拟MRI数据'], 'mri_001.jpg', { type: 'image/jpeg' })
        ];

        const dataTransfer = new DataTransfer();
        imageFiles.forEach(file => dataTransfer.items.add(file));

        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    `);

    // 等待文件处理
    await chromeMCP.waitForTimeout(2000);

    // 截图保存文件选择状态
    await chromeMCP.takeScreenshot({
      filename: 'medical-files-selected'
    });

    // 设置文件描述
    const fileDescriptions = [
      '胸部X光片 - 初步诊断',
      '头部CT扫描 - 详细检查',
      '腰椎MRI - 进一步评估'
    ];

    await chromeMCP.evaluateScript(`
      const descriptions = ${JSON.stringify(fileDescriptions)};
      const descriptionInputs = document.querySelectorAll('input[name="fileDescription"], textarea[name="fileDescription"]');

      descriptions.forEach((desc, index) => {
        if (descriptionInputs[index]) {
          descriptionInputs[index].value = desc;
        }
      });
    `);

    // 设置文件分类
    await chromeMCP.evaluateScript(`
      const categories = ['xray', 'ct_scan', 'mri'];
      const categorySelects = document.querySelectorAll('select[name="fileCategory"]');

      categories.forEach((category, index) => {
        if (categorySelects[index]) {
          const option = categorySelects[index].querySelector(\`option[value="${category}"]\`);
          if (option) {
            categorySelects[index].value = category;
          }
        }
      });
    `);

    // 截图保存文件信息配置
    await chromeMCP.takeScreenshot({
      filename: 'file-info-configured'
    });

    // 开始上传
    await chromeMCP.clickElement('button:has-text("开始上传"), [data-testid="start-upload"]');

    // 监控上传进度
    await chromeMCP.waitForElement('[data-testid="upload-progress"]');

    let uploadProgress = 0;
    const uploadStartTime = Date.now();
    const uploadTimeout = 120000; // 2分钟超时

    while (uploadProgress < 100 && (Date.now() - uploadStartTime) < uploadTimeout) {
      uploadProgress = await chromeMCP.evaluateScript(`
        const progressElement = document.querySelector('[data-testid="upload-progress"] .progress-value');
        return progressElement ? parseInt(progressElement.textContent) : 0;
      `);

      await chromeMCP.waitForTimeout(2000);
    }

    // 验证上传完成
    const uploadComplete = await chromeMCP.findElement('[data-testid="upload-complete"]');
    expect(uploadComplete).toBeTruthy();

    // 截图保存上传完成状态
    await chromeMCP.takeScreenshot({
      filename: 'file-upload-completed'
    });

    // 步骤 2: 验证文件管理界面
    await chromeMCP.waitForElement('[data-testid="media-gallery"]');

    // 检查上传的文件
    const uploadedFiles = await chromeMCP.findElements('[data-testid="media-file"]');
    expect(uploadedFiles.length).toBeGreaterThanOrEqual(3);

    // 截图保存媒体文件库
    await chromeMCP.takeScreenshot({
      filename: 'media-gallery-view'
    });

    // 步骤 3: 测试文件预览功能
    const firstMediaFile = uploadedFiles[0];
    if (firstMediaFile) {
      await chromeMCP.clickElement(`${firstMediaFile.selector} [data-testid="preview-button"]`);

      await chromeMCP.waitForElement('[data-testid="preview-modal"]');

      // 验证预览内容
      const previewContent = await chromeMCP.getWebContent();
      expect(previewContent.textContent).toContain('预览');

      // 截图保存文件预览
      await chromeMCP.takeScreenshot({
        filename: 'file-preview-modal'
      });

      // 关闭预览
      await chromeMCP.clickElement('button:has-text("关闭"), [data-testid="close-preview"]');
    }

    // 步骤 4: 测试文件编辑功能
    await chromeMCP.clickElement(`${firstMediaFile.selector} [data-testid="edit-button"]`);

    await chromeMCP.waitForElement('[data-testid="edit-modal"]');

    // 修改文件描述
    const descriptionInput = await chromeMCP.findElement('textarea[name="description"]');
    if (descriptionInput) {
      await chromeMCP.clearText(descriptionInput.selector);
      await chromeMCP.typeText(descriptionInput.selector, '更新后的文件描述 - 包含详细诊断信息');
    }

    // 修改文件分类
    const categorySelect = await chromeMCP.findElement('select[name="category"]');
    if (categorySelect) {
      await chromeMCP.clickElement(categorySelect.selector);
      await chromeMCP.clickElement('option[value="updated_category"]');
    }

    // 截图保存文件编辑界面
    await chromeMCP.takeScreenshot({
      filename: 'file-edit-modal'
    });

    // 保存修改
    await chromeMCP.clickElement('button:has-text("保存"), [data-testid="save-changes"]');

    // 验证保存成功
    const saveSuccess = await chromeMCP.findElement('.save-success, .toast-success');
    expect(saveSuccess).toBeTruthy();

    // 截图保存编辑成功状态
    await chromeMCP.takeScreenshot({
      filename: 'file-edit-success'
    });

    // 步骤 5: 测试批量操作
    // 选择多个文件
    const checkboxes = await chromeMCP.findElements('input[type="checkbox"][name="select-file"]');

    for (let i = 0; i < Math.min(2, checkboxes.length); i++) {
      await chromeMCP.clickElement(checkboxes[i].selector);
    }

    // 测试批量下载
    await chromeMCP.clickElement('button:has-text("批量下载"), [data-testid="batch-download"]');

    await chromeMCP.waitForElement('[data-testid="download-options"]');

    await chromeMCP.clickElement('input[name="downloadFormat"][value="zip"]');
    await chromeMCP.clickElement('button:has-text("确认下载")');

    // 等待下载处理
    await chromeMCP.waitForTimeout(5000);

    // 验证下载成功
    const downloadSuccess = await chromeMCP.findElement('.download-success, .toast-success');
    expect(downloadSuccess).toBeTruthy();

    // 截图保存批量下载结果
    await chromeMCP.takeScreenshot({
      filename: 'batch-download-success'
    });

    // 步骤 6: 测试文件搜索和筛选
    await chromeMCP.clickElement('input[placeholder*="搜索文件"]');
    await chromeMCP.typeText('input[placeholder*="搜索文件"]', 'xray');

    await chromeMCP.pressKey('Enter');
    await chromeMCP.waitForTimeout(2000);

    // 验证搜索结果
    const searchResults = await chromeMCP.getWebContent();
    expect(searchResults.textContent).toContain('xray');

    // 截图保存搜索结果
    await chromeMCP.takeScreenshot({
      filename: 'file-search-results'
    });

    // 测试分类筛选
    await chromeMCP.clickElement('select[name="categoryFilter"]');
    await chromeMCP.clickElement('option[value="xray"]');

    await chromeMCP.waitForTimeout(2000);

    // 验证筛选结果
    const filteredResults = await chromeMCP.getWebContent();
    expect(filteredResults.textContent).toContain('xray');

    // 截图保存筛选结果
    await chromeMCP.takeScreenshot({
      filename: 'file-filter-results'
    });
  });
});