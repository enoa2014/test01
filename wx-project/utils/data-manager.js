// utils/data-manager.js
// 数据管理工具 - 优化数据加载、缓存和错误处理
const logger = require('./logger');

const { errorHandler, cacheManager, debounce, isEmpty } = require('./admin-utils');

/**
 * 数据管理器
 */
class DataManager {
  constructor(options = {}) {
    this.options = {
      // 默认配置
      pageSize: 20,
      cacheTimeout: 5 * 60 * 1000, // 5分钟
      retryTimes: 3,
      retryDelay: 1000,
      enableCache: true,
      enableDebounce: true,
      debounceDelay: 300,
      ...options
    };

    // 请求队列
    this.requestQueue = new Map();
    // 正在进行的请求
    this.pendingRequests = new Map();
  }

  /**
   * 获取数据列表
   * @param {Object} options 请求选项
   * @returns {Promise<Object>}
   */
  async getList(options = {}) {
    const {
      api,
      params = {},
      cacheKey,
      page = 1,
      pageSize = this.options.pageSize,
      forceRefresh = false
    } = options;

    try {
      // 检查缓存
      if (!forceRefresh && this.options.enableCache && cacheKey) {
        const cachedData = cacheManager.get(cacheKey);
        if (cachedData) {
          logger.info(`[DataManager] Cache hit for ${cacheKey}`);
          return cachedData;
        }
      }

      // 检查是否有相同的请求正在进行
      const requestKey = this.generateRequestKey(api, params, page, pageSize);
      if (this.pendingRequests.has(requestKey)) {
        logger.info(`[DataManager] Request already pending for ${requestKey}`);
        return this.pendingRequests.get(requestKey);
      }

      // 创建请求Promise
      const requestPromise = this.executeRequest(api, {
        ...params,
        page,
        pageSize
      });

      // 记录正在进行的请求
      this.pendingRequests.set(requestKey, requestPromise);

      try {
        const result = await requestPromise;

        // 缓存结果
        if (this.options.enableCache && cacheKey && result.success) {
          cacheManager.set(cacheKey, result, this.options.cacheTimeout);
        }

        return result;
      } finally {
        // 清除正在进行的请求记录
        this.pendingRequests.delete(requestKey);
      }

    } catch (error) {
      logger.error(`[DataManager] Failed to get list:`, error);
      throw errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        api,
        params,
        operation: 'getList'
      });
    }
  }

  /**
   * 获取详情数据
   * @param {Object} options 请求选项
   * @returns {Promise<Object>}
   */
  async getDetail(options = {}) {
    const {
      api,
      id,
      params = {},
      cacheKey,
      forceRefresh = false
    } = options;

    try {
      // 检查缓存
      if (!forceRefresh && this.options.enableCache && cacheKey) {
        const cachedData = cacheManager.get(cacheKey);
        if (cachedData) {
          logger.info(`[DataManager] Cache hit for detail ${cacheKey}`);
          return cachedData;
        }
      }

      const requestKey = this.generateRequestKey(api, { id, ...params });
      if (this.pendingRequests.has(requestKey)) {
        return this.pendingRequests.get(requestKey);
      }

      const requestPromise = this.executeRequest(api, { id, ...params });
      this.pendingRequests.set(requestKey, requestPromise);

      try {
        const result = await requestPromise;

        if (this.options.enableCache && cacheKey && result.success) {
          cacheManager.set(cacheKey, result, this.options.cacheTimeout);
        }

        return result;
      } finally {
        this.pendingRequests.delete(requestKey);
      }

    } catch (error) {
      logger.error(`[DataManager] Failed to get detail:`, error);
      throw errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        api,
        id,
        params,
        operation: 'getDetail'
      });
    }
  }

  /**
   * 创建数据
   * @param {Object} options 请求选项
   * @returns {Promise<Object>}
   */
  async create(options = {}) {
    const {
      api,
      data,
      params = {},
      invalidateCache = []
    } = options;

    try {
      const result = await this.executeRequest(api, data, 'POST');

      // 清除相关缓存
      if (invalidateCache.length > 0) {
        this.invalidateCache(invalidateCache);
      }

      return result;

    } catch (error) {
      logger.error(`[DataManager] Failed to create:`, error);
      throw errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        api,
        data,
        params,
        operation: 'create'
      });
    }
  }

  /**
   * 更新数据
   * @param {Object} options 请求选项
   * @returns {Promise<Object>}
   */
  async update(options = {}) {
    const {
      api,
      id,
      data,
      params = {},
      invalidateCache = []
    } = options;

    try {
      const result = await this.executeRequest(api, { id, ...data, ...params }, 'PUT');

      // 清除相关缓存
      if (invalidateCache.length > 0) {
        this.invalidateCache(invalidateCache);
      }

      return result;

    } catch (error) {
      logger.error(`[DataManager] Failed to update:`, error);
      throw errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        api,
        id,
        data,
        params,
        operation: 'update'
      });
    }
  }

  /**
   * 删除数据
   * @param {Object} options 请求选项
   * @returns {Promise<Object>}
   */
  async delete(options = {}) {
    const {
      api,
      id,
      params = {},
      invalidateCache = []
    } = options;

    try {
      const result = await this.executeRequest(api, { id, ...params }, 'DELETE');

      // 清除相关缓存
      if (invalidateCache.length > 0) {
        this.invalidateCache(invalidateCache);
      }

      return result;

    } catch (error) {
      logger.error(`[DataManager] Failed to delete:`, error);
      throw errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        api,
        id,
        params,
        operation: 'delete'
      });
    }
  }

  /**
   * 批量操作
   * @param {Object} options 请求选项
   * @returns {Promise<Object>}
   */
  async batchOperation(options = {}) {
    const {
      api,
      operation,
      data = [],
      params = {},
      invalidateCache = []
    } = options;

    try {
      const result = await this.executeRequest(api, {
        operation,
        data,
        ...params
      }, 'POST');

      // 清除相关缓存
      if (invalidateCache.length > 0) {
        this.invalidateCache(invalidateCache);
      }

      return result;

    } catch (error) {
      logger.error(`[DataManager] Failed batch operation:`, error);
      throw errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        api,
        operation,
        data,
        params,
        batchOperation: true
      });
    }
  }

  /**
   * 执行请求
   * @param {string} api API名称
   * @param {Object} data 请求数据
   * @param {string} method HTTP方法
   * @returns {Promise<Object>}
   */
  async executeRequest(api, data = {}, method = 'GET') {
    let retryCount = 0;
    const maxRetries = this.options.retryTimes;

    while (retryCount <= maxRetries) {
      try {
        logger.info(`[DataManager] Executing request: ${api}`, { method, data });

        const result = await wx.cloud.callFunction({
          name: api,
          data
        });

        if (result.result && result.result.success) {
          return result.result;
        } else {
          throw new Error(result.result?.error?.message || '请求失败');
        }

      } catch (error) {
        retryCount++;

        if (retryCount <= maxRetries) {
          logger.warn(`[DataManager] Request failed, retrying (${retryCount}/${maxRetries}):`, error);
          await this.delay(this.options.retryDelay * retryCount);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * 生成请求键
   * @param {string} api API名称
   * @param {Object} params 参数
   * @param {number} page 页码
   * @param {number} pageSize 页面大小
   * @returns {string}
   */
  generateRequestKey(api, params = {}, page = 1, pageSize = 20) {
    const paramString = JSON.stringify({
      api,
      params: this.sortObjectKeys(params),
      page,
      pageSize
    });
    return btoa(paramString).replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * 对象键排序
   * @param {Object} obj 对象
   * @returns {Object}
   */
  sortObjectKeys(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    }

    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObjectKeys(obj[key]);
    });

    return sorted;
  }

  /**
   * 清除缓存
   * @param {Array} cacheKeys 缓存键数组
   */
  invalidateCache(cacheKeys) {
    cacheKeys.forEach(key => {
      if (typeof key === 'string') {
        cacheManager.delete(key);
      } else if (typeof key === 'object' && key.pattern) {
        // 支持模式匹配清除
        this.clearCacheByPattern(key.pattern);
      }
    });
  }

  /**
   * 按模式清除缓存
   * @param {RegExp} pattern 匹配模式
   */
  clearCacheByPattern(pattern) {
    // 这里需要根据实际的缓存管理器实现
    logger.info(`[DataManager] Clearing cache by pattern: ${pattern}`);
  }

  /**
   * 延迟函数
   * @param {number} ms 延迟毫秒数
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建搜索函数（带防抖）
   * @param {Function} searchCallback 搜索回调
   * @returns {Function}
   */
  createSearchFunction(searchCallback) {
    if (this.options.enableDebounce) {
      return debounce((keyword, ...args) => {
        if (isEmpty(keyword)) {
          return Promise.resolve([]);
        }
        return searchCallback(keyword, ...args);
      }, this.options.debounceDelay);
    }

    return (keyword, ...args) => {
      if (isEmpty(keyword)) {
        return Promise.resolve([]);
      }
      return searchCallback(keyword, ...args);
    };
  }

  /**
   * 创建分页加载函数
   * @param {Function} loadDataCallback 加载数据回调
   * @returns {Function}
   */
  createPaginatedLoader(loadDataCallback) {
    return async (options = {}) => {
      const {
        page = 1,
        pageSize = this.options.pageSize,
        reset = false,
        ...otherOptions
      } = options;

      try {
        const result = await loadDataCallback({
          page,
          pageSize,
          ...otherOptions
        });

        return {
          data: result.data || [],
          total: result.total || 0,
          page,
          pageSize,
          hasMore: result.data && result.data.length === pageSize,
          reset
        };

      } catch (error) {
        logger.error('[DataManager] Paginated loader failed:', error);
        throw error;
      }
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.requestQueue.clear();
    this.pendingRequests.clear();
    cacheManager.clear();
  }
}

/**
 * 创建数据管理器实例
 * @param {Object} options 配置选项
 * @returns {DataManager}
 */
function createDataManager(options = {}) {
  return new DataManager(options);
}

// 导出
module.exports = {
  DataManager,
  createDataManager
};