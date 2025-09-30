#!/usr/bin/env node

/**
 * 云数据库重新初始化快速脚本
 *
 * 使用方法:
 * npm run database:reinit
 * 或
 * node scripts/database-reinit.js [--backup] [--verify-only]
 *
 * 选项:
 * --backup     在清空前创建数据备份
 * --verify-only 仅验证数据，不执行操作
 */

const tcb = require("@cloudbase/node-sdk");
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 配置
const CONFIG = {
  collections: [
    'excel_records',
    'excel_cache',
    'patients',
    'patient_intake_records'
  ],
  batchSize: 20,
  backupDir: 'backups',
  timeout: 120000
};

// 从环境变量获取配置
const tcbEnv = process.env.TCB_ENV;
const secretId = process.env.TENCENTCLOUD_SECRETID;
const secretKey = process.env.TENCENTCLOUD_SECRETKEY;
const excelFileId = process.env.EXCEL_FILE_ID;

if (!tcbEnv || !secretId || !secretKey) {
  console.error('❌ 请设置环境变量：TCB_ENV, TENCENTCLOUD_SECRETID, TENCENTCLOUD_SECRETKEY');
  process.exit(1);
}

// 初始化云开发
const app = tcb.init({
  env: tcbEnv,
  secretId: secretId,
  secretKey: secretKey
});

const db = app.database();

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    backup: args.includes('--backup'),
    verifyOnly: args.includes('--verify-only'),
    help: args.includes('--help') || args.includes('-h')
  };
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
云数据库重新初始化脚本

使用方法:
  node scripts/database-reinit.js [选项]

选项:
  --backup      在清空前创建数据备份
  --verify-only 仅验证数据，不执行操作
  --help, -h    显示此帮助信息

环境变量:
  TCB_ENV                 云开发环境ID
  TENCENTCLOUD_SECRETID   腾讯云API密钥ID
  TENCENTCLOUD_SECRETKEY  腾讯云API密钥Key
  EXCEL_FILE_ID          Excel文件的云存储ID

示例:
  # 完整重新初始化（带备份）
  node scripts/database-reinit.js --backup

  # 仅验证当前数据状态
  node scripts/database-reinit.js --verify-only

  # 标准重新初始化（不备份）
  node scripts/database-reinit.js
`);
}

/**
 * 创建数据备份
 */
async function backupData() {
  console.log('💾 开始数据备份...');

  // 确保备份目录存在
  if (!fs.existsSync(CONFIG.backupDir)) {
    fs.mkdirSync(CONFIG.backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let totalBackuped = 0;

  for (const collectionName of CONFIG.collections) {
    try {
      console.log(`  备份集合: ${collectionName}`);

      const collection = db.collection(collectionName);
      const allData = [];
      let skip = 0;
      const limit = 100;

      while (true) {
        const res = await collection.skip(skip).limit(limit).get();
        if (!res.data || res.data.length === 0) break;

        allData.push(...res.data);
        skip += res.data.length;
      }

      if (allData.length > 0) {
        const backupFile = path.join(CONFIG.backupDir, `${collectionName}_${timestamp}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(allData, null, 2));
        console.log(`    ✅ 已备份 ${allData.length} 条记录到 ${backupFile}`);
        totalBackuped += allData.length;
      } else {
        console.log(`    ℹ️  集合 ${collectionName} 为空，跳过备份`);
      }

    } catch (error) {
      console.warn(`    ⚠️  备份集合 ${collectionName} 失败:`, error.message);
    }
  }

  console.log(`✅ 数据备份完成，共备份 ${totalBackuped} 条记录`);
  return totalBackuped;
}

/**
 * 清空单个集合
 */
async function clearCollection(collectionName) {
  console.log(`  清空集合: ${collectionName}`);

  try {
    const collection = db.collection(collectionName);
    let totalDeleted = 0;

    while (true) {
      const res = await collection.limit(CONFIG.batchSize).get();
      const docs = res && Array.isArray(res.data) ? res.data : [];

      if (!docs.length) break;

      const deletePromises = docs
        .filter(doc => doc && doc._id)
        .map(doc =>
          collection.doc(doc._id).remove()
            .catch(error => {
              console.warn(`    删除文档失败 ${doc._id}:`, error.message);
              return null;
            })
        );

      await Promise.all(deletePromises);
      totalDeleted += docs.length;
      console.log(`    已删除 ${docs.length} 条记录，累计 ${totalDeleted} 条`);
    }

    console.log(`    ✅ 集合 ${collectionName} 清空完成，共删除 ${totalDeleted} 条记录`);
    return totalDeleted;

  } catch (error) {
    if (error.errCode === -502005 ||
        (error.errMsg && error.errMsg.includes('DATABASE_COLLECTION_NOT_EXIST'))) {
      console.log(`    ℹ️  集合 ${collectionName} 不存在，跳过清空`);
      return 0;
    }
    throw error;
  }
}

/**
 * 清空所有集合
 */
async function clearAllCollections() {
  console.log('🗑️  开始清空所有集合...');

  let totalDeleted = 0;
  for (const collectionName of CONFIG.collections) {
    const deleted = await clearCollection(collectionName);
    totalDeleted += deleted;
  }

  console.log(`✅ 所有集合清空完成，共删除 ${totalDeleted} 条记录`);
  return totalDeleted;
}

/**
 * 重新导入数据
 */
