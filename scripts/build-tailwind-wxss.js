#!/usr/bin/env node
const path = require('path');
const fs = require('fs/promises');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');

async function runTailwind(inputPath, tempOutputPath, configPath, cwd) {
  const css = await fs.readFile(inputPath, 'utf8');
  const config = require(configPath);
  const result = await postcss([tailwindcss(config)]).process(css, {
    from: inputPath,
    to: tempOutputPath,
    map: false,
  });
  await fs.writeFile(tempOutputPath, result.css, 'utf8');
}

async function transformToWxss(rawCssPath, wxssOutputPath) {
  // 轻量转换：多数 Tailwind 工具类是类选择器，WXSS 可直接使用
  // 这里仅做极简替换以适配根选择器
  let cssSource = await fs.readFile(rawCssPath, 'utf8');
  cssSource = cssSource.replace(/:root/g, 'page');
  await fs.writeFile(wxssOutputPath, cssSource, 'utf8');
}

async function main() {
  const root = path.resolve(__dirname, '..');
  const inputPath = path.join(root, 'wx-project/styles/tailwind.input.css');
  const generatedDir = path.join(root, 'wx-project/styles/generated');
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
