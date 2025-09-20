const { envList, cloudEnvId } = require("../../config/envList");

Page({
  data: {
    envId: envList.length > 0 ? envList[0].envId : "",
    cloudEnvId,
    cloudResult: ""
  },

  onLoad() {
    if (!wx.cloud) {
      wx.showModal({
        title: "Notice",
        content: "The current WeChat base library version is too low to use cloud capabilities.",
        showCancel: false
      });
    }
  },

  async onCallCloud() {
    if (!wx.cloud) {
      wx.showToast({
        title: "Low base library",
        icon: "none"
      });
      return;
    }

    try {
      wx.showLoading({ title: "Calling cloud" });
      const res = await wx.cloud.callFunction({
        name: "helloWorld",
        data: {
          timestamp: Date.now()
        }
      });
      wx.hideLoading();
      this.setData({
        cloudResult: res.result && res.result.message ? res.result.message : JSON.stringify(res.result, null, 2)
      });
    } catch (error) {
      wx.hideLoading();
      console.error("Failed to call cloud function", error);
      wx.showToast({ title: "Call failed", icon: "none" });
      this.setData({
        cloudResult: `Cloud function failed: ${error && error.errMsg ? error.errMsg : "unknown error"}`
      });
    }
  }
});
