// 入住成功页面
Page({
  data: {
    patientName: '',
    intakeTime: '',
    emergencyContact: '',
    emergencyPhone: '',
    uploadCount: 0,
    situationSummary: '',
    recordId: '',
    patientKey: ''
  },

  onLoad(options) {
    // 从上一页传递的参数获取信息
    const {
      patientName = '',
      intakeTime = '',
      emergencyContact = '',
      emergencyPhone = '',
      uploadCount = '0',
      situationSummary = '',
      recordId = '',
      patientKey = ''
    } = options;

    // 格式化入住时间
    const formattedTime = intakeTime ? this.formatIntakeTime(intakeTime) : this.getCurrentTime();

    // 截取情况说明摘要（前50字）
    const summary = situationSummary.length > 50
      ? situationSummary.substring(0, 50) + '...'
      : situationSummary;

    this.setData({
      patientName: decodeURIComponent(patientName),
      intakeTime: formattedTime,
      emergencyContact: decodeURIComponent(emergencyContact),
      emergencyPhone: decodeURIComponent(emergencyPhone),
      uploadCount: parseInt(uploadCount) || 0,
      situationSummary: summary,
      recordId: decodeURIComponent(recordId),
      patientKey: decodeURIComponent(patientKey)
    });
  },

  onShow() {
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: '入住成功'
    });
  },

  // 格式化入住时间
  formatIntakeTime(timestamp) {
    try {
      const date = new Date(parseInt(timestamp) || timestamp);
      if (isNaN(date.getTime())) {
        return this.getCurrentTime();
      }

      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hour = date.getHours().toString().padStart(2, '0');
      const minute = date.getMinutes().toString().padStart(2, '0');

      return `${year}-${month}-${day} ${hour}:${minute}`;
    } catch (error) {
      return this.getCurrentTime();
    }
  },

  // 获取当前时间
  getCurrentTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 查看患者详情
  onViewPatient() {
    const { patientKey } = this.data;
    if (patientKey) {
      wx.redirectTo({
        url: `/pages/patient-detail/detail?key=${encodeURIComponent(patientKey)}`
      });
    } else {
      wx.showToast({
        title: '患者信息不完整',
        icon: 'error'
      });
    }
  },

  // 继续添加患者
  onAddAnother() {
    wx.redirectTo({
      url: '/pages/patient-intake/select/select'
    });
  },

  // 返回首页
  onBackToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 阻止用户通过手势返回
  onBackPress() {
    return true; // 阻止默认返回行为
  }
});