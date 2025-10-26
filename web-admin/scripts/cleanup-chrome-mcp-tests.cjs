#!/usr/bin/env node

/**
 * Chrome MCP 测试清理脚本
 * 清理测试结果、临时文件和缓存数据
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function removePath(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      log('green', `✅ 已删除: ${description}`);
      return true;
    } else {
      log('blue', `📄 不存在，跳过: ${description}`);
      return true;
    }
  } catch (error) {
    log('red', `❌ 删除失败: ${description} - ${error.message}`);
    return false;
  }
}

function cleanupTests() {
  log('cyan', '🧹 开始清理 Chrome MCP 测试环境...\n');

  let allSuccess = true;

  // 定义要清理的路径
  const cleanupPaths = [
    {
      path: path.join(process.cwd(), 'test-results'),
      desc: '测试结果目录'
    },
    {
      path: path.join(process.cwd(), 'playwright-report'),
      desc: 'Playwright 报告目录'
    },
    {
      path: path.join(process.cwd(), 'coverage'),
      desc: '代码覆盖率报告'
    },
    {
      path: path.join(process.cwd(), '.nyc_output'),
      desc: 'nyc 输出目录'
    },
    {
      path: path.join(process.cwd(), 'test-results.xml'),
      desc: 'JUnit 测试结果文件'
    },
    {
      path: path.join(process.cwd(), '.env.test'),
      desc: '测试环境配置文件'
    }
  ];

  // 清理文件和目录
  log('blue', '清理测试文件和目录:');
  cleanupPaths.forEach(({ path: filePath, desc }) => {
    const success = removePath(filePath, desc);
    allSuccess = allSuccess && success;
  });

  // 清理浏览器缓存和用户数据
  log('\nblue', '清理浏览器缓存:');
  const tempDirs = [
    {
      path: '/tmp/chrome-test-profile',
      desc: 'Chrome 测试用户配置'
    },
    {
      path: '/tmp/chrome-mobile-test-profile',
      desc: 'Chrome 移动端测试配置'
    },
    {
      path: '/tmp/chrome-tablet-test-profile',
      desc: 'Chrome 平板测试配置'
    },
    {
      path: '/tmp/chrome-performance-test-profile',
      desc: 'Chrome 性能测试配置'
    }
  ];

  tempDirs.forEach(({ path: dirPath, desc }) => {
    const success = removePath(dirPath, desc);
    allSuccess = allSuccess && success;
  });

  // 清理进程和端口
  log('\nblue', '清理相关进程:');
  try {
    // 查找并终止相关进程
    const processes = [
      'chrome',
      'chromium',
      'playwright',
      'node.*chrome-mcp'
    ];

    processes.forEach(proc => {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /F /IM ${proc}.exe 2>nul || echo "No ${proc} process found"`, { stdio: 'pipe' });
        } else {
          execSync(`pkill -f "${proc}" 2>/dev/null || echo "No ${proc} process found"`, { stdio: 'pipe' });
        }
        log('green', `✅ 已清理进程: ${proc}`);
      } catch (error) {
        log('blue', `📄 无需清理: ${proc} 进程`);
      }
    });
  } catch (error) {
    log('yellow', `⚠️ 进程清理时出现警告: ${error.message}`);
  }

  // 清理端口占用
  log('\nblue', '清理端口占用:');
  const ports = [9222, 9223, 9224, 9225];
  ports.forEach(port => {
    try {
      if (process.platform === 'win32') {
        execSync(`netstat -ano | findstr :${port} 2>nul`, { stdio: 'pipe' });
        log('yellow', `⚠️ 端口 ${port} 仍在使用，请手动检查`);
      } else {
        const result = execSync(`lsof -ti:${port} 2>/dev/null`, { stdio: 'pipe' });
        if (result.toString().trim()) {
          execSync(`kill -9 ${result.toString().trim()}`, { stdio: 'pipe' });
          log('green', `✅ 已释放端口: ${port}`);
        } else {
          log('blue', `📄 端口空闲: ${port}`);
        }
      }
    } catch (error) {
      log('blue', `📄 端口空闲: ${port}`);
    }
  });

  // 清理 npm 缓存（可选）
  const cleanNpmCache = process.argv.includes('--npm-cache');
  if (cleanNpmCache) {
    log('\nblue', '清理 npm 缓存:');
    try {
      execSync('npm cache clean --force', { stdio: 'inherit' });
      log('green', '✅ npm 缓存已清理');
    } catch (error) {
      log('red', `❌ npm 缓存清理失败: ${error.message}`);
      allSuccess = false;
    }
  }

  // 重新创建必要的目录结构
  log('\nblue', '重新创建目录结构:');
  const requiredDirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/html-report'
  ];

  requiredDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        log('green', `✅ 创建目录: ${dir}`);
      } else {
        log('blue', `📁 目录已存在: ${dir}`);
      }
    } catch (error) {
      log('red', `❌ 创建目录失败: ${dir} - ${error.message}`);
      allSuccess = false;
    }
  });

  // 生成清理报告
  log('\nblue', '生成清理报告:');
  const reportPath = path.join(process.cwd(), 'test-results', 'cleanup-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    cleanedPaths: cleanupPaths.map(p => p.path),
    cleanedTempDirs: tempDirs.map(p => p.path),
    cleanedPorts: ports,
    npmCacheCleaned: cleanNpmCache,
    success: allSuccess
  };

  try {
    // 确保目录存在
    const reportDir = path.dirname(reportPath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log('green', `✅ 清理报告已生成: ${reportPath}`);
  } catch (error) {
    log('red', `❌ 生成清理报告失败: ${error.message}`);
  }

  // 总结
  log('\n' + '='.repeat(50));
  if (allSuccess) {
    log('green', '🎉 Chrome MCP 测试环境清理完成！');

    log('\ncyan', '📋 下一步操作:');
    log('blue', '  1. 重新运行测试: npm run test:e2e:chrome-mcp:all');
    log('blue', '  2. 验证配置: npm run test:e2e:chrome-mcp:validate');
    log('blue', '  3. 查看文档: cat CHROME_MCP_E2E_TESTING_GUIDE.md');

    if (cleanNpmCache) {
      log('\nyellow', '💡 提示: npm 缓存已清理，下次安装依赖可能需要较长时间');
    }
  } else {
    log('red', '❌ 清理过程中出现错误，请检查上述日志。');
    log('\nyellow', '手动清理建议:');
    log('blue', '  1. 删除 test-results 目录');
    log('blue', '  2. 重启相关进程');
    log('blue', '  3. 检查端口占用');
  }

  return allSuccess;
}

// 显示帮助信息
function showHelp() {
  log('cyan', 'Chrome MCP 测试清理工具\n');
  log('blue', '用法:');
  log('yellow', '  node scripts/cleanup-chrome-mcp-tests.cjs [选项]\n');
  log('blue', '选项:');
  log('yellow', '  --npm-cache    同时清理 npm 缓存');
  log('yellow', '  --help         显示此帮助信息\n');
  log('blue', '示例:');
  log('yellow', '  node scripts/cleanup-chrome-mcp-tests.cjs');
  log('yellow', '  node scripts/cleanup-chrome-mcp-tests.cjs --npm-cache');
}

// 运行清理
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const success = cleanupTests();
  process.exit(success ? 0 : 1);
}

module.exports = { cleanupTests };