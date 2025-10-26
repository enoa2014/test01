#!/usr/bin/env node

/**
 * Chrome DevTools E2E测试演示脚本
 *
 * 这个脚本演示了如何使用Chrome DevTools增强的E2E测试系统
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// 如果直接运行且有参数，先处理参数
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.includes('--usage')) {
  console.log('🎯 Chrome DevTools E2E测试演示');
  console.log('=====================================');
  console.log('');
  showUsage();
  process.exit(0);
}

console.log('🎯 Chrome DevTools E2E测试演示');
console.log('=====================================');
console.log('');

async function runDemo() {
  console.log('📋 演示流程:');
  console.log('1. 检查环境配置');
  console.log('2. 运行基础设施测试');
  console.log('3. 运行高级功能测试');
  console.log('4. 运行业务流程测试');
  console.log('5. 生成综合报告');
  console.log('');

  // 1. 检查环境
  console.log('🔍 检查环境配置...');
  await checkEnvironment();

  // 2. 运行测试
  console.log('🚀 开始运行测试套件...');

  try {
    // 基础设施测试
    console.log('\n📡 1/3 运行基础设施测试...');
    await runTestCommand('infrastructure');

    // 高级功能测试
    console.log('\n⚡ 2/3 运行高级功能测试...');
    await runTestCommand('advanced');

    // 业务流程测试
    console.log('\n💼 3/3 运行业务流程测试...');
    await runTestCommand('business');

    console.log('\n✅ 所有测试完成!');

    // 3. 显示结果
    console.log('\n📊 测试结果总结:');
    await displayResults();

  } catch (error) {
    console.error('\n❌ 测试运行失败:', error.message);
    process.exit(1);
  }
}

async function checkEnvironment() {
  return new Promise((resolve) => {
    const npmList = spawn('npm', ['list', '@playwright/test'], { stdio: 'pipe' });
    let output = '';

    npmList.stdout.on('data', (data) => {
      output += data.toString();
    });

    npmList.on('close', (code) => {
      if (code === 0 && output.includes('@playwright/test')) {
        console.log('✅ Playwright 已安装');
      } else {
        console.log('⚠️  Playwright 未正确安装，请运行: npm install');
      }
      resolve();
    });
  });
}

async function runTestCommand(testType) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const testProcess = spawn('node', ['scripts/run-chrome-devtools-tests.js', testType], {
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let errorOutput = '';

    testProcess.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      // 显示关键信息
      if (text.includes('✅') || text.includes('❌') || text.includes('⚠️')) {
        process.stdout.write(text);
      }
    });

    testProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });

    testProcess.on('close', (code) => {
      const duration = Date.now() - startTime;

      if (code === 0) {
        console.log(`   ✅ 完成 (${duration}ms)`);
        resolve();
      } else {
        console.log(`   ❌ 失败 (${duration}ms)`);
        reject(new Error(`Test process exited with code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      reject(error);
    });
  });
}

async function displayResults() {
  const reportPath = 'test-results/chrome-devtools/test-summary.json';

  if (fs.existsSync(reportPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

      console.log(`   ⏰ 测试时间: ${summary.timestamp}`);
      console.log(`   📁 测试文件数: ${summary.results.testFiles.length}`);
      console.log(`   📸 截图数量: ${summary.results.screenshotsCount}`);
      console.log(`   📊 Playwright报告: ${summary.results.playwrightReportExists ? '✅ 已生成' : '❌ 未生成'}`);

      if (summary.recommendations.length > 0) {
        console.log('\n💡 建议:');
        summary.recommendations.forEach(rec => {
          console.log(`   - ${rec}`);
        });
      }

      console.log('\n🔗 查看详细报告:');
      console.log('   Playwright HTML报告: npm run e2e:report');
      console.log(`   测试摘要: ${reportPath}`);

    } catch (error) {
      console.log('⚠️  无法读取测试报告:', error.message);
    }
  } else {
    console.log('⚠️  未找到测试报告文件');
  }
}

// 显示使用说明
function showUsage() {
  console.log('📖 使用说明:');
  console.log('');
  console.log('运行完整演示:');
  console.log('  node scripts/demo-chrome-devtools-testing.js');
  console.log('');
  console.log('运行特定测试类型:');
  console.log('  npm run test:e2e:chrome-devtools:infra     # 基础设施测试');
  console.log('  npm run test:e2e:chrome-devtools:advanced  # 高级功能测试');
  console.log('  npm run test:e2e:chrome-devtools:business  # 业务流程测试');
  console.log('');
  console.log('有界面模式运行:');
  console.log('  npm run test:e2e:chrome-devtools:headed');
  console.log('');
  console.log('查看测试报告:');
  console.log('  npm run e2e:report');
  console.log('');
}

// 主函数
async function main() {
  console.log('🎯 开始Chrome DevTools E2E测试演示');
  console.log('按Ctrl+C可以随时停止');
  console.log('');

  // 等待用户确认
  if (!process.env.CI) {
    console.log('按Enter键开始，或者添加 --usage 查看使用说明');

    // 设置raw模式以监听单个按键
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      runDemo().catch(console.error);
    });
  } else {
    runDemo().catch(console.error);
  }
}

// 处理中断信号
process.on('SIGINT', () => {
  console.log('\n\n🛑 测试被用户中断');
  process.exit(0);
});

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
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  runDemo,
  checkEnvironment,
  runTestCommand,
  displayResults
};