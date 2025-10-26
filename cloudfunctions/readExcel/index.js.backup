const XLSX = require("xlsx");
const crypto = require("crypto");
const cloud = require("wx-server-sdk");

const CURRENT_ENV = process.env.TCB_ENV || process.env.TENCENTCLOUD_ENV || process.env.SCF_NAMESPACE || "cloud1-6g2fzr5f7cf51e38";
cloud.init({ env: CURRENT_ENV });

const EXCEL_FILE_ID = process.env.EXCEL_FILE_ID
  || "cloud://cloud1-6g2fzr5f7cf51e38.636c-cloud1-6g2fzr5f7cf51e38-1375978325/data/b.xlsx";
const COLLECTION = "excel_records";
const CACHE_COLLECTION = "excel_cache";
const PATIENTS_COLLECTION = "patients";
const PATIENT_INTAKE_COLLECTION = "patient_intake_records";
const SUMMARIES_CACHE_KEY = "patient_summaries";
const CACHE_TTL_MS = Number(process.env.EXCEL_CACHE_TTL || 5 * 60 * 1000);

const LABEL_MAP = {
  patientName: ["姓名"],
  gender: ["性别"],
  admissionDate: ["入住时间"],
  caregivers: ["入住人"],
  birthDate: ["患儿基本信息_出生日期"],
  nativePlace: ["患儿基本信息_籍贯", "籍贯"],
  ethnicity: ["患儿基本信息_民族", "民族"],
  idNumber: ["患儿基本信息_身份证号", "身份证号"],
  hospital: ["就诊情况_就诊医院", "就诊医院"],
  diagnosis: ["就诊情况_医院诊断"],
  doctor: ["就诊情况_医生姓名", "医生姓名"],
  symptoms: ["医疗情况_症状详情"],
  treatmentProcess: ["医疗情况_医治过程"],
  followUpPlan: ["医疗情况_后续治疗安排"],
  address: ["家庭基础信息_家庭地址", "家庭基本情况_家庭地址", "家庭地址"],
  fatherInfo: ["家庭基础信息_父亲姓名联系电话身份证号", "家庭基本情况_父亲姓名、电话、身份证号", "父亲姓名、电话、身份证号"],
  motherInfo: ["家庭基础信息_母亲姓名联系电话身份证号", "家庭基本情况_母亲姓名、电话、身份证号", "母亲姓名、电话、身份证号"],
  otherGuardian: ["家庭基础信息_其他监护人", "家庭基本情况_其他监护人", "其他监护人"],
  familyEconomy: ["家庭基础信息_家庭经济", "家庭基本情况_家庭经济", "家庭经济"],
  hospitalAdditional: ["就诊情况_医院诊断", "医院诊断"],
  diagnosisAdditional: ["医疗情况_症状详情", "症状详情"]
};

async function downloadExcelBuffer() {
  if (!EXCEL_FILE_ID) {
    throw new Error("Excel file id is not configured");
  }
  const { fileContent } = await cloud.downloadFile({ fileID: EXCEL_FILE_ID });
  return fileContent;
}

function buildLabelIndex(headers, subHeaders) {
  const index = new Map();
  const maxLength = Math.max(headers.length, subHeaders.length);
  for (let i = 0; i < maxLength; i += 1) {
    const top = (headers[i] || "").toString().trim();
    const sub = (subHeaders[i] || "").toString().trim();
    const candidates = [];
    if (top && sub) {
      candidates.push(`${top}_${sub}`);
    }
    if (top) {
      candidates.push(top);
    }
    if (sub) {
      candidates.push(sub);
    }
    candidates.push(`col_${i + 1}`);
    candidates.forEach((label) => {
      if (label && !index.has(label)) {
        index.set(label, i);
      }
    });
  }
  return index;
}

