#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const outputDir = path.join(projectRoot, 'release-win');
const exeName = 'web-admin.exe';
const embeddedEnvModule = path.join(projectRoot, 'env.bundle.cjs');

function parseDotEnv(file) {
  try {
    if (!fs.existsSync(file)) return {};
    const content = fs.readFileSync(file, 'utf8');
    const dotenv = require('dotenv');
    return dotenv.parse(content);
  } catch {
    return {};
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const joined = [command].concat(args || []).join(' ');
    throw new Error(`命令执行失败: ${joined}`);
  }
}

(async () => {
  console.log('📦 构建 Web 管理端静态资源 (vite build)...');
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  run(npxCmd, ['vite', 'build'], { cwd: projectRoot });

  if (!fs.existsSync(distDir)) {
    throw new Error('未找到 dist 目录，构建可能失败。');
  }

  console.log('🧹 清理旧的输出目录');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const exePath = path.join(outputDir, exeName);

  // 生成内嵌环境变量模块（从根 .env 与本地 .env/.env.local 合并）
  console.log('🔐  内嵌 .env 到可执行文件');
  const rootEnv = parseDotEnv(path.resolve(projectRoot, '..', '.env'));
  const localEnv = parseDotEnv(path.join(projectRoot, '.env'));
  const localEnv2 = parseDotEnv(path.join(projectRoot, '.env.local'));
  const merged = { ...rootEnv, ...localEnv, ...localEnv2 };
  const allowList = [
    'VITE_TCB_ENV_ID', 'TCB_ENV', 'TCB_ENV_ID', 'CLOUDBASE_ENV_ID',
    'TENCENTCLOUD_SECRETID', 'TENCENTCLOUD_SECRETKEY',
    'VITE_AUTH_FUNCTION_NAME'
  ];
  const filtered = Object.fromEntries(Object.entries(merged).filter(([k]) => allowList.includes(k)));
  fs.writeFileSync(embeddedEnvModule, 'module.exports = ' + JSON.stringify(filtered, null, 2) + '\n');

  console.log('⚙️  使用 pkg 打包可执行文件');
  // 使用 CommonJS 版本的服务端入口，兼容 pkg 打包
  run(npxCmd, ['pkg', 'server.cjs', '--targets', 'node18-win-x64', '--output', exePath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PKG_DISABLE_PROGRESS: '1',
    },
  });

  console.log('📁 拷贝 dist 静态资源');
  fs.cpSync(distDir, path.join(outputDir, 'dist'), { recursive: true });

  const instructions = `Web 管理端已打包完成\n\n` +
    `运行步骤：\n` +
    `1. 保持 dist 目录与 ${exeName} 同级。\n` +
    `2. 双击 ${exeName}，程序会自动在 http://localhost:4173 启动服务。\n` +
    `3. 如端口被占用，服务会自动尝试下一个端口。\n\n` +
    `退出方式：关闭弹出的命令行窗口即可终止服务。\n`;

  fs.writeFileSync(path.join(outputDir, 'README.txt'), instructions, 'utf8');

  console.log('✅ 打包完成，输出目录: %s', outputDir);

  // 清理内嵌模块源码，避免敏感信息落盘
  try { fs.rmSync(embeddedEnvModule, { force: true }); } catch {}
})();
