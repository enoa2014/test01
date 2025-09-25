const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 集合名称
const EXCEL_RECORDS_COLLECTION = "excel_records";
const EXCEL_CACHE_COLLECTION = "excel_cache";
const PATIENTS_COLLECTION = "patients";
const PATIENT_INTAKE_COLLECTION = "patient_intake_records";

// 工具函数
function makeError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
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

// 确保集合存在
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

// 从缓存获取患者列表
async function fetchPatientsFromCache(forceRefresh = false) {
  if (!forceRefresh) {
    try {
      await ensureCollectionExists(EXCEL_CACHE_COLLECTION);
      const res = await db.collection(EXCEL_CACHE_COLLECTION).limit(1).get();
      if (res.data && res.data.length > 0) {
        const cached = res.data[0];
        const cacheAge = Date.now() - (cached.updatedAt || 0);
        // 缓存有效期30分钟
        if (cacheAge < 30 * 60 * 1000 && Array.isArray(cached.patients)) {
          return cached.patients;
        }
      }
    } catch (error) {
      console.warn('Failed to read from cache', error);
    }
  }

  // 从数据库构建患者列表
  return await buildPatientsFromDatabase();
}

// 从数据库构建患者列表
async function buildPatientsFromDatabase() {
  await ensureCollectionExists(EXCEL_RECORDS_COLLECTION);

  const allRecords = [];
  let skip = 0;
  const limit = 100;

  // 分批获取所有记录
  while (true) {
    const res = await db.collection(EXCEL_RECORDS_COLLECTION)
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

  // 按患者分组并构建摘要
  const groups = buildPatientGroups(allRecords);
  const patients = Array.from(groups.values()).map(group => ({
    key: group.key,
    patientName: group.patientName,
    gender: group.gender || '',
    birthDate: group.birthDate || '',
    idNumber: group.idNumber || '',
    firstAdmissionDate: group.firstAdmissionDate,
    latestAdmissionDate: group.latestAdmissionDate,
    firstDiagnosis: group.firstDiagnosis || '',
    latestDiagnosis: group.latestDiagnosis || '',
    firstHospital: group.firstHospital || '',
    latestHospital: group.latestHospital || '',
    latestDoctor: group.latestDoctor || '',
    admissionCount: group.admissionCount || 0,
    summaryCaregivers: group.summaryCaregivers || ''
  }));

  // 更新缓存
  try {
    await ensureCollectionExists(EXCEL_CACHE_COLLECTION);
    await db.collection(EXCEL_CACHE_COLLECTION).doc('default').set({
      data: {
        patients,
        updatedAt: Date.now(),
        totalCount: patients.length
      }
    });
  } catch (error) {
    console.warn('Failed to update cache', error);
  }

  return patients;
}

// 构建患者分组
function buildPatientGroups(records) {
  const groups = new Map();

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

    // 更新统计信息
    if (record.admissionTimestamp) {
      group.admissionCount++;
      if (!group.firstAdmissionDate || record.admissionTimestamp < group.firstAdmissionTimestamp) {
        group.firstAdmissionDate = record.admissionDate;
        group.firstAdmissionTimestamp = record.admissionTimestamp;
        group.firstDiagnosis = record.diagnosis || '';
        group.firstHospital = record.hospital || '';
      }
      if (!group.latestAdmissionDate || record.admissionTimestamp > group.latestAdmissionTimestamp) {
        group.latestAdmissionDate = record.admissionDate;
        group.latestAdmissionTimestamp = record.admissionTimestamp;
        group.latestDiagnosis = record.diagnosis || '';
        group.latestHospital = record.hospital || '';
        group.latestDoctor = record.doctor || '';
      }
    }

    // 收集监护人信息
    if (record.caregivers && !group.summaryCaregivers.includes(record.caregivers)) {
      group.summaryCaregivers = group.summaryCaregivers
        ? `${group.summaryCaregivers}、${record.caregivers}`
        : record.caregivers;
    }
  });

  return groups;
}

// 按key获取患者详情
async function fetchPatientDetailByKey(recordKey) {
  if (!recordKey) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }

  await ensureCollectionExists(EXCEL_RECORDS_COLLECTION);
  const res = await db.collection(EXCEL_RECORDS_COLLECTION)
    .where({ key: recordKey })
    .get();

  if (!res.data || res.data.length === 0) {
    throw makeError('PATIENT_NOT_FOUND', '患者不存在');
  }

  const records = res.data;
  const groups = buildPatientGroups(records);
  const group = groups.get(recordKey);

  if (!group) {
    throw makeError('PATIENT_NOT_FOUND', '患者信息不完整');
  }

  return formatPatientDetail(group);
}

// 格式化患者详情
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
    { label: '监护人', value: group.summaryCaregivers }
  ]);

  // 构建家庭信息
  const familyInfoEntries = [];
  const addressGroups = new Map();

  group.records.forEach(record => {
    if (record.address) {
      const addr = normalizeSpacing(record.address);
      if (addr && !addressGroups.has(addr)) {
        addressGroups.set(addr, []);
      }
      if (addr) {
        addressGroups.get(addr).push({
          admissionDate: record.admissionDate || '',
          diagnosis: record.diagnosis || ''
        });
      }
    }
  });

  Array.from(addressGroups.entries()).forEach(([address, entries]) => {
    familyInfoEntries.push({
      label: '居住地址',
      value: address,
      details: entries
    });
  });

  // 构建经济信息
  const economicInfo = buildInfoList([
    { label: '家庭经济状况', value: pickRecordValue(record => record.familyEconomy) }
  ]);

  // 构建就诊记录
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
    familyInfo: familyInfoEntries,
    economicInfo,
    records
  };
}

// 处理患者列表请求
async function handleGetPatientsList(event) {
  const { forceRefresh = false } = event;

  try {
    const patients = await fetchPatientsFromCache(forceRefresh);
    return {
      success: true,
      patients,
      totalCount: patients.length
    };
  } catch (error) {
    console.error('获取患者列表失败', error);
    throw makeError('LIST_FAILED', '获取患者列表失败', { error: error.message });
  }
}

// 处理患者详情请求
async function handleGetPatientDetail(event) {
  const { key } = event;

  if (!key) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }

  try {
    const patientDetail = await fetchPatientDetailByKey(key);
    return {
      success: true,
      ...patientDetail
    };
  } catch (error) {
    console.error('获取患者详情失败', key, error);
    if (error.code) {
      throw error;
    }
    throw makeError('DETAIL_FAILED', '获取患者详情失败', { error: error.message });
  }
}

// 主函数
exports.main = async (event) => {
  const action = event.action || '';

  try {
    switch (action) {
      case 'list':
        return await handleGetPatientsList(event);
      case 'detail':
        return await handleGetPatientDetail(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `未支持的操作：${action || 'unknown'}`);
    }
  } catch (error) {
    console.error('patientProfile action failed', action, error);
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