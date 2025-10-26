#!/usr/bin/env node
const path = require('path');
const fs = require('fs/promises');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
// Use the new package entry for the PostCSS plugin
const weappTailwindcss = require('@weapp-tailwindcss/postcss');

async function runTailwind(inputPath, tempOutputPath, configPath, cwd) {
  const css = await fs.readFile(inputPath, 'utf8');
  const config = require(configPath);
  // First run Tailwind to generate raw CSS
  const result = await postcss([
    tailwindcss(config),
  ]).process(css, {
    from: inputPath,
    to: tempOutputPath,
    map: false,
  });
  await fs.writeFile(tempOutputPath, result.css, 'utf8');
}

async function transformToWxss(rawCssPath, wxssOutputPath) {
  let cssSource = await fs.readFile(rawCssPath, 'utf8');

  // 使用 weapp-tailwindcss 的样式处理器做小程序兼容转换
  const { createStyleHandler } = require('@weapp-tailwindcss/postcss');
  const handler = createStyleHandler({
    // 使用默认配置；如需启用 px->rpx 可在此开启 px2rpx/rem2rpx
    // 通过 cssSelectorReplacement.root 将 :root 映射为 page
    cssSelectorReplacement: { root: 'page', universal: ['view', 'text'] },
  });
  const processed = await handler(cssSource);
  let wxss = processed.css || String(processed);

  // 兜底：若仍存在 :root，做一遍替换
  wxss = wxss.replace(/:root/g, 'page');
  await fs.writeFile(wxssOutputPath, wxss, 'utf8');
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
