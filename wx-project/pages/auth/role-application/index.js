// pages/auth/role-application/index.js
const userManager = require('../../../utils/user-manager');
const { FormValidator, Validators } = require('../../../utils/validators');
const logger = require('../../../utils/logger');

Page({
  data: {
    // 表单数据
    selectedRole: '',
    reason: '',
    phone: '',
    email: '',
    attachments: [],

    // 表单状态
    submitting: false,
    canSubmit: false,

    // 历史申请记录
    historyApplications: [],

    // 角色配置
    roleConfig: {
      social_worker: {
        name: '社工',
        desc: '负责患者跟进、康复指导等工作'
      },
      volunteer: {
        name: '志愿者',
        desc: '协助社工开展活动、陪伴患者等'
      },
      researcher: {
        name: '研究员',
        desc: '负责数据分析、研究报告等工作'
      }
    }
  },

  onLoad(options) {
    logger.info('[role-application] 页面加载');
    this.initValidator();
    this.loadUserData();
    this.loadApplicationHistory();
    try {
      const preRole = options && options.role ? String(options.role) : '';
      if (preRole && ['social_worker','volunteer','parent'].includes(preRole)) {
        this.setData({ selectedRole: preRole });
        this.validateForm();
      }
    } catch (e) {
      // ignore
    }
  },

  onShow() {
    // 检查用户登录状态
    this.checkUserLogin();
  },

  /**
   * 初始化表单验证器
   */
  initValidator() {
    this.validator = new FormValidator({
      selectedRole: [
        Validators.required('请选择申请角色')
      ],
      reason: [
        Validators.required('请填写申请理由'),
        Validators.minLength(20, '申请理由至少需要20个字符'),
        Validators.maxLength(500, '申请理由不能超过500个字符')
      ],
      phone: [
        Validators.phone('请输入正确的手机号')
      ],
      email: [
        Validators.email('请输入正确的邮箱地址')
      ]
    });
  },

  /**
   * 加载用户数据
   */
  async loadUserData() {
    try {
      const user = await userManager.getCurrentUser();
      if (user && user.profile) {
        this.setData({
          phone: user.profile.phone || '',
          email: user.profile.email || ''
        });
        this.validateForm();
      }
    } catch (error) {
      logger.error('[role-application] 加载用户数据失败:', error);
    }
  },

  /**
   * 加载申请历史
   */
  async loadApplicationHistory() {
    try {
      const history = await userManager.getApplicationHistory();
      const formattedHistory = history.map(item => ({
        id: item._id,
        roleName: this.data.roleConfig[item.role]?.name || item.role,
        role: item.role,
        status: item.status,
        statusText: this.getStatusText(item.status),
        createTime: this.formatTime(item.createdAt),
        reason: item.reason,
        attachments: item.attachments || []
      }));

      this.setData({
        historyApplications: formattedHistory
      });
    } catch (error) {
      logger.error('[role-application] 加载申请历史失败:', error);
    }
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
          content: '请先登录后再进行角色申请',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      }
    } catch (error) {
      logger.error('[role-application] 检查登录状态失败:', error);
    }
  },

  /**
   * 选择角色
   */
  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({
      selectedRole: role
    });
    this.validateForm();
  },

  /**
   * 申请理由输入
   */
  onReasonInput(e) {
    this.setData({
      reason: e.detail.value
    });
    this.validateForm();
  },

  /**
   * 手机号输入
   */
  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value
    });
    this.validateForm();
  },

  /**
   * 邮箱输入
   */
  onEmailInput(e) {
    this.setData({
      email: e.detail.value
    });
    this.validateForm();
  },

  /**
   * 验证表单
   */
  validateForm() {
    const formData = {
      selectedRole: this.data.selectedRole,
      reason: this.data.reason,
      phone: this.data.phone,
      email: this.data.email
    };

    const result = this.validator.validate(formData);
    this.setData({
      canSubmit: result.isValid
    });
  },

  /**
   * 选择附件
   */
  async chooseAttachment() {
    try {
      const result = await wx.chooseMessageFile({
        count: 3 - this.data.attachments.length,
        type: 'file'
      });

      const newAttachments = result.tempFiles.map(file => ({
        name: file.name,
        path: file.path,
        size: this.formatFileSize(file.size),
        type: this.getFileType(file.name)
      }));

      // 验证文件大小
      const oversizedFiles = result.tempFiles.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        wx.showToast({
          title: '文件大小不能超过10MB',
          icon: 'none'
        });
        return;
      }

      this.setData({
        attachments: [...this.data.attachments, ...newAttachments]
      });
    } catch (error) {
      logger.error('[role-application] 选择附件失败:', error);
    }
  },

  /**
   * 移除附件
   */
  removeAttachment(e) {
    const index = e.currentTarget.dataset.index;
    const attachments = [...this.data.attachments];
    attachments.splice(index, 1);
    this.setData({
      attachments
    });
  },

  /**
   * 提交申请
   */
  async submitApplication() {
    if (!this.data.canSubmit || this.data.submitting) {
      return;
    }

    // 最后验证一次
    const formData = {
      selectedRole: this.data.selectedRole,
      reason: this.data.reason,
      phone: this.data.phone,
      email: this.data.email
    };

    const validationResult = this.validator.validate(formData);
    if (!validationResult.isValid) {
      wx.showToast({
        title: validationResult.errors[0].message,
        icon: 'none'
      });
      return;
    }

    this.setData({
      submitting: true
    });

    try {
      // 上传附件
      const uploadedAttachments = await this.uploadAttachments();

      // 提交申请
      const result = await userManager.submitRoleApplication({
        role: this.data.selectedRole,
        reason: this.data.reason,
        phone: this.data.phone,
        email: this.data.email,
        attachments: uploadedAttachments
      });

      if (result.success) {
        wx.showToast({
          title: '申请提交成功',
          icon: 'success'
        });

        // 清空表单
        this.setData({
          selectedRole: '',
          reason: '',
          phone: '',
          email: '',
          attachments: [],
          canSubmit: false
        });

        // 重新加载申请历史
        setTimeout(() => {
          this.loadApplicationHistory();
        }, 1000);

      } else {
        wx.showToast({
          title: result.message || '提交失败，请重试',
          icon: 'none'
        });
      }
    } catch (error) {
      logger.error('[role-application] 提交申请失败:', error);
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({
        submitting: false
      });
    }
  },

  /**
   * 上传附件
   */
  async uploadAttachments() {
    const uploadedFiles = [];

    for (const attachment of this.data.attachments) {
      try {
        const uploadResult = await userManager.uploadFile({
          filePath: attachment.path,
          fileName: attachment.name,
          fileType: 'application_attachment'
        });

        uploadedFiles.push({
          name: attachment.name,
          fileId: uploadResult.fileId,
          url: uploadResult.url,
          size: attachment.size,
          type: attachment.type
        });
      } catch (error) {
        logger.error('[role-application] 上传附件失败:', attachment.name, error);
        // 继续上传其他文件，不要因为一个文件失败而全部失败
      }
    }

    return uploadedFiles;
  },

  /**
   * 查看申请详情
   */
  viewApplicationDetail(e) {
    const id = e.currentTarget.dataset.id;
    const application = this.data.historyApplications.find(item => item.id === id);

    if (application) {
      wx.showModal({
        title: '申请详情',
        content: `角色：${application.roleName}\n状态：${application.statusText}\n申请时间：${application.createTime}\n申请理由：${application.reason}`,
        showCancel: false
      });
    }
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
      cancelled: '已撤销'
    };
    return statusMap[status] || '未知状态';
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  /**
   * 格式化文件大小
   */
  formatFileSize(size) {
    if (size < 1024) {
      return size + 'B';
    } else if (size < 1024 * 1024) {
      return (size / 1024).toFixed(1) + 'KB';
    } else {
      return (size / (1024 * 1024)).toFixed(1) + 'MB';
    }
  },

  /**
   * 获取文件类型
   */
  getFileType(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const typeMap = {
      'pdf': 'PDF',
      'doc': 'Word',
      'docx': 'Word',
      'jpg': '图片',
      'jpeg': '图片',
      'png': '图片',
      'txt': '文本'
    };
    return typeMap[ext] || '其他';
  }
});
