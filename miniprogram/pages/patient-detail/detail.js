Page({
  data: {
    loading: true,
    error: "",
    patient: null,
    basicInfo: [],
    familyInfo: [],
    economicInfo: [],
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
      const result = res?.result || {};
      const patient = result.patient || null;
      if (patient?.patientName) {
        wx.setNavigationBarTitle({ title: patient.patientName });
      }
      this.setData({
        loading: false,
        patient,
        basicInfo: result.basicInfo || [],
        familyInfo: result.familyInfo || [],
        economicInfo: result.economicInfo || [],
        records: result.records || []
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
