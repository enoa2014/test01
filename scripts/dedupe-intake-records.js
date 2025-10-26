#!/usr/bin/env node
const path = require('path');
const crypto = require('crypto');
const tcb = require('@cloudbase/node-sdk');
const {
  normalizeSpacing,
  normalizeTimestamp,
  dedupeIntakeRecords,
} = require('../cloudfunctions/patientIntake/utils/patient');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { TCB_ENV, TENCENTCLOUD_SECRETID, TENCENTCLOUD_SECRETKEY } = process.env;

if (!TCB_ENV || !TENCENTCLOUD_SECRETID || !TENCENTCLOUD_SECRETKEY) {
  console.error('Missing cloud credentials. Please set TCB_ENV, TENCENTCLOUD_SECRETID, TENCENTCLOUD_SECRETKEY in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
let patientKey = '';
let dryRun = false;
let triggerSync = false;

args.forEach(arg => {
  if (arg === '--dry-run') {
    dryRun = true;
  } else if (arg === '--sync') {
    triggerSync = true;
  } else if (arg.startsWith('--patient=')) {
    patientKey = arg.slice('--patient='.length);
  } else if (!patientKey) {
    patientKey = arg;
  }
});

if (!patientKey) {
  console.error('Usage: node scripts/dedupe-intake-records.js <patientKey> [--dry-run]');
  process.exit(1);
}

const app = tcb.init({ env: TCB_ENV, secretId: TENCENTCLOUD_SECRETID, secretKey: TENCENTCLOUD_SECRETKEY });
const db = app.database();
const _ = db.command;

function normalizeText(value) {
  const text = normalizeSpacing(value);
  return text || '';
}

function buildRecordSignature(record = {}) {
  const metadata = record.metadata || {};
  const patientKeyValue = record.patientKey || '';
  const parts = [];

  const addPart = value => {
    const text = normalizeText(value);
    if (text) {
      parts.push(text);
    }
  };

  const importOrder = metadata.importOrder !== undefined ? metadata.importOrder : record.importOrder;
  if (Number.isFinite(importOrder)) {
    parts.push(`order:${importOrder}`);
  }

  const rowIndex = metadata.rowIndex !== undefined ? metadata.rowIndex : record._rowIndex;
  if (Number.isFinite(rowIndex)) {
    parts.push(`row:${rowIndex}`);
  }

  const admissionTs = normalizeTimestamp(
    record.admissionTimestamp ||
      record.intakeTime ||
      (record.intakeInfo && record.intakeInfo.intakeTime) ||
      metadata.intakeTime ||
      record.createdAt
  );
  if (admissionTs !== null) {
    parts.push(`ts:${admissionTs}`);
  }

  const admissionDateRaw = normalizeText(record.admissionDateRaw || metadata.admissionDateRaw || record.admissionDate);
  if (admissionDateRaw) {
    parts.push(`date:${admissionDateRaw}`);
  }

  const medicalInfo = record.medicalInfo || {};
  const intakeInfo = record.intakeInfo || {};
  const hospital = normalizeText(
    record.hospital ||
      medicalInfo.hospital ||
      medicalInfo.hospitalDisplay ||
      intakeInfo.hospital
  );
  const diagnosis = normalizeText(
    record.diagnosis ||
      medicalInfo.diagnosis ||
      medicalInfo.diagnosisDisplay ||
      intakeInfo.diagnosis ||
      intakeInfo.visitReason
  );
  if (hospital || diagnosis) {
    parts.push(`info:${hospital}-${diagnosis}`);
  }

  const followUp = normalizeText(medicalInfo.followUpPlan || intakeInfo.followUpPlan);
  if (followUp) {
    parts.push(`plan:${followUp}`);
  }

  if (!parts.length) {
    addPart(record.intakeId);
    addPart(record._id);
  }

  if (!parts.length) {
    parts.push(`fallback:${record.updatedAt || Date.now()}`);
  }

  const raw = `${patientKeyValue}|${parts.join('|')}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

async function fetchRecords(key) {
  const pageSize = 100;
  const results = [];
  let skip = 0;

  while (true) {
    const res = await db
      .collection('patient_intake_records')
      .where({ patientKey: key })
      .skip(skip)
      .limit(pageSize)
      .get();

    const list = res.data || [];
    results.push(...list);
    if (list.length < pageSize) {
      break;
    }
    skip += pageSize;
  }

  return results;
}

(async () => {
  console.log(`Loading intake records for patientKey: ${patientKey}`);
  const records = await fetchRecords(patientKey);
  console.log(`Fetched ${records.length} records`);
  if (!records.length) {
    console.log('No records found. Exit.');
    return;
  }

  const signatureMap = new Map();
  records.forEach(record => {
    const signature = buildRecordSignature(record);
    const bucket = signatureMap.get(signature) || [];
    bucket.push(record);
    signatureMap.set(signature, bucket);
  });

  const keepList = [];
  const removeList = [];

  signatureMap.forEach(bucket => {
    if (!bucket.length) {
      return;
    }
    bucket.sort((a, b) => {
      const timeA = normalizeTimestamp(a.admissionTimestamp || a.metadata?.intakeTime || a.createdAt);
      const timeB = normalizeTimestamp(b.admissionTimestamp || b.metadata?.intakeTime || b.createdAt);
      if (timeA !== timeB) {
        return (timeA || 0) - (timeB || 0);
      }
      return String(a._id).localeCompare(String(b._id));
    });
    keepList.push(bucket[0]);
    for (let i = 1; i < bucket.length; i += 1) {
      removeList.push(bucket[i]);
    }
  });

  console.log(`Will keep ${keepList.length} records, ${removeList.length} duplicates detected.`);

  if (removeList.length && dryRun) {
    console.log('Dry-run mode: duplicates would be removed:', removeList.map(d => d._id));
  }

  if (!dryRun) {
    for (const duplicate of removeList) {
      try {
        await db.collection('patient_intake_records').doc(duplicate._id).remove();
        console.log(`Removed duplicate ${duplicate._id}`);
      } catch (error) {
        console.error(`Failed to remove ${duplicate._id}`, error);
      }
    }
  }

  for (const record of keepList) {
    const signature = buildRecordSignature(record);
    const excelRecordId = `excel_${signature}`;
    const metadata = record.metadata || {};
    if (metadata.excelRecordId === excelRecordId && metadata.recordSignature === signature) {
      continue;
    }
    if (dryRun) {
      console.log(`Would update ${record._id} with excelRecordId=${excelRecordId}`);
      continue;
    }
    try {
      await db.collection('patient_intake_records').doc(record._id).update({
        data: {
          'metadata.excelRecordId': excelRecordId,
          'metadata.recordSignature': signature,
        },
      });
      console.log(`Updated ${record._id} metadata with stable signature`);
    } catch (error) {
      console.error(`Failed to update ${record._id}`, error);
    }
  }

  if (triggerSync && !dryRun) {
    try {
      await app.callFunction({
        name: 'patientIntake',
        data: {
          action: 'getPatientDetail',
          patientKey,
        },
      });
      console.log('Triggered patient detail sync to refresh aggregates.');
    } catch (error) {
      console.warn('Failed to trigger patient detail sync', error);
    }
  }

  console.log('Done.');
})();
