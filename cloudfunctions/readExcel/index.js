const cloud = require("wx-server-sdk");
const XLSX = require("xlsx");
const {
  normalizeValue,
  normalizeSpacing,
  normalizeTimestamp,
  ensureCollectionExists,
  buildPatientGroups,
  buildGroupSummaries,
} = require('./utils/patient');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 集合名称
const COLLECTION = "excel_records";
const CACHE_COLLECTION = "excel_cache";
const PATIENT_CACHE_DOC_ID = "patients_summary_cache";
const PATIENTS_COLLECTION = "patients";
const PATIENT_INTAKE_COLLECTION = "patient_intake_records";
const RAW_COLLECTION = "excel_raw_records";

// Excel文件ID（从环境变量获取）
const EXCEL_FILE_ID = process.env.EXCEL_FILE_ID;

// 字段映射配置
const LABEL_MAP = {
  patientName: ["患者姓名", "姓名", "患者"],
  gender: ["性别"],
  birthDate: ["出生日期", "生日"],
  nativePlace: ["籍贯"],
  ethnicity: ["民族"],
  idNumber: ["身份证号", "证件号"],
  caregivers: ["监护人"],
  admissionDate: ["入院日期", "入院时间", "入住日期", "入住时间", "收治日期", "收治时间"],
  hospital: ["医院", "收治医院", "就诊情况_就诊医院", "就诊医院"],
  diagnosis: ["诊断", "初步诊断", "诊断结果", "就诊情况_医院诊断", "医院诊断"],
  doctor: ["医生", "主治医师", "就诊情况_医生姓名", "医生姓名"],
  symptoms: ["症状", "主要症状", "症状详情"],
  treatmentProcess: ["治疗过程", "康复过程", "医治过程"],
  followUpPlan: ["康复计划", "后续计划", "后续治疗安排"],
  address: ["地址", "家庭地址", "居住地址"],
  fatherInfo: [
    "父亲",
    "父亲信息",
    "爸爸",
    "家庭基础信息_父亲姓名联系电话身份证号",
    "家庭基本情况_父亲姓名、电话、身份证号",
    "父亲姓名、电话、身份证号",
    "父亲姓名联系电话身份证号"
  ],
  motherInfo: [
    "母亲",
    "母亲信息",
    "妈妈",
    "家庭基础信息_母亲姓名联系电话身份证号",
    "家庭基本情况_母亲姓名、电话、身份证号",
    "母亲姓名、电话、身份证号",
    "母亲姓名联系电话身份证号"
  ],
  otherGuardian: ["其他监护人", "家庭基础信息_其他监护人", "家庭基本情况_其他监护人"],
  familyEconomy: ["家庭基础信息_家庭经济", "家庭基本情况_家庭经济", "家庭经济"],
  hospitalAdditional: ["就诊情况_医院诊断", "医院诊断"],
  diagnosisAdditional: ["医疗情况_症状详情", "症状详情"]
};

