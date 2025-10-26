// utils/storage.js

/**
 * 本地存储工具类
 */
class Storage {
  /**
   * 设置存储项
   * @param {string} key - 键名
   * @param {any} value - 值
   * @param {number} expire - 过期时间（毫秒）
   */
  static set(key, value, expire) {
    try {
      const data = {
        value,
        timestamp: Date.now(),
        expire: expire ? Date.now() + expire : null
      };

      wx.setStorageSync(key, data);
      return true;
    } catch (error) {
      console.error('存储失败:', error);
      return false;
    }
  }

  /**
   * 获取存储项
   * @param {string} key - 键名
   * @param {any} defaultValue - 默认值
   * @returns {any}
   */
  static get(key, defaultValue = null) {
    try {
      const data = wx.getStorageSync(key);

      if (!data) {
        return defaultValue;
      }

      // 检查是否过期
      if (data.expire && Date.now() > data.expire) {
        this.remove(key);
        return defaultValue;
      }

      return data.value;
    } catch (error) {
      console.error('读取存储失败:', error);
      return defaultValue;
    }
  }

  /**
   * 移除存储项
   * @param {string} key - 键名
   */
  static remove(key) {
    try {
      wx.removeStorageSync(key);
      return true;
    } catch (error) {
      console.error('移除存储失败:', error);
      return false;
    }
  }

  /**
   * 清空所有存储
   */
  static clear() {
    try {
      wx.clearStorageSync();
      return true;
    } catch (error) {
      console.error('清空存储失败:', error);
      return false;
    }
  }

  /**
   * 获取存储大小信息
   * @returns {object}
   */
  static getInfo() {
    try {
      const info = wx.getStorageInfoSync();
      return {
        keys: info.keys,
        currentSize: info.currentSize,
        limitSize: info.limitSize,
        usagePercent: ((info.currentSize / info.limitSize) * 100).toFixed(2)
      };
    } catch (error) {
      console.error('获取存储信息失败:', error);
      return null;
    }
  }

  /**
   * 缓存用户信息
   * @param {object} userInfo - 用户信息
   * @param {number} expire - 过期时间（默认1小时）
   */
  static cacheUserInfo(userInfo, expire = 60 * 60 * 1000) {
    return this.set('user_info', userInfo, expire);
  }

  /**
   * 获取缓存的用户信息
   * @returns {object|null}
   */
  static getCachedUserInfo() {
    return this.get('user_info');
  }

  /**
   * 缓存权限信息
   * @param {string[]} permissions - 权限列表
   * @param {number} expire - 过期时间（默认30分钟）
   */
  static cachePermissions(permissions, expire = 30 * 60 * 1000) {
    return this.set('user_permissions', permissions, expire);
  }

  /**
   * 获取缓存的权限信息
   * @returns {string[]}
   */
  static getCachedPermissions() {
    return this.get('user_permissions', []);
  }

  /**
   * 缓存配置信息
   * @param {object} config - 配置信息
   */
  static cacheConfig(config) {
    return this.set('app_config', config);
  }

  /**
   * 获取缓存的配置信息
   * @returns {object|null}
   */
  static getCachedConfig() {
    return this.get('app_config');
  }

  /**
   * 设置用户偏好设置
   * @param {object} preferences - 偏好设置
   */
  static setUserPreferences(preferences) {
    return this.set('user_preferences', preferences);
  }

  /**
   * 获取用户偏好设置
   * @returns {object}
   */
  static getUserPreferences() {
    return this.get('user_preferences', {});
  }

  /**
   * 设置用户主题偏好
   * @param {string} theme - 主题名称
   */
  static setUserTheme(theme) {
    const preferences = this.getUserPreferences();
    preferences.theme = theme;
    return this.setUserPreferences(preferences);
  }

  /**
   * 获取用户主题偏好
   * @returns {string}
   */
  static getUserTheme() {
    const preferences = this.getUserPreferences();
    return preferences.theme || 'default';
  }

  /**
   * 缓存患者列表数据
   * @param {object} patientData - 患者数据
   * @param {number} expire - 过期时间（默认5分钟）
   */
  static cachePatientList(patientData, expire = 5 * 60 * 1000) {
    return this.set('patient_list_cache', patientData, expire);
  }

  /**
   * 获取缓存的患者列表数据
   * @returns {object|null}
   */
  static getCachedPatientList() {
    return this.get('patient_list_cache');
  }

  /**
   * 设置患者列表脏标记
   * @param {boolean} isDirty - 是否脏
   */
  static setPatientListDirty(isDirty) {
    return this.set('patient_list_dirty', isDirty);
  }

