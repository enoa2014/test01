const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// Collection names
const EXCEL_RECORDS_COLLECTION = "excel_records";
const EXCEL_CACHE_COLLECTION = "excel_cache";
const PATIENTS_COLLECTION = "patients";
const PATIENT_INTAKE_COLLECTION = "patient_intake_records";
const PATIENT_CACHE_DOC_ID = "patients_summary_cache";
const PATIENT_LIST_CACHE_TTL = 5 * 60 * 1000;
const DEFAULT_PATIENT_LIST_LIMIT = 80;
const MAX_PATIENT_LIST_LIMIT = 200;

// Utility functions
function makeError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}
function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}


function normalizeTimestamp(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isNaN(ts) ? null : ts;
  }
  const str = String(value).trim();
  if (!str) {
    return null;
  }
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return Number.isFinite(num) ? num : null;
  }
  const normalized = str.replace(/[./]/g, '-');
  const date = new Date(normalized);
  const ts = date.getTime();
  return Number.isNaN(ts) ? null : ts;
}

function normalizeValue(value) {
  if (value === undefined || value === null) {
    return '';
  }
  const str = String(value).trim();
  return str === 'null' || str === 'undefined' ? '' : str;
}

function normalizeSpacing(value) {
  const normalized = normalizeValue(value);
  if (!normalized) {
    return '';
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

// Ensure collection exists
async function ensureCollectionExists(name) {
  try {
    await db.collection(name).limit(1).get();
    return true;
  } catch (error) {
    const code = error && (error.errCode !== undefined ? error.errCode : error.code);
    const message = error && error.errMsg ? error.errMsg : '';
    const notExists = code === -502005 ||
      (message && message.indexOf('DATABASE_COLLECTION_NOT_EXIST') >= 0) ||
      (message && message.indexOf('collection not exists') >= 0);

    if (notExists) {
      try {
        await db.createCollection(name);
        return false;
      } catch (createError) {
        const createCode = createError && (createError.errCode !== undefined ? createError.errCode : createError.code);
        const alreadyExists = createCode === -502002;
        if (!alreadyExists) {
          console.warn('createCollection failed', name, createError);
        }
        return false;
      }
    }
    console.warn('ensureCollectionExists unexpected error', name, error);
    return false;
  }
}

// Load patient list from cache
async function fetchPatientsFromCache(options = {}) {
  const forceRefresh = !!(options && options.forceRefresh);
  const page = Math.max(Number(options && options.page) || 0, 0);
  const includeTotal = !!(options && options.includeTotal);
  const rawLimit = Number(options && options.limit);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_PATIENT_LIST_LIMIT, MAX_PATIENT_LIST_LIMIT));
  const eligibleForCache = !forceRefresh && page === 0;

  if (eligibleForCache) {
    try {
      await ensureCollectionExists(EXCEL_CACHE_COLLECTION);
      const res = await db.collection(EXCEL_CACHE_COLLECTION).doc(PATIENT_CACHE_DOC_ID).get();
      const cached = res && res.data ? res.data : null;
      const cacheAge = cached ? Date.now() - (cached.updatedAt || 0) : Number.MAX_SAFE_INTEGER;

      if (cached && cacheAge < PATIENT_LIST_CACHE_TTL && Array.isArray(cached.patients)) {
        const slice = cached.patients.slice(0, limit);
        const totalCount = cached.totalCount !== undefined ? cached.totalCount : slice.length;
        const hasMore = cached.hasMore !== undefined ? cached.hasMore : (totalCount > slice.length);
        return {
          patients: slice,
          totalCount,
          hasMore,
          nextPage: hasMore ? 1 : null,
          limit
        };
      }
    } catch (error) {
      const code = (error && (error.errCode !== undefined ? error.errCode : error.code));
      if (code !== -1 && code !== 'DOCUMENT_NOT_FOUND' && code !== 'DATABASE_DOCUMENT_NOT_EXIST') {
        console.warn('Failed to read from cache', error);
      }
    }
  }

  const fresh = await buildPatientsFromDatabase({
    page,
    limit,
    includeTotal
  });

  if (page === 0) {
    try {
      await ensureCollectionExists(EXCEL_CACHE_COLLECTION);
      await db.collection(EXCEL_CACHE_COLLECTION).doc(PATIENT_CACHE_DOC_ID).set({
        data: {
          patients: fresh.patients,
          totalCount: fresh.totalCount,
          hasMore: fresh.hasMore,
          limit,
          updatedAt: Date.now()
        }
      });
    } catch (error) {
      console.warn('Failed to write patient cache', error);
    }
  }

  return fresh;
}

