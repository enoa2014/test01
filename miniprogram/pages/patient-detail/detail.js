Page({
  data: {
    loading: true,
    error: "",
    patient: null,
    records: []
  },

  onLoad(options) {
    this.patientKey = options?.key ? decodeURIComponent(options.key) : "";
    if (!this.patientKey) {
      this.setData({ loading: false, error: "缺少患者标识" });
      return;
    }
    this.fetchPatientDetail();
  },

  async fetchPatientDetail() {
    this.setData({ loading: true, error: "" });

    try {
      const res = await wx.cloud.callFunction({
        name: "readExcel",
        data: { action: "detail", key: this.patientKey }
      });
      const patient = res?.result?.patient || null;
      const records = res?.result?.records || [];
      if (patient?.patientName) {
        wx.setNavigationBarTitle({ title: patient.patientName });
      }
      this.setData({
        loading: false,
        patient,
        records
      });
    } catch (error) {
      console.error("Failed to load patient detail", error);
      this.setData({
        loading: false,
        error: (error && error.errMsg) || "加载患者详情失败"
      });
    }
  }
});