function normalizeValue(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function normalizeSpacing(value) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

function parseGuardianInfo(value) {
  const raw = normalizeSpacing(value);
  if (!raw) {
    return null;
  }
  const phoneMatch = raw.match(/1\d{10}/);
  const idMatch = raw.match(/\d{15,18}[Xx]?/);
  let name = raw;
  if (phoneMatch) {
    const phonePattern = new RegExp(phoneMatch[0], 'g');
    name = name.replace(phonePattern, ' ');
  }
  if (idMatch) {
    const idPattern = new RegExp(idMatch[0], 'ig');
    name = name.replace(idPattern, ' ');
  }
  name = name.replace(/[,:，：]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    raw,
    name,
    phone: phoneMatch ? phoneMatch[0] : '',
    idNumber: idMatch ? idMatch[0].toUpperCase() : ''
  };
}

function pushGuardianInfo(list, signatureMap, info) {
  if (!info) {
    return;
  }
  const normalizeId = (value) => (value ? value.toUpperCase() : '');
  const normalizedInfo = {
    name: info.name || '',
    phone: info.phone || '',
    idNumber: normalizeId(info.idNumber),
    raw: info.raw || ''
  };

  const findExisting = () => {
    for (const entry of signatureMap.values()) {
      if (
        (normalizedInfo.idNumber && normalizedInfo.idNumber === normalizeId(entry.idNumber)) ||
        (normalizedInfo.phone && normalizedInfo.phone === entry.phone) ||
        (normalizedInfo.name && normalizedInfo.name === entry.name)
      ) {
        return entry;
      }
    }
    return null;
  };

  const existing = findExisting();
  if (existing) {
    if (normalizedInfo.name && !existing.name) {
      existing.name = normalizedInfo.name;
    }
    if (normalizedInfo.phone && !existing.phone) {
      existing.phone = normalizedInfo.phone;
    }
    if (normalizedInfo.idNumber && !existing.idNumber) {
      existing.idNumber = normalizedInfo.idNumber;
    }
    if (!existing.raw && normalizedInfo.raw) {
      existing.raw = normalizedInfo.raw;
    }
    return;
  }

  const signature = normalizedInfo.idNumber || normalizedInfo.phone || normalizedInfo.name || `RAW:${normalizedInfo.raw}`;
  const entry = { ...normalizedInfo };
  signatureMap.set(signature, entry);
  list.push(entry);
}


function isRowEmpty(row = []) {
  if (!row || !row.length) {
    return true;
  }
  return row.every((cell) => !normalizeValue(cell));
}

function parseDateValue(value) {
  const str = normalizeValue(value);
  if (!str) {
    return { text: "", timestamp: 0 };
  }
  const normalized = str.replace(/[./]/g, "-");
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    return { text: str, timestamp: date.getTime() };
  }
  return { text: str, timestamp: 0 };
}

function getFieldValue(row, labelIndex, labels) {
  for (const label of labels) {
    const idx = labelIndex.get(label);
    if (idx !== undefined) {
      return normalizeValue(row[idx]);
    }
  }
  return "";
}

function extractRecords(rows, labelIndex) {
  const records = [];
  const contentFields = [
    'gender',
    'birthDate',
    'nativePlace',
    'ethnicity',
    'caregivers',
    'admissionDate',
    'hospital',
    'diagnosis',
    'doctor',
    'symptoms',
    'treatmentProcess',
    'followUpPlan',
    'address',
    'fatherInfo',
    'motherInfo',
    'otherGuardian',
    'familyEconomy'
  ];

  rows.forEach((row, rawIndex) => {
    if (isRowEmpty(row)) {
      return;
    }
    const patientName = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.patientName));
    if (!patientName) {
      return;
    }

    const idNumberRaw = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.idNumber));
    const birthDate = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.birthDate));
    const caregivers = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.caregivers));
    const fatherInfoRaw = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.fatherInfo));
    const motherInfoRaw = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.motherInfo));
    const otherGuardian = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.otherGuardian));
    const familyEconomy = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.familyEconomy));
    const address = normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.address));

    const fatherParsed = parseGuardianInfo(fatherInfoRaw);
    const motherParsed = parseGuardianInfo(motherInfoRaw);
    const normalizedId = idNumberRaw ? idNumberRaw.toUpperCase() : '';

    const buildGuardianKey = (info) => {
      if (!info) {
        return '';
      }
      return info.idNumber || info.phone || info.name || info.raw || '';
    };

    const fatherKey = buildGuardianKey(fatherParsed);
    const motherKey = buildGuardianKey(motherParsed);

    const admissionInfo = parseDateValue(getFieldValue(row, labelIndex, LABEL_MAP.admissionDate));

    const record = {
      key: patientName,
      patientName,
      gender: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.gender)) || '',
      birthDate,
      nativePlace: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.nativePlace)),
      ethnicity: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.ethnicity)),
      idNumber: normalizedId,
      caregivers,
      admissionDate: admissionInfo.text,
      admissionTimestamp: admissionInfo.timestamp,
      hospital: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.hospital)),
      diagnosis:
        normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.diagnosis)) ||
        normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.hospitalAdditional)),
      doctor: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.doctor)),
      symptoms:
        normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.symptoms)) ||
        normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.diagnosisAdditional)),
      treatmentProcess: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.treatmentProcess)),
      followUpPlan: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.followUpPlan)),
      address,
      fatherInfo: fatherInfoRaw,
      motherInfo: motherInfoRaw,
      otherGuardian,
      familyEconomy,
      identitySignature: {
        id: normalizedId,
        father: fatherKey,
        mother: motherKey
      },
      rawRowIndex: rawIndex + 1
    };

    const hasContent = contentFields.some((field) => normalizeValue(record[field]));
    if (!hasContent) {
      return;
    }

    records.push(record);
  });

  return records;
}