// 工具函数
function makeError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function sanitizeIdentifier(value, fallbackSeed) {
  const base = normalizeSpacing(value);
  if (base) {
    const sanitized = base.replace(/[^a-zA-Z0-9_-]/g, '');
    const meaningful = sanitized.replace(/^excel_?/, '');
    if (sanitized && meaningful) {
      return sanitized;
    }
  }
  const seed = normalizeSpacing(fallbackSeed);
  if (seed) {
    const sanitizedSeed = seed.replace(/[^a-zA-Z0-9_-]/g, '');
    const meaningfulSeed = sanitizedSeed.replace(/^excel_?/, '');
    if (sanitizedSeed && meaningfulSeed) {
      return sanitizedSeed;
    }
  }
  return `excel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateRecordKey(record) {
  const normalizedIdNumber = normalizeSpacing(record && record.idNumber);
  if (normalizedIdNumber) {
    return sanitizeIdentifier(normalizedIdNumber, record && record.patientName);
  }
  const normalizedName = normalizeSpacing(record && record.patientName);
  const normalizedBirth = normalizeSpacing(record && record.birthDate);
  if (normalizedName && normalizedBirth) {
    return sanitizeIdentifier(`${normalizedName}_${normalizedBirth}`, normalizedName);
  }
  const rowIndex = record && (record.excelRowIndex || record.importOrder);
  if (normalizedName) {
    return sanitizeIdentifier(normalizedName, `${normalizedName}_${rowIndex || ''}`);
  }
  if (rowIndex) {
    return sanitizeIdentifier(`row_${rowIndex}`, `excel_${Date.now()}`);
  }
  return sanitizeIdentifier('', `excel_${Date.now()}`);
}

// 确保集合存在
// 下载Excel文件
async function downloadExcelBuffer(providedFileId) {
  const fileId = normalizeValue(providedFileId) || normalizeValue(EXCEL_FILE_ID);
  if (!fileId) {
    const error = new Error("Excel file id is not configured");
    error.code = 'INVALID_EXCEL_FILE_ID';
    error.details = {
      providedFileId: normalizeValue(providedFileId) || null,
      envFileId: normalizeValue(EXCEL_FILE_ID) || null
    };
    throw error;
  }
  const { fileContent } = await cloud.downloadFile({ fileID: fileId });
  return fileContent;
}

// 解析Excel文件
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, sheetStubs: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { sheetName: "", headers: [], subHeaders: [], rows: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  const headers = [];
  const subHeaders = [];
  const rows = [];

  // 读取表头
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const headerAddr = XLSX.utils.encode_cell({ r: 0, c: C });
    const subHeaderAddr = XLSX.utils.encode_cell({ r: 1, c: C });

    headers[C] = sheet[headerAddr] ? String(sheet[headerAddr].v || '').trim() : '';
    subHeaders[C] = sheet[subHeaderAddr] ? String(sheet[subHeaderAddr].v || '').trim() : '';
  }

  // 读取数据行
  for (let R = 2; R <= range.e.r; ++R) {
    const row = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = sheet[cellAddr];
      row[C] = cell ? (cell.v !== undefined ? cell.v : '') : '';
    }
    rows.push(row);
  }

  return { sheetName, headers, subHeaders, rows };
}

// 构建标签索引
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

    candidates.forEach(candidate => {
      if (!index.has(candidate)) {
        index.set(candidate, i);
      }
    });
  }

  return index;
}

// 获取字段值
function getFieldValue(row, labelIndex, possibleLabels) {
  for (const label of possibleLabels) {
    if (labelIndex.has(label)) {
      const columnIndex = labelIndex.get(label);
      return row[columnIndex];
    }
  }
  return '';
}

// 解析日期值
function parseDateValue(value) {
  if (!value) {
    return { text: '', timestamp: null };
  }

  if (value instanceof Date) {
    return {
      text: value.toISOString().split('T')[0],
      timestamp: value.getTime()
    };
  }

  const str = String(value).trim();
  if (!str) {
    return { text: '', timestamp: null };
  }

  // 尝试解析各种日期格式
  const formats = [
    /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/,
    /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/
  ];

  for (const format of formats) {
    const match = str.match(format);
    if (match) {
      let year, month, day;
      if (format === formats[0]) { // YYYY-MM-DD
        [, year, month, day] = match;
      } else { // MM-DD-YYYY 或 DD-MM-YYYY
        [, month, day, year] = match;
      }

      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return {
          text: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
          timestamp: date.getTime()
        };
      }
    }
  }

  return { text: str, timestamp: null };
}

// 提取记录
function extractRecords(rows, labelIndex) {
  const records = [];
  const isRowEmpty = (row) => !row || row.every(cell => !normalizeValue(cell));

  const contentFields = [
    'patientName', 'gender', 'birthDate', 'nativePlace', 'ethnicity',
    'caregivers', 'admissionDate', 'hospital', 'diagnosis', 'doctor',
    'symptoms', 'treatmentProcess', 'followUpPlan', 'address',
    'fatherInfo', 'motherInfo', 'otherGuardian', 'familyEconomy'
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
    const normalizedId = idNumberRaw ? idNumberRaw.toUpperCase() : '';
    const admissionInfo = parseDateValue(getFieldValue(row, labelIndex, LABEL_MAP.admissionDate));
    const normalizedAdmissionTimestamp = (admissionInfo.timestamp !== null && Number.isFinite(admissionInfo.timestamp))
      ? admissionInfo.timestamp
      : null;
    const excelRowIndex = rawIndex + 1;

    const record = {
      key: patientName,
      recordKey: '',
      patientName,
      originalPatientName: patientName,
      gender: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.gender)) || '',
      birthDate: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.birthDate)),
      nativePlace: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.nativePlace)),
      ethnicity: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.ethnicity)),
      idNumber: normalizedId,
      caregivers: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.caregivers)),
      admissionDate: admissionInfo.text,
      admissionTimestamp: normalizedAdmissionTimestamp,
      importOrder: excelRowIndex,
      excelRowIndex,
      hospital: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.hospital)),
      diagnosis: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.diagnosis)) ||
                 normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.hospitalAdditional)),
      doctor: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.doctor)),
      symptoms: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.symptoms)) ||
                normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.diagnosisAdditional)),
      treatmentProcess: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.treatmentProcess)),
      followUpPlan: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.followUpPlan)),
      address: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.address)),
      fatherInfo: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.fatherInfo)),
      motherInfo: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.motherInfo)),
      otherGuardian: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.otherGuardian)),
      familyEconomy: normalizeSpacing(getFieldValue(row, labelIndex, LABEL_MAP.familyEconomy))
    };

    const stableKey = generateRecordKey(record);
    record.key = stableKey;
    record.recordKey = stableKey;

    const hasContent = contentFields.some((field) => normalizeValue(record[field]));
    if (hasContent) {
      records.push(record);
    }
  });

  return records;
}

// 构建患者分组
// 保存摘要到缓存
async function saveSummariesToCache(summaries) {
  if (!Array.isArray(summaries) || summaries.length === 0) {
    return;
  }

  const cacheDoc = {
    patients: summaries,
    updatedAt: Date.now(),
    totalCount: summaries.length
  };

  try {
    await db.collection(CACHE_COLLECTION).doc(PATIENT_CACHE_DOC_ID).set({
      data: cacheDoc
    });
  } catch (error) {
    console.error('saveSummariesToCache failed', PATIENT_CACHE_DOC_ID, error);
    throw error;
  }
}

// 清空集合
async function clearCollection(collection) {
  const BATCH_SIZE = 20;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await collection.limit(BATCH_SIZE).get();
    const docs = res && Array.isArray(res.data) ? res.data : [];
    if (!docs.length) {
      break;
    }

    await Promise.all(
      docs
        .filter((doc) => doc && doc._id)
        .map((doc) => collection.doc(doc._id).remove().catch((error) => {
          console.warn('clearCollection remove failed', collection._name, doc._id, error);
          return null;
        }))
    );
  }
}

// 导入到数据库
async function importToDatabase(records) {
  await ensureCollectionExists(db, COLLECTION);
  const collection = db.collection(COLLECTION);
  await clearCollection(collection);

  if (!records.length) {
    return { inserted: 0 };
  }

  const routingTimestamp = Date.now();
  const docs = records.map((record, index) => {
    const actualTimestamp = Number.isFinite(record.admissionTimestamp)
      ? Number(record.admissionTimestamp)
      : null;
    const importOrder = record.importOrder || record.excelRowIndex || index + 1;
    const fallbackTimestamp = actualTimestamp !== null ? actualTimestamp : 0;
    return {
      ...record,
      admissionTimestamp: actualTimestamp,
      importOrder,
      excelRowIndex: record.excelRowIndex || importOrder,
      importedAt: fallbackTimestamp,
      _importedAt: fallbackTimestamp,
      _rowIndex: index + 1
    };
  });

  const batchSize = 100;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await collection.add({ data: batch });
  }

  return { inserted: docs.length };
}

// 计算患者键值
function computePatientKey(group) {
  if (!group) {
    return '';
  }
  const key = normalizeSpacing(group.recordKey || group.key || group.patientName || '');
  return key;
}

async function findExistingPatientDoc(collection, normalizedKey) {
  if (!normalizedKey) {
    return null;
  }

  try {
    const recordRes = await collection.where({ recordKey: normalizedKey }).limit(1).get();
    if (recordRes.data && recordRes.data.length) {
      const doc = recordRes.data[0];
      return { id: doc._id || normalizedKey, doc };
    }
  } catch (error) {
    console.warn('findExistingPatientDoc recordKey query failed', normalizedKey, error);
  }

  try {
    const docRes = await collection.doc(normalizedKey).get();
    if (docRes && docRes.data) {
      return { id: normalizedKey, doc: docRes.data };
    }
  } catch (error) {
    const notFound = error && (error.errCode === -1 || error.code === 'DOCUMENT_NOT_FOUND' || error.code === 'DATABASE_DOCUMENT_NOT_EXIST');
    if (!notFound) {
      console.warn('findExistingPatientDoc direct lookup failed', normalizedKey, error);
    }
  }

  try {
    const nameRes = await collection.where({ patientName: normalizedKey }).limit(5).get();
    if (nameRes.data && nameRes.data.length) {
      const doc = nameRes.data[0];
      return { id: doc._id || normalizedKey, doc };
    }
  } catch (error) {
    console.warn('findExistingPatientDoc name query failed', normalizedKey, error);
  }

  return null;
}

async function removeDuplicatePatientDocs(collection, patientName, keepId, primaryIdNumber) {
  const normalizedName = normalizeSpacing(patientName);
  if (!normalizedName || !keepId) {
    return;
  }

  let res;
  try {
    res = await collection.where({ patientName: normalizedName }).get();
  } catch (error) {
    console.warn('removeDuplicatePatientDocs query failed', normalizedName, error);
    return;
  }

  const docs = Array.isArray(res.data) ? res.data : [];
  const normalizeIdNumber = (value) => normalizeSpacing(value);
  const baselineIdNumber = normalizeIdNumber(primaryIdNumber);

  for (const doc of docs) {
    const docId = doc && doc._id;
    if (!docId || docId === keepId) {
      continue;
    }
    const docIdNumber = normalizeIdNumber(doc && (doc.idNumber || (doc.data && doc.data.idNumber)));
    if (baselineIdNumber && docIdNumber && docIdNumber !== baselineIdNumber) {
      continue;
    }
    try {
      await collection.doc(docId).remove();
    } catch (error) {
      console.warn('removeDuplicatePatientDocs remove failed', normalizedName, docId, error);
    }
  }
}

// 构建患者文档数据
function buildPatientPayload(group, latestRecord) {
  const normalizedRecordKey = normalizeSpacing(group.recordKey || group.key || group.patientName || '');

  const emergencyContactCandidates = [];
  if (group.summaryCaregivers) {
    emergencyContactCandidates.push(group.summaryCaregivers);
  }
  const guardianParts = [group.fatherInfo, group.motherInfo, group.otherGuardian]
    .filter(part => normalizeSpacing(part));
  if (guardianParts.length) {
    emergencyContactCandidates.push(guardianParts.join('、'));
  }
  const normalizedEmergencyContact = emergencyContactCandidates.find(value => normalizeSpacing(value));

  const contacts = Array.isArray(group.familyContacts) ? group.familyContacts : [];
  const contactToString = (contact) => {
    if (!contact) {
      return '';
    }
    const parts = [contact.name, contact.phone, contact.idNumber].map(part => normalizeSpacing(part)).filter(Boolean);
    if (parts.length) {
      return parts.join(' ');
    }
    return normalizeSpacing(contact.raw || '');
  };

  const fatherContact = contacts.find(contact => contact.role === 'father');
  const motherContact = contacts.find(contact => contact.role === 'mother');
  const guardianContact = contacts.find(contact => contact.role === 'other');

  return {
    patientName: group.patientName,
    idType: '身份证',
    idNumber: group.idNumber || latestRecord.idNumber || '',
    gender: group.gender || latestRecord.gender || '',
    birthDate: group.birthDate || latestRecord.birthDate || '',
    phone: '',
    address: latestRecord.address || '',
    nativePlace: normalizeSpacing(group.nativePlace || latestRecord.nativePlace || ''),
    ethnicity: normalizeSpacing(group.ethnicity || latestRecord.ethnicity || ''),
    excelImportOrder: group.importOrder || null,
    emergencyContact: normalizeSpacing(normalizedEmergencyContact || ''),
    emergencyPhone: '',
    backupContact: '',
    backupPhone: '',
    lastIntakeNarrative: latestRecord.symptoms || latestRecord.diagnosis || '',
    admissionCount: group.admissionCount || 0,
    firstAdmissionDate: group.firstAdmissionTimestamp,
    latestAdmissionDate: group.latestAdmissionTimestamp,
    firstDiagnosis: group.firstDiagnosis || '',
    latestDiagnosis: group.latestDiagnosis || '',
    firstHospital: group.firstHospital || '',
    latestHospital: group.latestHospital || '',
    latestDoctor: group.latestDoctor || '',
    fatherInfo: contactToString(fatherContact) || group.fatherInfo || group.fatherInfoRaw || '',
    motherInfo: contactToString(motherContact) || group.motherInfo || group.motherInfoRaw || '',
    otherGuardian: contactToString(guardianContact) || group.otherGuardian || group.otherGuardianRaw || '',
    familyEconomy: group.familyEconomy || group.familyEconomyRaw || '',
    familyContacts: Array.isArray(group.familyContacts)
      ? group.familyContacts.map(contact => ({ ...contact }))
      : [],
    recordKey: normalizedRecordKey,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

// 更新或插入患者文档
async function upsertPatientDocument(patientKey, payload, syncBatchId, options = {}) {
  const db = cloud.database();
  const collection = db.collection(PATIENTS_COLLECTION);
  const serverDate = options.serverDate || db.serverDate();
  const normalizedKey = normalizeSpacing(patientKey);

  const existing = await findExistingPatientDoc(collection, normalizedKey);

  const baseMeta = existing && existing.doc && existing.doc.meta ? existing.doc.meta : {};
  const docPayload = {
    ...payload,
    recordKey: normalizedKey,
    createdAt: existing && existing.doc && existing.doc.createdAt ? existing.doc.createdAt : (payload.createdAt || serverDate),
    updatedAt: serverDate,
    meta: {
      ...baseMeta,
      ...(payload.meta || {}),
      lastExcelSyncAt: serverDate,
      lastExcelSyncBatchId: syncBatchId
    }
  };

  const targetId = existing && existing.id
    ? existing.id
    : sanitizeIdentifier(normalizedKey ? `excel_${normalizedKey}` : '', `excel_${Date.now()}`);

  await collection.doc(targetId).set({ data: docPayload });
  await removeDuplicatePatientDocs(
    collection,
    payload.patientName,
    targetId,
    payload.idNumber || (existing && existing.doc && existing.doc.idNumber)
  );
  return targetId;
}

// 构建入住记录数据
function buildIntakePayload(group, patientKey, syncBatchId, serverDate) {
  const latestRecord = group.records && group.records[0] ? group.records[0] : {};
  const normalize = (value) => normalizeSpacing(value) || '';
  const medicalInfo = {
    hospital: normalize(latestRecord.hospital),
    diagnosis: normalize(latestRecord.diagnosis),
    doctor: normalize(latestRecord.doctor),
    treatmentProcess: normalize(latestRecord.treatmentProcess),
    followUpPlan: normalize(latestRecord.followUpPlan),
    symptoms: normalize(latestRecord.symptoms)
  };

  Object.keys(medicalInfo).forEach((key) => {
    if (!medicalInfo[key]) {
      delete medicalInfo[key];
    }
  });

  const situationText = normalize(latestRecord.symptoms)
    || normalize(latestRecord.diagnosis)
    || normalize(latestRecord.treatmentProcess);

  const emergencyContactParts = [];
  if (group.summaryCaregivers) {
    emergencyContactParts.push(group.summaryCaregivers);
  }
  const guardianContact = [group.fatherInfo, group.motherInfo, group.otherGuardian]
    .filter(part => normalizeSpacing(part));
  if (guardianContact.length) {
    emergencyContactParts.push(guardianContact.join('、'));
  }
  const emergencyContact = normalize(emergencyContactParts.find(value => normalizeSpacing(value)) || '');

  return {
    patientKey,
    patientName: group.patientName,
    intakeId: `${patientKey}-excel`,
    basicInfo: {
      patientName: group.patientName,
      idType: '身份证',
      idNumber: group.idNumber || latestRecord.idNumber || '',
      gender: group.gender || latestRecord.gender || '',
      birthDate: group.birthDate || latestRecord.birthDate || '',
      phone: ''
    },
    contactInfo: {
      address: latestRecord.address || '',
      emergencyContact,
      emergencyPhone: '',
      backupContact: '',
      backupPhone: '',
      familyContacts: Array.isArray(group.familyContacts)
        ? group.familyContacts.map(contact => ({ ...contact }))
        : []
    },
    intakeInfo: {
      intakeTime: group.latestAdmissionTimestamp || Date.now(),
      situation: situationText,
      followUpPlan: normalize(latestRecord.followUpPlan),
      medicalHistory: [],
      attachments: []
    },
    medicalInfo: Object.keys(medicalInfo).length ? medicalInfo : undefined,
    metadata: {
      submittedAt: serverDate,
      lastModifiedAt: serverDate,
      submittedBy: 'excel-import',
      syncBatchId
    },
    createdAt: serverDate,
    updatedAt: serverDate
  };
}

// 更新或插入入住记录
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

// 从分组同步患者数据
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

  await ensureCollectionExists(db, PATIENTS_COLLECTION);
  await ensureCollectionExists(db, PATIENT_INTAKE_COLLECTION);

  let patientCount = 0;
  let intakeCount = 0;
  const errors = [];

  for (const group of groupList) {
    if (!group || !group.patientName) {
      continue;
    }

    try {
      const patientKey = computePatientKey(group);
      if (!patientKey) {
        console.warn('syncPatientsFromGroups skip group without key', group.patientName);
        continue;
      }
      const latestRecord = group.records && group.records[0] ? group.records[0] : {};
      const patientPayload = buildPatientPayload(group, latestRecord);
      const patientDocId = await upsertPatientDocument(patientKey, patientPayload, syncBatchId, { serverDate });
      patientCount += 1;

      const intakePayload = buildIntakePayload(group, patientDocId, syncBatchId, serverDate);
      const intakeDocId = await upsertIntakeRecord(patientDocId, intakePayload, { serverDate });
      intakeCount += 1;
    } catch (error) {
      console.error('syncPatientsFromGroups item failed', group.patientName, error);
      errors.push({
        patientName: group.patientName,
        error: error.message || 'Unknown error'
      });
    }
  }

  return {
    syncBatchId,
    patients: patientCount,
    intakeRecords: intakeCount,
    errors
  };
}

// 规范化原始集合数据
function normalizeRawRecord(rawRecord, index) {
  if (!rawRecord || typeof rawRecord !== 'object') {
    return null;
  }

  const doc = { ...rawRecord };
  delete doc._id;
  delete doc._openid;

  let recordKey = normalizeSpacing(doc.recordKey || doc.key || doc.patientName || '');
  if (!recordKey) {
    recordKey = generateRecordKey(doc);
  }
  doc.recordKey = recordKey;
  doc.key = recordKey;

  const admissionInfo = parseDateValue(doc.admissionDate || doc.admissionDateRaw);
  if (admissionInfo.text && !doc.admissionDate) {
    doc.admissionDate = admissionInfo.text;
  }
  if (admissionInfo.timestamp !== null && doc.admissionTimestamp == null) {
    doc.admissionTimestamp = admissionInfo.timestamp;
  }

  const importOrder = Number.isFinite(doc.importOrder)
    ? Number(doc.importOrder)
    : (Number(doc.excelRowIndex) || index + 1);
  doc.importOrder = importOrder;
  if (!doc.excelRowIndex) {
    doc.excelRowIndex = importOrder;
  }

  const fallbackTimestamp = Number.isFinite(doc.admissionTimestamp)
    ? Number(doc.admissionTimestamp)
    : 0;
  if (!Number.isFinite(doc.importedAt)) {
    doc.importedAt = fallbackTimestamp;
  }
  doc._importedAt = doc.importedAt;
  doc._rowIndex = index + 1;

  if (doc.source && typeof doc.source === 'object') {
    doc.source = {
      ...doc.source,
      normalizedAt: Date.now(),
    };
  }

  return doc;
}

// 读取 excel_raw_records 集合
async function fetchRawRecordsFromDatabase() {
  await ensureCollectionExists(db, RAW_COLLECTION);
  const allRecords = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const res = await db.collection(RAW_COLLECTION)
      .skip(skip)
      .limit(limit)
      .get();
    const data = res && Array.isArray(res.data) ? res.data : [];
    if (!data.length) {
      break;
    }
    allRecords.push(...data);
    skip += data.length;
  }

  return allRecords;
}

// 从数据库获取记录
async function fetchRecordsFromDatabase() {
  await ensureCollectionExists(db, COLLECTION);
  const allRecords = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const res = await db.collection(COLLECTION)
      .orderBy('updatedAt', 'desc')
      .skip(skip)
      .limit(limit)
      .get();

    if (!res.data || res.data.length === 0) {
      break;
    }

    allRecords.push(...res.data);
    skip += res.data.length;
  }

  return allRecords;
}

// 主函数 - 只保留初始化和测试功能
exports.main = async (event = {}) => {
  try {
    const requestedFileId = normalizeValue(
      event && (event.fileId || event.fileID || event.excelFileId)
    );

    // import操作：从Excel文件导入数据到数据库
    if (event.action === "import") {
      const buffer = await downloadExcelBuffer(requestedFileId);
      const parsed = parseExcel(buffer);
      const labelIndex = buildLabelIndex(parsed.headers, parsed.subHeaders);
      const records = extractRecords(parsed.rows, labelIndex);
      const groups = buildPatientGroups(records);
      const summaries = buildGroupSummaries(groups);

      await ensureCollectionExists(db, CACHE_COLLECTION);
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

    // syncPatients操作：从excel_records同步数据到patients集合
    if (event.action === "syncPatients") {
      const syncBatchId = event.syncBatchId || `manual-${Date.now()}`;
      const dbRecords = await fetchRecordsFromDatabase();
      const groups = buildPatientGroups(dbRecords);
      const summaries = buildGroupSummaries(groups);

      await ensureCollectionExists(db, CACHE_COLLECTION);
      const sync = await syncPatientsFromGroups(groups, { syncBatchId });
      await saveSummariesToCache(summaries);

      return {
        action: "syncPatients",
        totalPatients: summaries.length,
        sync
      };
    }

    // normalizeFromRaw 操作：基于 excel_raw_records 初始化派生集合
    if (event.action === "normalizeFromRaw") {
      const rawRecords = await fetchRawRecordsFromDatabase();
      if (!rawRecords.length) {
        throw makeError('RAW_DATA_EMPTY', 'excel_raw_records 集合为空');
      }

      const normalized = rawRecords
        .map((item, index) => normalizeRawRecord(item, index))
        .filter(Boolean);

      if (!normalized.length) {
        throw makeError('NORMALIZED_EMPTY', '未生成任何可导入的记录');
      }

      const stats = await importToDatabase(normalized);
      const groups = buildPatientGroups(normalized);
      const summaries = buildGroupSummaries(groups);

      await ensureCollectionExists(db, CACHE_COLLECTION);
      await saveSummariesToCache(summaries);

      const syncBatchId = event.syncBatchId || ('raw-' + Date.now());
      const sync = await syncPatientsFromGroups(groups, { syncBatchId });

      return {
        action: "normalizeFromRaw",
        imported: stats,
        totalPatients: summaries.length,
        sync
      };
    }

    // 测试操作：验证Excel解析功能
    if (event.action === "test") {
      const buffer = await downloadExcelBuffer(requestedFileId);
      const parsed = parseExcel(buffer);
      const labelIndex = buildLabelIndex(parsed.headers, parsed.subHeaders);
      const records = extractRecords(parsed.rows, labelIndex);
      const summaries = buildGroupSummaries(buildPatientGroups(records));

      return {
        action: "test",
        sheetName: parsed.sheetName,
        headerCount: parsed.headers.length,
        recordCount: records.length,
        patientCount: summaries.length,
        sampleRecords: records.slice(0, 3),
        samplePatients: summaries.slice(0, 3)
      };
    }

    throw makeError('UNSUPPORTED_ACTION', `未支持的操作：${event.action || 'unknown'}`);

  } catch (error) {
    console.error('readExcel action failed', event.action, error);
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || '服务内部错误',
        details: error.details || null
      }
    };
  }
};
