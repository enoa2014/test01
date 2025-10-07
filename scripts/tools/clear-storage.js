/**
 * 快速清理小程序本地存储，主要用于筛选持久化及缓存测试。
 * 使用方式：在微信开发者工具调试控制台执行
 *   const clearStorage = require('../../scripts/tools/clear-storage');
 *   clearStorage();
 */
module.exports = function clearStorage() {
  if (typeof wx === 'undefined' || !wx.clearStorage) {
    console.warn('wx.clearStorage 不可用，请在微信开发者工具内执行。');
    return;
  }

  try {
    wx.clearStorage({
      success() {
        console.log('[clear-storage] 本地存储已清理');
      },
      fail(err) {
        console.error('[clear-storage] 清理失败', err);
      }
    });
  } catch (error) {
    console.error('[clear-storage] 执行异常', error);
  }
};
