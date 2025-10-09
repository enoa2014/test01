#!/usr/bin/env node
/**
 * 调用 readExcel 云函数：normalizeFromRaw
 * - 读取 excel_raw_records → 规范化 → 重置并导入 → 同步 → 刷新聚合
 * 使用：npm run database:normalize-from-raw
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
  console.log('🚀 调用 readExcel.normalizeFromRaw');
  console.log(`   env: ${envId}`);

  const app = tcb.init({ env: envId, secretId, secretKey });

  try {
    const res = await app.callFunction({
      name: 'readExcel',
      data: { action: 'normalizeFromRaw' },
    });
    const result = res && res.result;
    if (!result || result.success === false) {
      const msg = (result && result.error && (result.error.message || result.error.code)) || '云函数返回失败';
      throw new Error(msg);
    }

    console.log('✅ normalizeFromRaw 完成');
    console.log('📊 统计:');
    console.log('  - imported:', result.imported);
    console.log('  - totalPatients:', result.totalPatients);
    console.log('  - sync:', result.sync);
    if (result.aggregateRefresh) {
      console.log('  - aggregateRefresh:', result.aggregateRefresh);
    }
  } catch (error) {
    console.error('💥 调用失败：', error && error.message);
    if (/RAW_DATA_EMPTY|RAW/.test(error && error.message)) {
      console.error('👉 excel_raw_records 为空或未初始化，请先写入原始数据');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