// Build patient list from database
async function buildPatientsFromDatabase(options = {}) {
  await ensureCollectionExists(PATIENTS_COLLECTION);

  const page = Math.max(Number(options && options.page) || 0, 0);
  const rawLimit = Number(options && options.limit);
  const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : DEFAULT_PATIENT_LIST_LIMIT, MAX_PATIENT_LIST_LIMIT));
  const includeTotal = !!(options && options.includeTotal);

  const skip = page * limit;

  const res = await db.collection(PATIENTS_COLLECTION)
    .orderBy('data.updatedAt', 'desc')
    .skip(skip)
    .limit(limit)
    .field({
      _id: 1,
      key: 1,
      patientKey: 1,
      patientName: 1,
      gender: 1,
      birthDate: 1,
      idNumber: 1,
      latestHospital: 1,
      latestDoctor: 1,
      firstHospital: 1,
      latestDiagnosis: 1,
      firstDiagnosis: 1,
      admissionCount: 1,
      summaryCaregivers: 1,
      lastIntakeNarrative: 1,
      'data.admissionCount': 1,
      'data.firstAdmissionDate': 1,
      'data.latestAdmissionDate': 1,
      'data.latestAdmissionTimestamp': 1,
      'data.summaryCaregivers': 1,
      'data.lastIntakeNarrative': 1
    })
    .get();

  const docs = Array.isArray(res.data) ? res.data : [];
  const summaries = [];

  const excelMeta = new Map();
  const excelKeySet = new Set();
  docs.forEach((doc) => {
    if (doc && doc.recordKey) {
      excelKeySet.add(doc.recordKey);
    }
    if (doc && doc.patientName) {
      excelKeySet.add(doc.patientName);
    }
    if (doc && doc.key) {
      excelKeySet.add(doc.key);
    }
  });

  const excelKeys = Array.from(excelKeySet).filter(Boolean);
  const chunkSize = 50;
  for (let i = 0; i < excelKeys.length; i += chunkSize) {
    const slice = excelKeys.slice(i, i + chunkSize);
    try {
      const excelRes = await db.collection(EXCEL_RECORDS_COLLECTION)
        .where({ key: _.in(slice) })
        .get();
      const excelDocs = Array.isArray(excelRes.data) ? excelRes.data : [];
      excelDocs.forEach((record) => {
        if (record && record.key) {
          excelMeta.set(record.key, {
            nativePlace: normalizeValue(record.nativePlace),
            ethnicity: normalizeValue(record.ethnicity)
          });
        }
      });
    } catch (error) {
      console.warn('Failed to load excel metadata chunk', slice, error);
    }
  }

  docs.forEach((doc) => {
    const docId = doc._id || doc.key || doc.patientKey;
    const recordKey = doc.recordKey || (doc.metadata && doc.metadata.excelRecordKey);
    const nameKey = recordKey || doc.patientName || doc.key;
    if (!docId || !nameKey) {
      return;
    }

    const data = doc.data && typeof doc.data === 'object' ? doc.data : {};
    const dataAdmissionCount = safeNumber(data.admissionCount);
    const docAdmissionCount = safeNumber(doc.admissionCount);
    const admissionCount = Math.max(dataAdmissionCount, docAdmissionCount);

    const firstSource = data.firstAdmissionDate !== undefined ? data.firstAdmissionDate : doc.firstAdmissionDate;
    const firstTs = normalizeTimestamp(firstSource);

    const latestSource = data.latestAdmissionDate !== undefined ? data.latestAdmissionDate : doc.latestAdmissionDate;
    const latestTimestampSource = data.latestAdmissionTimestamp !== undefined ? data.latestAdmissionTimestamp : doc.latestAdmissionTimestamp;
    const latestTs = normalizeTimestamp(latestSource);
    const latestTimestamp = normalizeTimestamp(latestTimestampSource) || latestTs;

    const summaryCaregivers = doc.summaryCaregivers || doc.caregivers || data.summaryCaregivers || '';
    const lastNarrative = doc.lastIntakeNarrative || data.lastIntakeNarrative || '';

    const excelInfo = excelMeta.get(nameKey) || excelMeta.get(doc.recordKey) || null;
    const nativePlace = doc.nativePlace || data.nativePlace || (excelInfo && excelInfo.nativePlace) || '';
    const ethnicity = doc.ethnicity || data.ethnicity || (excelInfo && excelInfo.ethnicity) || '';

    summaries.push({
      key: nameKey,
      patientKey: docId,
      recordKey: nameKey,
      needsProfileSync: false,
      patientName: doc.patientName || '',
      gender: doc.gender || '',
      birthDate: doc.birthDate || '',
      idNumber: doc.idNumber || '',
      nativePlace,
      ethnicity,
      firstAdmissionDate: firstTs || null,
      latestAdmissionDate: latestTs || null,
      firstDiagnosis: doc.firstDiagnosis || '',
      latestDiagnosis: doc.latestDiagnosis || '',
      firstHospital: doc.firstHospital || '',
      latestHospital: doc.latestHospital || '',
      latestDoctor: doc.latestDoctor || '',
      admissionCount,
      summaryCaregivers,
      latestAdmissionTimestamp: latestTimestamp || null,
      lastIntakeNarrative: lastNarrative
    });
  });

  let totalCount = summaries.length;
  if (!includeTotal && page > 0) {
    totalCount = skip + summaries.length;
  }
  if (includeTotal) {
    try {
      const countRes = await db.collection(PATIENTS_COLLECTION).count();
      if (countRes && typeof countRes.total === 'number') {
        totalCount = countRes.total;
      }
    } catch (error) {
      console.warn('Failed to count patient summaries', error);
    }
  }

  let hasMore = docs.length === limit;
  if (includeTotal && typeof totalCount === 'number') {
    hasMore = (skip + docs.length) < totalCount;
  }
  const nextPage = hasMore ? page + 1 : null;

  return {
    patients: summaries,
    totalCount,
    hasMore,
    nextPage,
    limit
  };
}