  /**
   * 获取患者列表脏标记
   * @returns {boolean}
   */
  static getPatientListDirty() {
    return this.get('patient_list_dirty', false);
  }

  /**
   * 缓存用户访问令牌
   * @param {string} token - 访问令牌
   * @param {number} expire - 过期时间
   */
  static setAccessToken(token, expire) {
    return this.set('access_token', token, expire);
  }

  /**
   * 获取访问令牌
   * @returns {string|null}
   */
  static getAccessToken() {
    return this.get('access_token');
  }

  /**
   * 设置刷新令牌
   * @param {string} refreshToken - 刷新令牌
   */
  static setRefreshToken(refreshToken) {
    return this.set('refresh_token', refreshToken);
  }

  /**
   * 获取刷新令牌
   * @returns {string|null}
   */
  static getRefreshToken() {
    return this.get('refresh_token');
  }

  /**
   * 缓存临时数据
   * @param {string} key - 键名
   * @param {any} value - 值
   * @param {number} expire - 过期时间（默认10分钟）
   */
  static setTempData(key, value, expire = 10 * 60 * 1000) {
    const fullKey = `temp_${key}`;
    return this.set(fullKey, value, expire);
  }

  /**
   * 获取临时数据
   * @param {string} key - 键名
   * @param {any} defaultValue - 默认值
   * @returns {any}
   */
  static getTempData(key, defaultValue = null) {
    const fullKey = `temp_${key}`;
    return this.get(fullKey, defaultValue);
  }

  /**
   * 移除临时数据
   * @param {string} key - 键名
   */
  static removeTempData(key) {
    const fullKey = `temp_${key}`;
    return this.remove(fullKey);
  }

  /**
   * 清理所有临时数据
   */
  static clearTempData() {
    try {
      const info = wx.getStorageInfoSync();
      const tempKeys = info.keys.filter(key => key.startsWith('temp_'));

      tempKeys.forEach(key => {
        this.remove(key);
      });

      return true;
    } catch (error) {
      console.error('清理临时数据失败:', error);
      return false;
    }
  }

  /**
   * 批量设置存储项
   * @param {object} items - 存储项对象
   */
  static setMultiple(items) {
    const results = {};

    Object.keys(items).forEach(key => {
      const item = items[key];
      results[key] = this.set(key, item.value, item.expire);
    });

    return results;
  }

  /**
   * 批量获取存储项
   * @param {string[]} keys - 键名数组
   * @returns {object}
   */
  static getMultiple(keys) {
    const results = {};

    keys.forEach(key => {
      results[key] = this.get(key);
    });

    return results;
  }

  /**
   * 检查存储项是否存在
   * @param {string} key - 键名
   * @returns {boolean}
   */
  static exists(key) {
    try {
      const data = wx.getStorageSync(key);
      return data !== undefined && data !== null;
    } catch (error) {
      console.error('检查存储项失败:', error);
      return false;
    }
  }

  /**
   * 获取存储项大小
   * @param {string} key - 键名
   * @returns {number}
   */
  static getSize(key) {
    try {
      const data = wx.getStorageSync(key);
      if (data === undefined || data === null) {
        return 0;
      }
      return JSON.stringify(data).length;
    } catch (error) {
      console.error('获取存储项大小失败:', error);
      return 0;
    }
  }

  /**
   * 压缩存储（清理过期数据）
   */
  static compress() {
    try {
      const info = wx.getStorageInfoSync();
      const keys = info.keys;
      let cleanedCount = 0;

      keys.forEach(key => {
        const data = wx.getStorageSync(key);
        if (data && data.expire && Date.now() > data.expire) {
          this.remove(key);
          cleanedCount++;
        }
      });

      console.log(`存储压缩完成，清理了 ${cleanedCount} 个过期项`);
      return cleanedCount;
    } catch (error) {
      console.error('存储压缩失败:', error);
      return 0;
    }
  }

  /**
   * 导出存储数据
   * @returns {object}
   */
  static export() {
    try {
      const info = wx.getStorageInfoSync();
      const keys = info.keys;
      const data = {};

      keys.forEach(key => {
        data[key] = this.get(key);
      });

      return data;
    } catch (error) {
      console.error('导出存储数据失败:', error);
      return {};
    }
  }

  /**
   * 导入存储数据
   * @param {object} data - 存储数据
   * @returns {boolean}
   */
  static import(data) {
    try {
      Object.keys(data).forEach(key => {
        this.set(key, data[key]);
      });

      return true;
    } catch (error) {
      console.error('导入存储数据失败:', error);
      return false;
    }
  }
}

module.exports = Storage;