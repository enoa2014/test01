const {
  PATIENT_FIELD_CONFIG,
  CONTACT_FIELD_CONFIG,
  INTAKE_FIELD_CONFIG,
  FIELD_CONFIG_MAP,
  FORM_FIELD_KEYS,
} = require('./constants.js');

const { normalizeString, formatDateForInput, toTimestampFromDateInput } = require('./helpers.js');

function buildEditForm(patient = {}, intake = {}, fallbackPatient = {}) {
  const intakeInfo = intake.intakeInfo || {};

  const patientName = patient.patientName || fallbackPatient.patientName || '';
  const gender = patient.gender || fallbackPatient.gender || '';
  const birthDate = patient.birthDate || fallbackPatient.birthDate || '';

  const intakeDocId = intake._id || intake.intakeDocId || intake.intakeDocumentId || null;
  return {
    patientName,
    idType: patient.idType || '身份证',
    idNumber: patient.idNumber || '',
    gender,
    birthDate: formatDateForInput(birthDate),
    phone: patient.phone || '',
    address: patient.address || '',
    backupContact: patient.backupContact || '',
    backupPhone: patient.backupPhone || '',
    intakeTime: formatDateForInput(intakeInfo.intakeTime || intake.lastIntakeTime),
    narrative: intakeInfo.situation || intake.narrative || patient.lastIntakeNarrative || '',
    followUpPlan: intakeInfo.followUpPlan || '',
    medicalHistory: Array.isArray(intakeInfo.medicalHistory) ? intakeInfo.medicalHistory : [],
    attachments: Array.isArray(intakeInfo.attachments) ? intakeInfo.attachments : [],
    intakeId: intake.intakeId || intakeDocId,
    intakeDocId,
    intakeUpdatedAt:
      intake.updatedAt || (intake.metadata && intake.metadata.lastModifiedAt) || null,
    patientUpdatedAt: patient.updatedAt || null,
  };
}

function cloneForm(form) {
  return JSON.parse(JSON.stringify(form || {}));
}

function detectFormChanges(current, original) {
  if (!original) {
    return true;
  }
  const keys = Object.keys(current || {});
  for (const key of keys) {
    const currentValue = current[key];
    const originalValue = original[key];
    if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
      if (currentValue.length !== originalValue.length) {
        return true;
      }
      for (let i = 0; i < currentValue.length; i += 1) {
        if (JSON.stringify(currentValue[i]) !== JSON.stringify(originalValue[i])) {
          return true;
        }
      }
    } else if (currentValue !== originalValue) {
      return true;
    }
  }
  return false;
}

function buildPickerIndexMap(form) {
  const map = {};
  [...PATIENT_FIELD_CONFIG, ...CONTACT_FIELD_CONFIG, ...INTAKE_FIELD_CONFIG].forEach(config => {
    if (config.type === 'picker' && Array.isArray(config.options)) {
      const currentValue = form[config.key];
      const index = config.options.indexOf(currentValue);
      map[config.key] = index >= 0 ? index : 0;
    }
  });
  return map;
}

function collectChangedFormKeys(current = {}, original = {}) {
  const changed = [];
  FORM_FIELD_KEYS.forEach(key => {
    const currentValue = current[key];
    const originalValue = original[key];
    if (Array.isArray(currentValue) || Array.isArray(originalValue)) {
      const currentJson = JSON.stringify(currentValue || []);
      const originalJson = JSON.stringify(originalValue || []);
      if (currentJson !== originalJson) {
        changed.push(key);
      }
    } else {
      const normalizedCurrent =
        currentValue === undefined || currentValue === null ? '' : currentValue;
      const normalizedOriginal =
        originalValue === undefined || originalValue === null ? '' : originalValue;
      if (normalizedCurrent !== normalizedOriginal) {
        changed.push(key);
      }
    }
  });
  return changed;
}

function getFieldConfig(key) {
  return FIELD_CONFIG_MAP[key] || null;
}

function validateField(key, value, form) {
  const config = getFieldConfig(key);
  if (!config) {
    return '';
  }
  let currentValue = value;
  if (config.type === 'textarea' || config.type === 'text') {
    currentValue = normalizeString(value);
  }

  if (config.required && !currentValue) {
    return `${config.label}不能为空`;
  }

  if (config.maxLength && currentValue && currentValue.length > config.maxLength) {
    return `${config.label}不能超过${config.maxLength}个字符`;
  }

  if (key === 'idNumber' && form.idType === '身份证' && currentValue) {
    const value = String(currentValue).trim();
    const regex18 = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/;
    const regex15 = /^[1-9]\d{7}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}$/;
    if (!regex18.test(value) && !regex15.test(value)) {
      return '身份证号码格式不正确';
    }
  }

  if ((key === 'phone' || key === 'backupPhone') && currentValue) {
    if (!/^1[3-9]\d{9}$/.test(currentValue)) {
      return '手机号格式不正确';
    }
  }

  if (key === 'birthDate' && currentValue) {
    const ts = toTimestampFromDateInput(currentValue);
    if (ts === undefined) {
      return '出生日期格式不正确';
    }
    if (ts > Date.now()) {
      return '出生日期不能晚于今天';
    }
  }

  if (key === 'intakeTime' && currentValue) {
    if (toTimestampFromDateInput(currentValue) === undefined) {
      return '入住时间格式不正确';
    }
  }

  if (key === 'narrative') {
    const text = normalizeString(value);
    if (!text) {
      return '';
    }
    if (text.length > 500) {
      return '情况说明不能超过 500 个字符';
    }
  }

  return '';
}

function validateAllFields(form) {
  const errors = {};
  [...PATIENT_FIELD_CONFIG, ...CONTACT_FIELD_CONFIG, ...INTAKE_FIELD_CONFIG].forEach(field => {
    const message = validateField(field.key, form[field.key], form);
    if (message) {
      errors[field.key] = message;
    }
  });
  return errors;
}

module.exports = {
  buildEditForm,
  cloneForm,
  detectFormChanges,
  buildPickerIndexMap,
  collectChangedFormKeys,
  getFieldConfig,
  validateField,
  validateAllFields,
};