// Build patient groups
function buildPatientGroups(records) {
  const groups = new Map();

  const ensureTimestamp = (record) => {
    if (!record) {
      return null;
    }
    const primary = normalizeTimestamp(record.admissionTimestamp);
    if (primary !== null) {
      return primary;
    }
    const parsed = normalizeTimestamp(record.admissionDate);
    if (parsed !== null) {
      return parsed;
    }
    const importedAt = normalizeTimestamp(record._importedAt);
    if (importedAt !== null) {
      return importedAt;
    }
    const fallback = normalizeTimestamp(record.updatedAt || record.createdAt);
    if (fallback !== null) {
      return fallback;
    }
    return Date.now();
  };

  records.forEach(record => {
    if (!record.key || !record.patientName) {
      return;
    }

    if (!groups.has(record.key)) {
      groups.set(record.key, {
        key: record.key,
        patientName: record.patientName,
        gender: record.gender || '',
        birthDate: record.birthDate || '',
        idNumber: record.idNumber || '',
        records: [],
        admissionCount: 0,
        firstAdmissionDate: null,
        latestAdmissionDate: null,
        firstDiagnosis: '',
        latestDiagnosis: '',
        firstHospital: '',
        latestHospital: '',
        latestDoctor: '',
        summaryCaregivers: ''
      });
    }

    const group = groups.get(record.key);
    group.records.push(record);

    const admissionTimestamp = ensureTimestamp(record);

    if (admissionTimestamp !== null) {
      group.admissionCount += 1;
      if (!group.firstAdmissionTimestamp || admissionTimestamp < group.firstAdmissionTimestamp) {
        group.firstAdmissionDate = record.admissionDate;
        group.firstAdmissionTimestamp = admissionTimestamp;
        group.firstDiagnosis = record.diagnosis || '';
        group.firstHospital = record.hospital || '';
      }
      if (!group.latestAdmissionTimestamp || admissionTimestamp > group.latestAdmissionTimestamp) {
        group.latestAdmissionDate = record.admissionDate;
        group.latestAdmissionTimestamp = admissionTimestamp;
        group.latestDiagnosis = record.diagnosis || '';
        group.latestHospital = record.hospital || '';
        group.latestDoctor = record.doctor || '';
      }
    }

    // Collect caregiver info
    if (record.caregivers && !group.summaryCaregivers.includes(record.caregivers)) {
      group.summaryCaregivers = group.summaryCaregivers
        ? `${group.summaryCaregivers}、${normalizeSpacing(record.caregivers)}`
        : normalizeSpacing(record.caregivers);
    }
  });

  groups.forEach((group) => {
    const totalRecords = Array.isArray(group.records) ? group.records.length : 0;
    if (totalRecords > group.admissionCount) {
      group.admissionCount = totalRecords;
    }

    const latestRecord = totalRecords ? group.records[0] : {};
    const earliestRecord = totalRecords ? group.records[totalRecords - 1] : latestRecord;

    const ensureTimestamp = (current, source) => {
      if (current) {
        return current;
      }
      const ts = normalizeTimestamp(source);
      return ts || null;
    };

    if (!group.firstAdmissionDate && earliestRecord) {
      group.firstAdmissionDate = earliestRecord.admissionDate || earliestRecord.admissionTimestamp || null;
    }
    if (!group.firstAdmissionTimestamp && earliestRecord) {
      group.firstAdmissionTimestamp = ensureTimestamp(null, earliestRecord.admissionTimestamp || earliestRecord.admissionDate);
    }
    if (!group.firstDiagnosis && earliestRecord) {
      group.firstDiagnosis = earliestRecord.diagnosis || group.firstDiagnosis || '';
    }
    if (!group.firstHospital && earliestRecord) {
      group.firstHospital = earliestRecord.hospital || group.firstHospital || '';
    }

    if (!group.latestAdmissionDate && latestRecord) {
      group.latestAdmissionDate = latestRecord.admissionDate || latestRecord.admissionTimestamp || null;
    }
    if (!group.latestAdmissionTimestamp && latestRecord) {
      group.latestAdmissionTimestamp = ensureTimestamp(null, latestRecord.admissionTimestamp || latestRecord.admissionDate);
    }
    if (!group.latestDiagnosis && latestRecord) {
      group.latestDiagnosis = latestRecord.diagnosis || group.latestDiagnosis || '';
    }
    if (!group.latestHospital && latestRecord) {
      group.latestHospital = latestRecord.hospital || group.latestHospital || '';
    }
    if (!group.latestDoctor && latestRecord) {
      group.latestDoctor = latestRecord.doctor || group.latestDoctor || '';
    }

    if (!group.summaryCaregivers && latestRecord && latestRecord.caregivers) {
      group.summaryCaregivers = normalizeSpacing(latestRecord.caregivers);
    }
  });

  return groups;
}

