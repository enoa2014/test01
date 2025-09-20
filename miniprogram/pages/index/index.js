Page({
  data: {
    patients: [],
    loading: true,
    error: ''
  },

  onLoad() {
    this.fetchPatients();
  },

  async fetchPatients() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'readExcel',
        data: { action: 'list' }
      });
      const patients = res?.result?.patients || [];
      this.setData({ patients, loading: false });
    } catch (error) {
      console.error('Failed to load patients', error);
      this.setData({
        patients: [],
        loading: false,
        error: (error && error.errMsg) || '读取患者数据失败，请稍后重试'
      });
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
