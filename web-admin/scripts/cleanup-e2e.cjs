#!/usr/bin/env node
// 清理 E2E 残留：删除以 TEST_AUTOMATION_ 前缀或 createdFrom=web-admin-e2e 的患者及其关联记录
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const tcb = require('tcb-admin-node');

const projectRoot = path.resolve(__dirname, '..');

function loadEnv() {
  // 加载根与本地 .env
  try { dotenv.config({ path: path.resolve(projectRoot, '..', '.env') }); } catch {}
  try { dotenv.config({ path: path.join(projectRoot, '.env') }); } catch {}
  try { dotenv.config({ path: path.join(projectRoot, '.env.local') }); } catch {}
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { prefix: 'TEST_AUTOMATION_', dry: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--prefix' || a === '-p') { opts.prefix = args[++i] || opts.prefix; }
    else if (a === '--dry-run' || a === '--dry') { opts.dry = true; }
  }
  return opts;
}

async function main() {
  loadEnv();
  const { prefix, dry } = parseArgs();

  const envId = process.env.VITE_TCB_ENV_ID || process.env.TCB_ENV || process.env.TCB_ENV_ID || process.env.CLOUDBASE_ENV_ID || '';
  const secretId = process.env.TENCENTCLOUD_SECRETID || '';
  const secretKey = process.env.TENCENTCLOUD_SECRETKEY || '';
  if (!envId || !secretId || !secretKey) {
    console.error('缺少 CloudBase 配置，请在 .env 中提供 VITE_TCB_ENV_ID 与 TENCENTCLOUD_SECRETID/SECRETKEY');
    process.exit(1);
  }

  const app = tcb.init({ env: envId, credentials: { secretId, secretKey } });
  const db = app.database();
  const _ = db.command;

  const PATIENTS = 'patients';
  const INTAKES = 'patient_intake_records';
  const MEDIA = 'patient_media';
  const QUOTA = 'patient_media_quota';

  console.log(`🔍 前缀: ${prefix}  干跑(dry-run): ${dry ? '是' : '否'}`);

  // 收集患者 keys
  const re = db.RegExp({ regexp: `^${prefix}`, options: 'i' });
  let skip = 0; const size = 100; const keys = []; let found = 0;
  while (true) {
    const snap = await db.collection(PATIENTS)
      .where(_.or({ patientName: re }, { 'metadata.createdFrom': 'web-admin-e2e' }))
      .field({ _id: true, patientKey: true, patientName: true })
      .skip(skip).limit(size).get();
    const list = snap.data || [];
    for (const doc of list) {
      found += 1;
      keys.push(doc._id || doc.patientKey);
    }
    if (list.length < size) break;
    skip += size;
  }

  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));
  if (!uniqueKeys.length) {
    console.log('✅ 未发现可清理的 E2E 残留');
    return;
  }
  console.log(`🗑️  待清理患者数量: ${uniqueKeys.length}（总匹配: ${found}）`);

  if (dry) {
    console.log('（干跑）将删除以下 patientKey（最多显示 10 条）：');
    console.log(uniqueKeys.slice(0, 10).join(', ') + (uniqueKeys.length > 10 ? ' ...' : ''));
    return;
  }

  const chunk = (arr, n) => arr.reduce((acc, i, idx) => { (idx % n ? acc[acc.length - 1] : acc.push([])).push(i); return acc; }, []);
  const keyChunks = chunk(uniqueKeys, 50);

  // 删除 intake 记录
  let removedIntakes = 0;
  for (const group of keyChunks) {
    const res = await db.collection(INTAKES).where({ patientKey: _.in(group) }).remove();
    removedIntakes += res.deleted || 0;
  }
  console.log(`🧹 已删除入住记录: ${removedIntakes}`);

  // 删除 media 记录
  let removedMedia = 0;
  for (const group of keyChunks) {
    const res = await db.collection(MEDIA).where({ patientKey: _.in(group) }).remove();
    removedMedia += res.deleted || 0;
  }
  console.log(`🧹 已删除附件记录: ${removedMedia}`);

  // 删除 quota 文档
  let removedQuota = 0;
  for (const k of uniqueKeys) {
    try {
      const res = await db.collection(QUOTA).doc(k).remove();
      removedQuota += res.deleted || 0;
    } catch (_) {}
  }
  console.log(`🧹 已删除附件配额: ${removedQuota}`);

  // 删除患者本体
  let removedPatients = 0;
  for (const group of keyChunks) {
    const res = await db.collection(PATIENTS).where({ _id: _.in(group) }).remove();
    removedPatients += res.deleted || 0;
  }
  console.log(`🧹 已删除患者档案: ${removedPatients}`);

  console.log('✅ 清理完成');
}

main().catch(err => {
  console.error('清理失败:', err && err.message ? err.message : err);
  process.exit(1);
});

