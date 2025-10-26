// components/auth-button/index.js
const userManager = require('../../utils/user-manager');

Component({
  properties: {
    // 所需权限列表
    requiredRoles: {
      type: Array,
      value: []
    },
    // 按钮文本
    text: {
      type: String,
      value: ''
    },
    // 按钮类型
    type: {
      type: String,
      value: 'default' // default, primary, warn, success
    },
    // 按钮大小
    size: {
      type: String,
      value: 'medium' // small, medium, large
    },
    // 禁用状态
    disabled: {
      type: Boolean,
      value: false
    },
    // 加载状态
    loading: {
      type: Boolean,
      value: false
    },
    // 权限不足时的提示文本
    noPermissionText: {
      type: String,
      value: '您没有执行此操作的权限'
    },
    // 权限不足时的图标
    noPermissionIcon: {
      type: String,
      value: 'info'
    },
    // 是否显示权限提示
    showPermissionTip: {
      type: Boolean,
      value: true
    },
    // 平面样式
    plain: {
      type: Boolean,
      value: false
    },
    // 圆角样式
    round: {
      type: Boolean,
      value: false
    }
  },

  data: {
    hasPermission: false,
    showAuthModal: false,
    currentUser: null,
    permissionChecked: false
  },

  lifetimes: {
    attached() {
      this.checkPermission();

      // 监听用户权限变化
      this.permissionChangeListener = userManager.onPermissionChange(() => {
        this.checkPermission();
      });
    },

    detached() {
      // 清理权限变化监听器
      if (this.permissionChangeListener) {
        this.permissionChangeListener();
      }
    }
  },

  observers: {
    'requiredRoles': function() {
      this.checkPermission();
    }
  },

  methods: {
    /**
     * 检查权限
     */
    async checkPermission() {
      try {
        // 获取当前用户信息
        const user = await userManager.getCurrentUser();

        if (!user) {
          this.setData({
            hasPermission: false,
            currentUser: null,
            permissionChecked: true
          });
          return;
        }

        const hasPermission = userManager.hasPermission(this.data.requiredRoles);

        this.setData({
          hasPermission,
          currentUser: user,
          permissionChecked: true
        });
      } catch (error) {
        console.error('权限检查失败:', error);
        this.setData({
          hasPermission: false,
          currentUser: null,
          permissionChecked: true
        });
      }
    },

    /**
     * 处理按钮点击
     */
    handleClick() {
      if (this.data.disabled || this.data.loading) {
        return;
      }

      if (this.data.hasPermission) {
        this.triggerEvent('click');
      } else if (this.data.showPermissionTip) {
        this.setData({ showAuthModal: true });
      }
    },

    /**
     * 隐藏权限提示弹窗
     */
    hideAuthModal() {
      this.setData({ showAuthModal: false });
    },

    /**
     * 跳转到角色申请页面
     */
    goApplyPermission() {
      this.hideAuthModal();

      wx.navigateTo({
        url: '/pages/auth/role-application'
      }).catch(error => {
        console.error('跳转失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      });
    },

    /**
     * 联系管理员
     */
    contactAdmin() {
      this.hideAuthModal();

      wx.showModal({
        title: '联系管理员',
        content: '请联系您的机构管理员申请相关权限，或拨打客服电话：400-123-4567',
        showCancel: true,
        confirmText: '拨打电话',
        cancelText: '我知道了',
        success: (res) => {
          if (res.confirm) {
            wx.makePhoneCall({
              phoneNumber: '400-123-4567',
              fail: () => {
                wx.showToast({
                  title: '拨打失败',
                  icon: 'none'
                });
              }
            });
          }
        }
      });
    },

    /**
     * 查看权限说明
     */
    viewPermissionHelp() {
      this.hideAuthModal();

      wx.navigateTo({
        url: '/pages/auth/permission-help'
      }).catch(error => {
        console.error('跳转失败:', error);
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        });
      });
    },

    /**
     * 重新登录
     */
    reLogin() {
      this.hideAuthModal();

      wx.showModal({
        title: '重新登录',
        content: '是否需要重新登录以刷新权限状态？',
        success: (res) => {
          if (res.confirm) {
            userManager.clearCache();
            wx.reLaunch({
              url: '/pages/index/index'
            });
          }
        }
      });
    },

    /**
     * 获取按钮样式类名
     */
    getButtonClass() {
      const { type, size, plain, round, hasPermission, disabled, loading } = this.data;

      let classes = ['auth-button'];

      // 类型样式
      if (type) {
        classes.push(`auth-button--${type}`);
      }

      // 尺寸样式
      if (size) {
        classes.push(`auth-button--${size}`);
      }

      // 状态样式
      if (!hasPermission) {
        classes.push('auth-button--no-permission');
      }

      if (disabled) {
        classes.push('auth-button--disabled');
      }

      if (loading) {
        classes.push('auth-button--loading');
      }

      // 样式变体
      if (plain) {
        classes.push('auth-button--plain');
      }

      if (round) {
        classes.push('auth-button--round');
      }

      return classes.join(' ');
    },

    /**
     * 获取按钮文本
     */
    getButtonText() {
      const { text, hasPermission, loading } = this.data;

      if (loading) {
        return '加载中...';
      }

      if (!hasPermission && text) {
        return text;
      }

      return text || '';
    },

    /**
     * 获取权限提示内容
     */
    getPermissionTipContent() {
      const { requiredRoles, currentUser } = this.data;

      if (!requiredRoles || requiredRoles.length === 0) {
        return '此功能需要特定权限';
      }

      const roleNames = {
        admin: '管理员',
        social_worker: '社工',
        volunteer: '志愿者',
        parent: '家长'
      };

      const requiredRoleNames = requiredRoles.map(role => roleNames[role] || role);

      let content = `此功能需要以下权限之一：\n`;
      content += requiredRoleNames.join('、');

      if (currentUser) {
        const currentRoles = currentUser.roles || [];
        if (currentRoles.length === 0) {
          content += '\n\n当前您还未获得任何权限';
        } else {
          const currentRoleNames = currentRoles.map(role => roleNames[role] || role);
          content += `\n\n您当前权限：${currentRoleNames.join('、')}`;
        }
      }

      return content;
    }
  }
});