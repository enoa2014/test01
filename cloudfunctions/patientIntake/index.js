const cloud = require("wx-server-sdk");
const { v4: uuidv4 } = require('uuid');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 集合名称
const PATIENTS_COLLECTION = "patients";
const PATIENT_INTAKE_COLLECTION = "patient_intake_records";
const PATIENT_INTAKE_DRAFTS_COLLECTION = "patient_intake_drafts";
const INTAKE_CONFIG_COLLECTION = "intake_config";
const EXCEL_RECORDS_COLLECTION = "excel_records";

// 配置常量
const DRAFT_EXPIRE_DAYS = 7;
const SITUATION_MIN_LENGTH = 30;
const SITUATION_MAX_LENGTH = 500;
const SITUATION_KEYWORDS = ['护理', '症状', '康复', '治疗', '病情', '照顾', '功能', '障碍', '需要', '协助'];

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
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function generatePatientKey() {
  return `P${Date.now()}_${uuidv4().slice(0, 8)}`;
}

function generateIntakeId() {
  return `I${Date.now()}_${uuidv4().slice(0, 8)}`;
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
    { key: 'emergencyContact', label: '紧急联系人' },
    { key: 'emergencyPhone', label: '紧急联系人电话' },
    { key: 'situation', label: '情况说明' }
  ];

  for (const field of requiredFields) {
    const value = normalizeString(formData[field.key]);
    if (!value) {
      errors[field.key] = `${field.label}不能为空`;
    }
  }

  // 证件号码格式校验
  if (formData.idType === '身份证' && formData.idNumber) {
    if (!/^[1-9]\d{17}$/.test(formData.idNumber)) {
      errors.idNumber = '身份证号码格式不正确';
    }
  }

  // 手机号码校验
  const phoneFields = ['phone', 'emergencyPhone', 'backupPhone'];
  for (const field of phoneFields) {
    const phone = normalizeString(formData[field]);
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      errors[field] = '手机号码格式不正确';
    }
  }

  // 必填手机号码校验
  if (formData.emergencyPhone && !/^1[3-9]\d{9}$/.test(formData.emergencyPhone)) {
    errors.emergencyPhone = '紧急联系人电话格式不正确';
  }

  // 情况说明校验
  const situation = normalizeString(formData.situation);
  if (situation) {
    if (situation.length < SITUATION_MIN_LENGTH) {
      errors.situation = `情况说明至少需要${SITUATION_MIN_LENGTH}字`;
    } else if (situation.length > SITUATION_MAX_LENGTH) {
      errors.situation = `情况说明不能超过${SITUATION_MAX_LENGTH}字`;
    } else {
      const hasKeyword = SITUATION_KEYWORDS.some(keyword => situation.includes(keyword));
      if (!hasKeyword) {
        errors.situation = '情况说明应包含护理需求或症状相关信息';
      }
    }
  }

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

  await ensureCollectionExists(PATIENTS_COLLECTION);

  let query = db.collection(PATIENTS_COLLECTION);

  // 搜索过滤
  if (searchKeyword) {
    const keyword = normalizeString(searchKeyword).toLowerCase();
    query = query.where(_.or([
      { patientName: db.RegExp({ regexp: keyword, options: 'i' }) },
      { idNumber: db.RegExp({ regexp: keyword, options: 'i' }) },
      { phone: db.RegExp({ regexp: keyword, options: 'i' }) }
    ]));
  }

  // 分页查询
  const skip = page * pageSize;
  const res = await query
    .orderBy('updatedAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();

  const patients = (res.data || []).map(patient => ({
    key: patient._id,
    patientName: patient.patientName,
    gender: patient.gender,
    birthDate: patient.birthDate,
    idNumber: patient.idNumber,
    phone: patient.phone,
    admissionCount: patient.admissionCount || 0,
    latestAdmissionDate: patient.latestAdmissionDate,
    updatedAt: patient.updatedAt
  }));

  return {
    success: true,
    data: {
      patients,
      hasMore: patients.length === pageSize
    }
  };
}

