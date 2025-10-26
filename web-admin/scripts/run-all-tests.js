#!/usr/bin/env node

/**
 * 综合测试运行脚本
 * 运行所有类型的测试并生成综合报告
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logTestResult(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const color = passed ? 'green' : 'red';
  log(`  ${status} ${testName}`, color);
  if (details) {
    log(`    ${details}`, 'yellow');
  }
}

// 测试结果存储
const testResults = {
  unit: { passed: 0, failed: 0, details: [] },
  integration: { passed: 0, failed: 0, details: [] },
  e2e: { passed: 0, failed: 0, details: [] },
  coverage: { percentage: 0, details: '' }
};

// 运行命令并捕获输出
function runCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout || '',
      error: error.stderr || error.message
    };
  }
}

// 运行单元测试
function runUnitTests() {
  logSection('运行单元测试');

  const result = runCommand('npm run test:run -- --run --reporter=verbose', {
    cwd: process.cwd()
  });

  if (result.success) {
    log('✅ 单元测试执行成功', 'green');

    // 解析输出以获取测试统计
    const lines = result.output.split('\n');
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const line of lines) {
      if (line.includes('✓') || line.includes('✔')) {
        passedTests++;
        totalTests++;
      } else if (line.includes('✗') || line.includes('✕') || line.includes('❌')) {
        failedTests++;
        totalTests++;
      }
    }

    testResults.unit.passed = passedTests;
    testResults.unit.failed = failedTests;
    testResults.unit.details.push(`总计: ${totalTests}, 通过: ${passedTests}, 失败: ${failedTests}`);

    logTestResult('单元测试套件', failedTests === 0, `通过率: ${((passedTests/totalTests)*100).toFixed(1)}%`);
  } else {
    log('❌ 单元测试执行失败', 'red');
    log(result.error, 'yellow');
    testResults.unit.failed = 1;
    testResults.unit.details.push('执行失败');
  }
}

// 运行集成测试
function runIntegrationTests() {
  logSection('运行集成测试');

  // 运行组件集成测试
  const componentTests = [
    'src/pages/__tests__/DashboardPage.test.tsx',
    'src/pages/__tests__/PatientListPage.test.tsx',
    'src/pages/__tests__/ImportPage.test.tsx',
    'src/hooks/__tests__/useCloudFunction.test.ts'
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  for (const testFile of componentTests) {
    const result = runCommand(`npm run test:run -- --run ${testFile}`, {
      cwd: process.cwd()
    });

    const testName = path.basename(testFile, '.test.tsx');

    if (result.success) {
      totalPassed++;
      testResults.integration.passed++;
      testResults.integration.details.push(`${testName}: 通过`);
      logTestResult(testName, true);
    } else {
      totalFailed++;
      testResults.integration.failed++;
      testResults.integration.details.push(`${testName}: 失败`);
      logTestResult(testName, false);
    }
  }

  logTestResult('集成测试套件', totalFailed === 0, `通过: ${totalPassed}, 失败: ${totalFailed}`);
}

// 运行E2E测试
function runE2ETests() {
  logSection('运行E2E测试');

  // 检查是否有服务器运行
  const serverCheck = runCommand('curl -s http://localhost:4173 > nul 2>&1', { shell: true });

  if (!serverCheck.success) {
    log('⚠️  E2E测试服务器未运行，跳过E2E测试', 'yellow');
    testResults.e2e.details.push('服务器未运行，测试跳过');
    return;
  }

  const result = runCommand('npm run test:e2e -- --reporter=list', {
    cwd: process.cwd(),
    timeout: 120000 // 2分钟超时
  });

  if (result.success) {
    log('✅ E2E测试执行成功', 'green');

    // 解析E2E测试结果
    const lines = result.output.split('\n');
    let passedCount = 0;
    let failedCount = 0;

    for (const line of lines) {
      if (line.includes('✓') || line.includes('passed')) {
        passedCount++;
      } else if (line.includes('✗') || line.includes('failed')) {
        failedCount++;
      }
    }

    testResults.e2e.passed = passedCount;
    testResults.e2e.failed = failedCount;
    testResults.e2e.details.push(`总计: ${passedCount + failedCount}, 通过: ${passedCount}, 失败: ${failedCount}`);

    logTestResult('E2E测试套件', failedCount === 0, `通过率: ${((passedCount/(passedCount+failedCount))*100).toFixed(1)}%`);
  } else {
    log('❌ E2E测试执行失败', 'red');
    testResults.e2e.failed = 1;
    testResults.e2e.details.push('执行失败');
  }
}

// 生成覆盖率报告
function generateCoverageReport() {
  logSection('生成测试覆盖率报告');

  const result = runCommand('npm run test:coverage', {
    cwd: process.cwd()
  });

  if (result.success) {
    log('✅ 覆盖率报告生成成功', 'green');

    // 尝试提取覆盖率百分比
    const lines = result.output.split('\n');
    for (const line of lines) {
      if (line.includes('All files') && line.includes('%')) {
        const match = line.match(/(\d+(?:\.\d+)?)%/);
        if (match) {
          testResults.coverage.percentage = parseFloat(match[1]);
          testResults.coverage.details = line.trim();
          logTestResult('代码覆盖率', testResults.coverage.percentage >= 80, `${testResults.coverage.percentage}%`);
          break;
        }
      }
    }
  } else {
    log('❌ 覆盖率报告生成失败', 'red');
    testResults.coverage.details = '生成失败';
  }
}

// 生成综合报告
function generateReport() {
  logSection('生成综合测试报告');

  const totalTests = testResults.unit.passed + testResults.unit.failed +
                    testResults.integration.passed + testResults.integration.failed +
                    testResults.e2e.passed + testResults.e2e.failed;
  const totalPassed = testResults.unit.passed + testResults.integration.passed + testResults.e2e.passed;
  const totalFailed = testResults.unit.failed + testResults.integration.failed + testResults.e2e.failed;
  const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : 0;

  const report = `
# 🧪 综合测试报告

**生成时间**: ${new Date().toLocaleString('zh-CN')}
**测试环境**: Node.js ${process.version}

## 📊 测试概览

| 测试类型 | 通过 | 失败 | 通过率 |
|---------|------|------|--------|
| 单元测试 | ${testResults.unit.passed} | ${testResults.unit.failed} | ${testResults.unit.passed + testResults.unit.failed > 0 ? ((testResults.unit.passed/(testResults.unit.passed+testResults.unit.failed))*100).toFixed(1) : 0}% |
| 集成测试 | ${testResults.integration.passed} | ${testResults.integration.failed} | ${testResults.integration.passed + testResults.integration.failed > 0 ? ((testResults.integration.passed/(testResults.integration.passed+testResults.integration.failed))*100).toFixed(1) : 0}% |
| E2E测试 | ${testResults.e2e.passed} | ${testResults.e2e.failed} | ${testResults.e2e.passed + testResults.e2e.failed > 0 ? ((testResults.e2e.passed/(testResults.e2e.passed+testResults.e2e.failed))*100).toFixed(1) : 0}% |

### 📈 总体统计
- **总测试数**: ${totalTests}
- **通过测试**: ${totalPassed}
- **失败测试**: ${totalFailed}
- **总体通过率**: ${overallPassRate}%

## 🎯 代码覆盖率
- **覆盖率**: ${testResults.coverage.percentage}%
- **详情**: ${testResults.coverage.details}

## 📝 详细结果

### 单元测试详情
${testResults.unit.details.map(detail => `- ${detail}`).join('\n')}

### 集成测试详情
${testResults.integration.details.map(detail => `- ${detail}`).join('\n')}

### E2E测试详情
${testResults.e2e.details.map(detail => `- ${detail}`).join('\n')}

## 🚀 质量评估

${overallPassRate >= 90 ? '🟢 **优秀** - 测试质量很高，可以安全发布' :
  overallPassRate >= 80 ? '🟡 **良好** - 测试质量较好，建议修复失败的测试' :
  overallPassRate >= 70 ? '🟠 **一般** - 测试质量一般，需要改进' :
  '🔴 **需要改进** - 测试质量较低，需要重点关注'}

${testResults.coverage.percentage >= 80 ? '✅ 代码覆盖率达标' : '⚠️  代码覆盖率需要提升到80%以上'}

## 🛠️ 改进建议

1. ${totalFailed > 0 ? '优先修复失败的测试用例' : '继续维护现有测试用例'}
2. ${testResults.coverage.percentage < 80 ? '提升代码覆盖率到80%以上' : '保持或提升代码覆盖率'}
3. 定期运行测试以确保代码质量
4. 添加更多边界情况测试
5. 完善错误处理测试
`;

  // 写入报告文件
  const reportPath = path.join(process.cwd(), 'TEST_REPORT.md');
  fs.writeFileSync(reportPath, report);

  log(`📋 综合测试报告已生成: ${reportPath}`, 'green');

  // 显示简要总结
  log('\n📊 测试结果总结:', 'bright');
  log(`   总体通过率: ${overallPassRate}%`, overallPassRate >= 80 ? 'green' : 'yellow');
  log(`   代码覆盖率: ${testResults.coverage.percentage}%`, testResults.coverage.percentage >= 80 ? 'green' : 'yellow');
  log(`   状态: ${overallPassRate >= 80 ? '🟢 良好' : '🟡 需要改进'}`, overallPassRate >= 80 ? 'green' : 'yellow');
}

// 主函数
function main() {
  log('🚀 开始运行综合测试套件...', 'bright');
  log('测试时间:', new Date().toLocaleString('zh-CN'), 'cyan');

  try {
    runUnitTests();
    runIntegrationTests();
    runE2ETests();
    generateCoverageReport();
    generateReport();

    log('\n🎉 测试套件执行完成!', 'green');
  } catch (error) {
    log(`\n❌ 测试执行过程中发生错误: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  runUnitTests,
  runIntegrationTests,
  runE2ETests,
  generateCoverageReport,
  generateReport,
  testResults
};