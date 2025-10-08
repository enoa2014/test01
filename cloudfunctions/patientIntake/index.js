const cloud = require('wx-server-sdk');
const { v4: uuidv4 } = require('uuid');

const {
  normalizeSpacing,
  ensureCollectionExists,
  shouldCountIntakeRecord,
  dedupeIntakeRecords,
  extractRecordTimestampForKey,
  resolveRecordValue,
} = require('./utils/patient');

const createExcelSync = require('./excel-sync');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 集合名称
const PATIENTS_COLLECTION = 'patients';
const PATIENT_INTAKE_COLLECTION = 'patient_intake_records';
const PATIENT_INTAKE_DRAFTS_COLLECTION = 'patient_intake_drafts';
const INTAKE_CONFIG_COLLECTION = 'intake_config';
const EXCEL_RECORDS_COLLECTION = 'excel_records';
const PATIENT_OPERATION_LOGS_COLLECTION = 'patient_operation_logs';
const EXCEL_CACHE_COLLECTION = 'excel_cache';
const PATIENT_CACHE_DOC_ID = 'patients_summary_cache';

// 配置常量
const DRAFT_EXPIRE_DAYS = 7;
const SITUATION_MIN_LENGTH = 0;
const SITUATION_MAX_LENGTH = 500;
const SITUATION_KEYWORDS = [];
const MAX_INTAKE_QUERY_LIMIT = 100; // fetch limit for intake history queries
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeCareStatusValue = value => {
  const text = normalizeString(value);
  if (!text) {
    return '';
  }
  const lower = text.toLowerCase();
  if (['in_care', 'incare', 'in-care', 'active', '入住', '在住'].includes(lower)) {
    return 'in_care';
  }
  if (['pending', 'followup', 'follow_up', '待入住', '待随访', '随访'].includes(lower)) {
    return 'pending';
  }
  if (['discharged', 'left', 'checkout', 'checkedout', 'checked-out', '已离开', '已出院', '离开'].includes(lower)) {
    return 'discharged';
  }
  return '';
};

const deriveCareStatus = (patientDoc = {}, summary = null) => {
  const checkoutAtRaw =
    patientDoc.checkoutAt ||
    (patientDoc.data && patientDoc.data.checkoutAt) ||
    (patientDoc.metadata && patientDoc.metadata.checkoutAt);
  const checkoutAt = Number(checkoutAtRaw);
  if (Number.isFinite(checkoutAt) && checkoutAt > 0) {
    return 'discharged';
  }

  const baseStatus = normalizeCareStatusValue(
    patientDoc.careStatus || (patientDoc.data && patientDoc.data.careStatus)
  );
  if (baseStatus) {
    return baseStatus;
  }

  const latestTimestamp = Number(
    (summary && summary.latestTimestamp) ||
      patientDoc.latestAdmissionTimestamp ||
      (patientDoc.data && patientDoc.data.latestAdmissionTimestamp)
  );
  if (Number.isFinite(latestTimestamp) && latestTimestamp > 0) {
    const now = Date.now();
    if (latestTimestamp > now) {
      return 'pending';
    }
    const diffDays = Math.floor((now - latestTimestamp) / DAY_IN_MS);
    if (diffDays <= 30) {
      return 'in_care';
    }
    if (diffDays <= 90) {
      return 'pending';
    }
  }

  return 'discharged';
};

async function invalidatePatientSummaryCache() {
  try {
    await ensureCollection(EXCEL_CACHE_COLLECTION);
    await db
      .collection(EXCEL_CACHE_COLLECTION)
      .doc(PATIENT_CACHE_DOC_ID)
      .set({
        data: {
          patients: [],
          totalCount: 0,
          hasMore: true,
          limit: 0,
          updatedAt: 0,
          invalidatedAt: Date.now(),
        },
      });
  } catch (error) {
    console.warn('invalidatePatientSummaryCache failed', error);
  }
}

// 工具函数
function makeError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function normalizeString(value) {
  return normalizeSpacing(value);
}

function validateChineseId(idNumber) {
  if (!idNumber) {
    return false;
  }
  const value = String(idNumber).trim().toUpperCase();
  const pattern18 = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9X]$/;
  const pattern15 = /^[1-9]\d{7}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}$/;

  if (pattern15.test(value)) {
    return true;
  }

  if (!pattern18.test(value)) {
    return false;
  }

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const validateCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  const digits = value.split('');
  const sum = digits
    .slice(0, 17)
    .reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
  const code = validateCodes[sum % 11];
  return code === digits[17];
}

function generatePatientKey() {
  return `P${Date.now()}_${uuidv4().slice(0, 8)}`;
}

function generateIntakeId() {
  return `I${Date.now()}_${uuidv4().slice(0, 8)}`;
}

const ensureCollection = name => ensureCollectionExists(db, name);

const { ensurePatientDoc, syncExcelRecordsToIntake, syncPatientAggregates } = createExcelSync({
  db,
  collections: {
    PATIENTS_COLLECTION,
    PATIENT_INTAKE_COLLECTION,
    EXCEL_RECORDS_COLLECTION,
    EXCEL_CACHE_COLLECTION,
    PATIENT_CACHE_DOC_ID,
  },
});

async function writePatientOperationLog(logEntry) {
  await ensureCollection(PATIENT_OPERATION_LOGS_COLLECTION);
  const now = Date.now();
  const entry = {
    patientKey: logEntry.patientKey,
    action: logEntry.action || 'patient-detail-edit',
    operatorId: logEntry.operatorId || '',
    operatorName: logEntry.operatorName || '',
    changes: Array.isArray(logEntry.changes) ? logEntry.changes : [],
    message: logEntry.message || '',
    createdAt: now,
    extra: logEntry.extra || {},
  };

  await db.collection(PATIENT_OPERATION_LOGS_COLLECTION).add({ data: entry });
}

function assignNestedUpdates(target, source, prefix, allowedKeys) {
  if (!source || typeof source !== 'object') {
    return;
  }
  allowedKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      target[`${prefix}.${key}`] = source[key];
    }
  });
}

