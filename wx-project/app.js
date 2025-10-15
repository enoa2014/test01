const { envList, cloudEnvId, isProduction } = require('./config/envList');
const themeManager = require('./utils/theme');
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
});