function buildPatientGroups(records) {
  const groups = new Map();

  const addUniqueValue = (group, setKey, listKey, value) => {
    const normalized = normalizeSpacing(value);
    if (!normalized) {
      return;
    }
    if (!group[setKey].has(normalized)) {
      group[setKey].add(normalized);
      group[listKey].push(normalized);
    }
  };

  records.forEach((record) => {
    if (!record.key) {
      return;
    }
    if (!groups.has(record.key)) {
      groups.set(record.key, {
        key: record.key,
        patientName: record.patientName,
        gender: record.gender,
        idNumber: record.idNumber,
        birthDate: record.birthDate,
        nativePlace: record.nativePlace,
        ethnicity: record.ethnicity,
        caregiverNames: new Set(),
        addressSet: new Set(),
        addressList: [],
        fatherDetails: [],
        fatherSignatureMap: new Map(),
        motherDetails: [],
        motherSignatureMap: new Map(),
        otherGuardianDetails: [],
        otherGuardianSignatureMap: new Map(),
        familyEconomySet: new Set(),
        familyEconomyList: [],
        records: []
      });
    }

    const group = groups.get(record.key);
    group.records.push(record);

    if (record.gender && !group.gender) group.gender = record.gender;
    if (record.idNumber && !group.idNumber) group.idNumber = record.idNumber;
    if (record.birthDate && !group.birthDate) group.birthDate = record.birthDate;
    if (record.nativePlace && !group.nativePlace) group.nativePlace = record.nativePlace;
    if (record.ethnicity && !group.ethnicity) group.ethnicity = record.ethnicity;

    const caregiverValue = normalizeSpacing(record.caregivers);
    if (caregiverValue) {
      caregiverValue
        .split(/[、,，;；\/]+/)
        .map((name) => name.trim())
        .filter((name) => name && name !== record.patientName)
        .forEach((name) => group.caregiverNames.add(name));
    }

    addUniqueValue(group, 'addressSet', 'addressList', record.address);
    addUniqueValue(group, 'familyEconomySet', 'familyEconomyList', record.familyEconomy);

    group.fatherSignatureMap = group.fatherSignatureMap || new Map();
    group.motherSignatureMap = group.motherSignatureMap || new Map();
    group.otherGuardianSignatureMap = group.otherGuardianSignatureMap || new Map();

    pushGuardianInfo(group.fatherDetails, group.fatherSignatureMap, parseGuardianInfo(record.fatherInfo));
    pushGuardianInfo(group.motherDetails, group.motherSignatureMap, parseGuardianInfo(record.motherInfo));
    pushGuardianInfo(group.otherGuardianDetails, group.otherGuardianSignatureMap, parseGuardianInfo(record.otherGuardian));
  });

  const summaries = [];
  groups.forEach((group) => {
    group.records.sort((a, b) => (b.admissionTimestamp || 0) - (a.admissionTimestamp || 0));
    const latest = group.records[0] || {};
    const ascendingRecords = [...group.records].reverse();
    const findEarliestRecord = (predicate) => ascendingRecords.find((item) => item && predicate(item));
    const findLatestRecord = (predicate) => group.records.find((item) => item && predicate(item));
    const firstWithAdmission = findEarliestRecord((item) => normalizeSpacing(item.admissionDate) || item.admissionTimestamp);
    const firstWithDiagnosis = findEarliestRecord((item) => normalizeSpacing(item.diagnosis));
    const firstWithHospital = findEarliestRecord((item) => normalizeSpacing(item.hospital));
    const firstAdmissionDate = (firstWithAdmission && firstWithAdmission.admissionDate) || latest.admissionDate || '';
    const firstDiagnosis = (firstWithDiagnosis && firstWithDiagnosis.diagnosis) || latest.diagnosis || '';
    const firstHospital = (firstWithHospital && firstWithHospital.hospital) || latest.hospital || '';
    const caregiversText = Array.from(group.caregiverNames).join('、');

    summaries.push({
      key: group.key,
      patientName: group.patientName,
      gender: group.gender || latest.gender,
      idNumber: group.idNumber || latest.idNumber,
      birthDate: group.birthDate || latest.birthDate,
      nativePlace: group.nativePlace || latest.nativePlace,
      ethnicity: group.ethnicity || latest.ethnicity,
      caregivers: caregiversText,
      latestAdmissionDate: latest.admissionDate || '',
      latestDiagnosis: latest.diagnosis || '',
      latestHospital: latest.hospital || '',
      latestDoctor: latest.doctor || '',
      firstAdmissionDate: firstAdmissionDate,
      firstDiagnosis: firstDiagnosis,
      firstHospital: firstHospital,
      admissionCount: group.records.length,
      latestAdmissionTimestamp: latest.admissionTimestamp || 0
    });

    group.summaryCaregivers = caregiversText;
  });

  summaries.sort((a, b) => (b.latestAdmissionTimestamp || 0) - (a.latestAdmissionTimestamp || 0));

  return {
    summaries,
    groups
  };
}
async function ensureCollectionExists(collectionName) {
  const db = cloud.database();
  try {
    await db.collection(collectionName).limit(1).get();
    return true;
  } catch (error) {
    const code = (error && error.errCode !== undefined) ? error.errCode : (error && error.code);
    const message = (error && error.errMsg) ? error.errMsg : '';
    const notExists = code === -502005 || (message && message.indexOf('not exist') >= 0);
    if (notExists) {
      try {
        await db.createCollection(collectionName);
        return true;
      } catch (createErr) {
        const alreadyExists = createErr && (createErr.errCode === -502002 || (createErr.errMsg && createErr.errMsg.indexOf('already exist') >= 0));
        if (!alreadyExists) {
          console.warn('ensureCollectionExists failed', collectionName, createErr);
        }
      }
    }
  }
  return false;
}