// Fetch patient detail by key
async function fetchPatientDetailByKey(recordKey) {
  if (!recordKey) {
    throw makeError('INVALID_PATIENT_KEY', 'Missing patient identifier');
  }

  await ensureCollectionExists(EXCEL_RECORDS_COLLECTION);
  const res = await db.collection(EXCEL_RECORDS_COLLECTION)
    .where({ key: recordKey })
    .get();

  if (!res.data || res.data.length === 0) {
    throw makeError('PATIENT_NOT_FOUND', 'Patient record missing');
  }

  const records = res.data;
  const groups = buildPatientGroups(records);
  const group = groups.get(recordKey);

  if (!group) {
    throw makeError('PATIENT_NOT_FOUND', 'Patient information incomplete');
  }

  return formatPatientDetail(group);
}

// Format patient detail
function formatPatientDetail(group) {
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

  const buildInfoList = (pairs = []) => {
    return pairs
      .map(({ label, value }) => ({ label, value: normalizeValue(value) }))
      .filter((item) => item.value);
  };

  const basicInfo = buildInfoList([
    { label: '性别', value: group.gender || latest.gender },
    { label: '出生日期', value: group.birthDate || latest.birthDate },
    { label: '身份证号', value: group.idNumber || latest.idNumber },
    { label: '籍贯', value: group.nativePlace || latest.nativePlace },
    { label: '民族', value: group.ethnicity || latest.ethnicity },
    { label: '主要照护人', value: group.summaryCaregivers }
  ]);

  const familyInfo = buildInfoList([
    { label: '家庭地址', value: pickRecordValue(record => record.address) },
    { label: '父亲联系方式', value: pickRecordValue(record => record.fatherInfo) },
    { label: '母亲联系方式', value: pickRecordValue(record => record.motherInfo) },
    { label: '其他监护人', value: pickRecordValue(record => record.otherGuardian) }
  ]);

  // Build economic info
  const economicInfo = buildInfoList([
    { label: '家庭经济情况', value: pickRecordValue(record => record.familyEconomy) }
  ]);

  // Build medical records
  const records = group.records.map(record => ({
    admissionDate: record.admissionDate || '',
    hospital: record.hospital || '',
    diagnosis: record.diagnosis || '',
    doctor: record.doctor || '',
    symptoms: record.symptoms || '',
    treatmentProcess: record.treatmentProcess || '',
    followUpPlan: record.followUpPlan || ''
  })).filter(record => record.admissionDate || record.hospital || record.diagnosis);

  return {
    patient: {
      key: group.key,
      patientName: group.patientName,
      gender: group.gender || latest.gender || '',
      birthDate: group.birthDate || latest.birthDate || '',
      idNumber: group.idNumber || latest.idNumber || '',
      latestHospital: group.latestHospital,
      latestDoctor: group.latestDoctor
    },
    basicInfo,
    familyInfo,
    economicInfo,
    records
  };
}

