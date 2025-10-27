// utils/validators.js

/**
 * 表单验证工具类
 */
class Validators {
  /**
   * 验证姓名
   * @param {string} name - 姓名字符串
   * @returns {boolean}
   */
  static name(name) {
    if (!name || typeof name !== 'string') {
      return false;
    }

    // 去除空格后长度检查
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20) {
      return false;
    }

    // 支持中文、英文、少数点号
    const nameRegex = /^[\u4e00-\u9fa5a-zA-Z.]+$/;
    return nameRegex.test(trimmedName);
  }

  /**
   * 验证手机号
   * @param {string} phone - 手机号字符串
   * @returns {boolean}
   */
  static phone(phone) {
    if (!phone || typeof phone !== 'string') {
      return false;
    }

    // 中国大陆手机号正则
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 验证身份证号
   * @param {string} idCard - 身份证号字符串
   * @returns {boolean}
   */
  static idCard(idCard) {
    if (!idCard || typeof idCard !== 'string') {
      return false;
    }

    // 18位身份证号正则
    const idCardRegex = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    return idCardRegex.test(idCard);
  }

  /**
   * 验证邮箱
   * @param {string} email - 邮箱地址
   * @returns {boolean}
   */
  static email(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证密码强度
   * @param {string} password - 密码字符串
   * @returns {object} - 验证结果
   */
  static password(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, errors: ['密码不能为空'] };
    }

    const errors = [];

    if (password.length < 8) {
      errors.push('密码长度至少8位');
    }

    if (password.length > 20) {
      errors.push('密码长度不能超过20位');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }

    if (!/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证邀请码格式
   * @param {string} code - 邀请码字符串
   * @returns {boolean}
   */
  static inviteCode(code) {
    if (!code || typeof code !== 'string') {
      return false;
    }

    // 8位大写字母和数字
    const codeRegex = /^[A-Z0-9]{8}$/;
    return codeRegex.test(code.toUpperCase());
  }

  /**
   * 验证年龄范围
   * @param {number} age - 年龄数值
   * @param {number} min - 最小年龄
   * @param {number} max - 最大年龄
   * @returns {boolean}
   */
  static age(age, min = 0, max = 150) {
    const numAge = Number(age);

    if (isNaN(numAge)) {
      return false;
    }

    return numAge >= min && numAge <= max;
  }

  /**
   * 验证文本长度
   * @param {string} text - 文本内容
   * @param {number} minLength - 最小长度
   * @param {number} maxLength - 最大长度
   * @returns {boolean}
   */
  static textLength(text, minLength = 0, maxLength = 1000) {
    if (typeof text !== 'string') {
      return false;
    }

    const length = text.trim().length;
    return length >= minLength && length <= maxLength;
  }

  /**
   * 验证URL格式
   * @param {string} url - URL地址
   * @returns {boolean}
   */
  static url(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证日期格式
   * @param {string} date - 日期字符串
   * @param {string} format - 日期格式 (YYYY-MM-DD, YYYY/MM/DD等)
   * @returns {boolean}
   */
  static date(date, format = 'YYYY-MM-DD') {
    if (!date || typeof date !== 'string') {
      return false;
    }

    let regex;

    switch (format) {
      case 'YYYY-MM-DD':
        regex = /^\d{4}-\d{2}-\d{2}$/;
        break;
      case 'YYYY/MM/DD':
        regex = /^\d{4}\/\d{2}\/\d{2}$/;
        break;
      default:
        return false;
    }

    if (!regex.test(date)) {
      return false;
    }

    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }

  /**
   * 验证文件大小
   * @param {number} size - 文件大小（字节）
   * @param {number} maxSize - 最大大小（字节）
   * @returns {boolean}
   */
  static fileSize(size, maxSize) {
    if (typeof size !== 'number' || size < 0) {
      return false;
    }

    return size <= maxSize;
  }

  /**
   * 验证文件类型
   * @param {string} filename - 文件名
   * @param {string[]} allowedTypes - 允许的文件类型
   * @returns {boolean}
   */
  static fileType(filename, allowedTypes) {
    if (!filename || typeof filename !== 'string') {
      return false;
    }

    const extension = filename.split('.').pop().toLowerCase();
    return allowedTypes.includes(extension);
  }

  /**
   * 验证申请理由
   * @param {string} reason - 申请理由
   * @returns {object}
   */
  static applicationReason(reason) {
    if (!reason || typeof reason !== 'string') {
      return { valid: false, error: '申请理由不能为空' };
    }

    const trimmedReason = reason.trim();

    if (trimmedReason.length < 10) {
      return { valid: false, error: '申请理由至少需要10个字符' };
    }

    if (trimmedReason.length > 500) {
      return { valid: false, error: '申请理由不能超过500个字符' };
    }

    return { valid: true };
  }

  /**
   * 验证职业类型
   * @param {string} occupation - 职业类型
   * @returns {boolean}
   */
  static occupation(occupation) {
    const validOccupations = [
      'social_worker',    // 社工
      'volunteer',        // 志愿者
      'medical_staff',    // 医务人员
      'teacher',          // 教师
      'student',          // 学生
      'other'             // 其他
    ];

    return validOccupations.includes(occupation);
  }

  /**
   * 获取验证错误消息
   * @param {string} field - 字段名
   * @param {string} type - 验证类型
   * @returns {string}
   */
  static getErrorMessage(field, type) {
    const messages = {
      name: {
        required: '请输入姓名',
        invalid: '姓名格式不正确',
        length: '姓名长度应在2-20个字符之间'
      },
      phone: {
        required: '请输入手机号',
        invalid: '手机号格式不正确'
      },
      email: {
        required: '请输入邮箱',
        invalid: '邮箱格式不正确'
      },
      inviteCode: {
        required: '请输入邀请码',
        invalid: '邀请码格式不正确',
        length: '邀请码必须是8位字符'
      },
      reason: {
        required: '请输入申请理由',
        invalid: '申请理由格式不正确',
        length: '申请理由长度应在10-500个字符之间'
      },
      occupation: {
        required: '请选择职业类型',
        invalid: '职业类型不正确'
      }
    };

    return messages[field]?.[type] || `${field}验证失败`;
  }
}

/**
 * 综合表单验证器
 */
class FormValidator {
  constructor(rules = {}) {
    this.rules = rules;
    this.errors = {};
  }

  /**
   * 添加验证规则
   * @param {string} field - 字段名
   * @param {object} rule - 验证规则
   */
  addRule(field, rule) {
    this.rules[field] = rule;
  }

  /**
   * 验证单个字段
   * @param {string} field - 字段名
   * @param {any} value - 字段值
   * @returns {boolean}
   */
  validateField(field, value) {
    const rule = this.rules[field];
    if (!rule) {
      return true;
    }

    const errors = [];

    // 必填验证
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(Validators.getErrorMessage(field, 'required'));
      this.errors[field] = errors;
      return false;
    }

    // 如果字段为空且非必填，跳过其他验证
    if (value === undefined || value === null || value === '') {
      delete this.errors[field];
      return true;
    }

    // 类型验证
    if (rule.type) {
      let isValid = false;

      switch (rule.type) {
        case 'name':
          isValid = Validators.name(value);
          break;
        case 'phone':
          isValid = Validators.phone(value);
          break;
        case 'email':
          isValid = Validators.email(value);
          break;
        case 'idCard':
          isValid = Validators.idCard(value);
          break;
        case 'inviteCode':
          isValid = Validators.inviteCode(value);
          break;
        case 'age':
          isValid = Validators.age(value, rule.min, rule.max);
          break;
        case 'url':
          isValid = Validators.url(value);
          break;
        case 'date':
          isValid = Validators.date(value, rule.format);
          break;
        case 'reason': {
          const reasonResult = Validators.applicationReason(value);
          isValid = reasonResult.valid;
          if (!isValid) {
            errors.push(reasonResult.error);
          }
          break;
        }
        case 'occupation':
          isValid = Validators.occupation(value);
          break;
        default:
          isValid = true;
      }

      if (!isValid && errors.length === 0) {
        errors.push(Validators.getErrorMessage(field, 'invalid'));
      }
    }

    // 长度验证
    if (rule.minLength !== undefined || rule.maxLength !== undefined) {
      const length = String(value).length;

      if (rule.minLength !== undefined && length < rule.minLength) {
        errors.push(`${field}长度不能少于${rule.minLength}个字符`);
      }

      if (rule.maxLength !== undefined && length > rule.maxLength) {
        errors.push(`${field}长度不能超过${rule.maxLength}个字符`);
      }
    }

    // 自定义验证
    if (rule.validator && typeof rule.validator === 'function') {
      const customResult = rule.validator(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${field}验证失败`);
      }
    }

    if (errors.length > 0) {
      this.errors[field] = errors;
      return false;
    } else {
      delete this.errors[field];
      return true;
    }
  }

  /**
   * 验证整个表单
   * @param {object} data - 表单数据
   * @returns {boolean}
   */
  validate(data) {
    let isValid = true;

    Object.keys(this.rules).forEach(field => {
      if (!this.validateField(field, data[field])) {
        isValid = false;
      }
    });

    return isValid;
  }

  /**
   * 获取所有错误
   * @returns {object}
   */
  getErrors() {
    return this.errors;
  }

  /**
   * 获取字段错误
   * @param {string} field - 字段名
   * @returns {string[]}
   */
  getFieldErrors(field) {
    return this.errors[field] || [];
  }

  /**
   * 获取第一个错误消息
   * @param {string} field - 字段名
   * @returns {string|null}
   */
  getFirstError(field) {
    const errors = this.getFieldErrors(field);
    return errors.length > 0 ? errors[0] : null;
  }

  /**
   * 清除所有错误
   */
  clearErrors() {
    this.errors = {};
  }

  /**
   * 清除字段错误
   * @param {string} field - 字段名
   */
  clearFieldErrors(field) {
    delete this.errors[field];
  }

  /**
   * 检查是否有错误
   * @returns {boolean}
   */
  hasErrors() {
    return Object.keys(this.errors).length > 0;
  }

  /**
   * 获取错误数量
   * @returns {number}
   */
  getErrorCount() {
    return Object.keys(this.errors).length;
  }
}

module.exports = {
  Validators,
  FormValidator
};
