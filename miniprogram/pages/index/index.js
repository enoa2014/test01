const { envList, cloudEnvId } = require("../../config/envList");

Page({
  data: {
    envId: envList.length > 0 ? envList[0].envId : "",
    cloudEnvId,
    headers: [],
    rows: [],
    loading: true,
    error: "",
    importing: false,
    importStatus: ""
  },

  onLoad() {
    this.fetchExcelRows();
  },

  async fetchExcelRows() {
    this.setData({ loading: true, error: "" });

    try {
      const res = await wx.cloud.callFunction({
        name: "readExcel"
      });
      const { headers = [], rows = [] } = (res && res.result) || {};
      this.setData({
        headers,
        rows,
        loading: false
      });
    } catch (error) {
      console.error("Failed to load excel rows", error);
      this.setData({
        headers: [],
        rows: [],
        loading: false,
        error: (error && error.errMsg) || "读取 Excel 失败，请稍后重试"
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
      const count = res?.result?.imported?.inserted || 0;
      const message = `已同步 ${count} 条记录到云数据库`;
      this.setData({ importing: false, importStatus: message });
      wx.showToast({ title: "同步完成", icon: "success" });
      await this.fetchExcelRows();
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
    this.fetchExcelRows();
  }
});
