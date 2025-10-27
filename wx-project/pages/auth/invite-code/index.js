// pages/auth/invite-code/index.js
const userManager = require('../../../utils/user-manager');
const { Validators } = require('../../../utils/validators');
const logger = require('../../../utils/logger');

Page({
  data: {
    // 表单数据
    inviteCode: '',
    inputFocused: false,

    // 验证状态
    validating: false,
    using: false,
    canValidate: false,
    validationResult: null,

    // FAQ展开状态
    faqExpanded: [false, false, false, false],

    // 角色配置
    roleConfig: {
      social_worker: '社工',
      volunteer: '志愿者',
      researcher: '研究员',
      admin: '管理员'
    }
  },

  onLoad(options) {
    logger.info('[invite-code] 页面加载');
    // 解析二维码/小程序码参数
    try {
      const rawScene = options && options.scene ? decodeURIComponent(options.scene) : '';
      const rawCodeParam = options && options.code ? String(options.code).toUpperCase() : '';
      let foundCode = '';
      // 支持多种编码方案：
      // 1) i:XXXXXXXX （推荐）
      // 2) ic=XXXXXXXX / code=XXXXXXXX
      // 3) 纯 8 位码
      if (rawCodeParam && /^[A-Z0-9]{8}$/.test(rawCodeParam)) {
        foundCode = rawCodeParam;
      } else if (rawScene) {
        const scene = String(rawScene).toUpperCase();
        const m1 = scene.match(/\bi:([A-Z0-9]{8})\b/);
        const m2 = scene.match(/\b(?:IC|CODE)=([A-Z0-9]{8})\b/);
        const m3 = scene.match(/\b([A-Z0-9]{8})\b/);
        foundCode = (m1 && m1[1]) || (m2 && m2[1]) || (m3 && m3[1]) || '';
      }

      if (foundCode) {
        this.setData({
          inviteCode: foundCode,
          canValidate: Validators.inviteCode(foundCode)
        });
        // 自动验证并尝试激活
        setTimeout(() => this.validateAndUseInviteCode(), 200);
      }
    } catch (e) {
      logger.warn('[invite-code] 解析二维码参数失败:', e);
    }

    // 自动聚焦输入框（若未携带二维码码值）
    if (!this.data.inviteCode) {
      setTimeout(() => {
        this.setData({ inputFocused: true });
      }, 500);
    }
  },

  onShow() {
    // 检查用户登录状态
    this.checkUserLogin();
  },

  /**
   * 检查用户登录状态
   */
  async checkUserLogin() {
    try {
      const isLoggedIn = await userManager.isLoggedIn();
      if (!isLoggedIn) {
        wx.showModal({
          title: '提示',
          content: '请先登录后再使用邀请码',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      }
    } catch (error) {
      logger.error('[invite-code] 检查登录状态失败:', error);
    }
  },

  /**
   * 邀请码输入
   */
  onInviteCodeInput(e) {
    const inviteCode = e.detail.value.toUpperCase();
    this.setData({
      inviteCode,
      canValidate: Validators.inviteCode(inviteCode),
      validationResult: null // 清除之前的验证结果
    });
  },

  /**
   * 清除输入
   */
  clearInput() {
    this.setData({
      inviteCode: '',
      canValidate: false,
      validationResult: null
    });
  },

  /**
   * 验证并使用邀请码
   */
  async validateAndUseInviteCode() {
    if (!this.data.canValidate || this.data.validating || this.data.using) {
      return;
    }

    // 验证邀请码格式
    if (!Validators.inviteCode(this.data.inviteCode)) {
      wx.showToast({
        title: '请输入正确的8位邀请码',
        icon: 'none'
      });
      return;
    }

    this.setData({
      validating: true,
      validationResult: null
    });

    try {
      // 首先验证邀请码
      const validateResult = await userManager.validateInviteCode(this.data.inviteCode);

      if (!validateResult.success) {
        this.setData({
          validating: false,
          validationResult: {
            valid: false,
            message: validateResult.message || '邀请码验证失败'
          }
        });
        return;
      }

      // 显示验证结果
      const validationResult = {
        valid: validateResult.data.valid,
        message: validateResult.data.reason === 'not_found' ? '邀请码不存在' :
                validateResult.data.reason === 'expired' ? '邀请码已过期' :
                validateResult.data.reason === 'exhausted' ? '邀请码使用次数已用完' :
                validateResult.data.reason === 'inactive' ? '邀请码未激活' :
                '邀请码验证失败'
      };

      if (!validateResult.data.valid) {
        this.setData({
          validating: false,
          validationResult
        });
        return;
      }

      // 邀请码有效，显示角色信息
      const roleInfo = validateResult.data;
      validationResult.valid = true;
      validationResult.message = '邀请码验证成功，点击激活按钮获得角色权限';
      validationResult.role = roleInfo.role;
      validationResult.roleName = this.data.roleConfig[roleInfo.role] || roleInfo.role;
      validationResult.expiresAt = roleInfo.expiresAt ? this.formatDate(roleInfo.expiresAt) : null;
      validationResult.description = roleInfo.description;

      this.setData({
        validating: false,
        validationResult
      });

      // 自动使用邀请码
      setTimeout(() => {
        this.useInviteCode();
      }, 1500);

    } catch (error) {
      logger.error('[invite-code] 验证邀请码失败:', error);
      this.setData({
        validating: false,
        validationResult: {
          valid: false,
          message: '验证失败，请检查网络连接'
        }
      });
    }
  },

  /**
   * 使用邀请码
   */
  async useInviteCode() {
    if (this.data.using) {
      return;
    }

    this.setData({
      using: true
    });

    try {
      const result = await userManager.useInviteCode(this.data.inviteCode);

      if (result.success) {
        // 显示成功结果
        this.setData({
          using: false,
          validationResult: {
            valid: true,
            message: '恭喜！您已成功获得角色权限',
            role: result.data.role,
            roleName: this.data.roleConfig[result.data.role] || result.data.role,
            description: result.data.description
          }
        });

        // 显示成功提示
        wx.showToast({
          title: '激活成功！',
          icon: 'success',
          duration: 2000
        });

        // 延迟返回
        setTimeout(() => {
          wx.showModal({
            title: '激活成功',
            content: `您已成功获得${this.data.validationResult.roleName}角色权限！`,
            showCancel: false,
            success: () => {
              wx.navigateBack();
            }
          });
        }, 1000);

      } else {
        this.setData({
          using: false,
          validationResult: {
            valid: false,
            message: result.message || '激活失败，请重试'
          }
        });

        wx.showToast({
          title: result.message || '激活失败',
          icon: 'none'
        });
      }

    } catch (error) {
      logger.error('[invite-code] 使用邀请码失败:', error);
      this.setData({
        using: false,
        validationResult: {
          valid: false,
          message: '激活失败，请重试'
        }
      });

      wx.showToast({
        title: '激活失败，请重试',
        icon: 'none'
      });
    }
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
   * 显示帮助
   */
  showHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '邀请码是由管理员发放的8位字符码，用于激活特定角色权限。如果您没有邀请码，可以通过角色申请页面申请相应角色。',
      showCancel: false
    });
  },

  /**
   * 联系支持
   */
  contactSupport() {
    wx.showModal({
      title: '联系管理员',
      content: '如需帮助，请联系系统管理员获取邀请码或申请相关角色权限。',
      confirmText: '我知道了',
      showCancel: false
    });
  },

  /**
   * 前往角色申请
   */
  goToApplication() {
    wx.navigateTo({
      url: '/pages/auth/role-application'
    });
  },

  /**
   * 格式化日期
   */
  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
});
