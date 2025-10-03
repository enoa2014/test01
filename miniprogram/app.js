const { envList, cloudEnvId, isProduction } = require('./config/envList');

App({
  globalData: {
    envList,
    cloudEnvId,
    isProduction,
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
  },
});
