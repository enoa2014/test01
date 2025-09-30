#!/usr/bin/env node

/**
 * 便捷脚本：读取 .env 环境变量，并直接调用 patientIntake 云函数
 * 用于本地排查“入住提交”是否真正写入数据库
 *
 * 用法：
 *   node scripts/test-patient-intake.js           # 新增一条测试入住记录
 *   node scripts/test-patient-intake.js --existing <patientKey>   # 复用已存在患者 key
 */

const path = require('path');
const cloudbase = require('@cloudbase/node-sdk');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ 环境变量 ${name} 未配置，请在 .env 或 shell 中设置`);
    process.exit(1);
  }
  return value;
}

function createCloudApp() {
  const envId = requireEnv('TCB_ENV');
  const secretId = requireEnv('TENCENTCLOUD_SECRETID');
  const secretKey = requireEnv('TENCENTCLOUD_SECRETKEY');

  return cloudbase.init({ env: envId, secretId, secretKey });
}

function buildFormData(seed) {
  const idSuffix = seed.toString().slice(-10);
  return {
    patientName: `TEST_AUTOMATION_${seed}`,
    idType: '身份证',
    idNumber: `110101199001${idSuffix.padStart(6, '0')}`.slice(0, 18),
    gender: '女',
    birthDate: '1990-01-15',
    phone: `138${Math.floor(10000000 + Math.random() * 89999999)}`,
    address: '北京市东城区演示护理院 1 号楼 302',
    emergencyContact: '测试紧急联系人',
    emergencyPhone: `139${Math.floor(10000000 + Math.random() * 89999999)}`,
    backupContact: '备用联系人',
    backupPhone: `137${Math.floor(10000000 + Math.random() * 89999999)}`,
    situation: '患者需要持续护理与康复训练，症状稳定但需观察护理计划执行情况。',
    followUpPlan: '两周复诊，持续康复训练',
    medicalHistory: ['高血压'],
  };
}

async function submitIntake(app, options = {}) {
  const now = Date.now();
  const isEditingExisting = Boolean(options.existingKey);
  const payload = {
    action: 'submit',
    patientKey: isEditingExisting ? options.existingKey : null,
    isEditingExisting,
    formData: isEditingExisting ? { ...options.formData } : buildFormData(now),
    uploadedFiles: [],
    timestamp: now,
  };

  console.log('🚀 调用 patientIntake 云函数，提交数据：');
  console.log(JSON.stringify(payload, null, 2));

  const res = await app.callFunction({
    name: 'patientIntake',
    data: payload,
  });

  return res;
}

async function main() {
  const args = process.argv.slice(2);
  const existingKeyFlag = args.indexOf('--existing');
  const options = {};

  if (existingKeyFlag >= 0) {
    const key = args[existingKeyFlag + 1];
    if (!key) {
      console.error('❌ 使用 --existing 时需要提供 patientKey');
      process.exit(1);
    }
    options.existingKey = key;
  }

  const app = createCloudApp();

  try {
    const result = await submitIntake(app, options);

    console.log('\n✅ 云函数返回：');
    console.log(JSON.stringify(result, null, 2));

    if (result?.result?.success) {
      console.log('\n🎉 入住提交成功，患者已写入数据库');
    } else {
      console.log('\n⚠️ 云函数执行未返回 success=true，请检查返回结构或云端日志');
    }
  } catch (error) {
    console.error('\n❌ 调用失败：', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 未捕获的异常：', error);
    process.exit(1);
  });
}

module.exports = {
  submitIntake,
};
