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

function formatGuardian(name, phone) {
  const normalizedName = normalizeValue(name);
  const normalizedPhone = normalizeValue(phone);
  if (normalizedName && normalizedPhone) {
    return `${normalizedName} ${normalizedPhone}`;
  }
  return normalizedName || normalizedPhone || '';
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
      careStatus: 1,
      checkoutAt: 1,
      checkoutReason: 1,
      checkoutNote: 1,
      'metadata.checkoutAt': 1,
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
      'data.lastIntakeNarrative': 1,
      'data.careStatus': 1,
      'data.checkoutAt': 1,
      'data.checkoutReason': 1,
      'data.checkoutNote': 1
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
    const nestedData = data.data && typeof data.data === 'object' ? data.data : {};
    const pickValue = (...candidates) => {
      for (const value of candidates) {
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
      return undefined;
    };

    const dataAdmissionCount = Math.max(
      safeNumber(data.admissionCount),
      safeNumber(nestedData.admissionCount)
    );
    const docAdmissionCount = safeNumber(doc.admissionCount);
    const admissionCount = Math.max(dataAdmissionCount, docAdmissionCount);

    const firstSource = pickValue(nestedData.firstAdmissionDate, data.firstAdmissionDate, doc.firstAdmissionDate);
    const firstTs = normalizeTimestamp(firstSource);

    const latestSource = pickValue(nestedData.latestAdmissionDate, data.latestAdmissionDate, doc.latestAdmissionDate);
    const latestTimestampSource = pickValue(
      nestedData.latestAdmissionTimestamp,
      data.latestAdmissionTimestamp,
      doc.latestAdmissionTimestamp
    );
    const latestTs = normalizeTimestamp(latestSource);
    const latestTimestamp = normalizeTimestamp(latestTimestampSource) || latestTs;

    const summaryCaregivers = (
      pickValue(doc.summaryCaregivers, doc.caregivers, data.summaryCaregivers, nestedData.summaryCaregivers) || ''
    );
    const lastNarrative = pickValue(
      doc.lastIntakeNarrative,
      data.lastIntakeNarrative,
      nestedData.lastIntakeNarrative
    ) || '';
    let careStatus = pickValue(doc.careStatus, data.careStatus, nestedData.careStatus) || '';
    const checkoutAtSource = pickValue(doc.checkoutAt, data.checkoutAt, nestedData.checkoutAt);
    const checkoutAt = normalizeTimestamp(checkoutAtSource);
    const checkoutReason = pickValue(
      doc.checkoutReason,
      data.checkoutReason,
      nestedData.checkoutReason
    ) || '';
    const checkoutNote = pickValue(doc.checkoutNote, data.checkoutNote, nestedData.checkoutNote) || '';

    if (!careStatus && checkoutAt) {
      careStatus = 'discharged';
    } else if (careStatus === 'in_care' && checkoutAt && latestTimestamp && checkoutAt >= latestTimestamp) {
      careStatus = 'discharged';
    }
    const phone = doc.phone || data.phone || '';
    const address = doc.address || data.address || '';
    const emergencyContact = doc.emergencyContact || data.emergencyContact || '';
    const emergencyPhone = doc.emergencyPhone || data.emergencyPhone || '';
    const backupContact = doc.backupContact || data.backupContact || '';
    const backupPhone = doc.backupPhone || data.backupPhone || '';

    const nativePlace = normalizeValue(pickValue(doc.nativePlace, data.nativePlace, nestedData.nativePlace));
    const ethnicity = normalizeValue(pickValue(doc.ethnicity, data.ethnicity, nestedData.ethnicity));
    const excelImportOrder = pickValue(doc.excelImportOrder, data.excelImportOrder, nestedData.excelImportOrder);
    const importOrder = pickValue(doc.importOrder, data.importOrder, nestedData.importOrder, excelImportOrder);

    // 优先从data字段获取诊断和医院信息，如果没有则从doc根级字段获取
    const firstDiagnosis = pickValue(data.firstDiagnosis, nestedData.firstDiagnosis, doc.firstDiagnosis) || '';
    const latestDiagnosis = pickValue(data.latestDiagnosis, nestedData.latestDiagnosis, doc.latestDiagnosis) || '';
    const firstHospital = pickValue(data.firstHospital, nestedData.firstHospital, doc.firstHospital) || '';
    const latestHospital = pickValue(data.latestHospital, nestedData.latestHospital, doc.latestHospital) || '';
    const latestDoctor = pickValue(data.latestDoctor, nestedData.latestDoctor, doc.latestDoctor) || '';

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
      lastIntakeNarrative: lastNarrative,
      careStatus,
      checkoutAt: checkoutAt || null,
      checkoutReason,
      checkoutNote
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

  const normalizedKey = normalizeSpacing(recordKey);
  const keysToTry = new Set();
  if (normalizedKey) {
    keysToTry.add(normalizedKey);
  }

  await ensureCollectionExists(db, PATIENTS_COLLECTION);

  let patientDoc = null;
  const tryAssignPatientDoc = async (queryPromise) => {
    try {
      const snapshot = await queryPromise;
      if (snapshot && snapshot.data && snapshot.data.length) {
        const doc = snapshot.data[0];
        const docId = doc._id || doc.id || doc.patientKey || normalizedKey;
        patientDoc = { _id: docId, ...doc };
        if (Array.isArray(patientDoc.excelRecordKeys)) {
          patientDoc.excelRecordKeys.forEach((key) => {
            const normalized = normalizeSpacing(key);
            if (normalized) {
              keysToTry.add(normalized);
            }
          });
        }
        if (patientDoc.recordKey) {
          const normalized = normalizeSpacing(patientDoc.recordKey);
          if (normalized) {
            keysToTry.add(normalized);
          }
        }
        if (patientDoc.patientName) {
          const normalized = normalizeSpacing(patientDoc.patientName);
          if (normalized) {
            keysToTry.add(normalized);
          }
        }
      }
    } catch (error) {
      // 忽略这些查询错误，继续尝试其他方式
    }
  };

  // 先尝试按照文档 ID 查找患者档案
  await tryAssignPatientDoc(db.collection(PATIENTS_COLLECTION).doc(normalizedKey).get());

  if (!patientDoc) {
    // 再尝试 excelRecordKeys 包含当前 key 的文档
    await tryAssignPatientDoc(
      db
        .collection(PATIENTS_COLLECTION)
        .where({ excelRecordKeys: normalizedKey })
        .limit(1)
        .get()
    );
  }

  if (!patientDoc) {
    // 最后尝试患者姓名匹配
    await tryAssignPatientDoc(
      db
        .collection(PATIENTS_COLLECTION)
        .where({ patientName: normalizedKey })
        .limit(1)
        .get()
    );
  }

  await ensureCollectionExists(db, EXCEL_RECORDS_COLLECTION);

  const records = [];
  for (const key of keysToTry) {
    if (!key) {
      continue;
    }
    try {
      const res = await db.collection(EXCEL_RECORDS_COLLECTION).where({ key }).get();
      if (res.data && res.data.length) {
        records.push(...res.data);
      }
    } catch (error) {
      console.warn('patientProfile fetch detail excel lookup failed', key, error);
    }
  }

  if (!records.length) {
    if (patientDoc && patientDoc._id) {
      const fallbackDetail = await fetchFallbackPatientDetail(patientDoc._id);
      if (fallbackDetail) {
        return fallbackDetail;
      }
    }
    throw makeError('PATIENT_NOT_FOUND', 'Patient record missing');
  }

  const groups = buildPatientGroups(records);
  let group = groups.get(normalizedKey);
  if (!group && patientDoc) {
    const candidateKeys = [].concat(
      patientDoc.recordKey || [],
      Array.isArray(patientDoc.excelRecordKeys) ? patientDoc.excelRecordKeys : [],
      patientDoc.patientName || []
    );
    for (const key of candidateKeys) {
      const normalized = normalizeSpacing(key);
      if (normalized && groups.get(normalized)) {
        group = groups.get(normalized);
        break;
      }
    }
  }
  if (!group) {
    const iterator = groups.values().next();
    if (!iterator.done) {
      group = iterator.value;
    }
  }

  if (!group) {
    if (patientDoc && patientDoc._id) {
      const fallbackDetail = await fetchFallbackPatientDetail(patientDoc._id);
      if (fallbackDetail) {
        return fallbackDetail;
      }
    }
    throw makeError('PATIENT_NOT_FOUND', 'Patient information incomplete');
  }

  return formatPatientDetail(group, patientDoc);
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
      nativePlace: patientDoc.nativePlace || '',
      ethnicity: patientDoc.ethnicity || '',
      latestHospital: patientDoc.latestHospital || '',
      latestDoctor: patientDoc.latestDoctor || ''
    };

    const basicInfo = buildList([
      ['性别', patientDoc.gender],
      ['出生日期', patientDoc.birthDate],
      ['身份证号', patientDoc.idNumber],
      ['籍贯', patientDoc.nativePlace],
      ['民族', patientDoc.ethnicity],
      ['联系电话', patientDoc.phone]
    ]);

    const familyInfo = buildList([
      ['家庭地址', patientDoc.address],
      ['紧急联系人', patientDoc.emergencyContact],
      ['紧急联系电话', patientDoc.emergencyPhone],
      ['备用联系人', patientDoc.backupContact],
      ['备用联系电话', patientDoc.backupPhone],
      ['父亲联系方式', patientDoc.fatherInfo || formatGuardian(patientDoc.fatherContactName, patientDoc.fatherContactPhone)],
      ['母亲联系方式', patientDoc.motherInfo || formatGuardian(patientDoc.motherContactName, patientDoc.motherContactPhone)],
      ['其他监护人', patientDoc.guardianInfo || formatGuardian(patientDoc.guardianContactName, patientDoc.guardianContactPhone)]
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
function formatPatientDetail(group, patientDoc) {
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

  const ensureFamilyField = (label, value) => {
    const normalized = normalizeValue(value);
    if (!normalized) {
      return;
    }
    const existing = familyInfo.find(item => item.label === label && normalizeValue(item.value));
    if (!existing) {
      familyInfo.push({ label, value: normalized });
    }
  };

  if (patientDoc) {
    ensureFamilyField(
      '家庭地址',
      patientDoc.address
    );
    ensureFamilyField(
      '父亲联系方式',
      patientDoc.fatherInfo || formatGuardian(patientDoc.fatherContactName, patientDoc.fatherContactPhone)
    );
    ensureFamilyField(
      '母亲联系方式',
      patientDoc.motherInfo || formatGuardian(patientDoc.motherContactName, patientDoc.motherContactPhone)
    );
    ensureFamilyField(
      '其他监护人',
      patientDoc.guardianInfo || formatGuardian(patientDoc.guardianContactName, patientDoc.guardianContactPhone)
    );
    ensureFamilyField(
      '紧急联系人',
      patientDoc.emergencyContact
    );
    ensureFamilyField(
      '紧急联系电话',
      patientDoc.emergencyPhone
    );
  }

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