function normalizeStoredRecord(doc) {
  if (!doc) {
    return null;
  }
  const payload = doc.data && typeof doc.data === "object" ? doc.data : doc;
  if (!payload || !payload.key) {
    return null;
  }
  const record = { ...payload };
  if (!record.admissionTimestamp) {
    const info = parseDateValue(record.admissionDate);
    record.admissionDate = info.text;
    record.admissionTimestamp = info.timestamp;
  }
  return record;
}

async function saveSummariesToCache(summaries) {
  try {
    const db = cloud.database();
    const docRef = db.collection(CACHE_COLLECTION).doc(SUMMARIES_CACHE_KEY);
    const now = Date.now();
    await docRef.set({
      data: {
        key: SUMMARIES_CACHE_KEY,
        type: 'summaries',
        payload: summaries || [],
        updatedAt: now,
        ttl: CACHE_TTL_MS
      }
    });
  } catch (error) {
    console.warn('saveSummariesToCache failed', error);
  }
}

async function fetchCachedSummaries() {
  try {
    const db = cloud.database();
    const docRef = db.collection(CACHE_COLLECTION).doc(SUMMARIES_CACHE_KEY);
    const res = await docRef.get();
    if (!res || !res.data) {
      return null;
    }
    const record = res.data;
    const updatedAt = Number(record.updatedAt || 0);
    const ttl = Number(record.ttl || CACHE_TTL_MS || 0);
    if (ttl > 0 && updatedAt && Date.now() - updatedAt > ttl) {
      return null;
    }
    const payload = record.payload;
    return Array.isArray(payload) ? payload : null;
  } catch (error) {
    if (error && (error.errCode === 'DOCUMENT_NOT_FOUND' || (error.errMsg && error.errMsg.indexOf('not exist') >= 0))) {
      return null;
    }
    console.warn('fetchCachedSummaries failed', error);
    return null;
  }
}