// 获取患者详情
async function handleGetPatientDetail(event) {
  const { patientKey } = event;
  if (!patientKey) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }

  const res = await db.collection(PATIENTS_COLLECTION).doc(patientKey).get();
  if (!res.data) {
    throw makeError('PATIENT_NOT_FOUND', '患者不存在');
  }

  const patient = res.data;
  return {
    success: true,
    data: {
      patient: {
        key: patient._id,
        patientName: patient.patientName,
        idType: patient.idType,
        idNumber: patient.idNumber,
        gender: patient.gender,
        birthDate: patient.birthDate,
        phone: patient.phone,
        address: patient.address,
        emergencyContact: patient.emergencyContact,
        emergencyPhone: patient.emergencyPhone,
        backupContact: patient.backupContact,
        backupPhone: patient.backupPhone,
        lastIntakeNarrative: patient.lastIntakeNarrative || ''
      }
    }
  };
}

// 保存草稿
async function handleSaveDraft(event) {
  const { draftData, sessionId } = event;
  if (!draftData || !sessionId) {
    throw makeError('INVALID_DRAFT_DATA', '草稿数据不完整');
  }

  await ensureCollectionExists(PATIENT_INTAKE_DRAFTS_COLLECTION);

  const now = Date.now();
  const expiresAt = now + (DRAFT_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

  const draftRecord = {
    sessionId,
    draftData,
    createdAt: now,
    updatedAt: now,
    expiresAt
  };

  try {
    // 尝试更新现有草稿
    await db.collection(PATIENT_INTAKE_DRAFTS_COLLECTION)
      .where({ sessionId })
      .update({
        data: {
          draftData,
          updatedAt: now,
          expiresAt
        }
      });
  } catch (error) {
    // 如果没有现有草稿，创建新的
    await db.collection(PATIENT_INTAKE_DRAFTS_COLLECTION).add({
      data: draftRecord
    });
  }

  return {
    success: true,
    data: { savedAt: now }
  };
}

// 获取草稿
async function handleGetDraft(event) {
  const { sessionId } = event;
  if (!sessionId) {
    throw makeError('INVALID_SESSION_ID', '缺少会话标识');
  }

  await ensureCollectionExists(PATIENT_INTAKE_DRAFTS_COLLECTION);

  const now = Date.now();
  const res = await db.collection(PATIENT_INTAKE_DRAFTS_COLLECTION)
    .where({
      sessionId,
      expiresAt: _.gt(now)
    })
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();

  if (!res.data || res.data.length === 0) {
    return {
      success: true,
      data: { draft: null }
    };
  }

  return {
    success: true,
    data: { draft: res.data[0].draftData }
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

  // 开始事务
  const result = await db.runTransaction(async (transaction) => {
    await ensureCollectionExists(PATIENTS_COLLECTION);
    await ensureCollectionExists(PATIENT_INTAKE_COLLECTION);

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
      await patientRef.update({
        data: {
          patientName: formData.patientName,
          idType: formData.idType || '身份证',
          idNumber: formData.idNumber,
          gender: formData.gender,
          birthDate: formData.birthDate,
          phone: formData.phone || '',
          address: formData.address,
          emergencyContact: formData.emergencyContact,
          emergencyPhone: formData.emergencyPhone,
          backupContact: formData.backupContact || '',
          backupPhone: formData.backupPhone || '',
          lastIntakeNarrative: formData.situation,
          admissionCount: (patientRecord.admissionCount || 0) + 1,
          latestAdmissionDate: now,
          updatedAt: now
        }
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
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        backupContact: formData.backupContact || '',
        backupPhone: formData.backupPhone || '',
        lastIntakeNarrative: formData.situation,
        admissionCount: 1,
        firstAdmissionDate: now,
        latestAdmissionDate: now,
        createdAt: now,
        updatedAt: now
      };

      await transaction.collection(PATIENTS_COLLECTION).doc(finalPatientKey).set({
        data: patientRecord
      });
    }

    // 创建入住记录
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
        phone: formData.phone || ''
      },
      contactInfo: {
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        backupContact: formData.backupContact || '',
        backupPhone: formData.backupPhone || ''
      },
      intakeInfo: {
        intakeTime: now,
        situation: formData.situation,
        medicalHistory: formData.medicalHistory || [],
        attachments: uploadedFiles.map(file => ({
          id: file.id,
          displayName: file.displayName,
          category: file.category,
          uploadTime: now
        }))
      },
      metadata: {
        isEditingExisting,
        submittedAt: now,
        submittedBy: 'patient-intake-wizard'
      }
    };

    await transaction.collection(PATIENT_INTAKE_COLLECTION).add({
      data: intakeRecord
    });

    return {
      patientKey: finalPatientKey,
      intakeId,
      patientName: formData.patientName,
      intakeTime: now
    };
  });

  return {
    success: true,
    data: result
  };
}

