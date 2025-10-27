// utils/admin-utils.js
// 管理员功能通用工具函数
const logger = require('./logger');

/**
 * 统一的加载状态管理
 */
class LoadingManager {
  constructor() {
    this.loadingStates = new Map();
    this.loadingCallbacks = new Map();
  }

  /**
   * 开始加载
   * @param {string} key 加载标识
   * @param {Function} callback 状态变化回调
   */
  start(key, callback) {
    this.loadingStates.set(key, true);
    if (callback) {
      this.loadingCallbacks.set(key, callback);
      callback(true);
    }
  }

  /**
   * 结束加载
   * @param {string} key 加载标识
   */
  end(key) {
    this.loadingStates.set(key, false);
    const callback = this.loadingCallbacks.get(key);
    if (callback) {
      callback(false);
    }
  }

  /**
   * 获取加载状态
   * @param {string} key 加载标识
   * @returns {boolean}
   */
  isLoading(key) {
    return this.loadingStates.get(key) || false;
  }

  /**
   * 清除所有加载状态
   */
  clearAll() {
    this.loadingStates.clear();
    this.loadingCallbacks.clear();
  }
}

/**
 * 统一的错误处理机制
 */
class ErrorHandler {
  constructor() {
    this.errorTypes = {
      NETWORK: 'network',
      PERMISSION: 'permission',
      VALIDATION: 'validation',
      BUSINESS: 'business',
      SYSTEM: 'system'
    };
  }

  /**
   * 处理错误
   * @param {Error} error 错误对象
   * @param {string} type 错误类型
   * @param {Object} context 上下文信息
   * @returns {Object} 格式化的错误信息
   */
  handle(error, type = this.errorTypes.SYSTEM, context = {}) {
    const errorInfo = {
      type,
      message: this.getErrorMessage(error, type),
      code: error.code || 'UNKNOWN',
      timestamp: new Date().toISOString(),
      context,
      originalError: error
    };

    // 记录错误日志
    this.logError(errorInfo);

    // 显示用户友好的错误提示
    this.showUserError(errorInfo);

    return errorInfo;
  }

  /**
   * 获取用户友好的错误信息
   * @param {Error} error 原始错误
   * @param {string} type 错误类型
   * @returns {string}
   */
  getErrorMessage(error, type) {
    const messages = {
      [this.errorTypes.NETWORK]: '网络连接异常，请检查网络设置',
      [this.errorTypes.PERMISSION]: '权限不足，请联系管理员',
      [this.errorTypes.VALIDATION]: '输入信息有误，请检查后重试',
      [this.errorTypes.BUSINESS]: '操作失败，请稍后重试',
      [this.errorTypes.SYSTEM]: '系统异常，请联系技术支持'
    };

    return messages[type] || error.message || '操作失败';
  }

  /**
   * 记录错误日志
   * @param {Object} errorInfo 错误信息
   */
  logError(errorInfo) {
    logger.error('[Admin Error]', errorInfo);

    // 这里可以添加错误上报逻辑
    if (typeof wx !== 'undefined') {
      wx.cloud.callFunction({
        name: 'admin',
        data: {
          action: 'logError',
          errorInfo
        }
      }).catch(err => {
        logger.error('Error logging failed:', err);
      });
    }
  }

  /**
   * 显示用户错误提示
   * @param {Object} errorInfo 错误信息
   */
  showUserError(errorInfo) {
    if (typeof wx !== 'undefined') {
      wx.showToast({
        title: errorInfo.message,
        icon: 'none',
        duration: 3000
      });
    }
  }

  /**
   * 创建自定义错误
   * @param {string} message 错误信息
   * @param {string} code 错误代码
   * @param {string} type 错误类型
   * @returns {Error}
   */
  createError(message, code = 'CUSTOM_ERROR', type = this.errorTypes.BUSINESS) {
    const error = new Error(message);
    error.code = code;
    error.type = type;
    return error;
  }
}

/**
 * 数据验证工具
 */
