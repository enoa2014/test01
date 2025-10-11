// 入住成功页面
const themeManager = require('../../../utils/theme');

const INITIAL_THEME_KEY = themeManager.getTheme();

Page({
  data: {
    theme: INITIAL_THEME_KEY,
    themeClass: themeManager.resolveThemeClass(INITIAL_THEME_KEY),
    mode: 'intake',
    titleText: '入住登记成功',
    subtitleText: '住户信息已录入系统',
    summaryTitle: '入住信息',
    timeLabel: '入住时间',
    patientName: '',
    actionTime: '',
    uploadCount: 0,
    situationSummary: '',
    recordId: '',
    patientKey: '',
    reminderItems: [
      '住户档案已建立，可在系统中查看和管理',
      '如需补充信息或附件，可随时联系管理员',
      '紧急情况请及时联系相关负责人',
    ],
  },

  onLoad(options) {
    const app = getApp();
    this.themeUnsubscribe =
      app && typeof app.watchTheme === 'function'
        ? app.watchTheme(theme => this.handleThemeChange(theme), { immediate: true })
        : themeManager.subscribeTheme(theme => this.handleThemeChange(theme));

    const mode = options?.mode === 'create' ? 'create' : 'intake';
    const displayTexts = this.resolveDisplayTexts(mode);

    // 从上一页传递的参数获取信息
    const {
      patientName = '',
      intakeTime = '',
      uploadCount = '0',
      situationSummary = '',
      recordId = '',
      patientKey = '',
    } = options;

    // 格式化入住时间
    const formattedTime = intakeTime ? this.formatIntakeTime(intakeTime) : this.getCurrentTime();

    // 截取情况说明摘要（前50字）
    const summary =
      situationSummary.length > 50 ? situationSummary.substring(0, 50) + '...' : situationSummary;

    this.setData({
      mode,
      titleText: displayTexts.titleText,
      subtitleText: displayTexts.subtitleText,
      summaryTitle: displayTexts.summaryTitle,
      timeLabel: displayTexts.timeLabel,
      reminderItems: displayTexts.reminderItems,
      patientName: decodeURIComponent(patientName),
      actionTime: formattedTime,
      uploadCount: parseInt(uploadCount) || 0,
      situationSummary: summary,
      recordId: decodeURIComponent(recordId),
      patientKey: decodeURIComponent(patientKey),
    });
  },

  onShow() {
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: this.data.mode === 'create' ? '住户创建成功' : '入住成功',
    });
  },

  onUnload() {
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
  },

  handleThemeChange(themeKey) {
    this.setData({
      theme: themeKey,
      themeClass: themeManager.resolveThemeClass(themeKey),
    });
  },

  resolveDisplayTexts(mode) {
    if (mode === 'create') {
      return {
        titleText: '住户创建成功',
        subtitleText: '档案已加入住户列表',
        summaryTitle: '住户信息',
        timeLabel: '创建时间',
        reminderItems: [
          '住户档案已建立，可在列表中继续完善资料',
          '如需办理入住，可在住户详情页发起入住',
        ],
      };
    }
    return {
      titleText: '入住登记成功',
      subtitleText: '住户信息已录入系统',
      summaryTitle: '入住信息',
      timeLabel: '入住时间',
      reminderItems: [
        '住户档案已建立，可在系统中查看和管理',
        '如需补充信息或附件，可随时联系管理员',
        '紧急情况请及时联系相关负责人',
      ],
    };
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
        url: `/pages/patient-detail/detail?key=${encodeURIComponent(patientKey)}&patientId=${encodeURIComponent(patientKey)}`,
      });
    } else {
      wx.showToast({
        title: '患者信息不完整',
        icon: 'error',
      });
    }
  },

  // 继续添加患者（统一走创建向导；不再进入“选择入住条目”）
  onAddAnother() {
    wx.redirectTo({
      url: '/pages/patient-intake/wizard/wizard?mode=create',
    });
  },

  // 返回首页
  onBackToHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },

  // 阻止用户通过手势返回
  onBackPress() {
    return true; // 阻止默认返回行为
  },
});
