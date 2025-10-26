#!/usr/bin/env node

/**
 * Chrome MCP 配置验证脚本
 * 检查 Chrome MCP Server 的配置和权限设置
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

function checkCommand(command, description) {
  try {
    execSync(command, { stdio: 'pipe' });
    log('green', `✅ ${description}`);
    return true;
  } catch (error) {
    log('red', `❌ ${description} - 错误: ${error.message}`);
    return false;
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log('green', `✅ ${description} - 存在`);
    return true;
  } else {
    log('red', `❌ ${description} - 不存在: ${filePath}`);
    return false;
  }
}

function checkConfig() {
  log('cyan', '🔍 开始检查 Chrome MCP 配置...\n');

  let allGood = true;

  // 检查 mcp-chrome-bridge 安装
  log('blue', '检查 mcp-chrome-bridge 安装:');
  const bridgeInstalled = checkCommand('mcp-chrome-bridge -v', 'mcp-chrome-bridge 全局安装');
  allGood = allGood && bridgeInstalled;

  // 检查 Chrome MCP 配置文件
  log('\nblue', '检查配置文件:');
  const configFiles = [
    { path: path.join(process.cwd(), 'e2e', 'chrome-mcp.config.ts'), desc: 'Chrome MCP 测试配置' },
    { path: path.join(process.cwd(), 'e2e', 'fixtures', 'chrome-mcp-fixture.ts'), desc: 'Chrome MCP 测试夹具' },
    { path: path.join(process.cwd(), 'package.json'), desc: '项目包配置' }
  ];

  configFiles.forEach(({ path: filePath, desc }) => {
    const exists = checkFile(filePath, desc);
    allGood = allGood && exists;
  });

  // 检查测试脚本
  log('\nblue', '检查测试脚本:');
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const requiredScripts = [
      'test:e2e:chrome-mcp',
      'test:e2e:chrome-mcp:all',
      'test:e2e:chrome-mcp:business',
      'test:e2e:chrome-mcp:data',
      'test:e2e:chrome-mcp:performance'
    ];

    requiredScripts.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        log('green', `✅ 测试脚本 - ${script}`);
      } else {
        log('red', `❌ 测试脚本缺失 - ${script}`);
        allGood = false;
      }
    });
  }

  // 检查依赖安装
  log('\nblue', '检查依赖安装:');
  const dependencies = ['playwright', '@playwright/test'];
  dependencies.forEach(dep => {
    try {
      require.resolve(dep);
      log('green', `✅ 依赖 - ${dep}`);
    } catch (error) {
      log('red', `❌ 依赖缺失 - ${dep}`);
      allGood = false;
    }
  });

  // 检查测试目录结构
  log('\nblue', '检查测试目录结构:');
  const testDirs = [
    'e2e',
    'e2e/fixtures',
    'test-results'
  ];

  testDirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      log('green', `✅ 目录 - ${dir}`);
    } else {
      log('yellow', `⚠️ 目录不存在，将自动创建 - ${dir}`);
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        log('green', `✅ 目录已创建 - ${dir}`);
      } catch (error) {
        log('red', `❌ 目录创建失败 - ${dir}: ${error.message}`);
        allGood = false;
      }
    }
  });

  // 检查 Claude 配置文件
  log('\nblue', '检查 Claude 权限配置:');
  const claudeConfigPath = path.join(process.env.USERPROFILE || '', '.claude', 'claude_desktop_config.json');
  if (fs.existsSync(claudeConfigPath)) {
    try {
      const claudeConfig = JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'));
      if (claudeConfig.allowedTools && Array.isArray(claudeConfig.allowedTools)) {
        const chromeTools = claudeConfig.allowedTools.filter(tool =>
          typeof tool === 'string' && tool.includes('chrome-mcp-stdio')
        );

        if (chromeTools.length > 0) {
          log('green', `✅ Chrome MCP 工具权限 - 已配置 ${chromeTools.length} 个工具`);
        } else {
          log('yellow', `⚠️ Chrome MCP 工具权限 - 未配置`);
          log('yellow', `   请在 Claude 配置中添加 chrome-mcp-stdio 工具到 allowedTools`);
        }
      } else {
        log('yellow', `⚠️ Claude 配置格式异常`);
      }
    } catch (error) {
      log('red', `❌ Claude 配置读取失败: ${error.message}`);
    }
  } else {
    log('yellow', `⚠️ Claude 配置文件不存在: ${claudeConfigPath}`);
  }

  // 总结
  log('\n' + '='.repeat(50));
  if (allGood) {
    log('green', '🎉 所有配置检查通过！Chrome MCP E2E 测试环境已就绪。');
    log('\ncyan', '可以运行以下命令开始测试:');
    log('blue', '  npm run test:e2e:chrome-mcp:all');
    log('blue', '  npm run test:e2e:chrome-mcp:business');
    log('blue', '  npm run test:e2e:chrome-mcp:data');
    log('blue', '  npm run test:e2e:chrome-mcp:performance');
  } else {
    log('red', '❌ 配置检查失败，请修复上述问题后重新运行。');
    log('\nyellow', '常见修复方案:');
    log('blue', '  1. 安装 mcp-chrome-bridge: npm install -g mcp-chrome-bridge');
    log('blue', '  2. 注册消息主机: mcp-chrome-bridge -r');
    log('blue', '  3. 安装依赖: npm install');
    log('blue', '  4. 配置 Claude 权限: 添加 chrome-mcp-stdio 工具到 allowedTools');
  }

  return allGood;
}

// 运行检查
if (require.main === module) {
  const success = checkConfig();
  process.exit(success ? 0 : 1);
}

module.exports = { checkConfig };