class Validator {
  /**
   * 验证邮箱
   * @param {string} email 邮箱地址
   * @returns {boolean}
   */
  static isEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证手机号
   * @param {string} phone 手机号
   * @returns {boolean}
   */
  static isPhone(phone) {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 验证用户名
   * @param {string} username 用户名
   * @returns {Object}
   */
  static validateUsername(username) {
    const result = { valid: true, message: '' };

    if (!username || username.trim().length === 0) {
      result.valid = false;
      result.message = '用户名不能为空';
    } else if (username.length < 2) {
      result.valid = false;
      result.message = '用户名至少需要2个字符';
    } else if (username.length > 20) {
      result.valid = false;
      result.message = '用户名不能超过20个字符';
    } else if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(username)) {
      result.valid = false;
      result.message = '用户名只能包含中文、字母、数字和下划线';
    }

    return result;
  }

  /**
   * 验证密码强度
   * @param {string} password 密码
   * @returns {Object}
   */
  static validatePassword(password) {
    const result = { valid: true, message: '', strength: 'weak' };

    if (!password || password.length < 6) {
      result.valid = false;
      result.message = '密码至少需要6个字符';
    } else if (password.length > 20) {
      result.valid = false;
      result.message = '密码不能超过20个字符';
    } else {
      let score = 0;
      if (/[a-z]/.test(password)) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^a-zA-Z0-9]/.test(password)) score++;

      if (score >= 3) {
        result.strength = 'strong';
      } else if (score >= 2) {
        result.strength = 'medium';
      }
    }

    return result;
  }

  /**
   * 验证必填字段
   * @param {any} value 值
   * @param {string} fieldName 字段名
   * @returns {Object}
   */
  static validateRequired(value, fieldName) {
    const result = { valid: true, message: '' };

    if (value === null || value === undefined ||
        (typeof value === 'string' && value.trim() === '')) {
      result.valid = false;
      result.message = `${fieldName}不能为空`;
    }

    return result;
  }
}

/**
 * 数据缓存管理
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5分钟默认过期时间
  }

  /**
   * 设置缓存
   * @param {string} key 缓存键
   * @param {any} value 缓存值
   * @param {number} ttl 过期时间(毫秒)
   */
  set(key, value, ttl = this.defaultTTL) {
    // 清除已有的定时器
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });

    // 设置过期定时器
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.timers.set(key, timer);
  }

  /**
   * 获取缓存
   * @param {string} key 缓存键
   * @returns {any|null}
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * 删除缓存
   * @param {string} key 缓存键
   */
  delete(key) {
    this.cache.delete(key);

    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * 清除所有缓存
   */
  clear() {
    this.cache.clear();

    // 清除所有定时器
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  /**
   * 获取缓存大小
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}

/**
 * 防抖工具
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流工具
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 格式化数字
 * @param {number} num 数字
 * @param {string} defaultValue 默认值
 * @returns {string}
 */
function formatNumber(num, defaultValue = '--') {
  if (num === null || num === undefined || isNaN(num)) {
    return defaultValue;
  }
  return num.toLocaleString();
}

/**
 * 格式化文件大小
 * @param {number} bytes 字节数
 * @returns {string}
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 深拷贝对象
 * @param {any} obj 要拷贝的对象
 * @returns {any}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * 生成唯一ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 检查是否为空值
 * @param {any} value 值
 * @returns {boolean}
 */
function isEmpty(value) {
  return value === null ||
         value === undefined ||
         (typeof value === 'string' && value.trim() === '') ||
         (Array.isArray(value) && value.length === 0);
}

// 创建全局实例
const loadingManager = new LoadingManager();
const errorHandler = new ErrorHandler();
const cacheManager = new CacheManager();

// 导出工具
module.exports = {
  loadingManager,
  errorHandler,
  cacheManager,
  Validator,
  debounce,
  throttle,
  formatNumber,
  formatFileSize,
  deepClone,
  generateId,
  isEmpty
};