async function fetchRecordsFromDatabase() {
  const db = cloud.database();
  const collection = db.collection(COLLECTION);
  const result = [];
  const limit = 100;
  let skip = 0;

  while (true) {
    const res = await collection.skip(skip).limit(limit).get();
    if (!res.data.length) {
      break;
    }
    const chunk = res.data
      .map(normalizeStoredRecord)
      .filter((item) => item);
    result.push(...chunk);
    if (res.data.length < limit) {
      break;
    }
    skip += res.data.length;
  }
  return result;
}

async function fetchGroupByKey(recordKey) {
  if (!recordKey) {
    return null;
  }
  const db = cloud.database();
  const collection = db.collection(COLLECTION);
  const res = await collection.where({ key: recordKey }).get();
  if (!res.data.length) {
    return null;
  }
  const normalized = res.data
    .map(normalizeStoredRecord)
    .filter((item) => item);
  if (!normalized.length) {
    return null;
  }
  const { groups } = buildPatientGroups(normalized);
  return groups.get(recordKey) || null;
}

function buildInfoList(pairs = []) {
  return pairs
    .map(({ label, value }) => ({ label, value: normalizeValue(value) }))
    .filter((item) => item.value);
}

function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, sheetStubs: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { sheetName: "", headers: [], subHeaders: [], rows: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  const headers = rows[0] || [];
  const subHeaders = rows[1] || [];
  const dataRows = rows.slice(2);
  return { sheetName, headers, subHeaders, rows: dataRows };
}


function compactObject(source) {
  if (!source || typeof source !== 'object') {
    return {};
  }
  const result = {};
  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length === 0) {
      return;
    }
    if (value === undefined || value === null || value === '') {
      return;
    }
    result[key] = value;
  });
  return result;
}

function computePatientKey(group) {
  const name = normalizeSpacing(group.patientName || '').toLowerCase();
  const idNumber = normalizeSpacing(group.idNumber || '').toUpperCase();
  const base = idNumber ? `${name}::${idNumber}` : `${name}::${group.key || ''}`;
  const fallback = base && base.trim() ? base : `anon::${group.records?.[0]?.rawRowIndex || Date.now()}`;
  return crypto.createHash('sha256').update(fallback).digest('hex');
}

function buildContactList(group) {
  const contacts = [];
  const normalizeDetail = (detail) => ({
    name: normalizeSpacing(detail.name || ''),
    phone: normalizeSpacing(detail.phone || ''),
    idNumber: normalizeSpacing(detail.idNumber || ''),
    raw: detail.raw || ''
  });
  const pushDetails = (details = [], relation) => {
    details.forEach((detail) => {
      if (!detail) {
        return;
      }
      const normalized = normalizeDetail(detail);
      if (!normalized.name && !normalized.phone && !normalized.idNumber && !normalized.raw) {
        return;
      }
      contacts.push({ relation, ...normalized });
    });
  };
  pushDetails(group.fatherDetails, 'father');
  pushDetails(group.motherDetails, 'mother');
  pushDetails(group.otherGuardianDetails, 'guardian');
  return contacts;
}

function buildMedicalNotes(group) {
  const notes = [];
  (group.records || []).forEach((record) => {
    const note = compactObject({
      admissionDate: record.admissionDate,
      admissionTimestamp: record.admissionTimestamp,
      hospital: record.hospital,
      diagnosis: record.diagnosis,
      doctorName: record.doctor,
      symptoms: record.symptoms,
      treatmentProcess: record.treatmentProcess,
      followUpPlan: record.followUpPlan
    });
    if (Object.keys(note).length) {
      notes.push(note);
    }
  });
  return notes;
}

function buildPatientPayload(group, latestRecord) {
  return compactObject({
    patientName: group.patientName,
    gender: group.gender || latestRecord.gender,
    birthDate: group.birthDate || latestRecord.birthDate,
    idNumber: group.idNumber || latestRecord.idNumber,
    nativePlace: group.nativePlace || latestRecord.nativePlace,
    ethnicity: group.ethnicity || latestRecord.ethnicity,
    address: (group.addressList && group.addressList[0]) || latestRecord.address,
    caregivers: group.summaryCaregivers || '',
    lastIntakeNarrative: latestRecord.symptoms || latestRecord.treatmentProcess || latestRecord.diagnosis || ''
  });
}

