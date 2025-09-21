#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');
const cloudbase = require('@cloudbase/node-sdk');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const COLLECTION = 'excel_records';
const TEST_PREFIX = 'TEST_AUTOMATION_';
const RUN_ID = TEST_PREFIX + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

function requireEnv(name) {
  if (!process.env[name]) {
    console.error('[run-patient-suite] Missing required environment variable: ' + name);
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

function toTimestamp(dateText) {
  const normalized = dateText.replace(/[./]/g, '-');
  const time = Date.parse(normalized);
  return Number.isNaN(time) ? Date.now() : time;
}

function buildPatientRecords() {
  const patientBase = (suffix) => RUN_ID + '_' + suffix;

  const admissionsA = [
    {
      date: '2024-08-01',
      hospital: '自动化儿童医院',
      diagnosis: '血液肿瘤入院评估',
      doctor: '李勇',
      symptoms: '持续发热、血象异常',
      treatmentProcess: '完成初步骨髓穿刺和化疗方案讨论',
      followUpPlan: '两周后复诊确认疗程'
    },
    {
      date: '2024-09-12',
      hospital: '自动化儿童医院',
      diagnosis: '骨髓移植术后随访',
      doctor: '李勇',
      symptoms: '食欲恢复良好，轻微乏力',
      treatmentProcess: '调整抗排异药物剂量，进行免疫抑制监测',
      followUpPlan: '一个月后门诊复查'
    }
  ];

  const admissionsB = [
    {
      date: '2024-07-05',
      hospital: '康复中心医院',
      diagnosis: '神经康复入院评估',
      doctor: '王珊',
      symptoms: '术后肢体活动受限',
      treatmentProcess: '制定物理治疗计划，安排康复训练课程',
      followUpPlan: '每周两次复查训练效果'
    },
    {
      date: '2024-10-18',
      hospital: '康复中心医院',
      diagnosis: '强化康复训练复诊',
      doctor: '王珊',
      symptoms: '肌力提升明显，仍伴随轻度疼痛',
      treatmentProcess: '增加水疗课程，评估疼痛管理方案',
      followUpPlan: '半月后复诊，必要时调整训练强度'
    }
  ];

  const toRecords = (suffix, profile, admissions) => admissions.map((item, index) => ({
    key: patientBase(suffix),
    patientName: profile.name,
    gender: profile.gender,
    birthDate: profile.birthDate,
    nativePlace: profile.nativePlace,
    ethnicity: profile.ethnicity,
    caregivers: profile.caregivers,
    address: profile.address,
    fatherInfo: profile.fatherInfo,
    motherInfo: profile.motherInfo,
    otherGuardian: profile.otherGuardian,
    familyEconomy: profile.familyEconomy,
    admissionDate: item.date,
    admissionTimestamp: toTimestamp(item.date),
    hospital: item.hospital,
    diagnosis: item.diagnosis,
    doctor: item.doctor,
    symptoms: item.symptoms,
    treatmentProcess: item.treatmentProcess,
    followUpPlan: item.followUpPlan,
    identitySignature: {
      id: '',
      father: profile.fatherKey,
      mother: profile.motherKey
    },
    testMarker: RUN_ID,
    _source: 'automation',
    _runId: RUN_ID,
    _admissionIndex: index + 1
  }));

  const patientA = {
    name: patientBase('ALPHA'),
    gender: '男',
    birthDate: '2015-05-06',
    nativePlace: '江苏南京',
    ethnicity: '汉族',
    caregivers: 'TEST_AUTOMATION_父亲、TEST_AUTOMATION_母亲',
    address: '江苏省南京市秦淮区中山南路 100 号',
    fatherInfo: 'TEST_AUTOMATION_父亲 13800001111 身份证 320106200001010011',
    motherInfo: 'TEST_AUTOMATION_母亲 13800002222 身份证 320106200001010022',
    otherGuardian: '',
    familyEconomy: '家庭月收入 8000 元，需慈善支持',
    fatherKey: RUN_ID + '_ALPHA_FATHER',
    motherKey: RUN_ID + '_ALPHA_MOTHER'
  };

  const patientB = {
    name: patientBase('BETA'),
    gender: '女',
    birthDate: '2017-03-18',
    nativePlace: '浙江杭州',
    ethnicity: '汉族',
    caregivers: 'TEST_AUTOMATION_祖母',
    address: '浙江省杭州市西湖区文三路 200 号',
    fatherInfo: '',
    motherInfo: '',
    otherGuardian: '祖母 13700003333',
    familyEconomy: '主要依靠亲属支援',
    fatherKey: RUN_ID + '_BETA_FATHER',
    motherKey: RUN_ID + '_BETA_MOTHER'
  };

  return [
    ...toRecords('ALPHA', patientA, admissionsA),
    ...toRecords('BETA', patientB, admissionsB)
  ];
}

async function removeExistingTestData(collection, command, db) {
  const matcher = command.or([
    { testMarker: command.exists(true) },
    { ['data.testMarker']: command.exists(true) },
    { key: db.RegExp({ regexp: '^' + TEST_PREFIX }) },
    { ['data.key']: db.RegExp({ regexp: '^' + TEST_PREFIX }) }
  ]);

  try {
    const bulk = await collection.where(matcher).remove();
    if (bulk && typeof bulk.deleted === 'number') {
      console.log('[run-patient-suite] Bulk removed ' + bulk.deleted + ' automation documents.');
      if (bulk.deleted === 0) {
        return;
      }
    }
  } catch (error) {
    console.warn('[run-patient-suite] Bulk remove fallback:', error && error.message ? error.message : error);
  }

  const batchSize = 100;
  while (true) {
    const snapshot = await collection.where(matcher).limit(batchSize).get();
    if (!snapshot.data.length) {
      break;
    }
    for (const doc of snapshot.data) {
      await collection.doc(doc._id).remove();
    }
    if (snapshot.data.length < batchSize) {
      break;
    }
  }
}

async function insertRecords(collection, records) {
  let inserted = 0;
  for (const record of records) {
    const res = await collection.add({ data: record });
    if (res && res.id) {
      console.log('[run-patient-suite] Inserted doc id', res.id);
      try {
        await collection.doc(res.id).update({ key: record.key, testMarker: RUN_ID });
      } catch (updateError) {
        console.warn('[run-patient-suite] Unable to set root fields for doc', res.id, updateError.message || updateError);
      }
    } else if (res && Array.isArray(res.ids)) {
      console.log('[run-patient-suite] Inserted doc ids', res.ids.join(', '));
      const batchUpdate = res.ids.map((id) => collection.doc(id).update({ key: record.key, testMarker: RUN_ID }).catch((err) => {
        console.warn('[run-patient-suite] Unable to set root fields for doc', id, err.message || err);
      }));
      await Promise.all(batchUpdate);
    }
    if (res && Array.isArray(res.ids)) {
      inserted += res.ids.length;
    } else if (res && typeof res.id === 'string') {
      inserted += 1;
    } else {
      inserted += 1;
    }
  }
  return inserted;
}

function runJestSuite() {
  const isWin = process.platform === 'win32';
  const command = isWin ? 'npx.cmd' : 'npx';
  const args = ['jest', '--config', 'tests/e2e/jest.config.cjs', '--runInBand'];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Jest exited with code ' + code));
      }
    });
    child.on('error', reject);
  });
}

