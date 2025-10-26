// pages/auth/welcome/index.js
const userManager = require('../../../utils/user-manager');
const Storage = require('../../../utils/storage');

Page({
  data: {
    isFirstTime: true,
    canSkip: true,
    userLoaded: false
  },

  onLoad(options) {
    this.initPage();
  },

  onShow() {
    // 页面显示时检查用户状态
    this.checkUserStatus();
  },

  /**
   * 初始化页面
   */
  async initPage() {
    try {
      // 获取用户信息
      const user = await userManager.getCurrentUser();

      if (user) {
        this.setData({
          userLoaded: true,
          isFirstTime: userManager.isFirstTimeUser()
        });
      } else {
        // 如果没有用户信息，等待一下再检查
        setTimeout(() => {
          this.checkUserStatus();
        }, 1000);
      }
    } catch (error) {
      console.error('初始化欢迎页面失败:', error);
      this.setData({ userLoaded: true });
    }
  },

  /**
   * 检查用户状态
   */
  async checkUserStatus() {
    try {
      const user = await userManager.getCurrentUser(true); // 强制刷新

      if (!user) {
        // 用户未登录，等待微信授权
        this.setData({ userLoaded: true });
        return;
      }

      // 检查是否需要完善资料
      if (userManager.needsProfileCompletion()) {
        this.setData({
          userLoaded: true,
          isFirstTime: userManager.isFirstTimeUser()
        });
        return;
      }

      // 资料已完善，跳转到首页
      this.goToHome();
    } catch (error) {
      console.error('检查用户状态失败:', error);
      this.setData({ userLoaded: true });
    }
  },

  /**
   * 跳转到资料编辑页面
   */
  goToProfile() {
    if (!this.data.userLoaded) {
      wx.showToast({
        title: '用户信息加载中...',
        icon: 'loading'
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/user-profile/edit'
    }).catch(error => {
      console.error('跳转到资料编辑页面失败:', error);
      wx.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    });
  },

  /**
   * 跳转到邀请码输入页面
   */
  goToInviteCode() {
    if (!this.data.userLoaded) {
      wx.showToast({
        title: '用户信息加载中...',
        icon: 'loading'
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/auth/invite-code'
    }).catch(error => {
      console.error('跳转到邀请码页面失败:', error);
      wx.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    });
  },

  /**
   * 身份快捷入口：社工（自助申请）
   */
  goToSocialWorkerApply() {
    wx.navigateTo({
      url: '/pages/auth/role-application?role=social_worker'
    }).catch(err => {
      console.error('跳转失败:', err);
      wx.showToast({ title: '页面跳转失败', icon: 'none' });
    });
  },

  /**
   * 身份快捷入口：志愿者（邀请码）
   */
  goToVolunteerInvite() {
    wx.navigateTo({ url: '/pages/auth/invite-code' }).catch(err => {
      console.error('跳转失败:', err);
      wx.showToast({ title: '页面跳转失败', icon: 'none' });
    });
  },

  /**
   * 身份快捷入口：家长（邀请码）
   */
  goToParentInvite() {
    wx.navigateTo({ url: '/pages/auth/invite-code' }).catch(err => {
      console.error('跳转失败:', err);
      wx.showToast({ title: '页面跳转失败', icon: 'none' });
    });
  },

  /**
   * 跳转到角色申请页面
   */
  goToRoleApplication() {
    if (!this.data.userLoaded) {
      wx.showToast({
        title: '用户信息加载中...',
        icon: 'loading'
      });
      return;
    }

    wx.navigateTo({
      url: '/pages/auth/role-application'
    }).catch(error => {
      console.error('跳转到角色申请页面失败:', error);
      wx.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    });
  },

  /**
   * 跳转到权限帮助页面
   */
  goToPermissionHelp() {
    wx.navigateTo({
      url: '/pages/auth/permission-help'
    }).catch(error => {
      console.error('跳转到权限帮助页面失败:', error);
      wx.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    });
  },

  /**
   * 跳转到首页
   */
  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    }).catch(error => {
      console.error('跳转到首页失败:', error);
      wx.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    });
  },

  /**
   * 暂时跳过
   */
  skipForNow() {
    if (!this.data.canSkip) {
      return;
    }

    // 记录用户跳过时间
    Storage.setTempData('welcome_skipped_at', Date.now(), 24 * 60 * 60 * 1000); // 24小时有效

    this.goToHome();
  },

  /**
   * 查看使用指南
   */
  viewGuide() {
    wx.navigateTo({
      url: '/pages/help/user-guide'
    }).catch(error => {
      console.error('跳转到使用指南失败:', error);
      wx.showToast({
        title: '页面跳转失败',
        icon: 'none'
      });
    });
  },

  /**
   * 联系客服
   */
  contactSupport() {
    wx.showActionSheet({
      itemList: ['拨打客服电话', '在线客服'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 拨打客服电话
          wx.makePhoneCall({
            phoneNumber: '400-123-4567',
            fail: () => {
              wx.showToast({
                title: '拨打失败',
                icon: 'none'
              });
            }
          });
        } else if (res.tapIndex === 1) {
          // 在线客服
          wx.showToast({
            title: '在线客服功能开发中',
            icon: 'none'
          });
        }
      }
    });
  },

  /**
   * 分享功能
   */
  onShareAppMessage() {
    return {
      title: '入住档案系统',
      desc: '专业的患者入住管理平台',
      path: '/pages/index/index'
    };
  },

  /**
   * 分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: '入住档案系统 - 专业的患者入住管理平台',
      imageUrl: '/assets/share-cover.jpg'
    };
  }
});
