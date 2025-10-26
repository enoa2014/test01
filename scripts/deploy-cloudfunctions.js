#!/usr/bin/env node
/**
 * 简易 CloudBase 部署脚本（仅部署指定云函数目录）
 * 依赖：@cloudbase/manager-node、dotenv
 * 用法：
 *   node scripts/deploy-cloudfunctions.js patientIntake
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 优先读取仓库根 .env
try { dotenv.config({ path: path.resolve(process.cwd(), '.env') }); } catch {}

const CloudBase = require('@cloudbase/manager-node');

function resolveEnvId() {
  return (
    process.env.VITE_TCB_ENV_ID ||
    process.env.TCB_ENV ||
    process.env.TCB_ENV_ID ||
    process.env.CLOUDBASE_ENV_ID ||
    ''
  );
}

async function deployOne(funcName) {
  const envId = resolveEnvId();
  const secretId = process.env.TENCENTCLOUD_SECRETID || '';
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || '';

  if (!envId || !secretId || !secretKey) {
    throw new Error('缺少部署凭据或环境ID，请在 .env 配置 TCB_ENV/TENCENTCLOUD_SECRETID/TENCENTCLOUD_SECRETKEY');
  }

  const funcDir = path.resolve(process.cwd(), 'cloudfunctions', funcName);
  if (!fs.existsSync(funcDir)) {
    throw new Error(`未找到云函数目录: ${funcDir}`);
  }

  // 初始化 CloudBase 管理器
  const region = process.env.TENCENTCLOUD_REGION || process.env.CLOUD_REGION || '';
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || '';
  const app = CloudBase.init({
    secretId,
    secretKey,
    envId,
    region: region || undefined,
    proxy: proxy || undefined,
  });

  const functionRootPath = path.resolve(process.cwd(), 'cloudfunctions');

  // 避免更新运行时导致报错：不显式设置 runtime/timeout，仅上传代码
  const funcSpec = {
    name: funcName,
    installDependency: true,
    // 若环境变量存在，则一并下发（尤其是自定义登录密钥）
    envVariables: (() => {
      const vars = {};
      const add = (k) => { if (process.env[k]) vars[k] = process.env[k]; };
      add('TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID');
      add('TCB_CUSTOM_LOGIN_PRIVATE_KEY');
      add('CUSTOM_LOGIN_ENV_ID');
      add('ADMIN_SEED_CODE');
      return vars;
    })(),
  };

  console.log(`开始部署云函数: ${funcName} -> 环境 ${envId}`);
  console.log(`代码目录: ${funcDir}`);

  try {
    const res = await app.functions.createFunction({
      force: true,
      func: funcSpec,
      functionRootPath,
    });
    console.log(`部署成功: ${funcName}`, res && res.RequestId ? `(RequestId: ${res.RequestId})` : '');
  } catch (e) {
    console.error(`部署失败: ${funcName}`, e && e.message ? `- ${e.message}` : e);
    process.exitCode = 1;
  }
}

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.log('用法: node scripts/deploy-cloudfunctions.js <functionName>');
    console.log('示例: node scripts/deploy-cloudfunctions.js patientIntake');
    process.exit(1);
  }
  await deployOne(name);
}

main().catch((e) => {
  console.error('部署脚本异常:', e && e.message ? e.message : e);
  process.exit(1);
});
