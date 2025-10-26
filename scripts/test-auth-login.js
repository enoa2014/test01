#!/usr/bin/env node
/**
 * 验证 auth 自定义登录云函数：
 * - 可选：尝试以 ADMIN_SEED_CODE 初始化管理员（若已初始化会忽略）
 * - 使用指定用户名/口令调用 auth.login，断言返回 ticket
 *
 * 用法：
 *   node scripts/test-auth-login.js [username] [password]
 * 环境要求：.env 中配置 TCB_ENV / TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY
 */
const path = require('path');
const dotenv = require('dotenv');
const tcb = require('@cloudbase/node-sdk');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[test-auth-login] 缺少环境变量: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const envId = requireEnv('TCB_ENV');
  const secretId = requireEnv('TENCENTCLOUD_SECRETID');
  const secretKey = requireEnv('TENCENTCLOUD_SECRETKEY');

  const username = process.argv[2] || process.env.ADMIN_USERNAME || 'admin2025';
  const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'admin123456';
  const seedCode = process.env.ADMIN_SEED_CODE || '';

  const app = tcb.init({ env: envId, envId, secretId, secretKey });

  // 尝试种子初始化（忽略已初始化错误）
  if (seedCode) {
    try {
      const seed = await app.callFunction({
        name: 'auth',
        data: { action: 'seedAdmin', code: seedCode, username, password },
      });
      if (seed?.result?.success) {
        console.log(`[test-auth-login] 已初始化管理员: ${username}`);
      } else if (seed?.result?.error?.code) {
        if (String(seed.result.error.code).includes('ALREADY_INITIALIZED')) {
          console.log('[test-auth-login] 管理员已存在，跳过初始化');
        } else {
          console.log('[test-auth-login] 初始化返回: ', seed.result);
        }
      }
    } catch (e) {
      // 常见：FORBIDDEN（seedCode 不匹配），忽略
      console.log('[test-auth-login] 初始化阶段忽略错误: ' + (e?.message || e));
    }
  }

  // 执行登录
  const res = await app.callFunction({ name: 'auth', data: { action: 'login', username, password } });
  if (!res?.result?.success || !res?.result?.ticket) {
    console.error('[test-auth-login] 登录失败: ', res?.result || res);
    process.exit(2);
  }
  const user = res.result.user || {};
  console.log('[test-auth-login] 登录成功，返回 ticket，用户：', {
    uid: user.uid,
    username: user.username,
    role: user.role,
  });
}

main().catch((e) => {
  console.error('[test-auth-login] 异常: ' + (e?.message || e));
  process.exit(1);
});

