// 患者录入相关工具函数

// 证件号码校验
function validateIdNumber(idType, idNumber) {
  if (!idNumber || !idNumber.trim()) {
    return { valid: false, message: '请输入证件号码' };
  }

  const number = idNumber.trim();

  switch (idType) {
    case '身份证':
      return validateChineseId(number);
    case '护照':
      return validatePassport(number);
    case '军官证':
      return validateMilitaryId(number);
    default:
      return { valid: true }; // 其他类型暂不校验
  }
}

// 身份证号码校验
function validateChineseId(idNumber) {
  if (!/^[1-9]\d{17}$/.test(idNumber)) {
    return { valid: false, message: '身份证号码应为18位数字' };
  }

  // 校验码验证
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idNumber[i]) * weights[i];
  }

  const checkCode = codes[sum % 11];
  if (idNumber[17].toUpperCase() !== checkCode) {
    return { valid: false, message: '身份证号码校验码不正确' };
  }

  return { valid: true };
}

// 护照号码校验
function validatePassport(passport) {
  if (!/^[A-Za-z0-9]{6,12}$/.test(passport)) {
    return { valid: false, message: '护照号码格式不正确' };
  }
  return { valid: true };
}

// 军官证校验
function validateMilitaryId(militaryId) {
  if (!/^[A-Za-z0-9]{6,20}$/.test(militaryId)) {
    return { valid: false, message: '军官证号码格式不正确' };
  }
  return { valid: true };
}

// 手机号码校验
function validatePhone(phone) {
  if (!phone) {
    return { valid: true }; // 允许为空
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return { valid: false, message: '手机号码格式不正确' };
  }

  return { valid: true };
}

// 必填手机号码校验
function validateRequiredPhone(phone) {
  if (!phone || !phone.trim()) {
    return { valid: false, message: '请输入手机号码' };
  }

  return validatePhone(phone);
}

// 情况说明校验
function validateSituation(text, config = {}) {
  const {
    minLength = 30,
    maxLength = 500,
    keywords = ['护理', '症状', '康复', '治疗', '病情', '照顾', '功能', '障碍', '需要', '协助']
  } = config;

  if (!text || !text.trim()) {
    return { valid: false, message: '请填写情况说明' };
  }

  const trimmedText = text.trim();

  if (trimmedText.length < minLength) {
    return { valid: false, message: `情况说明至少需要${minLength}字` };
  }

  if (trimmedText.length > maxLength) {
    return { valid: false, message: `情况说明不能超过${maxLength}字` };
  }

  // 检查关键词
  const hasKeyword = keywords.some(keyword => trimmedText.includes(keyword));
  if (!hasKeyword) {
    return {
      valid: false,
      message: '情况说明应包含护理需求或症状相关信息',
      hint: `建议包含以下关键词：${keywords.slice(0, 5).join('、')}等`
    };
  }

  return { valid: true };
}

// 通用字段校验
function validateField(fieldName, value, rules = {}) {
  const {
    required = false,
    minLength,
    maxLength,
    pattern,
    minDate,
    maxDate,
    errorMessages = {}
  } = rules;

  // 必填检查
  if (required && (!value || !value.toString().trim())) {
    return {
      valid: false,
      message: errorMessages.required || `${fieldName}不能为空`
    };
  }

  // 如果不是必填且值为空，则通过校验
  if (!required && (!value || !value.toString().trim())) {
    return { valid: true };
  }

  const stringValue = value.toString().trim();

  // 长度校验
  if (minLength !== undefined && stringValue.length < minLength) {
    return {
      valid: false,
      message: errorMessages.minLength || `${fieldName}至少需要${minLength}个字符`
    };
  }

  if (maxLength !== undefined && stringValue.length > maxLength) {
    return {
      valid: false,
      message: errorMessages.maxLength || `${fieldName}不能超过${maxLength}个字符`
    };
  }

  // 正则表达式校验
  if (pattern && !new RegExp(pattern).test(stringValue)) {
    return {
      valid: false,
      message: errorMessages.pattern || `${fieldName}格式不正确`
    };
  }

  // 日期校验
  if (minDate || maxDate) {
    const date = new Date(stringValue);
    if (isNaN(date.getTime())) {
      return { valid: false, message: `${fieldName}格式不正确` };
    }

    if (minDate) {
      const min = minDate === 'today' ? new Date() : new Date(minDate);
      if (date < min) {
        return {
          valid: false,
          message: errorMessages.minDate || `${fieldName}不能早于${formatDate(min)}`
        };
      }
    }

    if (maxDate) {
      const max = maxDate === 'today' ? new Date() : new Date(maxDate);
      if (date > max) {
        return {
          valid: false,
          message: errorMessages.maxDate || `${fieldName}不能晚于${formatDate(max)}`
        };
      }
    }
  }

  return { valid: true };
}