// Handle patient list request
async function handleGetPatientsList(event = {}) {
  const forceRefresh = !!(event && event.forceRefresh);
  const page = Math.max(Number(event && event.page) || 0, 0);
  const pageSize = Number(event && event.pageSize);
  const includeTotal = !!(event && event.includeTotal);

  try {
    const result = await fetchPatientsFromCache({
      forceRefresh,
      page,
      limit: pageSize,
      includeTotal
    });

    return {
      success: true,
      patients: result.patients,
      totalCount: result.totalCount !== undefined ? result.totalCount : result.patients.length,
      hasMore: result.hasMore,
      nextPage: result.nextPage
    };
  } catch (error) {
    console.error('Failed to load patient list', error);
    throw makeError('LIST_FAILED', 'Failed to load patient list', { error: error.message });
  }
}

// Handle patient detail request
async function handleGetPatientDetail(event) {
  const { key } = event;

  if (!key) {
    throw makeError('INVALID_PATIENT_KEY', 'Missing patient identifier');
  }

  try {
    const patientDetail = await fetchPatientDetailByKey(key);
    return {
      success: true,
      ...patientDetail
    };
  } catch (error) {
    console.error('Failed to load patient detail', key, error);
    if (error.code) {
      throw error;
    }
    throw makeError('DETAIL_FAILED', 'Failed to load patient detail', { error: error.message });
  }
}

// Main function
exports.main = async (event) => {
  const action = event.action || '';

  try {
    switch (action) {
      case 'list':
        return await handleGetPatientsList(event);
      case 'detail':
        return await handleGetPatientDetail(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `Unsupported action: ${action || 'unknown'}`);
    }
  } catch (error) {
    console.error('patientProfile action failed', action, error);
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal service error',
        details: error.details || null
      }
    };
  }
};