// 校验表单数据
function validateFormData(formData) {
  const errors = {};

  // 必填字段校验
  const requiredFields = [
    { key: 'patientName', label: '患者姓名' },
    { key: 'idNumber', label: '证件号码' },
    { key: 'gender', label: '性别' },
    { key: 'birthDate', label: '出生日期' },
    { key: 'address', label: '常住地址' },
  ];

  for (const field of requiredFields) {
    const value = normalizeString(formData[field.key]);
    if (!value) {
      errors[field.key] = `${field.label}不能为空`;
    }
  }

  // 证件号码格式校验
  if (formData.idType === '身份证' && formData.idNumber) {
    const idNumber = normalizeString(formData.idNumber);
    if (!validateChineseId(idNumber)) {
      errors.idNumber = '身份证号码格式不正确';
    }
  }

  // 手机号码校验
  const phoneFields = ['phone', 'backupPhone'];
  for (const field of phoneFields) {
    const phone = normalizeString(formData[field]);
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      errors[field] = '手机号码格式不正确';
    }
  }

  // 必填手机号码校验
  // 情况说明校验
  const situation = normalizeString(formData.situation);
  if (situation && situation.length > SITUATION_MAX_LENGTH) {
    errors.situation = `情况说明不能超过${SITUATION_MAX_LENGTH}字`;
  }

  const longTextFields = [
    { key: 'hospitalDiagnosis', label: '医院诊断' },
    { key: 'symptomDetail', label: '症状详情' },
    { key: 'treatmentProcess', label: '医治过程' },
    { key: 'followUpPlan', label: '后续治疗安排' },
  ];

  longTextFields.forEach(field => {
    const value = normalizeString(formData[field.key]);
    if (value && value.length > SITUATION_MAX_LENGTH) {
      errors[field.key] = `${field.label}不能超过${SITUATION_MAX_LENGTH}字`;
    }
  });

  // 日期校验
  if (formData.birthDate) {
    const birthDate = new Date(formData.birthDate);
    const today = new Date();
    if (isNaN(birthDate.getTime())) {
      errors.birthDate = '出生日期格式不正确';
    } else if (birthDate > today) {
      errors.birthDate = '出生日期不能晚于今天';
    } else if (birthDate.getFullYear() < 1900) {
      errors.birthDate = '出生日期不能早于1900年';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// 获取患者列表（用于选择）
async function handleGetPatients(event) {
  const { searchKeyword = '', page = 0, pageSize = 20 } = event;

  await ensureCollection(PATIENTS_COLLECTION);

  let query = db.collection(PATIENTS_COLLECTION);

  // 搜索过滤
  if (searchKeyword) {
    const keyword = normalizeString(searchKeyword).toLowerCase();
    query = query.where(
      _.or([
        { patientName: db.RegExp({ regexp: keyword, options: 'i' }) },
        { idNumber: db.RegExp({ regexp: keyword, options: 'i' }) },
        { phone: db.RegExp({ regexp: keyword, options: 'i' }) },
      ])
    );
  }

  // 分页查询
  const skip = page * pageSize;
  const res = await query.orderBy('updatedAt', 'desc').skip(skip).limit(pageSize).get();

  const patients = (res.data || []).map(patient => ({
    key: patient._id,
    patientName: patient.patientName,
    gender: patient.gender,
    birthDate: patient.birthDate,
    idNumber: patient.idNumber,
    phone: patient.phone,
    admissionCount: patient.admissionCount || 0,
    latestAdmissionDate: patient.latestAdmissionDate,
    updatedAt: patient.updatedAt,
  }));

  return {
    success: true,
    data: {
      patients,
      hasMore: patients.length === pageSize,
    },
  };
}

async function handleCreatePatient(event) {
  const payload = (event && event.formData) || {};
  const normalizedForm = {
    patientName: normalizeString(payload.patientName),
    idType: normalizeString(payload.idType) || '身份证',
    idNumber: normalizeString(payload.idNumber),
    gender: normalizeString(payload.gender),
    birthDate: normalizeString(payload.birthDate),
    phone: normalizeString(payload.phone),
    address: normalizeString(payload.address),
    backupContact: normalizeString(payload.backupContact),
    backupPhone: normalizeString(payload.backupPhone),
    situation: normalizeString(payload.situation),
    visitHospital: normalizeString(payload.visitHospital),
    hospitalDiagnosis: normalizeString(payload.hospitalDiagnosis),
    attendingDoctor: normalizeString(payload.attendingDoctor),
    symptomDetail: normalizeString(payload.symptomDetail),
    treatmentProcess: normalizeString(payload.treatmentProcess),
    followUpPlan: normalizeString(payload.followUpPlan),
    fatherInfo: normalizeString(payload.fatherInfo),
    fatherContactName: normalizeString(payload.fatherContactName),
    fatherContactPhone: normalizeString(payload.fatherContactPhone),
    motherInfo: normalizeString(payload.motherInfo),
    motherContactName: normalizeString(payload.motherContactName),
    motherContactPhone: normalizeString(payload.motherContactPhone),
    guardianInfo: normalizeString(payload.guardianInfo),
    guardianContactName: normalizeString(payload.guardianContactName),
    guardianContactPhone: normalizeString(payload.guardianContactPhone),
  };

  const validation = validateFormData({
    ...normalizedForm,
    situation: normalizedForm.situation || '',
  });

  if (!validation.valid) {
    throw makeError('VALIDATION_ERROR', '表单数据校验失败', {
      errors: validation.errors,
    });
  }

  await ensureCollection(PATIENTS_COLLECTION);

  const patientKey = generatePatientKey();
  const now = Date.now();
  const patientRecord = {
    patientName: normalizedForm.patientName,
    idType: normalizedForm.idType,
    idNumber: normalizedForm.idNumber,
    gender: normalizedForm.gender,
    birthDate: normalizedForm.birthDate,
    phone: normalizedForm.phone,
    address: normalizedForm.address,
    backupContact: normalizedForm.backupContact,
    backupPhone: normalizedForm.backupPhone,
    lastIntakeNarrative: normalizedForm.situation,
    latestHospital: normalizedForm.visitHospital || '',
    latestDiagnosis: normalizedForm.hospitalDiagnosis || '',
    latestDoctor: normalizedForm.attendingDoctor || '',
    admissionCount: 0,
    careStatus: 'pending',
    checkoutReason: '',
    checkoutNote: '',
    checkoutAt: null,
    createdAt: now,
    updatedAt: now,
    data: {
      patientName: normalizedForm.patientName,
      idType: normalizedForm.idType,
      idNumber: normalizedForm.idNumber,
      gender: normalizedForm.gender,
      birthDate: normalizedForm.birthDate,
      phone: normalizedForm.phone,
      address: normalizedForm.address,
      backupContact: normalizedForm.backupContact,
      backupPhone: normalizedForm.backupPhone,
      admissionCount: 0,
      latestAdmissionDate: null,
      latestAdmissionTimestamp: null,
      firstAdmissionDate: null,
      latestHospital: normalizedForm.visitHospital || '',
      latestDiagnosis: normalizedForm.hospitalDiagnosis || '',
      latestDoctor: normalizedForm.attendingDoctor || '',
      careStatus: 'pending',
      checkoutAt: null,
      checkoutReason: '',
      checkoutNote: '',
      updatedAt: now,
    },
    metadata: {
      source: 'manual-create',
      createdBy: event && event.operatorId ? event.operatorId : '',
      createdFrom: 'patient-create',
    },
    fatherInfo: normalizedForm.fatherInfo || '',
    fatherContactName: normalizedForm.fatherContactName || '',
    fatherContactPhone: normalizedForm.fatherContactPhone || '',
    motherInfo: normalizedForm.motherInfo || '',
    motherContactName: normalizedForm.motherContactName || '',
    motherContactPhone: normalizedForm.motherContactPhone || '',
    guardianInfo: normalizedForm.guardianInfo || '',
    guardianContactName: normalizedForm.guardianContactName || '',
    guardianContactPhone: normalizedForm.guardianContactPhone || '',
    excelRecordKeys: [],
  };

  await db.collection(PATIENTS_COLLECTION).doc(patientKey).set({ data: patientRecord });

  await invalidatePatientSummaryCache();

  if (payload && payload.audit) {
    try {
      await writePatientOperationLog({
        patientKey,
        action: 'patient-create',
        operatorId: payload.audit.operatorId || '',
        operatorName: payload.audit.operatorName || '',
        changes: payload.audit.changes || [],
        message: payload.audit.message || '新建住户档案',
      });
    } catch (error) {
      console.warn('writePatientOperationLog failed for createPatient', patientKey, error);
    }
  }

  return {
    success: true,
    data: {
      patientKey,
      createdAt: now,
    },
  };
}

async function handleGetAllIntakeRecords(event) {
  const { patientKey, recordKey, patientName } = event;
  if (!patientKey) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }

  const excelKeys = [];
  if (recordKey) {
    excelKeys.push(recordKey);
  }
  if (patientName) {
    excelKeys.push(patientName);
  }

  const ensured = await ensurePatientDoc(patientKey, { excelKeys });
  const resolvedPatientKey = (ensured && ensured.patientKey) || patientKey;
  const patientDoc = ensured ? ensured.patientDoc : null;

  const syncExcelKeys = [...excelKeys];
  if (patientDoc && patientDoc.recordKey) {
    syncExcelKeys.push(patientDoc.recordKey);
  }
  if (patientDoc && patientDoc.patientName) {
    syncExcelKeys.push(patientDoc.patientName);
  }

  let summaryVersion = Date.now();
  let summaryCount = null;
  let summaryRecords = [];

  const syncResult = await syncExcelRecordsToIntake(resolvedPatientKey, {
    patientDoc,
    excelKeys: syncExcelKeys,
    forceSummary: true,
  });

  if (syncResult && syncResult.summary) {
    const { summary } = syncResult;
    if (summary && summary.count !== undefined) {
      summaryCount = Number(summary.count);
      if (!Number.isFinite(summaryCount)) {
        summaryCount = null;
      }
    }
    if (summary && Array.isArray(summary.records)) {
      summaryRecords = summary.records;
    }
    const versionCandidate = Number(
      summary.latestTimestamp || summary.updatedAt || summary.earliestTimestamp
    );
    if (Number.isFinite(versionCandidate) && versionCandidate > 0) {
      summaryVersion = versionCandidate;
    }
  }

  await ensureCollection(PATIENT_INTAKE_COLLECTION);

  try {
    const baseQuery = db
      .collection(PATIENT_INTAKE_COLLECTION)
      .where({ patientKey: resolvedPatientKey });
    const countRes = await baseQuery.count();
    const total = (countRes && countRes.total) || 0;

    if (!total) {
      const zeroCount = summaryCount !== null ? summaryCount : 0;
      return {
        success: true,
        data: {
          patientKey: resolvedPatientKey,
          totalCount: zeroCount,
          count: zeroCount,
          summaryVersion,
          records: [],
        },
      };
    }

    const batchSize = MAX_INTAKE_QUERY_LIMIT;
    const batchTimes = Math.max(1, Math.ceil(total / batchSize));
    const tasks = [];

    for (let i = 0; i < batchTimes; i++) {
      tasks.push(
        db
          .collection(PATIENT_INTAKE_COLLECTION)
          .where({ patientKey: resolvedPatientKey })
          .orderBy('updatedAt', 'desc')
          .orderBy('metadata.lastModifiedAt', 'desc')
          .skip(i * batchSize)
          .limit(batchSize)
          .get()
      );
    }

    const queryResults = await Promise.all(tasks);
    const rawIntakeRecords = [];

    queryResults.forEach(res => {
      if (res && Array.isArray(res.data)) {
        rawIntakeRecords.push(...res.data);
      }
    });

    const filteredRawRecords = rawIntakeRecords.filter(rawIntake => {
      if (!rawIntake) {
        return false;
      }
      const metadata = rawIntake.metadata || {};
      const recordId = typeof rawIntake._id === 'string' ? rawIntake._id : '';
      const isAggregatedBySource =
        metadata.source === 'excel-import' &&
        !metadata.excelRecordId &&
        recordId.indexOf(`${resolvedPatientKey}-excel`) === 0;
      const isAggregatedBySubmitter =
        (metadata.submittedBy === 'excel-import' || metadata.importMode === 'excel-import') &&
        recordId.endsWith('-excel');
      const isAggregatedByIdSuffix = recordId.endsWith('-excel') && !metadata.excelRecordId;

      if (isAggregatedBySource || isAggregatedBySubmitter || isAggregatedByIdSuffix) {
        return false;
      }
      return shouldCountIntakeRecord(rawIntake);
    });

    let dedupedRecords = [];
    if (summaryRecords && summaryRecords.length) {
      dedupedRecords = dedupeIntakeRecords(summaryRecords);
    } else {
      dedupedRecords = dedupeIntakeRecords(filteredRawRecords);
    }

    const sortedRecords = dedupedRecords.sort(
      (a, b) => extractRecordTimestampForKey(b) - extractRecordTimestampForKey(a)
    );

    const intakeRecords = sortedRecords.map(rawIntake => {
      const metadata = rawIntake.metadata || {};
      const intakeInfo = rawIntake.intakeInfo || {};
      const basicInfo = rawIntake.basicInfo || {};
      const medicalInfo = rawIntake.medicalInfo || {};
      const contactInfo = rawIntake.contactInfo || {};

      const hospital =
        resolveRecordValue(rawIntake, [
          ['medicalInfo', 'hospital'],
          'hospital',
          'hospitalDisplay',
          ['intakeInfo', 'hospital'],
        ]) || '';
      const diagnosis =
        resolveRecordValue(rawIntake, [
          ['medicalInfo', 'diagnosis'],
          'diagnosis',
          'diagnosisDisplay',
          ['intakeInfo', 'visitReason'],
        ]) || '';
      const doctor =
        resolveRecordValue(rawIntake, [
          ['medicalInfo', 'doctor'],
          'doctor',
          ['intakeInfo', 'doctor'],
        ]) || '';
      const followUpPlan =
        resolveRecordValue(rawIntake, [
          ['medicalInfo', 'followUpPlan'],
          'followUpPlan',
          ['intakeInfo', 'followUpPlan'],
        ]) || '';

      const medicalInfoPayload = {};
      ['hospital', 'diagnosis', 'doctor', 'symptoms', 'treatmentProcess', 'followUpPlan'].forEach(
        key => {
          const value = medicalInfo[key];
          if (value !== undefined && value !== null && value !== '') {
            medicalInfoPayload[key] = value;
          }
        }
      );
      const intakeInfoPayload = { ...intakeInfo };
      if (!intakeInfoPayload.followUpPlan && followUpPlan) {
        intakeInfoPayload.followUpPlan = followUpPlan;
      }
      if (!intakeInfoPayload.hospital && hospital) {
        intakeInfoPayload.hospital = hospital;
      }
      if (!intakeInfoPayload.doctor && doctor) {
        intakeInfoPayload.doctor = doctor;
      }

      const record = {
        intakeId: rawIntake._id,
        intakeTime: intakeInfo.intakeTime || rawIntake.intakeTime,
        situation: intakeInfo.situation || rawIntake.narrative,
        followUpPlan,
        patientName: basicInfo.patientName,
        gender: basicInfo.gender,
        birthDate: basicInfo.birthDate,
        idNumber: basicInfo.idNumber,
        primaryPhone: basicInfo.primaryPhone || contactInfo.primaryPhone,
        backupPhone: basicInfo.backupPhone || contactInfo.backupPhone,
        medicalHistory: medicalInfo.medicalHistory || intakeInfo.medicalHistory || [],
        currentCondition: medicalInfo.currentCondition,
        medications: medicalInfo.medications || [],
        allergies: medicalInfo.allergies || [],
        disabilities: medicalInfo.disabilities || [],
        careLevel: medicalInfo.careLevel,
        visitReason: medicalInfo.visitReason,
        symptoms: medicalInfo.symptoms,
        diagnosis: medicalInfo.diagnosis,
        treatmentPlan: medicalInfo.treatmentPlan,
        doctorNotes: medicalInfo.doctorNotes,
        createdAt: metadata.submittedAt || rawIntake.createdAt,
        updatedAt: rawIntake.updatedAt || metadata.lastModifiedAt,
        status: rawIntake.status || 'active',
        hospital,
        diagnosis,
        doctor,
        metadata,
      };

      if (Object.keys(medicalInfoPayload).length) {
        record.medicalInfo = medicalInfoPayload;
      }
      if (Object.keys(intakeInfoPayload).length) {
        record.intakeInfo = intakeInfoPayload;
      }

      const filteredRecord = {};
      Object.entries(record).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          if (!Array.isArray(value) || value.length > 0) {
            filteredRecord[key] = value;
          }
        }
      });
      return filteredRecord;
    });

    const dedupedCount = intakeRecords.length;
    const resolvedCount = summaryCount !== null ? summaryCount : dedupedCount;

    return {
      success: true,
      data: {
        patientKey: resolvedPatientKey,
        totalCount: resolvedCount,
        count: resolvedCount,
        summaryVersion,
        records: intakeRecords,
      },
    };
  } catch (error) {
    console.error('Failed to get intake records', resolvedPatientKey, error);
    return {
      success: true,
      data: {
        patientKey: resolvedPatientKey,
        totalCount: 0,
        count: 0,
        summaryVersion,
        records: [],
      },
    };
  }
}