// 获取入住配置
async function handleGetConfig(event) {
  await ensureCollectionExists(INTAKE_CONFIG_COLLECTION);

  try {
    const res = await db.collection(INTAKE_CONFIG_COLLECTION)
      .doc('default')
      .get();

    const config = res.data || {};

    return {
      success: true,
      data: {
        situationConfig: {
          minLength: config.situationMinLength || SITUATION_MIN_LENGTH,
          maxLength: config.situationMaxLength || SITUATION_MAX_LENGTH,
          keywords: config.situationKeywords || SITUATION_KEYWORDS,
          example: config.situationExample || '患者因脑瘫需要专业护理照顾，主要症状包括运动功能障碍、语言交流困难，需要协助进食、洗漱等日常生活护理，定期进行康复训练。'
        },
        uploadConfig: {
          maxFileSize: 10, // MB
          maxCount: 5,
          allowedTypes: 'JPG、PNG、PDF、Word、Excel等'
        }
      }
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
          example: '患者因脑瘫需要专业护理照顾，主要症状包括运动功能障碍、语言交流困难，需要协助进食、洗漱等日常生活护理，定期进行康复训练。'
        },
        uploadConfig: {
          maxFileSize: 10,
          maxCount: 5,
          allowedTypes: 'JPG、PNG、PDF、Word、Excel等'
        }
      }
    };
  }
}

// 清理过期草稿
async function handleCleanupDrafts(event) {
  await ensureCollectionExists(PATIENT_INTAKE_DRAFTS_COLLECTION);

  const now = Date.now();
  const res = await db.collection(PATIENT_INTAKE_DRAFTS_COLLECTION)
    .where({
      expiresAt: _.lt(now)
    })
    .remove();

  return {
    success: true,
    data: {
      deletedCount: res.stats.removed || 0,
      cleanupTime: now
    }
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
        forceRefresh
      }
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
      status: ((result.sync && result.sync.errors && result.sync.errors.length) || 0) === 0 ? 'success' : 'partial',
      metadata: {
        calledBy: 'patientIntake',
        totalPatients: result.totalPatients || 0,
        intakeRecords: (result.sync && result.sync.intakeRecords) || 0
      }
    };

    return {
      success: true,
      data: {
        sync: result.sync,
        syncLog,
        totalPatients: result.totalPatients || 0
      }
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
        errorDetails: error.details || null
      }
    };

    return {
      success: false,
      error: {
        code: error.code || 'SYNC_ERROR',
        message: error.message || 'Excel同步失败',
        details: error.details || null
      },
      data: { syncLog }
    };
  }
}

// 主函数
exports.main = async (event) => {
  const action = normalizeString(event.action);

  try {
    switch (action) {
      case 'getPatients':
        return await handleGetPatients(event);
      case 'getPatientDetail':
        return await handleGetPatientDetail(event);
      case 'saveDraft':
        return await handleSaveDraft(event);
      case 'getDraft':
        return await handleGetDraft(event);
      case 'submit':
        return await handleSubmitIntake(event);
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
        details: error.details || null
      }
    };
  }
};