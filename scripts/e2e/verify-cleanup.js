#!/usr/bin/env node

/**
 * 测试数据清理验证脚本
 *
 * 检查数据库中是否还有残留的测试数据
 * 用法: node scripts/e2e/verify-cleanup.js [--cleanup]
 */

const path = require('path');
const cloudbase = require('@cloudbase/node-sdk');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTIONS = ['excel_records', 'patient_intake_records', 'excel_cache', 'patients'];
const TEST_PREFIXES = ['TEST_AUTOMATION_', 'PATIENT_', 'local-'];

function buildPrefixMatchers(db, command) {
  const matchers = [];
  TEST_PREFIXES.forEach(prefix => {
    const regexp = db.RegExp({ regexp: '^' + prefix });
    matchers.push({ key: regexp });
    matchers.push({ ['data.key']: regexp });
    matchers.push({ patientKey: regexp });
    matchers.push({ ['data.patientKey']: regexp });
    matchers.push({ patientName: regexp });
    matchers.push({ ['data.patientName']: regexp });
  });
  return matchers;
}

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`[verify-cleanup] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return process.env[name];
}

function connectCloudBase() {
  const envId = requireEnv('TCB_ENV');
  const secretId = requireEnv('TENCENTCLOUD_SECRETID');
  const secretKey = requireEnv('TENCENTCLOUD_SECRETKEY');
  const app = cloudbase.init({ env: envId, envId, secretId, secretKey });
  return { app, envId };
}

async function findTestData(db, command) {
  const results = {};
  let totalCount = 0;
  const prefixMatchers = buildPrefixMatchers(db, command);

  for (const collectionName of COLLECTIONS) {
    const collection = db.collection(collectionName);

    const matcher = command.or([
      { testMarker: command.exists(true) },
      { ['data.testMarker']: command.exists(true) },
      ...prefixMatchers,
      { ['metadata.submittedBy']: 'patient-intake-wizard' },
    ]);

    try {
      const snapshot = await collection.where(matcher).limit(100).get();
      const count = snapshot.data.length;

      if (count > 0) {
        results[collectionName] = {
          count,
          samples: snapshot.data.slice(0, 3).map(doc => ({
            _id: doc._id,
            key: doc.key || doc.data?.key,
            patientKey: doc.patientKey || doc.data?.patientKey,
            patientName: doc.patientName || doc.data?.patientName,
            testMarker: doc.testMarker || doc.data?.testMarker,
          })),
        };
        totalCount += count;
      }
    } catch (error) {
      console.warn(`[verify-cleanup] Error checking ${collectionName}:`, error.message);
    }
  }

  return { results, totalCount };
}

async function cleanupTestData(db, command) {
  let totalRemoved = 0;
  const prefixMatchers = buildPrefixMatchers(db, command);

  for (const collectionName of COLLECTIONS) {
    const collection = db.collection(collectionName);

    const matcher = command.or([
      { testMarker: command.exists(true) },
      { ['data.testMarker']: command.exists(true) },
      ...prefixMatchers,
      { ['metadata.submittedBy']: 'patient-intake-wizard' },
    ]);

    const batchSize = 100;
    let removed = 0;
    do {
      const snapshot = await collection.where(matcher).limit(batchSize).get();
      if (!snapshot.data.length) {
        break;
      }
      const docs = snapshot.data;
      for (const doc of docs) {
        await collection.doc(doc._id).remove();
        removed += 1;
      }
      if (docs.length < batchSize) {
        break;
      }
    } while (true);

    if (removed > 0) {
      console.log(`[verify-cleanup] Removed ${removed} documents from ${collectionName}`);
      totalRemoved += removed;
    }
  }

  return totalRemoved;
}

async function main() {
  const shouldCleanup = process.argv.includes('--cleanup');

  console.log('[verify-cleanup] Connecting to cloud database...');
  const { app, envId } = connectCloudBase();
  const db = app.database({ env: envId });
  const command = db.command;

  console.log('[verify-cleanup] Scanning for test data...');
  const { results, totalCount } = await findTestData(db, command);

  if (totalCount === 0) {
    console.log('✅ No test data found in database');
    return;
  }

  console.log(`\n⚠️  Found ${totalCount} test records:\n`);

  for (const [collectionName, data] of Object.entries(results)) {
    console.log(`📦 ${collectionName}: ${data.count} records`);
    data.samples.forEach((sample, index) => {
      console.log(`   ${index + 1}. ${JSON.stringify(sample, null, 2)}`);
    });
    console.log('');
  }

  if (shouldCleanup) {
    console.log('[verify-cleanup] Cleaning up test data...');
    const removed = await cleanupTestData(db, command);
    console.log(`✅ Cleanup completed. Removed ${removed} records.`);
  } else {
    console.log('💡 Run with --cleanup flag to remove test data:');
    console.log('   node scripts/e2e/verify-cleanup.js --cleanup');
  }
}

main().catch(error => {
  console.error('[verify-cleanup] Error:', error);
  process.exit(1);
});