function buildIntakePayload(group, patientKey, syncBatchId, serverDate) {
  const latestRecord = group.records && group.records[0] ? group.records[0] : {};
  const basicInfo = compactObject({
    patientName: group.patientName,
    gender: group.gender || latestRecord.gender,
    birthDate: group.birthDate || latestRecord.birthDate,
    idNumber: group.idNumber || latestRecord.idNumber,
    nativePlace: group.nativePlace || latestRecord.nativePlace,
    ethnicity: group.ethnicity || latestRecord.ethnicity,
    caregivers: group.summaryCaregivers || ''
  });

  const admission = compactObject({
    admissionDate: latestRecord.admissionDate,
    admissionTimestamp: latestRecord.admissionTimestamp,
    hospital: latestRecord.hospital,
    diagnosis: latestRecord.diagnosis,
    doctorName: latestRecord.doctor,
    followUpPlan: latestRecord.followUpPlan
  });

  const payload = {
    patientKey,
    stage: 'submitted',
    source: 'excel-import',
    syncBatchId,
    basicInfo,
    contacts: buildContactList(group),
    narrative: latestRecord.symptoms || latestRecord.treatmentProcess || latestRecord.diagnosis || '',
    medicalNotes: buildMedicalNotes(group),
    admission,
    attachments: [],
    meta: {
      lastExcelSyncAt: serverDate,
      lastExcelSyncBatchId: syncBatchId
    },
    createdAt: serverDate,
    updatedAt: serverDate
  };

  return payload;
}

async function fetchExistingDoc(docRef) {
  try {
    const res = await docRef.get();
    if (res && res.data) {
      return res.data;
    }
    return null;
  } catch (error) {
    if (error && error.errMsg && (error.errMsg.includes('not found') || error.errMsg.includes('document.get:fail'))) {
      return null;
    }
    if (error && typeof error.errCode === 'number' && error.errCode === 11) {
      return null;
    }
    throw error;
  }
}

async function upsertPatientDocument(patientKey, payload, syncBatchId, options = {}) {
  const db = cloud.database();
  const docRef = db.collection(PATIENTS_COLLECTION).doc(patientKey);
  const serverDate = options.serverDate || db.serverDate();
  const existing = await fetchExistingDoc(docRef);
  if (existing) {
    const updateData = {
      updatedAt: serverDate,
      'meta.lastExcelSyncAt': serverDate,
      'meta.lastExcelSyncBatchId': syncBatchId,
      'meta.lastExcelSource': 'readExcel'
    };
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        updateData[key] = value;
      }
    });
    await docRef.update({ data: updateData });
    return existing._id || patientKey;
  }

  const newDoc = {
    key: patientKey,
    createdAt: serverDate,
    updatedAt: serverDate,
    ...payload,
    meta: {
      lastExcelSyncAt: serverDate,
      lastExcelSyncBatchId: syncBatchId,
      lastExcelSource: 'readExcel'
    }
  };
  await docRef.set({ data: newDoc });
  return patientKey;
}

async function upsertIntakeRecord(patientKey, intakePayload, options = {}) {
  const db = cloud.database();
  const collection = db.collection(PATIENT_INTAKE_COLLECTION);
  const serverDate = options.serverDate || db.serverDate();
  const docId = `${patientKey}-excel`;
  const payload = {
    ...intakePayload,
    updatedAt: serverDate,
    createdAt: intakePayload.createdAt || serverDate,
    meta: {
      ...(intakePayload.meta || {}),
      lastExcelSyncAt: serverDate,
      lastExcelSyncBatchId: intakePayload.syncBatchId
    }
  };
  await collection.doc(docId).set({ data: payload });
  return docId;
}

