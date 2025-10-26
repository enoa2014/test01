const { fn: jestFn } = require('jest-mock');
const expectLib = require('expect');
global.expect = expectLib;
require('@testing-library/jest-dom');

global.wx = {
  request: jestFn(),
  navigateTo: jestFn(),
  redirectTo: jestFn(),
  switchTab: jestFn(),
  navigateBack: jestFn(),
  reLaunch: jestFn(),
  showToast: jestFn(),
  showModal: jestFn(),
  showLoading: jestFn(),
  hideLoading: jestFn(),
  showActionSheet: jestFn(),
  setStorageSync: jestFn(),
  getStorageSync: jestFn(),
  removeStorageSync: jestFn(),
  clearStorageSync: jestFn(),
  cloud: {
    init: jestFn(),
    callFunction: jestFn(),
    database: jestFn(() => ({
      collection: jestFn(() => ({
        add: jestFn(),
        get: jestFn(),
        update: jestFn(),
        remove: jestFn(),
        where: jestFn(),
        orderBy: jestFn(),
        limit: jestFn(),
        skip: jestFn(),
      })),
    })),
    uploadFile: jestFn(),
    downloadFile: jestFn(),
  },
};

global.App = jestFn();
global.Page = jestFn();
global.Component = jestFn();
global.getApp = jestFn(() => ({ globalData: {} }));
global.getCurrentPages = jestFn(() => []);

global.console = {
  ...console,
  warn: jestFn(),
  error: jestFn(),
};
