const STORAGE_KEY = 'app_theme_preference';
const listeners = new Set();
let currentTheme = 'default';
let initialized = false;

const THEME_PRESETS = [
  { key: 'default', label: '浅色主题', className: 'theme-default' },
  { key: 'dark', label: '深色主题', className: 'theme-dark' },
];

function isWxAvailable() {
  return typeof wx !== 'undefined' && wx !== null;
}

function getThemeMeta(themeKey) {
  return THEME_PRESETS.find(item => item.key === themeKey) || THEME_PRESETS[0];
}

function normalizeTheme(themeKey) {
  return getThemeMeta(themeKey).key;
}

function readStoredTheme() {
  if (!isWxAvailable() || typeof wx.getStorageSync !== 'function') {
    return undefined;
  }
  try {
    return wx.getStorageSync(STORAGE_KEY);
  } catch (error) {
    console.warn('[theme-manager] 读取主题缓存失败', error);
    return undefined;
  }
}

function detectSystemTheme() {
  if (!isWxAvailable()) {
    return 'default';
  }
  try {
    if (typeof wx.getSystemSetting === 'function') {
      const setting = wx.getSystemSetting();
      if (setting && setting.theme) {
        return normalizeTheme(setting.theme === 'light' ? 'default' : setting.theme);
      }
    }
    if (typeof wx.getAppBaseInfo === 'function') {
      const baseInfo = wx.getAppBaseInfo();
      if (baseInfo && baseInfo.theme) {
        return normalizeTheme(baseInfo.theme === 'light' ? 'default' : baseInfo.theme);
      }
    }
    if (typeof wx.getWindowInfo === 'function') {
      const windowInfo = wx.getWindowInfo();
      if (windowInfo && windowInfo.theme) {
        return normalizeTheme(windowInfo.theme === 'light' ? 'default' : windowInfo.theme);
      }
    }
  } catch (error) {
    console.warn('[theme-manager] 无法读取系统主题', error);
  }
  return 'default';
}

function persistTheme(themeKey) {
  if (!isWxAvailable() || typeof wx.setStorageSync !== 'function') {
    return;
  }
  try {
    wx.setStorageSync(STORAGE_KEY, themeKey);
  } catch (error) {
    console.warn('[theme-manager] 主题写入缓存失败', error);
  }
}

function initTheme() {
  if (initialized) {
    return currentTheme;
  }
  const stored = readStoredTheme();
  const resolved = stored ? normalizeTheme(stored) : detectSystemTheme();
  currentTheme = resolved;
  initialized = true;
  return currentTheme;
}

function getTheme() {
  if (!initialized) {
    initTheme();
  }
  return currentTheme;
}

function notify(theme) {
  listeners.forEach(listener => {
    try {
      listener(theme);
    } catch (error) {
      console.warn('[theme-manager] 主题监听器执行失败', error);
    }
  });
}

function setTheme(themeKey) {
  const normalized = normalizeTheme(themeKey);
  if (normalized === currentTheme) {
    return currentTheme;
  }
  currentTheme = normalized;
  persistTheme(currentTheme);
  notify(currentTheme);
  return currentTheme;
}

function toggleTheme() {
  const index = THEME_PRESETS.findIndex(item => item.key === currentTheme);
  const nextMeta = index === -1 ? THEME_PRESETS[0] : THEME_PRESETS[(index + 1) % THEME_PRESETS.length];
  return setTheme(nextMeta.key);
}

function subscribeTheme(listener, options = {}) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  if (options.immediate !== false) {
    listener(getTheme());
  }
  return () => {
    listeners.delete(listener);
  };
}

function getThemeOptions() {
  return THEME_PRESETS.map(({ key, label }) => ({ key, label }));
}

function resolveThemeClass(themeKey) {
  return getThemeMeta(themeKey).className;
}

function getThemeLabel(themeKey) {
  return getThemeMeta(themeKey).label;
}

function getThemeIndex(themeKey) {
  return THEME_PRESETS.findIndex(item => item.key === themeKey);
}

module.exports = {
  initTheme,
  getTheme,
  setTheme,
  toggleTheme,
  subscribeTheme,
  getThemeOptions,
  resolveThemeClass,
  getThemeLabel,
  getThemeIndex,
};
