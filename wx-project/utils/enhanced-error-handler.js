// 增强错误处理器
const PERFORMANCE_CONFIG = require('../config/performance-config');
const performanceMonitor = require('./performance-monitor');

class EnhancedErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.isReporting = false;
    this.retryCount = new Map();
    this.setupGlobalHandlers();
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalHandlers() {
    // 微信小程序错误处理
    if (typeof wx !== 'undefined') {
      wx.onError && wx.onError((error) => {
        this.handleError(new Error(error), {
          source: 'wx.onError',
          type: 'javascript'
        });
      });

      wx.onUnhandledRejection && wx.onUnhandledRejection((event) => {
        this.handleError(event.reason, {
          source: 'wx.onUnhandledRejection',
          type: 'promise_rejection'
        });
      });
    }

    // 浏览器环境错误处理
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleError(event.error || new Error(event.message), {
          source: 'window.error',
          type: 'javascript',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, {
          source: 'window.unhandledrejection',
          type: 'promise_rejection'
        });
      });
    }
  }

  /**
   * 处理错误
   */
  handleError(error, context = {}) {
    // 标准化错误对象
    const standardError = this.standardizeError(error);

    // 增加上下文信息
    standardError.context = {
      ...context,
      timestamp: new Date().toISOString(),
      userAgent: this.getUserAgent(),
      url: this.getCurrentUrl(),
      userId: this.getCurrentUserId()
    };

    // 记录性能监控
    performanceMonitor.recordError(standardError, context);

    // 根据错误类型处理
    this.handleByErrorType(standardError, context);

    // 添加到上报队列
    this.queueErrorForReporting(standardError);

    // 显示用户友好消息
    this.showUserMessage(standardError, context);

    return standardError;
  }

  /**
   * 标准化错误对象
   */
  standardizeError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code || 'UNKNOWN_ERROR'
      };
    }

    if (typeof error === 'string') {
      return {
        name: 'Error',
        message: error,
        stack: null,
        code: 'STRING_ERROR'
      };
    }

    if (typeof error === 'object' && error !== null) {
      return {
        name: error.name || 'Error',
        message: error.message || error.errMsg || JSON.stringify(error),
        stack: error.stack,
        code: error.code || error.errCode || 'OBJECT_ERROR'
      };
    }

    return {
      name: 'Error',
      message: String(error),
      stack: null,
      code: 'UNKNOWN_ERROR'
    };
  }

  /**
   * 根据错误类型处理
   */
  handleByErrorType(error, context) {
    const { code, message } = error;

    // 网络错误
    if (this.isNetworkError(error)) {
      this.handleNetworkError(error, context);
    }
    // 权限错误
    else if (this.isPermissionError(error)) {
      this.handlePermissionError(error, context);
    }
    // 验证错误
    else if (this.isValidationError(error)) {
      this.handleValidationError(error, context);
    }
    // 服务器错误
    else if (this.isServerError(error)) {
      this.handleServerError(error, context);
    }
    // 未知错误
    else {
      this.handleUnknownError(error, context);
    }
  }

  /**
   * 判断是否为网络错误
   */
  isNetworkError(error) {
    const networkKeywords = [
      'network', 'timeout', 'connection', 'fetch', 'request',
      '网络', '超时', '连接', '请求'
    ];

    const lowerMessage = error.message.toLowerCase();
    return networkKeywords.some(keyword =>
      lowerMessage.includes(keyword.toLowerCase())
    ) || error.code === 'NETWORK_ERROR';
  }

  /**
   * 判断是否为权限错误
   */
  isPermissionError(error) {
    const permissionKeywords = [
      'permission', 'unauthorized', 'forbidden', 'access denied',
      '权限', '未授权', '禁止访问'
    ];

    const lowerMessage = error.message.toLowerCase();
    return permissionKeywords.some(keyword =>
      lowerMessage.includes(keyword.toLowerCase())
    ) || error.code === 'PERMISSION_DENIED';
  }

  /**
   * 判断是否为验证错误
   */
  isValidationError(error) {
    const validationKeywords = [
      'validation', 'invalid', 'required', 'format', 'schema',
      '验证', '无效', '必填', '格式'
    ];

    const lowerMessage = error.message.toLowerCase();
    return validationKeywords.some(keyword =>
      lowerMessage.includes(keyword.toLowerCase())
    ) || error.code === 'VALIDATION_ERROR';
  }

  /**
   * 判断是否为服务器错误
   */
  isServerError(error) {
    const serverKeywords = [
      'server', 'internal', '500', '502', '503', '504',
      '服务器', '内部错误'
    ];

    const lowerMessage = error.message.toLowerCase();
    return serverKeywords.some(keyword =>
      lowerMessage.includes(keyword.toLowerCase())
    ) || error.code === 'SERVER_ERROR';
  }

  /**
   * 处理网络错误
   */
  handleNetworkError(error, context) {
    console.error('[ErrorHandler] Network error:', error);

    // 自动重试逻辑
    if (context.enableRetry !== false) {
      this.scheduleRetry(error, context);
    }

    // 清理相关缓存
    this.clearRelevantCache(context);
  }

  /**
   * 处理权限错误
   */
  handlePermissionError(error, context) {
    console.error('[ErrorHandler] Permission error:', error);

    // 清理用户权限缓存
    if (typeof wx !== 'undefined' && wx.removeStorageSync) {
      wx.removeStorageSync('userInfo');
      wx.removeStorageSync('permissions');
    }

    // 跳转到登录页面
    if (context.redirectToLogin !== false) {
      setTimeout(() => {
        if (typeof wx !== 'undefined') {
          wx.navigateTo({
            url: '/pages/auth/login/index'
          });
        }
      }, 1500);
    }
  }

  /**
   * 处理验证错误
   */
  handleValidationError(error, context) {
    console.error('[ErrorHandler] Validation error:', error);

    // 显示详细的验证错误信息
    if (context.showDetails !== false) {
      this.showValidationDetails(error, context);
    }
  }

  /**
   * 处理服务器错误
   */
  handleServerError(error, context) {
    console.error('[ErrorHandler] Server error:', error);

    // 服务器错误时降低请求频率
    this.adjustRequestFrequency();
  }

  /**
   * 处理未知错误
   */
  handleUnknownError(error, context) {
    console.error('[ErrorHandler] Unknown error:', error);

    // 记录详细信息以便调试
    this.logErrorForDebugging(error, context);
  }

  /**
   * 显示用户友好消息
   */
  showUserMessage(error, context) {
    const messageKey = this.getMessageKey(error);
    const userMessage = PERFORMANCE_CONFIG.ERROR_HANDLING.USER_MESSAGES[messageKey] ||
                      PERFORMANCE_CONFIG.ERROR_HANDLING.USER_MESSAGES.UNKNOWN_ERROR;

    if (context.showToast !== false && typeof wx !== 'undefined') {
      wx.showToast({
        title: userMessage,
        icon: 'none',
        duration: 3000
      });
    }
  }

  /**
   * 获取消息键
   */
  getMessageKey(error) {
    if (this.isNetworkError(error)) return 'NETWORK_ERROR';
    if (this.isPermissionError(error)) return 'PERMISSION_ERROR';
    if (this.isValidationError(error)) return 'VALIDATION_ERROR';
    if (this.isServerError(error)) return 'SERVER_ERROR';
    return 'UNKNOWN_ERROR';
  }

  /**
   * 计划重试
   */
  scheduleRetry(error, context) {
    const retryKey = `${context.operation || 'unknown'}_${error.code}`;
    const currentRetryCount = this.retryCount.get(retryKey) || 0;
    const maxRetries = context.maxRetries || PERFORMANCE_CONFIG.REQUEST.RETRY.MAX_ATTEMPTS;

    if (currentRetryCount < maxRetries) {
      const delay = this.calculateRetryDelay(currentRetryCount);

      setTimeout(() => {
        this.retryCount.set(retryKey, currentRetryCount + 1);

        if (context.retryCallback) {
          context.retryCallback();
        }
      }, delay);
    } else {
      // 重试次数用完，清除计数
      this.retryCount.delete(retryKey);
    }
  }

  /**
   * 计算重试延迟
   */
  calculateRetryDelay(attempt) {
    const config = PERFORMANCE_CONFIG.REQUEST.RETRY;
    const delay = config.DELAY * Math.pow(config.BACKOFF_FACTOR, attempt);
    return Math.min(delay, config.MAX_DELAY);
  }

  /**
   * 清理相关缓存
   */
  clearRelevantCache(context) {
    if (context.cacheKey && typeof wx !== 'undefined') {
      wx.removeStorageSync(context.cacheKey);
    }
  }

  /**
   * 显示验证详情
   */
  showValidationDetails(error, context) {
    if (typeof wx !== 'undefined') {
      wx.showModal({
        title: '输入错误',
        content: error.message,
        showCancel: false
      });
    }
  }

  /**
   * 调整请求频率
   */
  adjustRequestFrequency() {
    // 实现请求频率调整逻辑
    console.log('[ErrorHandler] Adjusting request frequency due to server errors');
  }

  /**
   * 记录错误信息用于调试
   */
  logErrorForDebugging(error, context) {
    const debugInfo = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context,
      timestamp: new Date().toISOString()
    };

    console.error('[ErrorHandler] Debug info:', debugInfo);
  }

  /**
   * 添加错误到上报队列
   */
  queueErrorForReporting(error) {
    if (!PERFORMANCE_CONFIG.ERROR_HANDLING.REPORTING.ENABLED) return;

    this.errorQueue.push(error);

    // 批量上报
    if (this.errorQueue.length >= PERFORMANCE_CONFIG.ERROR_HANDLING.REPORTING.BATCH_SIZE) {
      this.flushErrorQueue();
    } else if (!this.isReporting) {
      // 定时上报
      setTimeout(() => {
        this.flushErrorQueue();
      }, PERFORMANCE_CONFIG.ERROR_HANDLING.REPORTING.FLUSH_INTERVAL);
    }
  }

  /**
   * 刷新错误队列（上报错误）
   */
  async flushErrorQueue() {
    if (this.errorQueue.length === 0 || this.isReporting) return;

    this.isReporting = true;
    const errors = this.errorQueue.splice(0, PERFORMANCE_CONFIG.ERROR_HANDLING.REPORTING.BATCH_SIZE);

    try {
      await this.reportErrors(errors);
    } catch (reportError) {
      console.error('[ErrorHandler] Failed to report errors:', reportError);
      // 上报失败，重新加入队列
      this.errorQueue.unshift(...errors);
    } finally {
      this.isReporting = false;
    }
  }

  /**
   * 上报错误到服务器
   */
  async reportErrors(errors) {
    if (typeof wx !== 'undefined') {
      return new Promise((resolve, reject) => {
        wx.request({
          url: PERFORMANCE_CONFIG.ERROR_HANDLING.REPORTING.ENDPOINT,
          method: 'POST',
          data: {
            errors,
            appVersion: this.getAppVersion(),
            deviceInfo: this.getDeviceInfo()
          },
          success: resolve,
          fail: reject
        });
      });
    }
  }

  /**
   * 获取用户代理信息
   */
  getUserAgent() {
    if (typeof wx !== 'undefined') {
      return wx.getSystemInfoSync().platform || 'unknown';
    }
    return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  }

  /**
   * 获取当前URL
   */
  getCurrentUrl() {
    if (typeof wx !== 'undefined') {
      const pages = getCurrentPages();
      if (pages.length > 0) {
        return pages[pages.length - 1].route || 'unknown';
      }
    }
    return typeof window !== 'undefined' ? window.location.href : 'unknown';
  }

  /**
   * 获取当前用户ID
   */
  getCurrentUserId() {
    try {
      if (typeof wx !== 'undefined') {
        const userInfo = wx.getStorageSync('userInfo');
        return userInfo?.id || userInfo?.openid || 'anonymous';
      }
    } catch (error) {
      // 忽略获取用户信息失败
    }
    return 'anonymous';
  }

  /**
   * 获取应用版本
   */
  getAppVersion() {
    try {
      if (typeof wx !== 'undefined') {
        const appInfo = wx.getAccountInfoSync();
        return appInfo.miniProgram?.version || 'unknown';
      }
    } catch (error) {
      // 忽略获取版本信息失败
    }
    return 'unknown';
  }

  /**
   * 获取设备信息
   */
  getDeviceInfo() {
    try {
      if (typeof wx !== 'undefined') {
        return wx.getSystemInfoSync();
      }
    } catch (error) {
      // 忽略获取设备信息失败
    }
    return {};
  }

  /**
   * 创建特定类型的错误
   */
  createError(message, code, type) {
    const error = new Error(message);
    error.code = code;
    error.type = type;
    return error;
  }

  /**
   * 清理错误处理器
   */
  cleanup() {
    this.errorQueue = [];
    this.retryCount.clear();
    this.isReporting = false;
  }
}

// 创建全局错误处理器实例
const enhancedErrorHandler = new EnhancedErrorHandler();

module.exports = enhancedErrorHandler;
