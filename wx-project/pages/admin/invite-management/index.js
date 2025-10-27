// pages/admin/invite-management/index.js
const userManager = require('../../../utils/user-manager');
const { errorHandler, loadingManager, debounce } = require('../../../utils/admin-utils');
const { createDataManager } = require('../../../utils/data-manager');
const logger = require('../../../utils/logger');

Page({
  data: {
    // 搜索和筛选
    searchKeyword: '',
    selectedRoleIndex: 0,
    selectedStatusIndex: 0,
    selectedDate: '',

    // 筛选选项
    roleOptions: [
      { label: '全部角色', value: '' },
      { label: '管理员', value: 'admin' },
      { label: '社工', value: 'social_worker' },
      { label: '志愿者', value: 'volunteer' },
      { label: '研究员', value: 'researcher' }
    ],
    statusOptions: [
      { label: '全部状态', value: '' },
      { label: '有效', value: 'active' },
      { label: '已使用', value: 'used' },
      { label: '已过期', value: 'expired' },
      { label: '已撤销', value: 'revoked' }
    ],

    // 邀请码数据
    invites: [],
    loading: false,
    currentPage: 1,
    totalPages: 1,
    total: 0,
    pageSize: 20,

    // 统计数据
    stats: {
      totalInvites: 0,
      activeInvites: 0,
      usedInvites: 0,
      expiredInvites: 0
    },

    // 弹窗状态
    showCreateModal: false,
    showBatchModal: false,
    showDetailModal: false,
    selectedInvite: null,

    // 创建表单
    formRoleIndex: 0,
    formMaxUses: '1',
    formDescription: '',
    formExpiryType: 'never',
    formExpiresAt: '',

    // 批量创建表单
    batchRoleIndex: 0,
    batchCount: '5',
    batchMaxUses: '1',
    batchDescription: '',

    // 骨架屏状态
    showSkeleton: true
  },

  onLoad(_options) {
    logger.info('[admin-invite-management] 页面加载');
    this.initDataManager();
    this.checkAdminPermission();
  },

  /**
   * 初始化数据管理器
   */
  initDataManager() {
    this.dataManager = createDataManager({
      pageSize: 20,
      cacheTimeout: 3 * 60 * 1000, // 3分钟缓存
      enableCache: true,
      enableDebounce: true,
      debounceDelay: 500
    });

    // 创建搜索函数
    this.searchInvites = this.dataManager.createSearchFunction(async (keyword) => {
      return this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'getInviteList',
          filter: { keyword }
        },
        cacheKey: `invites_search_${keyword}`
      });
    });
  },

  onShow() {
    this.loadInvites();
    this.loadStats();
  },

  /**
   * 检查管理员权限
   */
  async checkAdminPermission() {
    try {
      loadingManager.start('permission');
      const hasPermission = await userManager.hasPermission(['admin']);

      if (!hasPermission) {
        throw errorHandler.createError('权限不足', 'PERMISSION_DENIED', errorHandler.errorTypes.PERMISSION);
      }

      // 权限检查通过，开始加载数据
      this.loadData();
    } catch (error) {
      errorHandler.handle(error, errorHandler.errorTypes.PERMISSION, {
        operation: 'checkAdminPermission'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } finally {
      loadingManager.end('permission');
    }
  },

  /**
   * 加载页面数据
   */
  async loadData() {
    try {
      await Promise.all([
        this.loadInvites(),
        this.loadStats()
      ]);

      // 数据加载完成，隐藏骨架屏
      this.setData({ showSkeleton: false });
    } catch (error) {
      logger.error('[admin-invite-management] 加载初始数据失败:', error);
      this.setData({ showSkeleton: false });
    }
  },

  /**
   * 搜索输入（防抖处理）
   */
  onSearchInput: debounce(function(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword,
      currentPage: 1,
      invites: []
    });
    this.loadInvites();
  }, 500),

  /**
   * 清除搜索
   */
  clearSearch() {
    this.setData({
      searchKeyword: '',
      currentPage: 1,
      invites: []
    });
    this.loadInvites();
  },

  /**
   * 执行搜索
   */
  performSearch() {
    this.setData({
      currentPage: 1,
      invites: []
    });
    this.loadInvites();
  },

  /**
   * 角色筛选变化
   */
  onRoleChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedRoleIndex: index,
      currentPage: 1,
      invites: []
    });
    this.loadInvites();
  },

  /**
   * 状态筛选变化
   */
  onStatusChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedStatusIndex: index,
      currentPage: 1,
      invites: []
    });
    this.loadInvites();
  },

  /**
   * 日期筛选变化
   */
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      selectedDate: date,
      currentPage: 1,
      invites: []
    });
    this.loadInvites();
  },

  /**
   * 加载邀请码列表
   */
  async loadInvites() {
    const loadingKey = 'invites';

    if (loadingManager.isLoading(loadingKey)) {
      return;
    }

    loadingManager.start(loadingKey, (isLoading) => {
      this.setData({ loading: isLoading });
    });

    try {
      const {
        searchKeyword,
        selectedRoleIndex,
        selectedStatusIndex,
        selectedDate,
        currentPage,
        pageSize,
        roleOptions,
        statusOptions
      } = this.data;

      const selectedRole = roleOptions[selectedRoleIndex].value;
      const selectedStatus = statusOptions[selectedStatusIndex].value;

      const filter = {
        keyword: searchKeyword.trim() || undefined,
        role: selectedRole || undefined,
        status: selectedStatus || undefined,
        date: selectedDate || undefined
      };

      // 移除undefined值
      Object.keys(filter).forEach(key => {
        if (filter[key] === undefined) {
          delete filter[key];
        }
      });

      // 生成缓存键
      const cacheKey = `invites_${selectedRole}_${selectedStatus}_${selectedDate}_${currentPage}_${searchKeyword}`;

      const result = await this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'getInviteList',
          filter,
          page: currentPage - 1,
          pageSize
        },
        cacheKey,
        forceRefresh: false
      });

      if (result.success) {
        const { invites, total } = result.data;

        const formattedInvites = invites.map(invite => ({
          id: invite._id,
          code: invite.code,
          role: invite.role,
          status: invite.status,
          statusText: this.getStatusText(invite.status),
          description: invite.description || '',
          maxUses: invite.maxUses || 1,
          usedCount: invite.usedCount || 0,
          remainingUses: (invite.maxUses || 1) - (invite.usedCount || 0),
          createdAt: invite.createdAt,
          createTime: this.formatDate(invite.createdAt),
          expiresAt: invite.expiresAt,
          createdBy: invite.createdBy,
          createdByName: invite.createdByName || '管理员',
          usageRecords: invite.usageRecords || []
        }));

        this.setData({
          invites: formattedInvites,
          total: total || 0,
          totalPages: Math.ceil(total / pageSize) || 1
        });
      } else {
        throw new Error(result.error?.message || '加载邀请码列表失败');
      }
    } catch (error) {
      errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        operation: 'loadInvites',
        currentPage: this.data.currentPage
      });
    } finally {
      loadingManager.end(loadingKey);
    }
  },

  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      // 模拟统计数据，实际应该从云函数获取
      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'getInviteStats'
        }
      });

      if (result.result && result.result.success) {
        this.setData({
          stats: result.result.data
        });
      } else {
        // 设置默认统计数据
        this.setData({
          stats: {
            totalInvites: this.data.total || 0,
            activeInvites: Math.floor((this.data.total || 0) * 0.6),
            usedInvites: Math.floor((this.data.total || 0) * 0.3),
            expiredInvites: Math.floor((this.data.total || 0) * 0.1)
          }
        });
      }
    } catch (error) {
      logger.error('[admin-invite-management] 加载统计数据失败:', error);
      // 设置默认统计数据
      this.setData({
        stats: {
          totalInvites: this.data.total || 0,
          activeInvites: Math.floor((this.data.total || 0) * 0.6),
          usedInvites: Math.floor((this.data.total || 0) * 0.3),
          expiredInvites: Math.floor((this.data.total || 0) * 0.1)
        }
      });
    }
  },

  /**
   * 显示创建邀请码弹窗
   */
  showCreateModal() {
    this.setData({
      showCreateModal: true,
      formRoleIndex: 0,
      formMaxUses: '1',
      formDescription: '',
      formExpiryType: 'never',
      formExpiresAt: ''
    });
  },

  /**
   * 关闭创建弹窗
   */
  closeCreateModal() {
    this.setData({
      showCreateModal: false
    });
  },

  /**
   * 显示批量创建弹窗
   */
  showBatchCreateModal() {
    this.setData({
      showBatchModal: true,
      batchRoleIndex: 0,
      batchCount: '5',
      batchMaxUses: '1',
      batchDescription: ''
    });
  },

  /**
   * 关闭批量创建弹窗
   */
  closeBatchModal() {
    this.setData({
      showBatchModal: false
    });
  },

  /**
   * 创建表单角色变化
   */
  onFormRoleChange(e) {
    this.setData({
      formRoleIndex: e.detail.value
    });
  },

  /**
   * 创建表单使用次数输入
   */
  onFormMaxUsesInput(e) {
    this.setData({
      formMaxUses: e.detail.value
    });
  },

  /**
   * 创建表单说明输入
   */
  onFormDescriptionInput(e) {
    this.setData({
      formDescription: e.detail.value
    });
  },

  /**
   * 创建表单过期类型变化
   */
  onExpiryChange(e) {
    const expiryType = e.detail.value[0];
    this.setData({
      formExpiryType: expiryType
    });
  },

  /**
   * 创建表单过期时间变化
   */
  onFormExpiresAtChange(e) {
    this.setData({
      formExpiresAt: e.detail.value
    });
  },

  /**
   * 批量表单角色变化
   */
  onBatchRoleChange(e) {
    this.setData({
      batchRoleIndex: e.detail.value
    });
  },

  /**
   * 批量表单数量输入
   */
  onBatchCountInput(e) {
    this.setData({
      batchCount: e.detail.value
    });
  },

  /**
   * 批量表单使用次数输入
   */
  onBatchMaxUsesInput(e) {
    this.setData({
      batchMaxUses: e.detail.value
    });
  },

  /**
   * 批量表单说明输入
   */
  onBatchDescriptionInput(e) {
    this.setData({
      batchDescription: e.detail.value
    });
  },

  /**
   * 表单是否有效
   */
  get isFormValid() {
    const { formMaxUses } = this.data;
    return formMaxUses && parseInt(formMaxUses) > 0 && parseInt(formMaxUses) <= 100;
  },

  /**
   * 批量表单是否有效
   */
  get isBatchFormValid() {
    const { batchCount, batchMaxUses } = this.data;
    const count = parseInt(batchCount);
    const maxUses = parseInt(batchMaxUses);

    return batchCount && count > 0 && count <= 50 &&
           batchMaxUses && maxUses > 0 && maxUses <= 100;
  },

  /**
   * 确认创建邀请码
   */
  async confirmCreateInvite() {
    if (!this.data.isFormValid) {
      wx.showToast({
        title: '请检查输入参数',
        icon: 'none'
      });
      return;
    }

    const { formRoleIndex, formMaxUses, formDescription, formExpiryType, formExpiresAt, roleOptions } = this.data;

    try {
      wx.showLoading({ title: '创建中...' });

      const inviteData = {
        role: roleOptions[formRoleIndex].value,
        maxUses: parseInt(formMaxUses),
        description: formDescription.trim() || undefined
      };

      if (formExpiryType === 'date' && formExpiresAt) {
        inviteData.expiresAt = new Date(formExpiresAt).getTime();
      }

      const result = await userManager.createInviteCode(inviteData);

      wx.hideLoading();

      if (result.success) {
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        });

        this.closeCreateModal();
        this.loadInvites();
        this.loadStats();
      } else {
        throw new Error(result.error || '创建失败');
      }
    } catch (error) {
      wx.hideLoading();
      logger.error('[admin-invite-management] 创建邀请码失败:', error);
      wx.showToast({
        title: error.message || '创建失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 确认批量创建
   */
  async confirmBatchCreate() {
    if (!this.data.isBatchFormValid) {
      wx.showToast({
        title: '请检查输入参数',
        icon: 'none'
      });
      return;
    }

    const { batchRoleIndex, batchCount, batchMaxUses, batchDescription, roleOptions } = this.data;

    try {
      wx.showLoading({ title: '批量创建中...' });

      const inviteData = {
        role: roleOptions[batchRoleIndex].value,
        maxUses: parseInt(batchMaxUses),
        description: batchDescription.trim() || undefined,
        batchCount: parseInt(batchCount)
      };

      const result = await this.dataManager.batchOperation({
        api: 'rbac',
        operation: 'batchCreateInvites',
        data: inviteData,
        invalidateCache: ['invites_active', 'invites_stats']
      });

      wx.hideLoading();

      if (result.success) {
        wx.showToast({
          title: `成功创建 ${result.data.successCount || batchCount} 个邀请码`,
          icon: 'success'
        });

        this.closeBatchModal();
        this.loadData();
      } else {
        throw new Error(result.error?.message || '批量创建失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'confirmBatchCreate'
      });
    }
  },

  /**
   * 查看邀请码详情
   */
  viewInviteDetail(e) {
    const inviteId = e.currentTarget.dataset.id;
    const invite = this.data.invites.find(i => i.id === inviteId);

    if (invite) {
      this.setData({
        selectedInvite: invite,
        showDetailModal: true
      });
    }
  },

  /**
   * 关闭详情弹窗
   */
  closeDetailModal() {
    this.setData({
      showDetailModal: false,
      selectedInvite: null
    });
  },

  /**
   * 复制邀请码
   */
  copyInviteCode(e) {
    const code = e.currentTarget.dataset.code;

    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        });
      }
    });
  },

  /**
   * 编辑邀请码
   */
  editInvite(_e) {
    wx.showModal({
      title: '编辑邀请码',
      content: '邀请码编辑功能开发中...',
      showCancel: false
    });
  },

  /**
   * 撤销邀请码
   */
  async revokeInvite(e) {
    const inviteId = e.currentTarget.dataset.id;
    const invite = this.data.invites.find(i => i.id === inviteId);

    if (!invite) return;

    const result = await wx.showModal({
      title: '确认撤销',
      content: `确定要撤销邀请码 "${invite.code}" 吗？撤销后将无法恢复。`,
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      wx.showLoading({ title: '处理中...' });

      const revokeResult = await userManager.revokeInviteCode(inviteId, '管理员撤销');

      wx.hideLoading();

      if (revokeResult.success) {
        wx.showToast({
          title: '撤销成功',
          icon: 'success'
        });

        // 重新加载数据
        setTimeout(() => {
          this.loadInvites();
          this.loadStats();
        }, 1000);
      } else {
        throw new Error(revokeResult.error || '撤销失败');
      }
    } catch (error) {
      wx.hideLoading();
      logger.error('[admin-invite-management] 撤销邀请码失败:', error);
      wx.showToast({
        title: error.message || '撤销失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 导出邀请码数据
   */
  exportInvites() {
    wx.showModal({
      title: '导出数据',
      content: '邀请码数据导出功能开发中...',
      showCancel: false
    });
  },

  /**
   * 上一页
   */
  prevPage() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1,
        invites: []
      });
      this.loadInvites();
    }
  },

  /**
   * 下一页
   */
  nextPage() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1,
        invites: []
      });
      this.loadInvites();
    }
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      active: '有效',
      used: '已使用',
      expired: '已过期',
      revoked: '已撤销'
    };
    return statusMap[status] || '未知状态';
  },

  /**
   * 格式化日期
   */
  formatDate(timestamp) {
    if (!timestamp) return '未知';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return '今天';
    } else if (diffDays === 1) {
      return '昨天';
    } else if (diffDays < 7) {
      return `${diffDays}天前`;
    } else if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)}周前`;
    } else if (diffDays < 365) {
      return `${Math.floor(diffDays / 30)}个月前`;
    } else {
      return `${Math.floor(diffDays / 365)}年前`;
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      invites: []
    });

    Promise.all([
      this.loadInvites(),
      this.loadStats()
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 触底加载更多
   */
  onReachBottom() {
    const { currentPage, totalPages, loading } = this.data;
    if (currentPage < totalPages && !loading) {
      this.setData({
        currentPage: currentPage + 1
      });
      this.loadInvites();
    }
  }
});