// 获取患者详情
async function handleGetPatientDetail(event) {
  const { patientKey, recordKey, patientName } = event;
  if (!patientKey) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }

  const excelKeys = [];
  if (recordKey) {
    excelKeys.push(recordKey);
  }
  if (patientName) {
    excelKeys.push(patientName);
  }

  const ensured = await ensurePatientDoc(patientKey, { excelKeys });
  const resolvedPatientKey = (ensured && ensured.patientKey) || patientKey;
  const patient = ensured ? ensured.patientDoc : null;

  if (!patient) {
    throw makeError('PATIENT_NOT_FOUND', '患者不存在');
  }

  const syncExcelKeys = [...excelKeys];
  if (patient.recordKey) {
    syncExcelKeys.push(patient.recordKey);
  }
  if (patient.patientName) {
    syncExcelKeys.push(patient.patientName);
  }

  const syncResult = await syncExcelRecordsToIntake(resolvedPatientKey, {
    patientDoc: patient,
    excelKeys: syncExcelKeys,
    forceSummary: true,
  });
  const syncSummary = syncResult && syncResult.summary;

  if (syncSummary) {
    const nextData = patient && typeof patient.data === 'object' ? { ...patient.data } : {};
    nextData.admissionCount = syncSummary.count;
    if (syncSummary.earliestTimestamp) {
      nextData.firstAdmissionDate = syncSummary.earliestTimestamp;
    }
    if (syncSummary.latestTimestamp) {
      nextData.latestAdmissionDate = syncSummary.latestTimestamp;
      nextData.latestAdmissionTimestamp = syncSummary.latestTimestamp;
    }
    patient.data = nextData;
    patient.admissionCount = syncSummary.count;
    if (syncSummary.earliestTimestamp) {
      patient.firstAdmissionDate = syncSummary.earliestTimestamp;
    }
    if (syncSummary.latestTimestamp) {
      patient.latestAdmissionDate = syncSummary.latestTimestamp;
      patient.latestAdmissionTimestamp = syncSummary.latestTimestamp;
    }
    if (syncSummary.latestNarrative) {
      patient.lastIntakeNarrative = syncSummary.latestNarrative;
    }
    if (syncSummary.latestHospital) {
      patient.latestHospital = syncSummary.latestHospital;
    }
    if (syncSummary.latestDoctor) {
      patient.latestDoctor = syncSummary.latestDoctor;
    }
  }

  let resolvedCareStatus = null;
  let storedCareStatus = '';
  if (patient) {
    resolvedCareStatus = deriveCareStatus(patient, syncSummary);
    storedCareStatus = normalizeCareStatusValue(
      patient.careStatus || (patient.data && patient.data.careStatus)
    );
    if (resolvedCareStatus) {
      patient.careStatus = resolvedCareStatus;
      if (patient.data && typeof patient.data === 'object') {
        patient.data.careStatus = resolvedCareStatus;
      }
    }
  }

  let latestIntake = null;
  try {
    await ensureCollection(PATIENT_INTAKE_COLLECTION);
    const intakeRes = await db
      .collection(PATIENT_INTAKE_COLLECTION)
      .where({ patientKey: resolvedPatientKey })
      .orderBy('updatedAt', 'desc')
      .orderBy('metadata.lastModifiedAt', 'desc')
      .limit(1)
      .get();
    if (Array.isArray(intakeRes.data) && intakeRes.data.length > 0) {
      const rawIntake = intakeRes.data[0];
      const metadata = rawIntake.metadata || {};
      const lastModifiedAt =
        metadata.lastModifiedAt || rawIntake.updatedAt || metadata.submittedAt || null;
      latestIntake = {
        ...rawIntake,
        metadata: {
          ...metadata,
          lastModifiedAt,
        },
      };
    }
  } catch (error) {
    console.warn('加载最新入住记录失败', resolvedPatientKey, error);
  }

  let operationLogs = [];
  try {
    await ensureCollection(PATIENT_OPERATION_LOGS_COLLECTION);
    const logsRes = await db
      .collection(PATIENT_OPERATION_LOGS_COLLECTION)
      .where({ patientKey: resolvedPatientKey })
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
      operationLogs = Array.isArray(logsRes.data)
        ? logsRes.data.map(log => ({
            ...log,
          }))
        : [];
  } catch (error) {
    console.warn('加载患者操作日志失败', resolvedPatientKey, error);
  }

  if (resolvedCareStatus && resolvedCareStatus !== storedCareStatus && resolvedPatientKey) {
    try {
      await db.collection(PATIENTS_COLLECTION).doc(resolvedPatientKey).update({
        data: {
          careStatus: resolvedCareStatus,
          'data.careStatus': resolvedCareStatus,
        },
      });
    } catch (error) {
      console.warn('sync patient careStatus failed', resolvedPatientKey, error);
    }
  }

  return {
    success: true,
    data: {
      patient: {
        key: resolvedPatientKey,
        patientName: patient.patientName,
        idType: patient.idType,
        idNumber: patient.idNumber,
        gender: patient.gender,
        birthDate: patient.birthDate,
        nativePlace: patient.nativePlace || '',
        ethnicity: patient.ethnicity || '',
        phone: patient.phone,
        address: patient.address,
        backupContact: patient.backupContact,
        backupPhone: patient.backupPhone,
        lastIntakeNarrative: patient.lastIntakeNarrative || '',
        updatedAt: patient.updatedAt || null,
        createdAt: patient.createdAt || null,
        careStatus: patient.careStatus || '',
        checkoutReason: patient.checkoutReason || '',
        checkoutNote: patient.checkoutNote || '',
        checkoutAt: patient.checkoutAt || null,
        fatherInfo: patient.fatherInfo || '',
        fatherContactName: patient.fatherContactName || '',
        fatherContactPhone: patient.fatherContactPhone || '',
        motherInfo: patient.motherInfo || '',
        motherContactName: patient.motherContactName || '',
        motherContactPhone: patient.motherContactPhone || '',
        guardianInfo: patient.guardianInfo || '',
        guardianContactName: patient.guardianContactName || '',
        guardianContactPhone: patient.guardianContactPhone || '',
        excelRecordKeys: Array.isArray(patient.excelRecordKeys) ? patient.excelRecordKeys : [],
      },
      latestIntake,
      operationLogs,
    },
  };
}


