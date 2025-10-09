#!/usr/bin/env node
/**
 * 通过 readExcel 云函数重置数据库（并清空操作日志）
 *
 * 使用：
 *   node scripts/reset-via-readexcel.js
 *   npm run database:reset:readexcel
 */
const tcb = require('@cloudbase/node-sdk');
require('dotenv').config();

const envId = process.env.TCB_ENV;
const secretId = process.env.TENCENTCLOUD_SECRETID;
const secretKey = process.env.TENCENTCLOUD_SECRETKEY;

if (!envId || !secretId || !secretKey) {
  console.error('❌ 缺少环境变量 TCB_ENV / TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY');
  process.exit(1);
}

async function main() {
  console.log('🚀 调用 readExcel.resetAll 重置数据库（含操作日志）');
  console.log(`   env: ${envId}`);

  const app = tcb.init({ env: envId, secretId, secretKey });
  const db = app.database();

  try {
    const res = await app.callFunction({
      name: 'readExcel',
      data: { action: 'resetAll' },
    });

    const result = res && res.result;
    if (!result || result.success === false) {
      throw new Error((result && result.error && result.error.message) || '云函数返回失败');
    }

    console.log('✅ 重置完成：', result.cleared || result);

    // 简单校验四个集合是否为空
    const collections = [
      'patients',
      'patient_intake_records',
      'excel_cache',
      'patient_operation_logs',
    ];
    const counts = {};
    for (const name of collections) {
      try {
        const c = await db.collection(name).count();
        counts[name] = c && typeof c.total === 'number' ? c.total : 0;
      } catch (e) {
        counts[name] = 'N/A';
      }
    }
    console.log('📊 清空后计数：', counts);
    console.log('🎉 Done');
  } catch (error) {
    console.error('💥 重置失败：', error && error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

