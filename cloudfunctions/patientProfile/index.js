const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const {
  normalizeValue,
  normalizeSpacing,
  normalizeTimestamp,
  ensureCollectionExists,
  buildPatientGroups,
} = require('./utils/patient');

// Collection names
const EXCEL_RECORDS_COLLECTION = 'excel_records';
const EXCEL_CACHE_COLLECTION = 'excel_cache';
const PATIENTS_COLLECTION = 'patients';
const PATIENT_INTAKE_COLLECTION = 'patient_intake_records';
const PATIENT_MEDIA_COLLECTION = 'patient_media';
const PATIENT_MEDIA_QUOTA_COLLECTION = 'patient_media_quota';
const PATIENT_OPERATION_LOGS_COLLECTION = 'patient_operation_logs';
const PATIENT_CACHE_DOC_ID = 'patients_summary_cache';
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
  const limit = Math.max(
    1,
    Math.min(
      Number.isFinite(rawLimit) ? rawLimit : DEFAULT_PATIENT_LIST_LIMIT,
      MAX_PATIENT_LIST_LIMIT
    )
  );
  const eligibleForCache = !forceRefresh && page === 0;

  if (eligibleForCache) {
    try {
      await ensureCollectionExists(db, EXCEL_CACHE_COLLECTION);
      const res = await db.collection(EXCEL_CACHE_COLLECTION).doc(PATIENT_CACHE_DOC_ID).get();
      const cached = res && res.data ? res.data : null;
      const cacheAge = cached ? Date.now() - (cached.updatedAt || 0) : Number.MAX_SAFE_INTEGER;

      const cacheHasNativePlace =
        Array.isArray(cached && cached.patients) &&
        cached.patients.every(item =>
          item && Object.prototype.hasOwnProperty.call(item, 'nativePlace')
        );

      if (
        cached &&
        cacheAge < PATIENT_LIST_CACHE_TTL &&
        Array.isArray(cached.patients) &&
        cacheHasNativePlace
      ) {
        const slice = cached.patients.slice(0, limit);
        const totalCount = cached.totalCount !== undefined ? cached.totalCount : slice.length;
        const hasMore = cached.hasMore !== undefined ? cached.hasMore : totalCount > slice.length;
        return {
          patients: slice,
          totalCount,
          hasMore,
          nextPage: hasMore ? 1 : null,
          limit,
        };
      }
    } catch (error) {
      const code = error && (error.errCode !== undefined ? error.errCode : error.code);
      if (code !== -1 && code !== 'DOCUMENT_NOT_FOUND' && code !== 'DATABASE_DOCUMENT_NOT_EXIST') {
        console.warn('Failed to read from cache', error);
      }
    }
  }

  const fresh = await buildPatientsFromDatabase({
    page,
    limit,
    includeTotal,
  });

  if (page === 0) {
    try {
      await ensureCollectionExists(db, EXCEL_CACHE_COLLECTION);
      await db
        .collection(EXCEL_CACHE_COLLECTION)
        .doc(PATIENT_CACHE_DOC_ID)
        .set({
          data: {
            patients: fresh.patients,
            totalCount: fresh.totalCount,
            hasMore: fresh.hasMore,
            limit,
            updatedAt: Date.now(),
          },
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
  const limit = Math.max(
    1,
    Math.min(
      Number.isFinite(rawLimit) ? rawLimit : DEFAULT_PATIENT_LIST_LIMIT,
      MAX_PATIENT_LIST_LIMIT
    )
  );
  const includeTotal = !!(options && options.includeTotal);

  const skip = page * limit;

  const res = await db
    .collection(PATIENTS_COLLECTION)
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
      nativePlace: 1,
      ethnicity: 1,
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
      'data.checkoutNote': 1,
      'data.nativePlace': 1,
      'data.ethnicity': 1,
      'data.data.nativePlace': 1,
      'data.data.ethnicity': 1,
    })
    .get();

  const docs = Array.isArray(res.data) ? res.data : [];
  const summaries = [];

  docs.forEach(doc => {
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

    const firstSource = pickValue(
      nestedData.firstAdmissionDate,
      data.firstAdmissionDate,
      doc.firstAdmissionDate
    );
    const firstTs = normalizeTimestamp(firstSource);

    const latestSource = pickValue(
      nestedData.latestAdmissionDate,
      data.latestAdmissionDate,
      doc.latestAdmissionDate
    );
    const latestTimestampSource = pickValue(
      nestedData.latestAdmissionTimestamp,
      data.latestAdmissionTimestamp,
      doc.latestAdmissionTimestamp
    );
    const latestTs = normalizeTimestamp(latestSource);
    const latestTimestamp = normalizeTimestamp(latestTimestampSource) || latestTs;

    const summaryCaregivers =
      pickValue(
        doc.summaryCaregivers,
        doc.caregivers,
        data.summaryCaregivers,
        nestedData.summaryCaregivers
      ) || '';
    const lastNarrative =
      pickValue(
        doc.lastIntakeNarrative,
        data.lastIntakeNarrative,
        nestedData.lastIntakeNarrative
      ) || '';
    let careStatus = pickValue(doc.careStatus, data.careStatus, nestedData.careStatus) || '';
    const checkoutAtSource = pickValue(doc.checkoutAt, data.checkoutAt, nestedData.checkoutAt);
    const checkoutAt = normalizeTimestamp(checkoutAtSource);
    const checkoutReason =
      pickValue(doc.checkoutReason, data.checkoutReason, nestedData.checkoutReason) || '';
    const checkoutNote =
      pickValue(doc.checkoutNote, data.checkoutNote, nestedData.checkoutNote) || '';

    if (!careStatus && checkoutAt) {
      careStatus = 'discharged';
    } else if (
      careStatus === 'in_care' &&
      checkoutAt &&
      latestTimestamp &&
      checkoutAt >= latestTimestamp
    ) {
      careStatus = 'discharged';
    }
    const phone = doc.phone || data.phone || '';
    const address = doc.address || data.address || '';
    const emergencyContact = doc.emergencyContact || data.emergencyContact || '';
    const emergencyPhone = doc.emergencyPhone || data.emergencyPhone || '';
    const backupContact = doc.backupContact || data.backupContact || '';
    const backupPhone = doc.backupPhone || data.backupPhone || '';

    const nativePlace = normalizeValue(
      pickValue(doc.nativePlace, data.nativePlace, nestedData.nativePlace)
    );
    const ethnicity = normalizeValue(
      pickValue(doc.ethnicity, data.ethnicity, nestedData.ethnicity)
    );
    const excelImportOrder = pickValue(
      doc.excelImportOrder,
      data.excelImportOrder,
      nestedData.excelImportOrder
    );
    const importOrder = pickValue(
      doc.importOrder,
      data.importOrder,
      nestedData.importOrder,
      excelImportOrder
    );

    // 优先从data字段获取诊断和医院信息，如果没有则从doc根级字段获取
    const firstDiagnosis =
      pickValue(data.firstDiagnosis, nestedData.firstDiagnosis, doc.firstDiagnosis) || '';
    const latestDiagnosis =
      pickValue(data.latestDiagnosis, nestedData.latestDiagnosis, doc.latestDiagnosis) || '';
    const firstHospital =
      pickValue(data.firstHospital, nestedData.firstHospital, doc.firstHospital) || '';
    const latestHospital =
      pickValue(data.latestHospital, nestedData.latestHospital, doc.latestHospital) || '';
    const latestDoctor =
      pickValue(data.latestDoctor, nestedData.latestDoctor, doc.latestDoctor) || '';

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
      checkoutNote,
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
    hasMore = skip + docs.length < totalCount;
  }
  const nextPage = hasMore ? page + 1 : null;

  return {
    patients: summaries,
    totalCount,
    hasMore,
    nextPage,
    limit,
  };
}

function normalizeKeyCandidate(value) {
  return normalizeSpacing(value || '');
}

async function findPatientDocForDeletion(options = {}) {
  await ensureCollectionExists(db, PATIENTS_COLLECTION);

  const candidateKeys = new Set();
  const addCandidate = value => {
    const normalized = normalizeKeyCandidate(value);
    if (normalized) {
      candidateKeys.add(normalized);
    }
  };

  addCandidate(options && options.patientKey);
  addCandidate(options && options.recordKey);

  let patientDoc = null;

  const assignFromSnapshot = snapshot => {
    if (!snapshot || !snapshot.data) {
      return false;
    }
    const data = snapshot.data;
    if (Array.isArray(data) && data.length) {
      const doc = data[0];
      const docId = doc._id || doc.id || doc.patientKey || doc.recordKey;
      if (docId) {
        patientDoc = { _id: docId, ...doc };
        return true;
      }
    }
    if (snapshot._id && !patientDoc) {
      patientDoc = { _id: snapshot._id, ...snapshot };
      return true;
    }
    return false;
  };

  for (const key of candidateKeys) {
    try {
      const res = await db.collection(PATIENTS_COLLECTION).doc(key).get();
      if (res && res.data) {
        patientDoc = { _id: key, ...res.data };
        break;
      }
    } catch (error) {
      const code = error && (error.errCode !== undefined ? error.errCode : error.code);
      if (
        code !== -1 &&
        code !== 'DOCUMENT_NOT_FOUND' &&
        code !== 'DATABASE_DOCUMENT_NOT_EXIST'
      ) {
        console.warn('findPatientDoc direct lookup failed', key, error);
      }
    }
  }

  if (!patientDoc) {
    for (const key of candidateKeys) {
      try {
        const res = await db
          .collection(PATIENTS_COLLECTION)
          .where({ recordKey: key })
          .limit(1)
          .get();
        if (assignFromSnapshot(res)) {
          break;
        }
      } catch (error) {
        console.warn('findPatientDoc by recordKey failed', key, error);
      }
    }
  }

  if (!patientDoc) {
    for (const key of candidateKeys) {
      try {
        const res = await db
          .collection(PATIENTS_COLLECTION)
          .where({ excelRecordKeys: key })
          .limit(1)
          .get();
        if (assignFromSnapshot(res)) {
          break;
        }
      } catch (error) {
        console.warn('findPatientDoc by excelRecordKeys failed', key, error);
      }
    }
  }

  if (!patientDoc) {
    for (const key of candidateKeys) {
      try {
        const res = await db
          .collection(PATIENTS_COLLECTION)
          .where({ patientName: key })
          .limit(1)
          .get();
        if (assignFromSnapshot(res)) {
          break;
        }
      } catch (error) {
        console.warn('findPatientDoc by patientName failed', key, error);
      }
    }
  }

  if (!patientDoc) {
    throw makeError('PATIENT_NOT_FOUND', '未找到对应的住户档案');
  }

  const recordKeys = new Set();
  const patientKeys = new Set();

  const pushRecordKey = value => {
    const normalized = normalizeKeyCandidate(value);
    if (normalized) {
      recordKeys.add(normalized);
    }
  };

  const pushPatientKey = value => {
    const normalized = normalizeKeyCandidate(value);
    if (normalized) {
      patientKeys.add(normalized);
    }
  };

  pushRecordKey(options && options.recordKey);
  pushRecordKey(patientDoc.recordKey);
  pushRecordKey(patientDoc.key);
  pushRecordKey(patientDoc.patientName);
  if (Array.isArray(patientDoc.excelRecordKeys)) {
    patientDoc.excelRecordKeys.forEach(pushRecordKey);
  }

  pushPatientKey(options && options.patientKey);
  pushPatientKey(patientDoc._id);
  pushPatientKey(patientDoc.patientKey);
  pushPatientKey(patientDoc.key);

  return {
    patientDoc,
    recordKeys,
    patientKeys,
  };
}

async function deleteExcelRecordsByKeys(recordKeys) {
  const keys = Array.isArray(recordKeys) ? recordKeys.slice() : [];
  const uniqueKeys = keys
    .map(item => normalizeKeyCandidate(item))
    .filter(item => !!item);
  if (!uniqueKeys.length) {
    return 0;
  }

  await ensureCollectionExists(db, EXCEL_RECORDS_COLLECTION);

  let removed = 0;
  const chunkSize = 10;
  for (let i = 0; i < uniqueKeys.length; i += chunkSize) {
    const chunk = uniqueKeys.slice(i, i + chunkSize);
    const condition = { key: _.in(chunk) };
    try {
      const res = await db
        .collection(EXCEL_RECORDS_COLLECTION)
        .where(condition)
        .remove();
      removed += (res && res.stats && res.stats.removed) || 0;
    } catch (error) {
      throw makeError('DELETE_EXCEL_FAILED', '删除Excel导入记录失败', {
        error: error && error.message,
      });
    }
  }

  return removed;
}

async function deleteIntakeRecordsByPatientKeys(patientKeys) {
  const keys = Array.isArray(patientKeys) ? patientKeys.slice() : [];
  const uniqueKeys = keys
    .map(item => normalizeKeyCandidate(item))
    .filter(item => !!item);
  if (!uniqueKeys.length) {
    return 0;
  }

  await ensureCollectionExists(db, PATIENT_INTAKE_COLLECTION);

  try {
    const res = await db
      .collection(PATIENT_INTAKE_COLLECTION)
      .where({ patientKey: _.in(uniqueKeys) })
      .remove();
    return (res && res.stats && res.stats.removed) || 0;
  } catch (error) {
    throw makeError('DELETE_INTAKE_FAILED', '删除入住记录失败', {
      error: error && error.message,
    });
  }
}

async function deletePatientMediaAssets(patientKeysSet) {
  const keys = Array.isArray(patientKeysSet)
    ? patientKeysSet
    : patientKeysSet instanceof Set
      ? Array.from(patientKeysSet)
      : [];
  const uniqueKeys = keys
    .map(item => normalizeKeyCandidate(item))
    .filter(item => !!item);
  if (!uniqueKeys.length) {
    return { mediaRemoved: 0, filesRemoved: 0, quotaRemoved: 0 };
  }

  await ensureCollectionExists(db, PATIENT_MEDIA_COLLECTION);

  const processedKeys = new Set();
  const fileIds = new Set();
  let mediaRemoved = 0;
  let quotaRemoved = 0;

  for (const key of uniqueKeys) {
    if (processedKeys.has(key)) {
      continue;
    }
    processedKeys.add(key);

    let skip = 0;
    const batchSize = 50;
    while (true) {
      let res;
      try {
        res = await db
          .collection(PATIENT_MEDIA_COLLECTION)
          .where({ patientKey: key })
          .skip(skip)
          .limit(batchSize)
          .get();
      } catch (error) {
        console.warn('加载附件以删除失败', key, error);
        break;
      }

      const docs = (res && res.data) || [];
      if (!docs.length) {
        break;
      }

      for (const doc of docs) {
        if (!doc || !doc._id) {
          continue;
        }
        if (doc.storageFileId) {
          fileIds.add(doc.storageFileId);
        }
        if (doc.thumbFileId) {
          fileIds.add(doc.thumbFileId);
        }
        try {
          const removeRes = await db.collection(PATIENT_MEDIA_COLLECTION).doc(doc._id).remove();
          mediaRemoved += (removeRes && removeRes.stats && removeRes.stats.removed) || 0;
        } catch (error) {
          console.warn('删除附件记录失败', doc._id, error);
        }
      }

      if (docs.length < batchSize) {
        break;
      }
      skip += docs.length;
    }

    try {
      await ensureCollectionExists(db, PATIENT_MEDIA_QUOTA_COLLECTION);
      const quotaRes = await db
        .collection(PATIENT_MEDIA_QUOTA_COLLECTION)
        .where({ patientKey: key })
        .remove();
      quotaRemoved += (quotaRes && quotaRes.stats && quotaRes.stats.removed) || 0;
    } catch (error) {
      console.warn('删除附件配额失败', key, error);
    }
  }

  const files = Array.from(fileIds).filter(item => !!item);
  if (files.length) {
    const chunkSize = 50;
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      try {
        await cloud.deleteFile({ fileList: chunk });
      } catch (error) {
        console.warn('删除云存储文件失败', chunk, error);
      }
    }
  }

  return {
    mediaRemoved,
    filesRemoved: files.length,
    quotaRemoved,
  };
}

async function invalidatePatientListCache() {
  try {
    await ensureCollectionExists(db, EXCEL_CACHE_COLLECTION);
    await db.collection(EXCEL_CACHE_COLLECTION).doc(PATIENT_CACHE_DOC_ID).remove();
  } catch (error) {
    const code = error && (error.errCode !== undefined ? error.errCode : error.code);
    if (
      code !== -1 &&
      code !== 'DOCUMENT_NOT_FOUND' &&
      code !== 'DATABASE_DOCUMENT_NOT_EXIST'
    ) {
      console.warn('清理患者列表缓存失败', error);
    }
  }
}

async function writeDeletionLog(patientDoc, summary, operator) {
  try {
    await ensureCollectionExists(db, PATIENT_OPERATION_LOGS_COLLECTION);
    await db.collection(PATIENT_OPERATION_LOGS_COLLECTION).add({
      data: {
        patientKey: patientDoc && patientDoc._id,
        type: 'delete',
        createdAt: Date.now(),
        createdBy: operator || '',
        metadata: {
          patientName: patientDoc && patientDoc.patientName,
          recordKey: patientDoc && patientDoc.recordKey,
          removed: summary,
        },
      },
    });
  } catch (error) {
    console.warn('记录住户删除日志失败', patientDoc && patientDoc._id, error);
  }
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
  const tryAssignPatientDoc = async queryPromise => {
    try {
      const snapshot = await queryPromise;
      if (snapshot && snapshot.data && snapshot.data.length) {
        const doc = snapshot.data[0];
        const docId = doc._id || doc.id || doc.patientKey || normalizedKey;
        patientDoc = { _id: docId, ...doc };
        if (Array.isArray(patientDoc.excelRecordKeys)) {
          patientDoc.excelRecordKeys.forEach(key => {
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
      db.collection(PATIENTS_COLLECTION).where({ excelRecordKeys: normalizedKey }).limit(1).get()
    );
  }

  if (!patientDoc) {
    // 最后尝试患者姓名匹配
    await tryAssignPatientDoc(
      db.collection(PATIENTS_COLLECTION).where({ patientName: normalizedKey }).limit(1).get()
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

    const fallbackContacts = [];
    const contactKeys = new Set();
    const addContact = contact => {
      if (!contact || typeof contact !== 'object') {
        return;
      }
      const role = contact.role || 'other';
      const name = normalizeSpacing(contact.name || contact.raw || '');
      const phone = normalizeSpacing(contact.phone || '');
      const idNumber = normalizeSpacing(contact.idNumber || '');
      const raw = normalizeSpacing(
        contact.raw || [name, phone, idNumber].filter(Boolean).join(' ')
      );
      const key = [role, name.replace(/\s+/g, '').toLowerCase(), phone].join('|');
      if (!key.trim()) {
        return;
      }
      if (!contactKeys.has(key)) {
        contactKeys.add(key);
        fallbackContacts.push({ role, name, phone, idNumber, raw });
      }
    };

    const addRawContact = (role, rawValue) => {
      const normalized = normalizeSpacing(rawValue);
      if (!normalized) {
        return;
      }
      const segments =
        role === 'other'
          ? normalized
              .replace(/[、，,]/g, '、')
              .split('、')
              .map(item => normalizeSpacing(item))
              .filter(Boolean)
          : [normalized];
      segments.forEach(segment => {
        const parsed = parseFamilyContact(segment, role);
        if (parsed) {
          addContact(parsed);
        }
      });
    };

    addRawContact(
      'father',
      patientDoc.fatherInfo ||
        formatGuardian(patientDoc.fatherContactName, patientDoc.fatherContactPhone)
    );
    addRawContact(
      'mother',
      patientDoc.motherInfo ||
        formatGuardian(patientDoc.motherContactName, patientDoc.motherContactPhone)
    );
    addRawContact(
      'other',
      patientDoc.guardianInfo ||
        formatGuardian(patientDoc.guardianContactName, patientDoc.guardianContactPhone)
    );
    (Array.isArray(patientDoc.familyContacts) ? patientDoc.familyContacts : []).forEach(addContact);

    const contactToString = contact => {
      if (!contact) {
        return '';
      }
      const parts = [contact.name, contact.phone, contact.idNumber]
        .map(part => normalizeSpacing(part))
        .filter(Boolean);
      if (parts.length) {
        return parts.join(' ');
      }
      return normalizeSpacing(contact.raw || '');
    };

    const patient = {
      key: patientDoc._id || patientKey,
      patientName: patientDoc.patientName || '',
      gender: patientDoc.gender || '',
      birthDate: patientDoc.birthDate || '',
      idNumber: patientDoc.idNumber || '',
      nativePlace: patientDoc.nativePlace || '',
      ethnicity: patientDoc.ethnicity || '',
      latestHospital: patientDoc.latestHospital || '',
      latestDoctor: patientDoc.latestDoctor || '',
      fatherInfo: contactToString(fallbackContacts.find(contact => contact.role === 'father')),
      motherInfo: contactToString(fallbackContacts.find(contact => contact.role === 'mother')),
      otherGuardian: contactToString(fallbackContacts.find(contact => contact.role === 'other')),
      familyEconomy: patientDoc.familyEconomy || '',
      familyContacts: fallbackContacts,
    };

    const basicInfo = buildList([
      ['性别', patientDoc.gender],
      ['出生日期', patientDoc.birthDate],
      ['身份证号', patientDoc.idNumber],
      ['籍贯', patientDoc.nativePlace],
      ['民族', patientDoc.ethnicity],
      ['联系电话', patientDoc.phone],
    ]);

    const familyInfo = buildList([
      ['家庭地址', patientDoc.address],
      ['紧急联系人', patientDoc.emergencyContact],
      ['紧急联系电话', patientDoc.emergencyPhone],
      ['备用联系人', patientDoc.backupContact],
      ['备用联系电话', patientDoc.backupPhone],
      [
        '父亲联系方式',
        contactToString(fallbackContacts.find(contact => contact.role === 'father')),
      ],
      [
        '母亲联系方式',
        contactToString(fallbackContacts.find(contact => contact.role === 'mother')),
      ],
      ['其他监护人', contactToString(fallbackContacts.find(contact => contact.role === 'other'))],
    ]);

    const economicInfo = buildList([['家庭经济情况', patientDoc.familyEconomy]]);

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
            intakeId: item.intakeId || item._id || '',
          }))
        : [];
    } catch (intakeError) {
      console.warn(
        'patientProfile fallback failed to load intake records',
        patientKey,
        intakeError
      );
    }

    return {
      patient,
      basicInfo,
      familyInfo,
      economicInfo,
      familyContacts: fallbackContacts,
      records,
    };
  } catch (error) {
    console.warn('patientProfile fallback failed', patientKey, error);
    return null;
  }
}

// Format patient detail
function formatPatientDetail(group, patientDoc) {
  const latest = group.records[0] || {};

  const pickRecordValue = getter => {
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
      .filter(item => item.value);
  };

  const contactsFromGroup = Array.isArray(group.familyContacts) ? group.familyContacts : [];
  const contactsFromPatientDoc =
    patientDoc && Array.isArray(patientDoc.familyContacts) ? patientDoc.familyContacts : [];
  const contactKeys = new Set();
  const mergedContacts = [];

  const addContacts = (list = []) => {
    list.forEach(contact => {
      if (!contact || typeof contact !== 'object') {
        return;
      }
      const role = contact.role || 'other';
      const name = normalizeSpacing(contact.name || contact.raw || '');
      const phone = normalizeSpacing(contact.phone || '');
      const idNumber = normalizeSpacing(contact.idNumber || '');
      const raw = normalizeSpacing(
        contact.raw || [name, phone, idNumber].filter(Boolean).join(' ')
      );
      const key = [role, name.replace(/\s+/g, '').toLowerCase(), phone].join('|');
      if (!key.trim()) {
        return;
      }
      if (!contactKeys.has(key)) {
        contactKeys.add(key);
        mergedContacts.push({ role, name, phone, idNumber, raw });
      }
    });
  };

  addContacts(contactsFromGroup);
  addContacts(contactsFromPatientDoc);

  const contactToString = contact => {
    if (!contact) {
      return '';
    }
    const parts = [contact.name, contact.phone, contact.idNumber]
      .map(part => normalizeSpacing(part))
      .filter(Boolean);
    if (parts.length) {
      return parts.join(' ');
    }
    return normalizeSpacing(contact.raw || '');
  };

  const fatherContact = mergedContacts.find(contact => contact.role === 'father');
  const motherContact = mergedContacts.find(contact => contact.role === 'mother');
  const guardianContact = mergedContacts.find(contact => contact.role === 'other');

  const fatherInfoValue =
    contactToString(fatherContact) ||
    pickRecordValue(record => record.fatherInfo) ||
    (patientDoc &&
      (patientDoc.fatherInfo ||
        formatGuardian(patientDoc.fatherContactName, patientDoc.fatherContactPhone)));

  const motherInfoValue =
    contactToString(motherContact) ||
    pickRecordValue(record => record.motherInfo) ||
    (patientDoc &&
      (patientDoc.motherInfo ||
        formatGuardian(patientDoc.motherContactName, patientDoc.motherContactPhone)));

  const otherGuardianValue =
    contactToString(guardianContact) ||
    pickRecordValue(record => record.otherGuardian) ||
    (patientDoc &&
      (patientDoc.guardianInfo ||
        formatGuardian(patientDoc.guardianContactName, patientDoc.guardianContactPhone)));

  const economicValue =
    pickRecordValue(record => record.familyEconomy) || (patientDoc && patientDoc.familyEconomy);

  const basicInfo = buildInfoList([
    { label: '性别', value: group.gender || latest.gender },
    { label: '出生日期', value: group.birthDate || latest.birthDate },
    { label: '身份证号', value: group.idNumber || latest.idNumber },
    { label: '籍贯', value: group.nativePlace || latest.nativePlace },
    { label: '民族', value: group.ethnicity || latest.ethnicity },
    { label: '主要照护人', value: group.summaryCaregivers },
  ]);

  const familyInfo = buildInfoList([
    {
      label: '家庭地址',
      value: pickRecordValue(record => record.address) || (patientDoc && patientDoc.address),
    },
    { label: '父亲联系方式', value: fatherInfoValue },
    { label: '母亲联系方式', value: motherInfoValue },
    { label: '其他监护人', value: otherGuardianValue },
    { label: '紧急联系人', value: patientDoc && patientDoc.emergencyContact },
    { label: '紧急联系电话', value: patientDoc && patientDoc.emergencyPhone },
  ]);

  // Build economic info
  const economicInfo = buildInfoList([{ label: '家庭经济情况', value: economicValue }]);

  // Build medical records
  const dedupeSet = new Set();
  const records = (Array.isArray(group.records) ? group.records : []).reduce(
    (acc, record, index) => {
      if (!record) {
        return acc;
      }

      const admissionDateText = normalizeValue(record.admissionDate);
      const admissionTimestamp = normalizeTimestamp(
        record.admissionTimestamp || record._importedAt || record.updatedAt
      );
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
        followUpPlan,
      ].join('|');

      if (dedupeSet.has(dedupeKey)) {
        return acc;
      }
      dedupeSet.add(dedupeKey);

      const situationText =
        normalizeSpacing(record.situation) ||
        normalizeSpacing(record.symptoms) ||
        normalizeSpacing(record.treatmentProcess) ||
        normalizeSpacing(record.diagnosis);

      const medicalInfo = {
        hospital,
        diagnosis,
        doctor,
        symptoms,
        treatmentProcess,
        followUpPlan,
      };

      Object.keys(medicalInfo).forEach(key => {
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
        intakeInfo:
          situationText || followUpPlan
            ? {
                intakeTime: admissionTimestamp || null,
                situation: situationText,
                followUpPlan,
              }
            : undefined,
      });

      return acc;
    },
    []
  );

  return {
    patient: {
      key: group.key,
      patientName: group.patientName,
      gender: group.gender || latest.gender || '',
      birthDate: group.birthDate || latest.birthDate || '',
      idNumber: group.idNumber || latest.idNumber || '',
      latestHospital: group.latestHospital,
      latestDoctor: group.latestDoctor,
      fatherInfo: fatherInfoValue || '',
      motherInfo: motherInfoValue || '',
      otherGuardian: otherGuardianValue || '',
      familyEconomy: economicValue || '',
      familyContacts: mergedContacts,
    },
    basicInfo,
    familyInfo,
    economicInfo,
    familyContacts: mergedContacts,
    records,
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
      includeTotal,
    });

    return {
      success: true,
      patients: result.patients,
      totalCount: result.totalCount !== undefined ? result.totalCount : result.patients.length,
      hasMore: result.hasMore,
      nextPage: result.nextPage,
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
      ...patientDetail,
    };
  } catch (error) {
    if (error && error.code === 'PATIENT_NOT_FOUND') {
      const fallbackDetail = await fetchFallbackPatientDetail(key);
      if (fallbackDetail) {
        console.warn('patientProfile detail fallback to patients collection', key);
        return {
          success: true,
          ...fallbackDetail,
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

async function handleDeletePatient(event = {}) {
  const patientKeyInput = event.patientKey;
  const recordKeyInput = event.recordKey;

  if (!patientKeyInput && !recordKeyInput) {
    throw makeError('INVALID_PATIENT_KEY', '缺少住户标识');
  }

  const context = cloud.getWXContext();
  const operator = event.operator || context.OPENID || context.UNIONID || 'mini-program';

  const lookup = await findPatientDocForDeletion({
    patientKey: patientKeyInput,
    recordKey: recordKeyInput,
  });
  const patientDoc = lookup.patientDoc;
  const recordKeys = Array.from(lookup.recordKeys);
  const patientKeys = Array.from(lookup.patientKeys);

  const mediaSummary = await deletePatientMediaAssets(patientKeys);
  const excelRemoved = await deleteExcelRecordsByKeys(recordKeys);
  const intakeRemoved = await deleteIntakeRecordsByPatientKeys(patientKeys);

  let patientRemoved = 0;
  try {
    const res = await db.collection(PATIENTS_COLLECTION).doc(patientDoc._id).remove();
    patientRemoved = (res && res.stats && res.stats.removed) || 0;
  } catch (error) {
    throw makeError('DELETE_PATIENT_FAILED', '删除住户档案失败', {
      error: error && error.message,
    });
  }

  await invalidatePatientListCache();

  const removalSummary = {
    patient: patientRemoved,
    intakeRecords: intakeRemoved,
    excelRecords: excelRemoved,
    mediaRecords: mediaSummary.mediaRemoved,
    mediaFiles: mediaSummary.filesRemoved,
    mediaQuota: mediaSummary.quotaRemoved,
  };

  await writeDeletionLog(patientDoc, removalSummary, operator);

  return {
    success: true,
    patientKey: patientDoc._id,
    removed: removalSummary,
  };
}

// Main function
exports.main = async event => {
  const action = event.action || '';

  try {
    switch (action) {
      case 'list':
        return await handleGetPatientsList(event);
      case 'detail':
        return await handleGetPatientDetail(event);
      case 'delete':
        return await handleDeletePatient(event);
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
        details: error.details || null,
      },
    };
  }
};
