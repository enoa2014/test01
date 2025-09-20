const { envList, cloudEnvId, isProduction } = require("./config/envList");

App({
  globalData: {
    envList,
    cloudEnvId,
    isProduction
  },

  onLaunch() {
    if (!wx.cloud) {
      console.warn("The current WeChat base library version is too low. Please upgrade to 2.2.3 or above to use cloud capabilities.");
      return;
    }

    wx.cloud.init({
      env: cloudEnvId,
      traceUser: true
    });
  }
});
