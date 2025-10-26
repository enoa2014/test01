#!/usr/bin/env node

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
  console.log(`🚀 启动 Chrome MCP ${testType} 测试...`);
  try {
    execSync(commands[testType], { stdio: 'inherit', cwd: path.dirname(__dirname) });
  } catch (error) {
    console.error(`❌ 测试执行失败: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log('❌ 未知的测试类型:', testType);
  console.log('\n可用的测试类型:');
  Object.keys(commands).forEach(key => {
    console.log(`  - ${key}`);
  });
  process.exit(1);
}
