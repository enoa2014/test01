#!/usr/bin/env node

/**
 * 批量清理 patient_intake_records 老数据，仅保留指定 syncBatchId 生成的 ${patientKey}-excel 文档。
 *
 * 使用示例：
 *   node scripts/cleanup-intake-records.js --sync-batch raw-reinit-20240607
 *   node scripts/cleanup-intake-records.js --sync-batch raw-reinit-20240607 --dry-run
 */

const tcb = require('@cloudbase/node-sdk');
require('dotenv').config();

const DEFAULT_BATCH_SIZE = 500;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    dryRun: false,
    batchId: '',
    help: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--sync-batch') {
      const value = args[i + 1];
      if (value) {
        options.batchId = value;
        i += 1;
      } else {
        console.warn('⚠️  --sync-batch 需要一个参数，例如 --sync-batch raw-reinit-20240607');
      }
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      console.warn(`⚠️  未知参数: ${arg}`);
    }
  }

  return options;
}

function showHelp() {
  console.log(`
批量清理 patient_intake_records 老数据脚本

选项：
  --sync-batch <id>   必填。本次导入/同步使用的 syncBatchId。
  --dry-run           仅输出即将删除的文档数量，不执行删除。
  --help, -h          显示帮助信息。

环境变量：
  TCB_ENV                 云开发环境 ID
  TENCENTCLOUD_SECRETID   腾讯云 API 密钥 ID
  TENCENTCLOUD_SECRETKEY  腾讯云 API 密钥 Key
`);
}

function normalizeSpacing(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function shouldKeepRecord(doc, batchId) {
  if (!doc || !doc._id) {
    return false;
  }

  const metadata = doc.metadata || {};
  if (batchId && metadata.syncBatchId !== batchId) {
    return false;
  }

  const patientKey = normalizeSpacing(doc.patientKey || '');
  if (patientKey && doc._id === `${patientKey}-excel`) {
    return true;
  }

  // 兜底：部分文档可能缺少 patientKey，但 _id 已按约定生成
  if (!patientKey && doc._id.endsWith('-excel')) {
    return true;
  }

  return false;
}

async function fetchAllDocuments(collection, batchSize = DEFAULT_BATCH_SIZE) {
  const all = [];
  let skip = 0;

  while (true) {
    const res = await collection
      .orderBy('patientKey', 'asc')
      .skip(skip)
      .limit(batchSize)
      .field({ _id: true, patientKey: true, metadata: true })
      .get();

    const docs = Array.isArray(res.data) ? res.data : [];
    if (!docs.length) {
      break;
    }

    all.push(...docs);
    skip += docs.length;
  }

  return all;
}

function chunk(list, size) {
  const result = [];
  for (let i = 0; i < list.length; i += size) {
    result.push(list.slice(i, i + size));
  }
  return result;
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.batchId) {
    console.error('❌ 必须通过 --sync-batch 指定本次导入使用的 syncBatchId。');
    showHelp();
    process.exit(1);
  }

  const envId = process.env.TCB_ENV;
  const secretId = process.env.TENCENTCLOUD_SECRETID;
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY;

  if (!envId || !secretId || !secretKey) {
    console.error('❌ 请设置环境变量 TCB_ENV、TENCENTCLOUD_SECRETID、TENCENTCLOUD_SECRETKEY');
    process.exit(1);
  }

  const app = tcb.init({ env: envId, secretId, secretKey });
  const db = app.database();
  const collection = db.collection('patient_intake_records');

  console.log(`🚀 开始清理 patient_intake_records，保留 syncBatchId='${options.batchId}' 的聚合记录...`);

  const docs = await fetchAllDocuments(collection);
  if (!docs.length) {
    console.log('ℹ️  集合为空，无需处理。');
    return;
  }

  const toKeep = [];
  const toDelete = [];

  docs.forEach(doc => {
    if (shouldKeepRecord(doc, options.batchId)) {
      toKeep.push(doc);
    } else {
      toDelete.push(doc);
    }
  });

  console.log(`统计结果：总计 ${docs.length} 条，保留 ${toKeep.length} 条，删除 ${toDelete.length} 条。`);

  if (options.dryRun) {
    console.log('🧪 dry-run 模式，仅输出统计，不实际删除。');
    return;
  }

  if (!toDelete.length) {
    console.log('✅ 无需删除，所有记录均满足条件。');
    return;
  }

  const chunks = chunk(toDelete, 20);
  let removed = 0;

  for (const batch of chunks) {
    await Promise.all(
      batch.map(doc =>
        collection
          .doc(doc._id)
          .remove()
          .then(() => {
            removed += 1;
          })
          .catch(error => {
            console.warn(`⚠️  删除文档 ${doc._id} 失败: ${error.message}`);
          })
      )
    );
  }

  console.log(`✅ 删除完成，共删除 ${removed} 条。请再次运行列表/详情验证数据。`);
}

main().catch(error => {
  console.error('❌ 操作失败：', error);
  process.exit(1);
});