async function importData() {
  console.log('📥 开始重新导入数据...');

  const fileId = excelFileId || 'cloud://cloud1-6g2fzr5f7cf51e38.636c-cloud1-6g2fzr5f7cf51e38-1375978325/data/b.xlsx';

  try {
    const result = await app.callFunction({
      name: 'readExcel',
      data: {
        action: 'import',
        fileId: fileId
      }
    });

    if (result.result && result.result.success !== false) {
      console.log('✅ 数据导入成功');
      console.log('📊 导入统计:');
      console.log(`  - 表名: ${result.result.sheetName || 'N/A'}`);
      console.log(`  - 导入记录数: ${result.result.imported?.inserted || 0}`);
      console.log(`  - 患者数量: ${result.result.totalPatients || 0}`);

      if (result.result.sync) {
        console.log(`  - 同步患者: ${result.result.sync.patients || 0}`);
        console.log(`  - 同步入住记录: ${result.result.sync.intakeRecords || 0}`);
        console.log(`  - 同步批次ID: ${result.result.sync.syncBatchId || ''}`);
      }

      return result.result;
    } else {
      throw new Error('数据导入失败: ' + JSON.stringify(result.result?.error));
    }

  } catch (error) {
    console.error('❌ 数据导入失败:', error.message);
    throw error;
  }
}

/**
 * 验证数据完整性
 */
async function verifyData() {
  console.log('🔍 验证数据完整性...');

  const results = {};
  let allValid = true;

  for (const collectionName of CONFIG.collections) {
    try {
      const collection = db.collection(collectionName);
      const countResult = await collection.count();
      const total = countResult.total || 0;

      results[collectionName] = total;
      console.log(`  - ${collectionName}: ${total} 条记录`);

      // 获取样本数据验证
      if (total > 0) {
        const sampleResult = await collection.limit(1).get();
        if (sampleResult.data && sampleResult.data.length > 0) {
          const sample = sampleResult.data[0];

          // 特定验证逻辑
          if (collectionName === 'patients' && (!sample.patientName || !sample.admissionCount)) {
            console.log(`    ⚠️  患者数据缺少关键字段`);
            allValid = false;
          }
        }
      }

    } catch (error) {
      console.error(`  ❌ 验证集合 ${collectionName} 失败:`, error.message);
      results[collectionName] = 'error';
      allValid = false;
    }
  }

  // 数据一致性检查
  console.log('\n🔍 数据一致性检查:');

  if (results.patients === results.patient_intake_records) {
    console.log(`  ✅ 患者记录与入住记录数量一致: ${results.patients}`);
  } else {
    console.log(`  ⚠️  患者记录(${results.patients})与入住记录(${results.patient_intake_records})数量不一致`);
    allValid = false;
  }

  if (results.excel_cache > 0) {
    console.log(`  ✅ 缓存数据已生成: ${results.excel_cache} 个文档`);
  } else {
    console.log(`  ⚠️  缓存数据缺失或为空`);
  }

  if (results.excel_records > 0) {
    console.log(`  ✅ Excel原始数据已导入: ${results.excel_records} 条记录`);
  } else {
    console.log(`  ❌ Excel原始数据缺失`);
    allValid = false;
  }

  return { results, allValid };
}

/**
 * 清理缓存
 */
async function clearCache() {
  console.log('🧹 清理缓存...');

  try {
    const cacheCollection = db.collection('excel_cache');

    await cacheCollection.doc('default').remove().catch(() => {});
    await cacheCollection.doc('patients_summary_cache').remove().catch(() => {});

    // 强制刷新
    await app.callFunction({
      name: 'patientProfile',
      data: {
        action: 'list',
        forceRefresh: true,
        pageSize: 1
      }
    });

    console.log('✅ 缓存清理完成');

  } catch (error) {
    console.warn('⚠️  缓存清理失败:', error.message);
  }
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  console.log('🚀 云数据库重新初始化开始...');
  console.log(`环境: ${tcbEnv}`);
  console.log(`时间: ${new Date().toLocaleString()}`);

  try {
    // 仅验证模式
    if (options.verifyOnly) {
      const { results, allValid } = await verifyData();
      console.log(`\n📊 验证${allValid ? '通过' : '失败'}！`);
      process.exit(allValid ? 0 : 1);
      return;
    }

    // 数据备份
    if (options.backup) {
      await backupData();
      console.log('');
    }

    // 清空数据库
    await clearAllCollections();
    console.log('');

    // 重新导入数据
    await importData();
    console.log('');

    // 清理缓存
    await clearCache();
    console.log('');

    // 验证结果
    const { results, allValid } = await verifyData();

    // 总结
    console.log('\n🎉 数据库重新初始化完成！');
    console.log('\n📊 最终统计:');
    Object.entries(results).forEach(([name, count]) => {
      console.log(`  - ${name}: ${count} 条记录`);
    });

    if (!allValid) {
      console.log('\n⚠️  发现数据一致性问题，请检查！');
      process.exit(1);
    } else {
      console.log('\n✅ 所有验证通过，初始化成功！');
    }

  } catch (error) {
    console.error('\n💥 操作失败:', error.message);
    console.error('\n请检查:');
    console.error('1. 网络连接是否稳定');
    console.error('2. 环境变量是否正确配置');
    console.error('3. 云函数是否已正确部署');
    console.error('4. Excel文件是否存在且可访问');
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = {
  backupData,
  clearAllCollections,
  importData,
  verifyData,
  clearCache
};