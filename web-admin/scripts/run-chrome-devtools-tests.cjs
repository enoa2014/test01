#!/usr/bin/env node

/**
 * Chrome DevTools E2E测试运行脚本
 *
 * 功能：
 * 1. 启动Chrome DevTools增强的E2E测试
 * 2. 生成详细的性能和调试报告
 * 3. 支持不同的测试模式和配置
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  TEST_FILES: [
    'chrome-devtools-infrastructure.spec.ts',
    'chrome-devtools-advanced.spec.ts',
    'chrome-devtools-business-workflows.spec.ts'
  ],
  REPORT_DIR: 'test-results/chrome-devtools',
  BASE_URL: process.env.PW_BASE_URL || 'http://localhost:5178',
  PARALLEL: process.env.CI ? false : true,
  HEADED: process.env.HEADED === 'true',
  BROWSER: process.env.BROWSER || 'chromium'
};

// 创建报告目录
function ensureReportDir() {
  if (!fs.existsSync(CONFIG.REPORT_DIR)) {
    fs.mkdirSync(CONFIG.REPORT_DIR, { recursive: true });
  }
}

// 运行Playwright测试
async function runPlaywrightTests(testFiles = CONFIG.TEST_FILES) {
  return new Promise((resolve, reject) => {
    console.log('🚀 开始运行Chrome DevTools E2E测试...');
    console.log(`📁 测试文件: ${testFiles.join(', ')}`);
    console.log(`🌐 测试地址: ${CONFIG.BASE_URL}`);
    console.log(`🖥️  浏览器: ${CONFIG.BROWSER}`);
    console.log(`📖 有界面模式: ${CONFIG.HEADED ? '是' : '否'}`);
    console.log('');

    const playwrightArgs = [
      'test',
      ...testFiles,
      `--project=${CONFIG.BROWSER}`,
      `--base-url=${CONFIG.BASE_URL}`
    ];

    if (CONFIG.HEADED) {
      playwrightArgs.push('--headed');
    }

    if (!CONFIG.PARALLEL) {
      playwrightArgs.push('--workers=1');
    }

    const playwrightProcess = spawn('npx', ['playwright', ...playwrightArgs], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    playwrightProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Chrome DevTools E2E测试完成');
        resolve(code);
      } else {
        console.log(`❌ 测试失败，退出码: ${code}`);
        reject(new Error(`Playwright tests failed with code ${code}`));
      }
    });

    playwrightProcess.on('error', (error) => {
      console.error('❌ 运行测试时出错:', error);
      reject(error);
    });
  });
}

// 生成测试报告摘要
function generateTestSummary() {
  const summaryPath = path.join(CONFIG.REPORT_DIR, 'test-summary.json');
  const timestamp = new Date().toISOString();

  try {
    // 读取Playwright报告（如果存在）
    const playwrightReportPath = 'playwright-report';
    let hasPlaywrightReport = false;

    if (fs.existsSync(playwrightReportPath)) {
      hasPlaywrightReport = true;
    }

    // 检查测试结果文件
    const testResultsDir = CONFIG.REPORT_DIR;
    const testResultFiles = fs.existsSync(testResultsDir)
      ? fs.readdirSync(testResultsDir).filter(file => file.endsWith('.png'))
      : [];

    const summary = {
      timestamp,
      testConfig: CONFIG,
      results: {
        playwrightReportExists: hasPlaywrightReport,
        screenshotsCount: testResultFiles.length,
        testFiles: CONFIG.TEST_FILES
      },
      recommendations: []
    };

    // 添加建议
    if (testResultFiles.length > 0) {
      summary.recommendations.push('已生成截图文件，建议查看以分析UI状态');
    }

    if (hasPlaywrightReport) {
      summary.recommendations.push('已生成Playwright HTML报告，运行 `npm run e2e:report` 查看');
    }

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📊 测试摘要已生成: ${summaryPath}`);

    return summary;
  } catch (error) {
    console.error('⚠️ 生成测试摘要时出错:', error.message);
    return null;
  }
}

// 显示测试结果
function displayResults() {
  const reportPath = path.join(CONFIG.REPORT_DIR, 'test-summary.json');

  if (fs.existsSync(reportPath)) {
    const summary = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

    console.log('');
    console.log('📋 测试结果摘要:');
    console.log(`   ⏰ 测试时间: ${summary.timestamp}`);
    console.log(`   📁 测试文件数: ${summary.results.testFiles.length}`);
    console.log(`   📸 截图数量: ${summary.results.screenshotsCount}`);
    console.log(`   📊 Playwright报告: ${summary.results.playwrightReportExists ? '已生成' : '未生成'}`);

    if (summary.recommendations.length > 0) {
      console.log('');
      console.log('💡 建议:');
      summary.recommendations.forEach(rec => {
        console.log(`   - ${rec}`);
      });
    }
  }
}

// 主函数
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];

    ensureReportDir();

    switch (command) {
      case 'infrastructure':
        console.log('🔧 运行基础设施测试...');
        await runPlaywrightTests(['chrome-devtools-infrastructure.spec.ts']);
        break;

      case 'advanced':
        console.log('⚡ 运行高级功能测试...');
        await runPlaywrightTests(['chrome-devtools-advanced.spec.ts']);
        break;

      case 'business':
        console.log('💼 运行业务流程测试...');
        await runPlaywrightTests(['chrome-devtools-business-workflows.spec.ts']);
        break;

      case 'all':
      default:
        console.log('🎯 运行所有Chrome DevTools测试...');
        await runPlaywrightTests();
        break;
    }

    // 生成测试摘要
    generateTestSummary();

    // 显示结果
    displayResults();

    console.log('');
    console.log('✨ Chrome DevTools E2E测试流程完成!');

  } catch (error) {
    console.error('💥 测试运行失败:', error.message);
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  runPlaywrightTests,
  generateTestSummary,
  CONFIG
};