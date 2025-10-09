#!/usr/bin/env node
/**
 * 扫描 patients 集合，按身份证号聚合，输出疑似重复的住户档案。
 * 使用：node scripts/find-duplicate-patients.js [--with-empty]
 * 需要 .env 中配置 TCB_ENV / TENCENTCLOUD_SECRETID / TENCENTCLOUD_SECRETKEY
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const tcb = require('@cloudbase/node-sdk');

const { TCB_ENV, TENCENTCLOUD_SECRETID, TENCENTCLOUD_SECRETKEY } = process.env;
if (!TCB_ENV || !TENCENTCLOUD_SECRETID || !TENCENTCLOUD_SECRETKEY) {
  console.error('❌ 缺少云开发凭据，请在 .env 配置 TCB_ENV/TENCENTCLOUD_SECRETID/TENCENTCLOUD_SECRETKEY');
  process.exit(1);
}

const includeEmpty = process.argv.includes('--with-empty');

function normalizeIdNumber(value) {
  if (!value && value !== 0) return '';
  return String(value).trim().replace(/\s+/g, '').toUpperCase();
}

function normalizeText(value) {
  if (!value && value !== 0) return '';
  return String(value).trim();
}

async function fetchAllPatients(db) {
  const coll = db.collection('patients');
  const pageSize = 500;
  const all = [];
  let skip = 0;
  while (true) {
    const res = await coll
      .orderBy('updatedAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .field({ _id: true, patientName: true, idNumber: true, updatedAt: true, admissionCount: true })
      .get();
    const list = Array.isArray(res.data) ? res.data : [];
    if (!list.length) break;
    all.push(...list);
    skip += list.length;
  }
  return all;
}

function groupByIdNumber(patients) {
  const groups = new Map();
  for (const p of patients) {
    const id = normalizeIdNumber(p.idNumber);
    if (!id && !includeEmpty) continue;
    const key = id || `__EMPTY__:${normalizeText(p.patientName)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return groups;
}

function printDuplicates(groups) {
  let dupCount = 0;
  groups.forEach((list, key) => {
    if (!Array.isArray(list) || list.length < 2) return;
    dupCount += 1;
    console.log(`\n# 组 ${dupCount} — 身份标识: ${key}`);
    list
      .sort((a, b) => (Number(b.updatedAt || 0) - Number(a.updatedAt || 0)))
      .forEach(item => {
        console.log(
          `- _id=${item._id}  姓名=${normalizeText(item.patientName)}  身份证=${normalizeIdNumber(
            item.idNumber
          )}  入住次数=${item.admissionCount || 0}  更新时间=${new Date(
            Number(item.updatedAt || 0)
          ).toLocaleString()}`
        );
      });
  });
  if (dupCount === 0) {
    console.log('✅ 未发现重复身份证号的住户档案');
  } else {
    console.log(`\n共发现 ${dupCount} 组疑似重复的住户，请人工确认并合并。`);
  }
}

async function main() {
  const app = tcb.init({ env: TCB_ENV, secretId: TENCENTCLOUD_SECRETID, secretKey: TENCENTCLOUD_SECRETKEY });
  const db = app.database();
  const patients = await fetchAllPatients(db);
  const groups = groupByIdNumber(patients);
  printDuplicates(groups);
}

main().catch(err => {
  console.error('执行失败：', err && err.message ? err.message : err);
  process.exit(1);
});

