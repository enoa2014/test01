// pages/auth/permission-management/index.js
const userManager = require('../../../utils/user-manager');
const logger = require('../../../utils/logger');

Page({
  data: {
    // 用户信息
    userInfo: {
      userId: '',
      profile: {
        realName: '',
        avatar: ''
      },
      status: '',
      statusText: '',
      createTime: '',
      updateTime: ''
    },

    // 用户角色
    userRoles: [],

    // 申请记录
    applications: [],

    // 角色配置
    roleConfig: {
      social_worker: {
        name: '社工',
        description: '负责患者跟进、康复指导等日常工作',
        permissions: [
          { name: '患者管理' },
          { name: '康复计划' },
          { name: '文件上传' },
          { name: '数据查看' }
        ]
      },
      volunteer: {
        name: '志愿者',
        description: '协助社工开展活动、陪伴患者',
        permissions: [
          { name: '患者查看' },
          { name: '活动参与' },
          { name: '记录上传' },
          { name: '统计查看' }
        ]
      },
      researcher: {
        name: '研究员',
        description: '负责数据分析、研究报告等工作',
        permissions: [
          { name: '数据查看' },
          { name: '报告生成' },
          { name: '数据导出' },
          { name: '系统统计' }
        ]
      },
      admin: {
        name: '管理员',
        description: '系统管理和用户权限管理',
        permissions: [
          { name: '用户管理' },
          { name: '权限管理' },
          { name: '系统设置' },
          { name: '数据管理' }
        ]
      }
    }
  },

  onLoad(_options) {
    logger.info('[permission-management] 页面加载');
  },

  onShow() {
    // 每次显示页面时重新加载数据
    this.loadUserData();
  },

  /**
   * 加载用户数据
   */
  async loadUserData() {
    try {
      wx.showLoading({
        title: '加载中...'
      });

      // 获取用户信息
      const user = await userManager.getCurrentUser();
      if (user) {
        const userInfo = {
          userId: user.userId || user.openid,
          profile: user.profile || {},
          status: user.status || 'active',
          statusText: this.getUserStatusText(user.status),
          createTime: this.formatDate(user.createdAt),
          updateTime: this.formatDate(user.updatedAt)
        };

        // 获取用户角色
        const userRoles = this.formatUserRoles(user.roles || [], user);

        // 获取申请记录
        const applications = await this.loadApplications();

        this.setData({
          userInfo,
          userRoles,
          applications
        });
      }
    } catch (error) {
      logger.error('[permission-management] 加载用户数据失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 加载申请记录
   */
  async loadApplications() {
    try {
      const applications = await userManager.getApplicationHistory();
      return applications.map(item => ({
        id: item._id,
        role: item.role,
        roleName: this.data.roleConfig[item.role]?.name || item.role,
        status: item.status,
        statusText: this.getApplicationStatusText(item.status),
        reason: item.reason,
        createTime: this.formatDate(item.createdAt),
        reviewedAt: item.reviewedAt ? this.formatDate(item.reviewedAt) : null
      }));
    } catch (error) {
      logger.error('[permission-management] 加载申请记录失败:', error);
      return [];
    }
  },

  /**
   * 格式化用户角色
   */
  formatUserRoles(roles, user) {
    return roles.map(role => {
      const roleConfig = this.data.roleConfig[role];
      return {
        role,
        roleName: roleConfig?.name || role,
        description: roleConfig?.description || '',
        permissions: roleConfig?.permissions || [],
        obtainTime: user.createdAt ? this.formatDate(user.createdAt) : '未知'
      };
    });
  },

  /**
   * 获取用户状态文本
   */
  getUserStatusText(status) {
    const statusMap = {
      active: '正常',
      inactive: '未激活',
      suspended: '已暂停',
      pending: '待审核'
    };
    return statusMap[status] || '未知状态';
  },

  /**
   * 获取申请状态文本
   */
  getApplicationStatusText(status) {
    const statusMap = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
      cancelled: '已撤销'
    };
    return statusMap[status] || '未知状态';
  },

  /**
   * 编辑头像
   */
  async editAvatar() {
    try {
      const result = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      if (result.tempFilePaths.length > 0) {
        wx.showLoading({
          title: '上传中...'
        });

        // 上传头像
        const uploadResult = await userManager.uploadAvatar(result.tempFilePaths[0]);

        if (uploadResult.success) {
          // 更新用户资料
          await userManager.updateProfile({
            avatar: uploadResult.url
          });

          // 更新本地数据
          const userInfo = { ...this.data.userInfo };
          userInfo.profile.avatar = uploadResult.url;
          this.setData({ userInfo });

          wx.showToast({
            title: '头像更新成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '头像上传失败',
            icon: 'none'
          });
        }
      }
    } catch (error) {
      logger.error('[permission-management] 编辑头像失败:', error);
      wx.showToast({
        title: '头像更新失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 编辑资料
   */
  editProfile() {
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
   * 查看申请详情
   */
  viewApplicationDetail(e) {
    const id = e.currentTarget.dataset.id;
    const application = this.data.applications.find(item => item.id === id);

    if (application) {
      let content = `角色：${application.roleName}\n状态：${application.statusText}\n申请时间：${application.createTime}`;

      if (application.reason) {
        content += `\n申请理由：${application.reason}`;
      }

      if (application.reviewedAt) {
        content += `\n审核时间：${application.reviewedAt}`;
      }

      wx.showModal({
        title: '申请详情',
        content,
        showCancel: false
      });
    }
  },

  /**
   * 撤销申请
   */
  async cancelApplication(e) {
    const id = e.currentTarget.dataset.id;

    const result = await new Promise((resolve) => {
      wx.showModal({
        title: '确认撤销',
        content: '确定要撤销这个申请吗？撤销后需要重新提交申请。',
        success: (res) => {
          resolve(res.confirm);
        }
      });
    });

    if (!result) {
      return;
    }

    try {
      wx.showLoading({
        title: '撤销中...'
      });

      // 调用撤销申请的API（需要在userManager中实现）
      const cancelResult = await userManager.cancelApplication(id);

      if (cancelResult.success) {
        wx.showToast({
          title: '申请已撤销',
          icon: 'success'
        });

        // 重新加载申请记录
        setTimeout(() => {
          this.loadUserData();
        }, 1000);
      } else {
        wx.showToast({
          title: cancelResult.message || '撤销失败',
          icon: 'none'
        });
      }
    } catch (error) {
      logger.error('[permission-management] 撤销申请失败:', error);
      wx.showToast({
        title: '撤销失败，请重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 格式化日期
   */
  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadUserData().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