async function handleListIntakeRecords(event = {}) {
  const patientKey = normalizeSpacing(event.patientKey);
  const limit = Math.min(Number(event.limit) || MAX_INTAKE_QUERY_LIMIT, MAX_INTAKE_QUERY_LIMIT);

  if (!patientKey) {
    throw makeError('INVALID_PATIENT_KEY', '缺少住户标识');
  }

  await ensureCollectionExists(PATIENT_INTAKE_COLLECTION);

  try {
    const res = await db
      .collection(PATIENT_INTAKE_COLLECTION)
      .where({ patientKey })
      .orderBy('updatedAt', 'desc')
      .orderBy('metadata.lastModifiedAt', 'desc')
      .limit(limit)
      .get();

    const items = Array.isArray(res.data) ? res.data : [];

    return {
      success: true,
      data: { items },
    };
  } catch (error) {
    console.error('list intake records failed', patientKey, error);
    return {
      success: false,
      error: {
        code: 'LIST_INTAKE_FAILED',
        message: '获取入住记录失败',
      },
    };
  }
}


// 保存草稿
async function handleSaveDraft(event) {
  const { draftData, sessionId } = event;
  if (!draftData || !sessionId) {
    throw makeError('INVALID_DRAFT_DATA', '草稿数据不完整');
  }

  await ensureCollection(PATIENT_INTAKE_DRAFTS_COLLECTION);

  const now = Date.now();
  const expiresAt = now + DRAFT_EXPIRE_DAYS * 24 * 60 * 60 * 1000;

  const draftRecord = {
    sessionId,
    draftData,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  try {
    // 尝试更新现有草稿
    await db
      .collection(PATIENT_INTAKE_DRAFTS_COLLECTION)
      .where({ sessionId })
      .update({
        data: {
          draftData,
          updatedAt: now,
          expiresAt,
        },
      });
  } catch (error) {
    // 如果没有现有草稿，创建新的
    await db.collection(PATIENT_INTAKE_DRAFTS_COLLECTION).add({
      data: draftRecord,
    });
  }

  return {
    success: true,
    data: { savedAt: now },
  };
}

// 获取草稿
async function handleGetDraft(event) {
  const { sessionId } = event;
  if (!sessionId) {
    throw makeError('INVALID_SESSION_ID', '缺少会话标识');
  }

  await ensureCollection(PATIENT_INTAKE_DRAFTS_COLLECTION);

  const now = Date.now();
  const res = await db
    .collection(PATIENT_INTAKE_DRAFTS_COLLECTION)
    .where({
      sessionId,
      expiresAt: _.gt(now),
    })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();

  if (!res.data || res.data.length === 0) {
    return {
      success: true,
      data: { draft: null },
    };
  }

  return {
    success: true,
    data: { draft: res.data[0].draftData },
  };
}

// 提交入住数据
async function handleSubmitIntake(event) {
  const { patientKey, formData, uploadedFiles = [], isEditingExisting = false } = event;

  // 校验表单数据
  const validation = validateFormData(formData);
  if (!validation.valid) {
    throw makeError('VALIDATION_ERROR', '表单数据校验失败', { errors: validation.errors });
  }

  const now = Date.now();
  const intakeId = generateIntakeId();
  let finalPatientKey = patientKey;
  const normalizedVisitHospital = normalizeString(formData.visitHospital);
  const normalizedHospitalDiagnosis = normalizeString(formData.hospitalDiagnosis);
  const normalizedAttendingDoctor = normalizeString(formData.attendingDoctor);
  const normalizedSymptomDetail = normalizeString(formData.symptomDetail);
  const normalizedTreatmentProcess = normalizeString(formData.treatmentProcess);
  const normalizedFollowUpPlan = normalizeString(formData.followUpPlan);

  // 开始事务
  const result = await db.runTransaction(async transaction => {
    await ensureCollection(PATIENTS_COLLECTION);
    await ensureCollection(PATIENT_INTAKE_COLLECTION);

    let patientRecord;

    if (isEditingExisting && patientKey) {
      // 更新现有患者
      const patientRef = transaction.collection(PATIENTS_COLLECTION).doc(patientKey);
      const patientDoc = await patientRef.get();

      if (!patientDoc.data) {
        throw makeError('PATIENT_NOT_FOUND', '患者不存在');
      }

      patientRecord = patientDoc.data;

      // 更新患者基础信息
      const toNumber = value => {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };
      const dataSnapshot = patientRecord.data || {};
      const baseCount = toNumber(patientRecord.admissionCount);
      const fallbackCount = baseCount !== null ? baseCount : toNumber(dataSnapshot.admissionCount);
      const effectiveCount = fallbackCount !== null ? fallbackCount : 0;
      const newAdmissionCount = effectiveCount + 1;
      const baseFirstDate = toNumber(dataSnapshot.firstAdmissionDate);
      const fallbackFirstDate =
        baseFirstDate !== null ? baseFirstDate : toNumber(patientRecord.firstAdmissionDate);
      const normalizedFirstAdmissionDate = fallbackFirstDate !== null ? fallbackFirstDate : now;

      const patientUpdateData = {
        patientName: formData.patientName,
        idType: formData.idType || '身份证',
        idNumber: formData.idNumber,
        gender: formData.gender,
        birthDate: formData.birthDate,
        phone: formData.phone || '',
        address: formData.address,
        backupContact: formData.backupContact || '',
        backupPhone: formData.backupPhone || '',
        lastIntakeNarrative: formData.situation,
        admissionCount: newAdmissionCount,
        latestAdmissionDate: now,
        updatedAt: now,
        careStatus: 'in_care',
        checkoutAt: _.remove(),
        checkoutReason: _.remove(),
        checkoutNote: _.remove(),
        'data.admissionCount': newAdmissionCount,
        'data.latestAdmissionDate': now,
        'data.latestAdmissionTimestamp': now,
        'data.firstAdmissionDate': normalizedFirstAdmissionDate,
        'data.updatedAt': now,
      };

      if (normalizedVisitHospital) {
        patientUpdateData.latestHospital = normalizedVisitHospital;
        patientUpdateData['data.latestHospital'] = normalizedVisitHospital;
      }
      if (normalizedHospitalDiagnosis) {
        patientUpdateData.latestDiagnosis = normalizedHospitalDiagnosis;
        patientUpdateData['data.latestDiagnosis'] = normalizedHospitalDiagnosis;
      }
      if (normalizedAttendingDoctor) {
        patientUpdateData.latestDoctor = normalizedAttendingDoctor;
        patientUpdateData['data.latestDoctor'] = normalizedAttendingDoctor;
      }

      await patientRef.update({
        data: patientUpdateData,
      });
    } else {
      // 创建新患者
      finalPatientKey = generatePatientKey();

      patientRecord = {
        patientName: formData.patientName,
        idType: formData.idType || '身份证',
        idNumber: formData.idNumber,
        gender: formData.gender,
        birthDate: formData.birthDate,
        phone: formData.phone || '',
        address: formData.address,
        backupContact: formData.backupContact || '',
        backupPhone: formData.backupPhone || '',
        lastIntakeNarrative: formData.situation,
        latestHospital: normalizedVisitHospital || '',
        latestDiagnosis: normalizedHospitalDiagnosis || '',
        latestDoctor: normalizedAttendingDoctor || '',
        admissionCount: 1,
        firstAdmissionDate: now,
        latestAdmissionDate: now,
        createdAt: now,
        updatedAt: now,
        data: {
          admissionCount: 1,
          firstAdmissionDate: now,
          latestAdmissionDate: now,
          latestAdmissionTimestamp: now,
          updatedAt: now,
          latestHospital: normalizedVisitHospital || '',
          latestDiagnosis: normalizedHospitalDiagnosis || '',
          latestDoctor: normalizedAttendingDoctor || '',
        },
        careStatus: 'in_care',
      };

      await transaction.collection(PATIENTS_COLLECTION).doc(finalPatientKey).set({
        data: patientRecord,
      });
      console.log('[patientIntake] submitIntake created patient', finalPatientKey, {
        hasSituation: Boolean(formData.situation),
        admissionCount: patientRecord.admissionCount,
      });
    }

    // 创建入住记录
    const intakeTimeValue = Number(formData.intakeTime);

    const normalizedIntakeTime = Number.isFinite(intakeTimeValue) ? intakeTimeValue : now;

    const intakeRecord = {
      patientKey: finalPatientKey,
      patientName: formData.patientName,
      intakeId,
      basicInfo: {
        patientName: formData.patientName,
        idType: formData.idType || '身份证',
        idNumber: formData.idNumber,
        gender: formData.gender,
        birthDate: formData.birthDate,
        phone: formData.phone || '',
      },
      contactInfo: {
        address: formData.address,
        backupContact: formData.backupContact || '',
        backupPhone: formData.backupPhone || '',
      },
      intakeInfo: {
        intakeTime: normalizedIntakeTime,
        situation: formData.situation,
        followUpPlan: normalizedFollowUpPlan,
        medicalHistory: formData.medicalHistory || [],
        attachments: uploadedFiles.map(file => ({
          id: file.id,
          displayName: file.displayName,
          category: file.category,
          uploadTime: now,
        })),
      },
      metadata: {
        isEditingExisting,
        submittedAt: now,
        lastModifiedAt: now,
        submittedBy: 'patient-intake-wizard',
      },
      createdAt: now,
      updatedAt: now,
    };

    const medicalInfoPayload = {};

    if (normalizedVisitHospital) {
      intakeRecord.intakeInfo.hospital = normalizedVisitHospital;
      intakeRecord.hospital = normalizedVisitHospital;
      medicalInfoPayload.hospital = normalizedVisitHospital;
    }
    if (normalizedHospitalDiagnosis) {
      intakeRecord.intakeInfo.diagnosis = normalizedHospitalDiagnosis;
      intakeRecord.diagnosis = normalizedHospitalDiagnosis;
      medicalInfoPayload.diagnosis = normalizedHospitalDiagnosis;
    }
    if (normalizedAttendingDoctor) {
      intakeRecord.intakeInfo.doctor = normalizedAttendingDoctor;
      intakeRecord.doctor = normalizedAttendingDoctor;
      medicalInfoPayload.doctor = normalizedAttendingDoctor;
    }
    if (normalizedSymptomDetail) {
      intakeRecord.intakeInfo.symptoms = normalizedSymptomDetail;
      intakeRecord.symptoms = normalizedSymptomDetail;
      medicalInfoPayload.symptoms = normalizedSymptomDetail;
    }
    if (normalizedTreatmentProcess) {
      intakeRecord.intakeInfo.treatmentProcess = normalizedTreatmentProcess;
      intakeRecord.treatmentProcess = normalizedTreatmentProcess;
      medicalInfoPayload.treatmentProcess = normalizedTreatmentProcess;
    }
    if (normalizedFollowUpPlan) {
      intakeRecord.followUpPlan = normalizedFollowUpPlan;
      medicalInfoPayload.followUpPlan = normalizedFollowUpPlan;
    }

    if (Object.keys(medicalInfoPayload).length) {
      intakeRecord.medicalInfo = medicalInfoPayload;
    }

    await transaction.collection(PATIENT_INTAKE_COLLECTION).add({
      data: intakeRecord,
    });

    return {
      patientKey: finalPatientKey,
      intakeId,
      patientName: formData.patientName,
      intakeTime: now,
    };
  });

  try {
    const verifySnapshot = await db.collection(PATIENTS_COLLECTION).doc(result.patientKey).get();
    const exists = Boolean(verifySnapshot && verifySnapshot.data);
    console.log('[patientIntake] submitIntake verify patient doc', result.patientKey, {
      exists,
      intakeId: result.intakeId,
    });
  } catch (verifyError) {
    console.warn('[patientIntake] submitIntake verify failed', result.patientKey, verifyError);
  }

  let summary = null;
  try {
    summary = await syncPatientAggregates(result.patientKey, {
      patientDoc: { _id: result.patientKey },
      serverDate: Date.now(),
    });
  } catch (error) {
    console.warn('submitIntake aggregates failed', result.patientKey, error);
  }

  if (summary) {
    result.admissionCount = summary.count;
    result.firstAdmissionDate = summary.earliestTimestamp;
    result.latestAdmissionDate = summary.latestTimestamp;
  }

  await invalidatePatientSummaryCache();
  return {
    success: true,
    data: result,
  };
}

async function handleUpdatePatient(event = {}) {
  const {
    patientKey,
    patientUpdates = {},
    intakeUpdates = {},
    audit = {},
    expectedPatientUpdatedAt,
  } = event;

  if (!patientKey) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }

  const now = Date.now();

  await ensureCollection(PATIENTS_COLLECTION);
  await ensureCollection(PATIENT_INTAKE_COLLECTION);

  const transactionResult = await db.runTransaction(async transaction => {
    const patientRef = transaction.collection(PATIENTS_COLLECTION).doc(patientKey);
    const patientDoc = await patientRef.get();

    if (!patientDoc.data) {
      throw makeError('PATIENT_NOT_FOUND', '患者不存在');
    }

    const patientSnapshot = patientDoc.data;
    const expectedPatientTs =
      patientUpdates.expectedUpdatedAt !== undefined
        ? patientUpdates.expectedUpdatedAt
        : expectedPatientUpdatedAt;

    if (
      expectedPatientTs !== undefined &&
      patientSnapshot.updatedAt !== undefined &&
      Number(patientSnapshot.updatedAt) !== Number(expectedPatientTs)
    ) {
      throw makeError('VERSION_CONFLICT', '患者信息已被其他人更新', {
        latestUpdatedAt: patientSnapshot.updatedAt,
      });
    }

    const patientFields = [
      'patientName',
      'idType',
      'idNumber',
      'gender',
      'birthDate',
      'phone',
      'address',
      'backupContact',
      'backupPhone',
      'lastIntakeNarrative',
      'fatherInfo',
      'fatherContactName',
      'fatherContactPhone',
      'motherInfo',
      'motherContactName',
      'motherContactPhone',
      'guardianInfo',
      'guardianContactName',
      'guardianContactPhone',
    ];
    const patientUpdateData = {};
    patientFields.forEach(field => {
      if (
        Object.prototype.hasOwnProperty.call(patientUpdates, field) &&
        patientUpdates[field] !== undefined
      ) {
        patientUpdateData[field] = patientUpdates[field];
      }
    });

    if (
      intakeUpdates &&
      intakeUpdates.narrative !== undefined &&
      !Object.prototype.hasOwnProperty.call(patientUpdateData, 'lastIntakeNarrative')
    ) {
      patientUpdateData.lastIntakeNarrative = intakeUpdates.narrative;
    }

    let patientChanged = false;
    if (Object.keys(patientUpdateData).length > 0) {
      patientUpdateData.updatedAt = now;
      await patientRef.update({ data: patientUpdateData });
      patientChanged = true;
    }

    let intakeChanged = false;
    let updatedIntakeId = intakeUpdates.intakeId || null;

    if (intakeUpdates && intakeUpdates.intakeId) {
      const intakeRef = transaction
        .collection(PATIENT_INTAKE_COLLECTION)
        .doc(intakeUpdates.intakeId);
      const intakeDoc = await intakeRef.get();

      if (!intakeDoc.data) {
        throw makeError('INTAKE_NOT_FOUND', '入住记录不存在');
      }

      if (intakeDoc.data.patientKey !== patientKey) {
        throw makeError('INTAKE_PATIENT_MISMATCH', '入住记录与当前患者不匹配');
      }

      const expectedIntakeTs = intakeUpdates.expectedUpdatedAt;
      if (
        expectedIntakeTs !== undefined &&
        intakeDoc.data.updatedAt !== undefined &&
        Number(intakeDoc.data.updatedAt) !== Number(expectedIntakeTs)
      ) {
        throw makeError('INTAKE_VERSION_CONFLICT', '入住记录已被其他人更新', {
          latestUpdatedAt: intakeDoc.data.updatedAt,
        });
      }

      const intakeUpdateData = {};
      assignNestedUpdates(intakeUpdateData, intakeUpdates.basicInfo, 'basicInfo', [
        'patientName',
        'idType',
        'idNumber',
        'gender',
        'birthDate',
        'phone',
      ]);
      assignNestedUpdates(intakeUpdateData, intakeUpdates.contactInfo, 'contactInfo', [
        'address',
        'backupContact',
        'backupPhone',
      ]);

      if (intakeUpdates.intakeInfo && typeof intakeUpdates.intakeInfo === 'object') {
        const intakeInfo = intakeUpdates.intakeInfo;
        if (intakeInfo.intakeTime !== undefined) {
          let intakeTimeTs = intakeInfo.intakeTime;
          if (typeof intakeTimeTs === 'string') {
            const parsed = new Date(intakeTimeTs);
            if (Number.isNaN(parsed.getTime())) {
              throw makeError('INVALID_INTAKE_TIME', '入住时间格式不正确');
            }
            intakeTimeTs = parsed.getTime();
          }
          if (typeof intakeTimeTs !== 'number' || Number.isNaN(intakeTimeTs)) {
            throw makeError('INVALID_INTAKE_TIME', '入住时间格式不正确');
          }
          intakeUpdateData['intakeInfo.intakeTime'] = intakeTimeTs;
        }
        if (intakeInfo.situation !== undefined) {
          intakeUpdateData['intakeInfo.situation'] = intakeInfo.situation;
        }
        if (intakeInfo.followUpPlan !== undefined) {
          intakeUpdateData['intakeInfo.followUpPlan'] = intakeInfo.followUpPlan;
        }
      }

      if (intakeUpdates.medicalHistory !== undefined) {
        intakeUpdateData['intakeInfo.medicalHistory'] = Array.isArray(intakeUpdates.medicalHistory)
          ? intakeUpdates.medicalHistory
          : [];
      }

      if (intakeUpdates.attachments !== undefined) {
        intakeUpdateData['intakeInfo.attachments'] = Array.isArray(intakeUpdates.attachments)
          ? intakeUpdates.attachments
          : [];
      }

      if (intakeUpdates.narrative !== undefined) {
        intakeUpdateData['intakeInfo.situation'] = intakeUpdates.narrative;
      }

      if (Object.keys(intakeUpdateData).length > 0) {
        intakeUpdateData.updatedAt = now;
        intakeUpdateData['metadata.lastModifiedAt'] = now;
        await intakeRef.update({ data: intakeUpdateData });
        intakeChanged = true;
      }
    }

    if (!patientChanged && !intakeChanged) {
      throw makeError('NO_CHANGES', '未检测到需要更新的字段');
    }

    return {
      patientChanged,
      intakeChanged,
      updatedAt: now,
      intakeId: updatedIntakeId,
    };
  });

  const changesForLog =
    Array.isArray(audit.changes) && audit.changes.length
      ? audit.changes
      : [
          ...(transactionResult.patientChanged ? ['patient'] : []),
          ...(transactionResult.intakeChanged ? ['intake'] : []),
        ];

  await writePatientOperationLog({
    patientKey,
    operatorId: audit.operatorId || audit.operatorOpenId || '',
    operatorName: audit.operatorName || '',
    message: audit.message || '更新患者资料',
    action: 'patient-detail-edit',
    changes: changesForLog,
    extra: audit.extra || {},
  });

  await invalidatePatientSummaryCache();

  return {
    success: true,
    data: {
      patientKey,
      intakeId: transactionResult.intakeId,
      patientUpdated: transactionResult.patientChanged,
      intakeUpdated: transactionResult.intakeChanged,
      updatedAt: transactionResult.updatedAt,
    },
  };
}

