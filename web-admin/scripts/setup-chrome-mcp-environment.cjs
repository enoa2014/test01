#!/usr/bin/env node

/**
 * Chrome MCP 环境设置脚本
 * 自动配置 Chrome MCP E2E 测试环境
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

function runCommand(command, description) {
  try {
    log('blue', `执行: ${description}`);
    execSync(command, { stdio: 'inherit' });
    log('green', `✅ 完成: ${description}`);
    return true;
  } catch (error) {
    log('red', `❌ 失败: ${description} - ${error.message}`);
    return false;
  }
}

function createDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      log('green', `✅ 创建目录: ${dirPath}`);
    } else {
      log('blue', `📁 目录已存在: ${dirPath}`);
    }
    return true;
  } catch (error) {
    log('red', `❌ 创建目录失败: ${dirPath} - ${error.message}`);
    return false;
  }
}

function setupEnvironment() {
  log('cyan', '🚀 开始设置 Chrome MCP E2E 测试环境...\n');

  let allSuccess = true;

  // 1. 检查和安装 mcp-chrome-bridge
  log('blue', '步骤 1: 安装 mcp-chrome-bridge');
  try {
    execSync('mcp-chrome-bridge -v', { stdio: 'pipe' });
    log('green', '✅ mcp-chrome-bridge 已安装');
  } catch (error) {
    log('yellow', '⚠️ mcp-chrome-bridge 未安装，开始安装...');
    const success = runCommand('npm install -g mcp-chrome-bridge', '全局安装 mcp-chrome-bridge');
    allSuccess = allSuccess && success;
  }

  // 2. 注册消息主机
  log('\nblue', '步骤 2: 注册消息主机');
  const registerSuccess = runCommand('mcp-chrome-bridge -r', '注册 Chrome 消息主机');
  allSuccess = allSuccess && registerSuccess;

  // 3. 创建必要的目录结构
  log('\nblue', '步骤 3: 创建目录结构');
  const directories = [
    'e2e',
    'e2e/fixtures',
    'e2e/helpers',
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/html-report',
    'scripts'
  ];

  directories.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    const success = createDirectory(dirPath);
    allSuccess = allSuccess && success;
  });

  // 4. 检查并安装项目依赖
  log('\nblue', '步骤 4: 安装项目依赖');
  const installSuccess = runCommand('npm install', '安装项目依赖');
  allSuccess = allSuccess && installSuccess;

  // 5. 安装 Playwright 浏览器
  log('\nblue', '步骤 5: 安装 Playwright 浏览器');
  const playwrightSuccess = runCommand('npx playwright install chromium', '安装 Chromium 浏览器');
  allSuccess = allSuccess && playwrightSuccess;

  // 6. 创建环境配置文件
  log('\nblue', '步骤 6: 创建环境配置');
  const envConfigPath = path.join(process.cwd(), '.env.test');
  const envContent = `# Chrome MCP E2E 测试环境配置
NODE_ENV=test
DEBUG=pw:api
CHROME_MCP_DEBUG=true
CHROME_MCP_TIMEOUT=30000
TEST_BASE_URL=http://localhost:4174
TEST_USER_TOKEN=test-token
SCREENSHOT_DIR=./test-results/screenshots
VIDEO_DIR=./test-results/videos
PERFORMANCE_TIMEOUT=300000
NETWORK_THROTTLE=false
`;

  try {
    fs.writeFileSync(envConfigPath, envContent);
    log('green', `✅ 创建环境配置文件: ${envConfigPath}`);
  } catch (error) {
    log('red', `❌ 创建环境配置失败: ${error.message}`);
    allSuccess = false;
  }

  // 7. 创建 Git 忽略文件
  log('\nblue', '步骤 7: 配置 Git 忽略规则');
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let gitignoreContent = '';

  try {
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    }

    const testIgnores = [
      '# Chrome MCP E2E 测试结果',
      'test-results/',
      'test-results/**/*',
      '.env.test',
      'coverage/',
      'playwright-report/',
      'test-results.xml'
    ];

    testIgnores.forEach(ignore => {
      if (!gitignoreContent.includes(ignore.split('\n')[0])) {
        gitignoreContent += `\n${ignore}`;
      }
    });

    fs.writeFileSync(gitignorePath, gitignoreContent);
    log('green', '✅ 更新 .gitignore 文件');
  } catch (error) {
    log('red', `❌ 更新 .gitignore 失败: ${error.message}`);
    allSuccess = false;
  }

  // 8. 验证配置
  log('\nblue', '步骤 8: 验证配置');
  const validateScript = path.join(process.cwd(), 'scripts', 'validate-chrome-mcp-config.cjs');
  if (fs.existsSync(validateScript)) {
    const validateSuccess = runCommand(`node "${validateScript}"`, '验证 Chrome MCP 配置');
    allSuccess = allSuccess && validateSuccess;
  } else {
    log('yellow', '⚠️ 验证脚本不存在，跳过验证');
  }

  // 9. 生成启动脚本
  log('\nblue', '步骤 9: 生成启动脚本');
  const startScriptPath = path.join(process.cwd(), 'scripts', 'start-chrome-mcp-tests.cjs');
  const startScriptContent = `#!/usr/bin/env node

/**
 * Chrome MCP 测试启动脚本
 * 提供便捷的测试启动入口
 */

const { execSync } = require('child_process');
const path = require('path');

const commands = {
  'all': 'npm run test:e2e:chrome-mcp:all',
  'business': 'npm run test:e2e:chrome-mcp:business',
  'data': 'npm run test:e2e:chrome-mcp:data',
  'performance': 'npm run test:e2e:chrome-mcp:performance',
  'debug': 'npm run test:e2e:chrome-mcp:debug',
  'headed': 'npm run test:e2e:chrome-mcp:headed',
  'report': 'npm run test:e2e:chrome-mcp:report'
};

const testType = process.argv[2] || 'all';

if (commands[testType]) {
  console.log(\`🚀 启动 Chrome MCP \${testType} 测试...\`);
  try {
    execSync(commands[testType], { stdio: 'inherit', cwd: path.dirname(__dirname) });
  } catch (error) {
    console.error(\`❌ 测试执行失败: \${error.message}\`);
    process.exit(1);
  }
} else {
  console.log('❌ 未知的测试类型:', testType);
  console.log('\\n可用的测试类型:');
  Object.keys(commands).forEach(key => {
    console.log(\`  - \${key}\`);
  });
  process.exit(1);
}
`;

  try {
    fs.writeFileSync(startScriptPath, startScriptContent);
    log('green', `✅ 创建启动脚本: ${startScriptPath}`);
  } catch (error) {
    log('red', `❌ 创建启动脚本失败: ${error.message}`);
    allSuccess = false;
  }

  // 总结
  log('\n' + '='.repeat(50));
  if (allSuccess) {
    log('green', '🎉 Chrome MCP E2E 测试环境设置完成！');

    log('\ncyan', '📋 快速开始:');
    log('blue', '  1. 确保 Chrome 扩展已安装并启用');
    log('blue', '  2. 运行测试验证:');
    log('yellow', '     npm run test:e2e:chrome-mcp:validate');
    log('blue', '  3. 执行测试:');
    log('yellow', '     npm run test:e2e:chrome-mcp:all');

    log('\ncyan', '🔧 可用的测试命令:');
    log('blue', '  npm run test:e2e:chrome-mcp:all         # 运行所有测试');
    log('blue', '  npm run test:e2e:chrome-mcp:business    # 业务流程测试');
    log('blue', '  npm run test:e2e:chrome-mcp:data        # 数据管理测试');
    log('blue', '  npm run test:e2e:chrome-mcp:performance # 性能测试');
    log('blue', '  npm run test:e2e:chrome-mcp:debug       # 调试模式');
    log('blue', '  npm run test:e2e:chrome-mcp:headed      # 有界面模式');
    log('blue', '  npm run test:e2e:chrome-mcp:report      # 生成报告');

    log('\ncyan', '📖 更多信息:');
    log('blue', '  查看 CHROME_MCP_E2E_TESTING_GUIDE.md 获取详细使用指南');
  } else {
    log('red', '❌ 环境设置过程中出现错误，请检查上述日志并手动修复。');
    log('\nyellow', '手动设置步骤:');
    log('blue', '  1. npm install -g mcp-chrome-bridge');
    log('blue', '  2. mcp-chrome-bridge -r');
    log('blue', '  3. npm install');
    log('blue', '  4. npx playwright install chromium');
  }

  return allSuccess;
}

// 运行设置
if (require.main === module) {
  const success = setupEnvironment();
  process.exit(success ? 0 : 1);
}

module.exports = { setupEnvironment };