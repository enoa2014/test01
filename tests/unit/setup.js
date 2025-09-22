// Jest测试环境设置
import '@testing-library/jest-dom';

// 模拟微信小程序全局对象
global.wx = {
  // 基础API模拟
  request: jest.fn(),
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  navigateBack: jest.fn(),
  reLaunch: jest.fn(),

  // 界面API
  showToast: jest.fn(),
  showModal: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showActionSheet: jest.fn(),

  // 存储API
  setStorageSync: jest.fn(),
  getStorageSync: jest.fn(),
  removeStorageSync: jest.fn(),
  clearStorageSync: jest.fn(),

  // 云开发API
  cloud: {
    init: jest.fn(),
    callFunction: jest.fn(),
    database: jest.fn(() => ({
      collection: jest.fn(() => ({
        add: jest.fn(),
        get: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        where: jest.fn(),
        orderBy: jest.fn(),
        limit: jest.fn(),
        skip: jest.fn()
      }))
    })),
    uploadFile: jest.fn(),
    downloadFile: jest.fn()
  }
};

// 模拟小程序构造器
global.App = jest.fn();
global.Page = jest.fn();
global.Component = jest.fn();
global.getApp = jest.fn(() => ({
  globalData: {}
}));
global.getCurrentPages = jest.fn(() => []);

// 模拟console
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn()
};