async function handleCheckoutPatient(event = {}) {
  const { patientKey, checkout = {} } = event;

  if (!patientKey) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }

  const reason = normalizeString(checkout.reason);
  const note = normalizeString(checkout.note);
  const operatorId = normalizeString(checkout.operatorId || checkout.operatorOpenId);
  const operatorName = normalizeString(checkout.operatorName);
  const requestedTimestamp = Number(checkout.timestamp);
  const now = Date.now();
  const checkoutAt = Number.isFinite(requestedTimestamp) ? requestedTimestamp : now;

  await ensureCollection(PATIENTS_COLLECTION);
  await ensureCollection(PATIENT_INTAKE_COLLECTION);

  const result = await db.runTransaction(async transaction => {
    const patientRef = transaction.collection(PATIENTS_COLLECTION).doc(patientKey);
    const snapshot = await patientRef.get();
    if (!snapshot.data) {
      throw makeError('PATIENT_NOT_FOUND', '患者不存在');
    }

    const patientDoc = snapshot.data;

    const intakeId = `checkout_${checkoutAt}_${Math.random().toString(36).slice(2, 8)}`;
    const checkoutRecord = {
      intakeId,
      patientKey,
      patientName: patientDoc.patientName || '',
      status: 'checkout',
      createdAt: now,
      updatedAt: now,
      basicInfo: {
        patientName: patientDoc.patientName || '',
        idType: patientDoc.idType || '身份证',
        idNumber: patientDoc.idNumber || '',
        gender: patientDoc.gender || '',
        birthDate: patientDoc.birthDate || '',
        phone: patientDoc.phone || '',
      },
      contactInfo: {
        address: patientDoc.address || '',
        backupContact: patientDoc.backupContact || '',
        backupPhone: patientDoc.backupPhone || '',
        guardianName: patientDoc.guardianContactName || '',
        guardianPhone: patientDoc.guardianContactPhone || '',
      },
      intakeInfo: {
        checkoutReason: reason || '',
        checkoutNote: note || '',
        checkoutAt,
      },
      metadata: {
        source: 'manual-checkout',
        submittedAt: now,
        lastModifiedAt: now,
        operatorId: operatorId || '',
        operatorName: operatorName || '',
        checkoutReason: reason || '',
        checkoutNote: note || '',
        checkoutAt,
      },
    };

    await transaction
      .collection(PATIENT_INTAKE_COLLECTION)
      .doc(intakeId)
      .set({ data: checkoutRecord });

    const patientUpdate = {
      careStatus: 'discharged',
      checkoutReason: reason || '',
      checkoutNote: note || '',
      checkoutAt,
      updatedAt: now,
      'data.updatedAt': now,
    };

    await patientRef.update({ data: patientUpdate });

    return {
      patientDoc: { ...patientDoc, _id: patientKey },
      checkoutRecord,
      patientUpdate,
    };
  });

  await writePatientOperationLog({
    patientKey,
    action: 'patient-checkout',
    operatorId: operatorId || '',
    operatorName: operatorName || '',
    message: '办理离开',
    changes: ['checkout'],
    extra: {
      reason,
      note,
      checkoutAt,
    },
  });

  await invalidatePatientSummaryCache();

  return {
    success: true,
    data: {
      patientKey,
      checkoutAt,
      reason,
      note,
    },
  };
}