// 表单整体校验
function validateForm(formData, validationRules = {}) {
  const errors = {};

  for (const [fieldName, value] of Object.entries(formData)) {
    const rules = validationRules[fieldName];
    if (!rules) continue;

    const result = validateField(fieldName, value, rules);
    if (!result.valid) {
      errors[fieldName] = result.message;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// 日期校验
function validateDate(dateStr, options = {}) {
  const { required = false, maxDate, minDate } = options;

  if (!dateStr) {
    return required
      ? { valid: false, message: '请选择日期' }
      : { valid: true };
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return { valid: false, message: '日期格式不正确' };
  }

  if (maxDate) {
    const max = new Date(maxDate);
    if (date > max) {
      return { valid: false, message: `日期不能晚于${formatDate(max)}` };
    }
  }

  if (minDate) {
    const min = new Date(minDate);
    if (date < min) {
      return { valid: false, message: `日期不能早于${formatDate(min)}` };
    }
  }

  return { valid: true };
}

// 出生日期校验
function validateBirthDate(birthDate) {
  const today = new Date();
  const maxDate = formatDate(today);
  const minDate = '1900-01-01';

  return validateDate(birthDate, {
    required: true,
    maxDate,
    minDate
  });
}

// 入住时间校验
function validateIntakeTime(intakeTime) {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const minDate = formatDate(sevenDaysAgo);

  return validateDate(intakeTime, {
    required: true,
    minDate
  });
}

// 格式化日期
function formatDate(date) {
  if (!date) return '';

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// 格式化日期时间
function formatDateTime(date) {
  if (!date) return '';

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const dateStr = formatDate(d);
  const hour = d.getHours().toString().padStart(2, '0');
  const minute = d.getMinutes().toString().padStart(2, '0');

  return `${dateStr} ${hour}:${minute}`;
}

// 计算年龄
function calculateAge(birthDate) {
  if (!birthDate) return '';

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '';

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age >= 0 ? `${age}岁` : '';
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

// 文件类型检测
function getFileCategory(fileName, mimeType) {
  const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const documentTypes = [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const documentExts = ['.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];

  // 首先检查MIME类型
  if (imageTypes.includes(mimeType)) return 'image';
  if (documentTypes.includes(mimeType)) return 'document';

  // 然后检查文件扩展名
  const ext = getFileExtension(fileName).toLowerCase();
  if (imageExts.includes(ext)) return 'image';
  if (documentExts.includes(ext)) return 'document';

  return 'unknown';
}

// 获取文件扩展名
function getFileExtension(fileName) {
  if (!fileName) return '';
  const lastDot = fileName.lastIndexOf('.');
  return lastDot >= 0 ? fileName.substring(lastDot) : '';
}

// 文件上传校验
function validateUploadFile(file, config = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['image', 'document']
  } = config;

  if (!file) {
    return { valid: false, message: '文件不能为空' };
  }

  if (file.size > maxSize) {
    const maxSizeText = formatFileSize(maxSize);
    return { valid: false, message: `文件大小不能超过${maxSizeText}` };
  }

  const category = getFileCategory(file.name, file.type);
  if (!allowedTypes.includes(category)) {
    return { valid: false, message: '不支持的文件类型' };
  }

  return { valid: true, category };
}

// 构建错误消息
function buildErrorMessage(errors) {
  const messages = Object.values(errors).filter(Boolean);
  return messages.length > 0 ? messages[0] : '';
}

// 调用患者媒体云函数
async function callPatientMedia(action, data = {}) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'patientMedia',
      data: { action, ...data }
    });

    if (!res.result) {
      throw new Error('云函数调用失败');
    }

    if (!res.result.success) {
      const error = res.result.error || {};
      throw new Error(error.message || '操作失败');
    }

    return res.result.data;
  } catch (error) {
    console.error('patientMedia 调用失败:', error);
    throw error;
  }
}

// 调用患者录入云函数
async function callPatientIntake(action, data = {}) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'patientIntake',
      data: { action, ...data }
    });

    if (!res.result) {
      throw new Error('云函数调用失败');
    }

    if (!res.result.success) {
      const error = res.result.error || {};
      throw new Error(error.message || '操作失败');
    }

    return res.result.data;
  } catch (error) {
    console.error('patientIntake 调用失败:', error);
    throw error;
  }
}

// 导出所有函数
module.exports = {
  // 校验函数
  validateIdNumber,
  validatePhone,
  validateRequiredPhone,
  validateSituation,
  validateDate,
  validateBirthDate,
  validateIntakeTime,
  validateUploadFile,
  validateField,
  validateForm,

  // 格式化函数
  formatDate,
  formatDateTime,
  formatFileSize,
  calculateAge,

  // 文件处理函数
  getFileCategory,
  getFileExtension,

  // 工具函数
  buildErrorMessage,

  // 云函数调用
  callPatientMedia,
  callPatientIntake
};