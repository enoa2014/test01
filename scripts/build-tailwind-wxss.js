#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs/promises');
const { createStyleHandler } = require('@weapp-tailwindcss/postcss');

async function runTailwind(inputPath, tempOutputPath, configPath, cwd) {
  const args = ['@tailwindcss/cli', '-i', inputPath, '-o', tempOutputPath, '--config', configPath, '--minify'];
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
      TAILWIND_DISABLE_WATCHER: '1',
    },
  });
  if (result.status !== 0) {
    throw new Error(`Tailwind 构建失败，退出码 ${result.status}`);
  }
}

async function transformToWxss(rawCssPath, wxssOutputPath) {
  const styleHandler = createStyleHandler({ platform: 'wechat' });
  const cssSource = await fs.readFile(rawCssPath, 'utf8');
  const result = await styleHandler(cssSource, {
    cssSelectorReplacement: {
      root: 'page',
      universal: ['view', 'text'],
    },
  });
  await fs.writeFile(wxssOutputPath, result.css, 'utf8');
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const inputPath = path.join(root, 'miniprogram/styles/tailwind.input.css');
  const generatedDir = path.join(root, 'miniprogram/styles/generated');
  const rawCssPath = path.join(generatedDir, 'tailwind.raw.css');
  const wxssPath = path.join(generatedDir, 'tailwind.wxss');
  const configPath = path.join(root, 'tailwind.config.js');

  await fs.mkdir(generatedDir, { recursive: true });

  await runTailwind(inputPath, rawCssPath, configPath, root);
  await transformToWxss(rawCssPath, wxssPath);

  try {
    await fs.unlink(rawCssPath);
  } catch (error) {
    console.warn('[tailwind build] 无法删除临时文件', rawCssPath, error);
  }

  console.log(`WXSS 输出完成：${path.relative(root, wxssPath)}`);
}

main().catch(error => {
  console.error('[tailwind build] 失败:', error);
  process.exit(1);
});