async function main() {
  console.log('[run-patient-suite] Start run id ' + RUN_ID);
  const { app, envId } = connectCloudBase();
  const db = app.database({ env: envId });
  const collection = db.collection(COLLECTION);
  const command = db.command;

  const records = buildPatientRecords();
  const patientKeys = Array.from(new Set(records.map((record) => record.key)));
  let testError;

  try {
    console.log('[run-patient-suite] Cleaning existing automation records...');
    await removeExistingTestData(collection, command, db);

    console.log('[run-patient-suite] Inserting ' + records.length + ' test admissions for ' + patientKeys.length + ' patients...');
    const inserted = await insertRecords(collection, records);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const verify = await collection.where({ ['data.testMarker']: RUN_ID }).get();
    console.log('[run-patient-suite] Verification query returned ' + verify.data.length + ' documents (expected ' + inserted + ').');

    console.log('[run-patient-suite] Executing E2E suite...');
    await runJestSuite();
    console.log('[run-patient-suite] E2E suite completed successfully.');
  } catch (error) {
    testError = error;
    console.error('[run-patient-suite] E2E suite failed:', error && error.message ? error.message : error);
  } finally {
    try {
      console.log('[run-patient-suite] Removing automation records...');
      await removeExistingTestData(collection, command, db);
      console.log('[run-patient-suite] Cleanup completed.');
    } catch (cleanupError) {
      console.error('[run-patient-suite] Cleanup encountered an error:', cleanupError && cleanupError.message ? cleanupError.message : cleanupError);
      if (!testError) {
        testError = cleanupError;
      }
    }
  }

  if (testError) {
    process.exitCode = 1;
  } else {
    console.log('[run-patient-suite] All tasks finished without errors.');
  }
}

main();