async function handleManualStatusUpdate(event = {}) {
  const patientKey = normalizeString(event.patientKey);
  if (!patientKey) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }

  const targetStatusRaw = normalizeString(event.status || event.careStatus);
  const allowedStatuses = ['in_care', 'pending', 'discharged'];
  if (!allowedStatuses.includes(targetStatusRaw)) {
    throw makeError('INVALID_STATUS', '不支持的目标状态');
  }

  const note = normalizeString(event.note);
  const timestampRaw = Number(event.timestamp);
  const now = Date.now();
  const statusAdjustedAt = Number.isFinite(timestampRaw) ? timestampRaw : now;

  const wxContext = cloud.getWXContext();
  const operatorId = normalizeString(
    event.operatorId || event.operatorOpenId || (wxContext && wxContext.OPENID) || ''
  );
  const operatorName = normalizeString(event.operatorName || event.operator || '');

  await ensureCollection(PATIENTS_COLLECTION);

  await db.runTransaction(async transaction => {
    const patientRef = transaction.collection(PATIENTS_COLLECTION).doc(patientKey);
    const snapshot = await patientRef.get();
    if (!snapshot.data) {
      throw makeError('PATIENT_NOT_FOUND', '患者不存在');
    }

    const patientDoc = snapshot.data;

    const updates = {
      careStatus: targetStatusRaw,
      updatedAt: now,
      'data.updatedAt': now,
      manualStatusUpdatedAt: statusAdjustedAt,
      manualStatusOperatorId: operatorId || '',
    };

    if (operatorName) {
      updates.manualStatusOperatorName = operatorName;
    } else {
      updates.manualStatusOperatorName = _.remove();
    }

    if (note) {
      updates.manualStatusNote = note;
    } else {
      updates.manualStatusNote = _.remove();
    }

    if (targetStatusRaw === 'discharged') {
      updates.checkoutAt = statusAdjustedAt;
      if (note) {
        updates.checkoutNote = note;
        if (!patientDoc.checkoutReason) {
          updates.checkoutReason = note;
        }
      }
    } else {
      updates.checkoutAt = _.remove();
      updates.checkoutReason = _.remove();
      updates.checkoutNote = _.remove();
    }

    await patientRef.update({ data: updates });
  });

  await writePatientOperationLog({
    patientKey,
    action: 'manual-status-update',
    operatorId: operatorId || '',
    operatorName: operatorName || '',
    message: '手动调整住户状态',
    changes: ['careStatus'],
    extra: {
      careStatus: targetStatusRaw,
      note,
      statusAdjustedAt,
    },
  });

  await invalidatePatientSummaryCache();

  return {
    success: true,
    data: {
      patientKey,
      careStatus: targetStatusRaw,
      note,
      statusAdjustedAt,
      checkoutAt: targetStatusRaw === 'discharged' ? statusAdjustedAt : null,
    },
  };
}

