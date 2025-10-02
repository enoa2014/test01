const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const {
  normalizeValue,
  normalizeSpacing,
  normalizeTimestamp,
  ensureCollectionExists,
  buildPatientGroups,
} = require('./utils/patient');

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
      await ensureCollectionExists(db, EXCEL_CACHE_COLLECTION);
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
      await ensureCollectionExists(db, EXCEL_CACHE_COLLECTION);
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
  await ensureCollectionExists(db, PATIENTS_COLLECTION);

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
      phone: 1,
      address: 1,
      emergencyContact: 1,
      emergencyPhone: 1,
      backupContact: 1,
      backupPhone: 1,
      recordKey: 1,
      firstAdmissionDate: 1,
      latestAdmissionDate: 1,
      latestAdmissionTimestamp: 1,
      firstHospital: 1,
      latestHospital: 1,
      latestDoctor: 1,
      firstDiagnosis: 1,
      latestDiagnosis: 1,
      admissionCount: 1,
      summaryCaregivers: 1,
      lastIntakeNarrative: 1,
      'data.firstAdmissionDate': 1,
      'data.latestAdmissionDate': 1,
      'data.latestAdmissionTimestamp': 1,
      'data.firstHospital': 1,
      'data.latestHospital': 1,
      'data.latestDoctor': 1,
      'data.firstDiagnosis': 1,
      'data.latestDiagnosis': 1,
      'data.admissionCount': 1,
      'data.summaryCaregivers': 1,
      'data.lastIntakeNarrative': 1
    })
    .get();

  const docs = Array.isArray(res.data) ? res.data : [];
  const summaries = [];

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
    const phone = doc.phone || data.phone || '';
    const address = doc.address || data.address || '';
    const emergencyContact = doc.emergencyContact || data.emergencyContact || '';
    const emergencyPhone = doc.emergencyPhone || data.emergencyPhone || '';
    const backupContact = doc.backupContact || data.backupContact || '';
    const backupPhone = doc.backupPhone || data.backupPhone || '';

    const nativePlace = normalizeValue(doc.nativePlace || data.nativePlace);
    const ethnicity = normalizeValue(doc.ethnicity || data.ethnicity);
    const excelImportOrder = doc.excelImportOrder || data.excelImportOrder || null;
    const importOrder = doc.importOrder || data.importOrder || excelImportOrder || null;

    // 优先从data字段获取诊断和医院信息，如果没有则从doc根级字段获取
    const firstDiagnosis = data.firstDiagnosis || doc.firstDiagnosis || '';
    const latestDiagnosis = data.latestDiagnosis || doc.latestDiagnosis || '';
    const firstHospital = data.firstHospital || doc.firstHospital || '';
    const latestHospital = data.latestHospital || doc.latestHospital || '';
    const latestDoctor = data.latestDoctor || doc.latestDoctor || '';

    summaries.push({
      key: nameKey,
      patientKey: docId,
      recordKey: nameKey,
      needsProfileSync: false,
      patientName: doc.patientName || '',
      gender: doc.gender || '',
      birthDate: doc.birthDate || '',
      idNumber: doc.idNumber || '',
      phone,
      address,
      emergencyContact,
      emergencyPhone,
      backupContact,
      backupPhone,
      nativePlace,
      ethnicity,
      excelImportOrder,
      importOrder,
      firstAdmissionDate: firstTs || null,
      latestAdmissionDate: latestTs || null,
      firstDiagnosis,
      latestDiagnosis,
      firstHospital,
      latestHospital,
      latestDoctor,
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


// Fetch patient detail by key
async function fetchPatientDetailByKey(recordKey) {
  if (!recordKey) {
    throw makeError('INVALID_PATIENT_KEY', 'Missing patient identifier');
  }

  await ensureCollectionExists(db, EXCEL_RECORDS_COLLECTION);
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

async function fetchFallbackPatientDetail(patientKey) {
  try {
    await ensureCollectionExists(db, PATIENTS_COLLECTION);
    const patientSnapshot = await db.collection(PATIENTS_COLLECTION).doc(patientKey).get();
    const patientDoc = patientSnapshot && patientSnapshot.data ? patientSnapshot.data : null;
    if (!patientDoc) {
      return null;
    }

    const buildList = (items = []) =>
      items
        .map(([label, value]) => ({ label, value: normalizeValue(value) }))
        .filter(item => item.value);

    const patient = {
      key: patientDoc._id || patientKey,
      patientName: patientDoc.patientName || '',
      gender: patientDoc.gender || '',
      birthDate: patientDoc.birthDate || '',
      idNumber: patientDoc.idNumber || '',
      latestHospital: patientDoc.latestHospital || '',
      latestDoctor: patientDoc.latestDoctor || ''
    };

    const basicInfo = buildList([
      ['性别', patientDoc.gender],
      ['出生日期', patientDoc.birthDate],
      ['身份证号', patientDoc.idNumber],
      ['联系电话', patientDoc.phone]
    ]);

    const familyInfo = buildList([
      ['家庭地址', patientDoc.address],
      ['紧急联系人', patientDoc.emergencyContact],
      ['紧急联系电话', patientDoc.emergencyPhone],
      ['备用联系人', patientDoc.backupContact],
      ['备用联系电话', patientDoc.backupPhone]
    ]);

    const economicInfo = buildList([
      ['家庭经济情况', patientDoc.familyEconomy]
    ]);

    let records = [];
    try {
      await ensureCollectionExists(db, PATIENT_INTAKE_COLLECTION);
      const intakeSnapshot = await db
        .collection(PATIENT_INTAKE_COLLECTION)
        .where({ patientKey })
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get();
      records = Array.isArray(intakeSnapshot.data)
        ? intakeSnapshot.data.map(item => ({
            ...item,
            intakeId: item.intakeId || item._id || ''
          }))
        : [];
    } catch (intakeError) {
      console.warn('patientProfile fallback failed to load intake records', patientKey, intakeError);
    }

    return {
      patient,
      basicInfo,
      familyInfo,
      economicInfo,
      records
    };
  } catch (error) {
    console.warn('patientProfile fallback failed', patientKey, error);
    return null;
  }
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
  const dedupeSet = new Set();
  const records = (Array.isArray(group.records) ? group.records : []).reduce((acc, record, index) => {
    if (!record) {
      return acc;
    }

    const admissionDateText = normalizeValue(record.admissionDate);
    const admissionTimestamp = normalizeTimestamp(record.admissionTimestamp || record._importedAt || record.updatedAt);
    const hospital = normalizeSpacing(record.hospital);
    const diagnosis = normalizeSpacing(record.diagnosis);
    const doctor = normalizeSpacing(record.doctor);
    const symptoms = normalizeSpacing(record.symptoms);
    const treatmentProcess = normalizeSpacing(record.treatmentProcess);
    const followUpPlan = normalizeSpacing(record.followUpPlan);

    const dedupeKey = [
      admissionTimestamp || '',
      admissionDateText,
      hospital,
      diagnosis,
      doctor,
      symptoms,
      treatmentProcess,
      followUpPlan
    ].join('|');

    if (dedupeSet.has(dedupeKey)) {
      return acc;
    }
    dedupeSet.add(dedupeKey);

    const situationText = normalizeSpacing(record.situation)
      || normalizeSpacing(record.symptoms)
      || normalizeSpacing(record.treatmentProcess)
      || normalizeSpacing(record.diagnosis);

    const medicalInfo = {
      hospital,
      diagnosis,
      doctor,
      symptoms,
      treatmentProcess,
      followUpPlan
    };

    Object.keys(medicalInfo).forEach((key) => {
      if (!medicalInfo[key]) {
        delete medicalInfo[key];
      }
    });

    acc.push({
      intakeId: `excel_${group.key || 'patient'}_${index}`,
      intakeTime: admissionTimestamp || null,
      admissionDate: admissionDateText,
      status: 'excel-import',
      hospital,
      diagnosis,
      doctor,
      symptoms,
      treatmentProcess,
      followUpPlan,
      situation: situationText,
      medicalInfo: Object.keys(medicalInfo).length ? medicalInfo : undefined,
      intakeInfo: situationText || followUpPlan
        ? {
            intakeTime: admissionTimestamp || null,
            situation: situationText,
            followUpPlan
          }
        : undefined
    });

    return acc;
  }, []);

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
    if (error && error.code === 'PATIENT_NOT_FOUND') {
      const fallbackDetail = await fetchFallbackPatientDetail(key);
      if (fallbackDetail) {
        console.warn('patientProfile detail fallback to patients collection', key);
        return {
          success: true,
          ...fallbackDetail
        };
      }
    }
    console.error('Failed to load patient detail', key, error);
    if (error && error.code) {
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
