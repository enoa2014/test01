const { envList, cloudEnvId, isProduction } = require('./config/envList');
const themeManager = require('./utils/theme');
const userManager = require('./utils/user-manager');
const logger = require('./utils/logger');

const themeListeners = new Set();

function registerThemeSync(appInstance) {
  const syncTheme = themeKey => {
    const themeClass = themeManager.resolveThemeClass(themeKey);
    appInstance.globalData.theme = themeKey;
    appInstance.globalData.themeClass = themeClass;
    themeListeners.forEach(listener => {
      try {
        listener(themeKey, themeClass);
      } catch (error) {
        logger.warn('[app-theme] 主题监听器执行失败', error);
      }
    });
  };

  themeManager.subscribeTheme(syncTheme);

  if (typeof wx !== 'undefined' && typeof wx.onThemeChange === 'function') {
    wx.onThemeChange(({ theme }) => {
      const resolved = theme === 'light' ? 'default' : theme;
      appInstance.setTheme(resolved);
    });
  }

  return syncTheme;
}

App({
  globalData: {
    envList,
    cloudEnvId,
    isProduction,
    theme: themeManager.initTheme(),
    themeClass: themeManager.resolveThemeClass(themeManager.getTheme()),
    userManager: userManager, // 添加用户管理器到全局数据
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '提示',
        content: '当前微信基础库版本过低，请升级至 2.2.3 及以上再使用云开发能力。',
        showCancel: false,
      });
      return;
    }

    wx.cloud.init({
      env: cloudEnvId,
      traceUser: true,
    });

    registerThemeSync(this);

    // 初始化用户管理器
    this.initUserManager();
  },

  /**
   * 初始化用户管理器
   */
  async initUserManager() {
    try {
      // 尝试获取当前用户信息
      await userManager.getCurrentUser();
      logger.info('[app-user] 用户管理器初始化成功');

      // 如果是新用户，跳转到欢迎页面
      if (userManager.isFirstTimeUser()) {
        logger.info('[app-user] 首次使用用户，跳转到欢迎页面');
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/auth/welcome'
          });
        }, 1000);
      }

    } catch (error) {
      logger.error('[app-user] 用户管理器初始化失败:', error);
      // 初始化失败，跳转到欢迎页面
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/auth/welcome'
        });
      }, 1000);
    }
  },

  getTheme() {
    return this.globalData.theme || themeManager.getTheme();
  },

  setTheme(theme) {
    const resolved = themeManager.setTheme(theme);
    this.globalData.theme = resolved;
    this.globalData.themeClass = themeManager.resolveThemeClass(resolved);
    return resolved;
  },

  toggleTheme() {
    const next = themeManager.toggleTheme();
    this.globalData.theme = next;
    this.globalData.themeClass = themeManager.resolveThemeClass(next);
    return next;
  },

  watchTheme(listener, options = {}) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    themeListeners.add(listener);

    if (options.immediate !== false) {
      listener(this.getTheme(), this.globalData.themeClass);
    }

    return () => {
      themeListeners.delete(listener);
    };
  },

  /**
   * 检查用户权限
   * @param {string[]} requiredRoles - 需要的角色列表
   * @returns {Promise<boolean>}
   */
  async checkUserPermissions(requiredRoles = []) {
    try {
      const isLoggedIn = await userManager.isLoggedIn();
      if (!isLoggedIn) {
        wx.showModal({
          title: '未登录',
          content: '请先登录后再使用此功能',
          showCancel: false,
          success: () => {
            wx.redirectTo({
              url: '/pages/auth/welcome'
            });
          }
        });
        return false;
      }

      if (requiredRoles.length > 0) {
        const hasPermission = userManager.hasPermission(requiredRoles);
        if (!hasPermission) {
          wx.showModal({
            title: '权限不足',
            content: '您没有使用此功能的权限，请联系管理员申请相应角色。',
            showCancel: false,
            success: () => {
              wx.navigateTo({
                url: '/pages/auth/permission-management'
              });
            }
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('[app] 检查用户权限失败:', error);
      wx.showToast({
        title: '权限检查失败',
        icon: 'none'
      });
      return false;
    }
  },

  /**
   * 获取当前用户信息
   * @returns {object|null}
   */
  getCurrentUser() {
    return userManager.currentUser;
  },

  /**
   * 获取用户角色名称
   * @returns {string}
   */
  getUserRoleName() {
    return userManager.getRoleName();
  },

  /**
   * 检查用户是否有特定权限
   * @param {string[]} roles - 角色列表
   * @returns {boolean}
   */
  hasUserPermission(roles) {
    return userManager.hasPermission(roles);
  }
});