async function syncPatientsFromGroups(groups, options = {}) {
  if (!groups) {
    return { syncBatchId: options.syncBatchId || '', patients: 0, intakeRecords: 0, errors: [] };
  }
  const groupList = Array.isArray(groups)
    ? groups
    : (typeof groups.values === 'function' ? Array.from(groups.values()) : Object.values(groups));
  const db = cloud.database();
  const serverDate = options.serverDate || db.serverDate();
  const syncBatchId = options.syncBatchId || `excel-${Date.now()}`;
  await ensureCollectionExists(PATIENTS_COLLECTION);
  await ensureCollectionExists(PATIENT_INTAKE_COLLECTION);

  let patientCount = 0;
  let intakeCount = 0;
  const errors = [];

  for (const group of groupList) {
    if (!group || !group.patientName) {
      continue;
    }
    try {
      const patientKey = computePatientKey(group);
      const latestRecord = group.records && group.records[0] ? group.records[0] : {};
      const patientPayload = buildPatientPayload(group, latestRecord);
      const patientDocId = await upsertPatientDocument(patientKey, patientPayload, syncBatchId, { serverDate });
      patientCount += 1;

      const intakePayload = buildIntakePayload(group, patientKey, syncBatchId, serverDate);
      const intakeDocId = await upsertIntakeRecord(patientKey, intakePayload, { serverDate });
      intakeCount += 1;

      const patientsCollection = db.collection(PATIENTS_COLLECTION);
      await patientsCollection.doc(patientDocId).update({
        data: {
          lastIntakeId: intakeDocId,
          updatedAt: serverDate,
          'meta.lastExcelSyncAt': serverDate,
          'meta.lastExcelSyncBatchId': syncBatchId,
          'meta.lastExcelSource': 'readExcel'
        }
      });
    } catch (error) {
      console.error('syncPatientsFromGroups error', group && group.patientName, error);
      errors.push({ patientName: group && group.patientName, message: error.message || String(error) });
    }
  }

  return {
    syncBatchId,
    patients: patientCount,
    intakeRecords: intakeCount,
    errors
  };
}

async function clearCollection(collection) {
  const db = cloud.database();
  const _ = db.command;
  try {
    await collection.where({ key: _.exists(true) }).remove();
    return;
  } catch (error) {
    console.warn("clearCollection fallback", error);
  }

  const batchSize = 100;
  while (true) {
    const snapshot = await collection.limit(batchSize).get();
    if (!snapshot.data.length) {
      break;
    }
    for (const doc of snapshot.data) {
      await collection.doc(doc._id).remove();
    }
  }
}

async function importToDatabase(records) {
  const db = cloud.database();
  await ensureCollectionExists(COLLECTION);
  const collection = db.collection(COLLECTION);
  await clearCollection(collection);

  if (!records.length) {
    return { inserted: 0 };
  }

  const timestamp = Date.now();
  const docs = records.map((record, index) => ({
    ...record,
    _importedAt: timestamp,
    _rowIndex: index + 1
  }));

  const batchSize = 100;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await collection.add({ data: batch });
  }

  return { inserted: docs.length };
}