// 获取入住配置
async function handleGetConfig(event) {
  await ensureCollection(INTAKE_CONFIG_COLLECTION);

  try {
    const res = await db.collection(INTAKE_CONFIG_COLLECTION).doc('default').get();

    const config = res.data || {};

    return {
      success: true,
      data: {
        situationConfig: {
          minLength: config.situationMinLength || SITUATION_MIN_LENGTH,
          maxLength: config.situationMaxLength || SITUATION_MAX_LENGTH,
          keywords: config.situationKeywords || SITUATION_KEYWORDS,
          example:
            config.situationExample ||
            '患者因脑瘫需要专业护理照顾，主要症状包括运动功能障碍、语言交流困难，需要协助进食、洗漱等日常生活护理，定期进行康复训练。',
        },
        uploadConfig: {
          maxFileSize: 10, // MB
          maxCount: 5,
          allowedTypes: 'JPG、PNG、PDF、Word、Excel等',
        },
      },
    };
  } catch (error) {
    // 如果配置不存在，返回默认值
    return {
      success: true,
      data: {
        situationConfig: {
          minLength: SITUATION_MIN_LENGTH,
          maxLength: SITUATION_MAX_LENGTH,
          keywords: SITUATION_KEYWORDS,
          example:
            '患者因脑瘫需要专业护理照顾，主要症状包括运动功能障碍、语言交流困难，需要协助进食、洗漱等日常生活护理，定期进行康复训练。',
        },
        uploadConfig: {
          maxFileSize: 10,
          maxCount: 5,
          allowedTypes: 'JPG、PNG、PDF、Word、Excel等',
        },
      },
    };
  }
}

