// pages/auth/permission-help/index.js
Page({
  data: {
    // FAQ展开状态
    faqExpanded: [false, false, false, false, false, false]
  },

  onLoad(options) {
    console.log('[permission-help] 页面加载');
  },

  /**
   * 滚动到指定section
   */
  scrollToSection(e) {
    const section = e.currentTarget.dataset.section;
    const selector = `#${section}`;

    wx.createSelectorQuery()
      .select(selector)
      .boundingClientRect((rect) => {
        if (rect) {
          wx.pageScrollTo({
            scrollTop: rect.top - 100,
            duration: 300
          });
        }
      })
      .exec();
  },

  /**
   * 切换FAQ展开状态
   */
  toggleFaq(e) {
    const index = e.currentTarget.dataset.index;
    const faqExpanded = [...this.data.faqExpanded];
    faqExpanded[index] = !faqExpanded[index];
    this.setData({
      faqExpanded
    });
  },

  /**
   * 前往资料编辑页面
   */
  goToProfileEdit() {
    wx.navigateTo({
      url: '/pages/user-profile/edit'
    });
  },

  /**
   * 前往邀请码页面
   */
  goToInviteCode() {
    wx.navigateTo({
      url: '/pages/auth/invite-code'
    });
  },

  /**
   * 前往角色申请页面
   */
  goToRoleApplication() {
    wx.navigateTo({
      url: '/pages/auth/role-application'
    });
  },

  /**
   * 前往权限管理页面
   */
  goToPermissionManagement() {
    wx.switchTab({
      url: '/pages/auth/permission-management'
    });
  },

  /**
   * 联系管理员
   */
  contactAdmin() {
    wx.showModal({
      title: '联系管理员',
      content: '如需联系管理员，请通过以下方式：\n\n1. 在系统中提交意见反馈\n2. 联系您的直属上级\n3. 发送邮件至admin@example.com\n\n我们会尽快回复您的问题。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 意见反馈
   */
  goToFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '您可以通过以下方式提交意见反馈：\n\n1. 在系统内发送反馈消息\n2. 描述遇到的问题或建议\n3. 我们会定期查看并回复\n\n感谢您的宝贵意见！',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 分享页面
   */
  onShareAppMessage() {
    return {
      title: '权限使用帮助',
      path: '/pages/auth/permission-help',
      imageUrl: '/assets/share-help.png'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '权限使用帮助 - 了解如何获得和使用系统权限',
      query: '',
      imageUrl: '/assets/share-help.png'
    };
  }
});