exports.main = async (event = {}) => {
  try {
    const forceRefresh = event && event.forceRefresh;
    if (event.action === "import") {
      const buffer = await downloadExcelBuffer();
      const parsed = parseExcel(buffer);
      const labelIndex = buildLabelIndex(parsed.headers, parsed.subHeaders);
      const records = extractRecords(parsed.rows, labelIndex);
      const { summaries, groups } = buildPatientGroups(records);
      await ensureCollectionExists(CACHE_COLLECTION);
      await saveSummariesToCache(summaries);
      const stats = await importToDatabase(records);
      const syncBatchId = event.syncBatchId || `excel-${Date.now()}`;
      const sync = await syncPatientsFromGroups(groups, { syncBatchId });
      return {
        action: "import",
        sheetName: parsed.sheetName,
        imported: stats,
        totalPatients: summaries.length,
        sync
      };
    }

    if (event.action === "syncPatients") {
      const syncBatchId = event.syncBatchId || `manual-${Date.now()}`;
      const dbRecords = await fetchRecordsFromDatabase();
      const { summaries, groups } = buildPatientGroups(dbRecords);
      await ensureCollectionExists(CACHE_COLLECTION);
      const sync = await syncPatientsFromGroups(groups, { syncBatchId });
      await saveSummariesToCache(summaries);
      return {
        action: "syncPatients",
        totalPatients: summaries.length,
        sync
      };
    }

    if (event.action === "detail") {
      const key = event.key;
      if (!key) {
        throw new Error("detail action requires key");
      }
      const group = await fetchGroupByKey(key);
      if (!group) {
        throw new Error("patient not found");
      }
      const latest = group.records[0] || {};
      const pickRecordValue = (getter) => {
        if (!Array.isArray(group.records)) {
          return '';
        }
        for (const record of group.records) {
          const value = normalizeSpacing(getter(record));
          if (value) {
            return value;
          }
        }
        return '';
      };
      const patientNativePlace = normalizeSpacing(group.nativePlace) || normalizeSpacing(latest.nativePlace) || pickRecordValue((record) => record.nativePlace);
      const patientEthnicity = normalizeSpacing(group.ethnicity) || normalizeSpacing(latest.ethnicity) || pickRecordValue((record) => record.ethnicity);
      const patientLatestHospital = normalizeSpacing(latest.hospital) || pickRecordValue((record) => record.hospital);
      const patientLatestDoctor = normalizeSpacing(latest.doctor) || pickRecordValue((record) => record.doctor);
      const basicInfo = buildInfoList([
        { label: '性别', value: group.gender || latest.gender },
        { label: '出生日期', value: group.birthDate || latest.birthDate },
        { label: '身份证号', value: group.idNumber || latest.idNumber },
        { label: '籍贯', value: group.nativePlace || latest.nativePlace },
        { label: '民族', value: group.ethnicity || latest.ethnicity },
        { label: '监护人', value: group.summaryCaregivers }
      ]);
      const familyInfoEntries = [];

      const uniqueAddresses = Array.from(
        new Set(
          group.addressList
            .map((item) => normalizeSpacing(item))
            .filter((item) => item)
        )
      );
      if (uniqueAddresses.length === 1) {
        familyInfoEntries.push({ label: '家庭地址', value: uniqueAddresses[0] });
      } else if (uniqueAddresses.length > 1) {
        familyInfoEntries.push({ label: '家庭地址', value: uniqueAddresses.join('；') });
      }

      const addGuardianEntries = (details, baseLabel) => {
        details.forEach((info, index) => {
          const prefix = details.length > 1 ? `${baseLabel}${index + 1}` : baseLabel;
          if (info.name) {
            familyInfoEntries.push({ label: `${prefix}姓名`, value: info.name });
          }
          if (info.phone) {
            familyInfoEntries.push({ label: `${prefix}电话`, value: info.phone });
          }
          if (info.idNumber) {
            familyInfoEntries.push({ label: `${prefix}身份证号`, value: info.idNumber });
          }
          if (!info.name && !info.phone && !info.idNumber) {
            familyInfoEntries.push({ label: prefix, value: info.raw });
          }
        });
      };

      addGuardianEntries(group.fatherDetails, '父亲');
      addGuardianEntries(group.motherDetails, '母亲');
      addGuardianEntries(group.otherGuardianDetails, '其他监护人');

      const economicInfoEntries = [];
      group.familyEconomyList.forEach((value, index) => {
        economicInfoEntries.push({
          label: group.familyEconomyList.length > 1 ? `家庭经济情况${index + 1}` : '家庭经济情况',
          value
        });
      });

const records = group.records.map((record, index) => ({
        title: `第${index + 1}次入住${record.admissionDate ? ' · ' + record.admissionDate : ''}` ,
        info: buildInfoList([
          { label: '入住日期', value: record.admissionDate },
          { label: '就诊医院', value: record.hospital },
          { label: '诊断', value: record.diagnosis },
          { label: '主治医生', value: record.doctor },
          { label: '症状详情', value: record.symptoms },
          { label: '治疗过程', value: record.treatmentProcess },
          { label: '后续计划', value: record.followUpPlan }
        ]),
        rawRowIndex: record.rawRowIndex || index + 1
      })).filter((entry) => entry.info.length);

return {
        patient: {
          key: group.key,
          patientName: group.patientName,
          gender: group.gender || latest.gender || '',
          birthDate: group.birthDate || latest.birthDate || '',
          nativePlace: patientNativePlace,
          ethnicity: patientEthnicity,
          latestHospital: patientLatestHospital,
          latestDoctor: patientLatestDoctor
        },
        basicInfo,
        familyInfo: familyInfoEntries,
        economicInfo: economicInfoEntries,
        records
      };

    }

    // action=list or default
    const cachedSummaries = forceRefresh ? null : await fetchCachedSummaries();
    if (!forceRefresh && cachedSummaries && cachedSummaries.length) {
      return { patients: cachedSummaries, source: "cache" };
    }

    const dbRecords = await fetchRecordsFromDatabase();
    if (!dbRecords.length) {
      await ensureCollectionExists(CACHE_COLLECTION);
      await saveSummariesToCache([]);
      return { patients: [], source: "database" };
    }
    const { summaries } = buildPatientGroups(dbRecords);
    await ensureCollectionExists(CACHE_COLLECTION);
    await saveSummariesToCache(summaries);
    return { patients: summaries, source: "database" };
  } catch (error) {
    console.error("readExcel error", error);
    throw error;
  }
};