// 清理过期草稿
async function handleCleanupDrafts(event) {
  await ensureCollection(PATIENT_INTAKE_DRAFTS_COLLECTION);

  const now = Date.now();
  const res = await db
    .collection(PATIENT_INTAKE_DRAFTS_COLLECTION)
    .where({
      expiresAt: _.lt(now),
    })
    .remove();

  return {
    success: true,
    data: {
      deletedCount: res.stats.removed || 0,
      cleanupTime: now,
    },
  };
}

// 从Excel同步患者数据
async function handleSyncFromExcel(event) {
  const { syncBatchId = `manual-${Date.now()}`, forceRefresh = false } = event;

  try {
    // 调用 readExcel 云函数的同步功能
    const res = await cloud.callFunction({
      name: 'readExcel',
      data: {
        action: 'syncPatients',
        syncBatchId,
        forceRefresh,
      },
    });

    if (!res.result) {
      throw makeError('SYNC_FAILED', 'Excel同步调用失败');
    }

    const result = res.result;

    // 记录同步日志
    const syncLog = {
      syncBatchId,
      syncType: 'excel_to_patients',
      startTime: Date.now(),
      endTime: Date.now(),
      processedCount: (result.sync && result.sync.patients) || 0,
      successCount: (result.sync && result.sync.patients) || 0,
      errorCount: (result.sync && result.sync.errors && result.sync.errors.length) || 0,
      errors: (result.sync && result.sync.errors) || [],
      status:
        ((result.sync && result.sync.errors && result.sync.errors.length) || 0) === 0
          ? 'success'
          : 'partial',
      metadata: {
        calledBy: 'patientIntake',
        totalPatients: result.totalPatients || 0,
        intakeRecords: (result.sync && result.sync.intakeRecords) || 0,
      },
    };

    return {
      success: true,
      data: {
        sync: result.sync,
        syncLog,
        totalPatients: result.totalPatients || 0,
      },
    };
  } catch (error) {
    console.error('Excel同步失败', error);

    // 记录失败日志
    const syncLog = {
      syncBatchId,
      syncType: 'excel_to_patients',
      startTime: Date.now(),
      endTime: Date.now(),
      processedCount: 0,
      successCount: 0,
      errorCount: 1,
      errors: [{ message: error.message || '同步调用失败' }],
      status: 'failed',
      metadata: {
        calledBy: 'patientIntake',
        errorDetails: error.details || null,
      },
    };

    return {
      success: false,
      error: {
        code: error.code || 'SYNC_ERROR',
        message: error.message || 'Excel同步失败',
        details: error.details || null,
      },
      data: { syncLog },
    };
  }
}

// 主函数
exports.main = async event => {
  const action = normalizeString(event.action);

  try {
    switch (action) {
      case 'getPatients':
        return await handleGetPatients(event);
      case 'getPatientDetail':
        return await handleGetPatientDetail(event);
      case 'listIntakeRecords':
        return await handleListIntakeRecords(event);
      case 'createPatient':
        return await handleCreatePatient(event);
      case 'getAllIntakeRecords':
        return await handleGetAllIntakeRecords(event);
      case 'saveDraft':
        return await handleSaveDraft(event);
      case 'getDraft':
        return await handleGetDraft(event);
      case 'submit':
        return await handleSubmitIntake(event);
      case 'updatePatient':
        return await handleUpdatePatient(event);
      case 'checkoutPatient':
        return await handleCheckoutPatient(event);
      case 'updateCareStatus':
        return await handleManualStatusUpdate(event);
      case 'getConfig':
        return await handleGetConfig(event);
      case 'cleanupDrafts':
        return await handleCleanupDrafts(event);
      case 'syncFromExcel':
        return await handleSyncFromExcel(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `未支持的操作：${action || 'unknown'}`);
    }
  } catch (error) {
    console.error('patientIntake action failed', action, error);
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || '服务内部错误',
        details: error.details || null,
      },
    };
  }
};
