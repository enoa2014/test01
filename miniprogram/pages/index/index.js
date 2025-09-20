const { envList, cloudEnvId } = require("../../config/envList");

Page({
  data: {
    envId: envList.length > 0 ? envList[0].envId : "",
    cloudEnvId,
    patients: [],
    loading: true,
    error: "",
    importing: false,
    importStatus: ""
  },

  onLoad() {
    this.fetchPatients();
  },

  async fetchPatients() {
    this.setData({ loading: true, error: "" });

    try {
      const res = await wx.cloud.callFunction({
        name: "readExcel",
        data: { action: "list" }
      });
      const patients = res?.result?.patients || [];
      this.setData({ patients, loading: false });
    } catch (error) {
      console.error("Failed to load patients", error);
      this.setData({
        patients: [],
        loading: false,
        error: (error && error.errMsg) || "读取患者数据失败，请稍后重试"
      });
    }
  },

  async onImport() {
    if (this.data.importing) {
      return;
    }
    this.setData({ importing: true, importStatus: "" });
    wx.showLoading({ title: "同步中", mask: true });

    try {
      const res = await wx.cloud.callFunction({
        name: "readExcel",
        data: { action: "import" }
      });
      wx.hideLoading();
      const count = res?.result?.totalPatients || 0;
      const message = `已同步 ${count} 名患者的数据到云数据库`;
      this.setData({ importing: false, importStatus: message });
      wx.showToast({ title: "同步完成", icon: "success" });
      await this.fetchPatients();
    } catch (error) {
      console.error("Import excel to database failed", error);
      wx.hideLoading();
      this.setData({
        importing: false,
        importStatus: (error && error.errMsg) || "同步失败"
      });
      wx.showToast({ title: "同步失败", icon: "none" });
    }
  },

  onRetry() {
    this.fetchPatients();
  },

  onPatientTap(event) {
    const { key } = event.currentTarget.dataset;
    if (!key) {
      return;
    }
    wx.navigateTo({
      url: `/pages/patient-detail/detail?key=${encodeURIComponent(key)}`
    });
  }
});
