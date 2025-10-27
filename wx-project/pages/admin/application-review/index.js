// pages/admin/application-review/index.js
const userManager = require('../../../utils/user-manager');
const { errorHandler, loadingManager, debounce } = require('../../../utils/admin-utils');
const { createDataManager } = require('../../../utils/data-manager');
const logger = require('../../../utils/logger');

Page({
  data: {
    // 筛选状态
    activeTab: 'pending',
    selectedRoleIndex: 0,
    selectedDate: '',
    searchKeyword: '',
    roleOptions: [
      { label: '全部角色', value: '' },
      { label: '社工', value: 'social_worker' },
      { label: '志愿者', value: 'volunteer' },
      { label: '研究员', value: 'researcher' },
      { label: '管理员', value: 'admin' }
    ],

    // 申请数据
    applications: [],
    loading: false,
    currentPage: 1,
    totalPages: 1,
    total: 0,
    pageSize: 20,

    // 统计数据
    stats: {
      pendingCount: 0,
      todayCount: 0,
      totalCount: 0
    },

    // 弹窗状态
    showDetailModal: false,
    showReasonModal: false,
    selectedApplication: null,
    reasonModalType: '', // 'approve' or 'reject'
    reviewReason: '',

    // 骨架屏状态
    showSkeleton: true,

    // 角色描述
    roleDescriptions: {
      social_worker: '负责患者跟进、康复指导等日常工作',
      volunteer: '协助社工开展活动、陪伴患者',
      researcher: '负责数据分析、研究报告等工作',
      admin: '系统管理和用户权限管理'
    }
  },

  /**
   * 页面初始化
   */
  onLoad(_options) {
    logger.info('[admin-application-review] 页面加载');
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
    this.searchApplications = this.dataManager.createSearchFunction(async (keyword) => {
      return this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'listRoleRequests',
          filter: { keyword }
        },
        cacheKey: `applications_search_${keyword}`
      });
    });
  },

  onShow() {
    this.loadApplications();
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
        this.loadApplications(),
        this.loadStats()
      ]);

      // 数据加载完成，隐藏骨架屏
      this.setData({ showSkeleton: false });
    } catch (error) {
      logger.error('[admin-application-review] 加载初始数据失败:', error);
      this.setData({ showSkeleton: false });
    }
  },

  /**
   * 切换标签页
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;

    this.setData({
      activeTab: tab,
      currentPage: 1,
      applications: []
    });

    this.loadApplications();
  },

  /**
   * 搜索输入（防抖处理）
   */
  onSearchInput: debounce(function(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword,
      currentPage: 1,
      applications: []
    });
    this.loadApplications();
  }, 500),

  /**
   * 清除搜索
   */
  clearSearch() {
    this.setData({
      searchKeyword: '',
      currentPage: 1,
      applications: []
    });
    this.loadApplications();
  },

  /**
   * 角色筛选变化
   */
  onRoleChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedRoleIndex: index,
      currentPage: 1,
      applications: []
    });

    this.loadApplications();
  },

  /**
   * 日期筛选变化
   */
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      selectedDate: date,
      currentPage: 1,
      applications: []
    });

    this.loadApplications();
  },

  /**
   * 批量操作
   */
  async batchApprove() {
    const pendingApplications = this.data.applications.filter(app => app.state === 'pending');

    if (pendingApplications.length === 0) {
      wx.showToast({
        title: '没有待审核的申请',
        icon: 'none'
      });
      return;
    }

    const result = await wx.showModal({
      title: '批量通过',
      content: `确定要通过所有 ${pendingApplications.length} 个待审核申请吗？`,
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      wx.showLoading({ title: '批量处理中...' });

      const batchResult = await this.dataManager.batchOperation({
        api: 'rbac',
        operation: 'batchApprove',
        data: pendingApplications.map(app => app.id),
        invalidateCache: ['applications_pending', 'applications_stats']
      });

      wx.hideLoading();

      if (batchResult.success) {
        wx.showToast({
          title: `成功通过 ${batchResult.data.successCount} 个申请`,
          icon: 'success'
        });

        // 重新加载数据
        this.loadData();
      } else {
        throw new Error(batchResult.error?.message || '批量操作失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'batchApprove'
      });
    }
  },

  /**
   * 批量拒绝
   */
  async batchReject() {
    const pendingApplications = this.data.applications.filter(app => app.state === 'pending');

    if (pendingApplications.length === 0) {
      wx.showToast({
        title: '没有待审核的申请',
        icon: 'none'
      });
      return;
    }

    const result = await wx.showModal({
      title: '批量拒绝',
      content: `确定要拒绝所有 ${pendingApplications.length} 个待审核申请吗？`,
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      wx.showLoading({ title: '批量处理中...' });

      const batchResult = await this.dataManager.batchOperation({
        api: 'rbac',
        operation: 'batchReject',
        data: pendingApplications.map(app => app.id),
        invalidateCache: ['applications_pending', 'applications_stats']
      });

      wx.hideLoading();

      if (batchResult.success) {
        wx.showToast({
          title: `成功拒绝 ${batchResult.data.successCount} 个申请`,
          icon: 'success'
        });

        // 重新加载数据
        this.loadData();
      } else {
        throw new Error(batchResult.error?.message || '批量操作失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'batchReject'
      });
    }
  },

  /**
   * 加载申请列表
   */
  async loadApplications() {
    const loadingKey = 'applications';

    if (loadingManager.isLoading(loadingKey)) {
      return;
    }

    loadingManager.start(loadingKey, (isLoading) => {
      this.setData({ loading: isLoading });
    });

    try {
      const { activeTab, selectedRoleIndex, roleOptions, selectedDate, currentPage, pageSize, searchKeyword } = this.data;
      const selectedRole = roleOptions[selectedRoleIndex].value;

      const filter = {
        state: activeTab === 'all' ? undefined : activeTab,
        role: selectedRole || undefined,
        date: selectedDate || undefined,
        keyword: searchKeyword.trim() || undefined
      };

      // 移除undefined值
      Object.keys(filter).forEach(key => {
        if (filter[key] === undefined) {
          delete filter[key];
        }
      });

      // 生成缓存键
      const cacheKey = `applications_${activeTab}_${selectedRole}_${selectedDate}_${currentPage}_${searchKeyword}`;

      const result = await this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'listRoleRequests',
          filter,
          page: currentPage - 1,
          pageSize
        },
        cacheKey,
        forceRefresh: false
      });

      if (result.success) {
        const { requests, total } = result.data;

        const formattedApplications = requests.map(item => ({
          id: item._id,
          openid: item.openid,
          displayName: item.displayName || '未知用户',
          avatar: item.avatar || '',
          phone: item.phone || '',
          email: item.email || '',
          role: item.role,
          reason: item.reason || '',
          attachments: item.attachments || [],
          state: item.state,
          statusText: this.getStatusText(item.state),
          createdAt: item.createdAt,
          createTime: this.formatDate(item.createdAt),
          reviewedAt: item.reviewedAt ? this.formatDate(item.reviewedAt) : '',
          reviewerName: item.reviewerName || '管理员',
          reviewReason: item.reviewReason || ''
        }));

        this.setData({
          applications: formattedApplications,
          total: total || 0,
          totalPages: Math.ceil(total / pageSize) || 1
        });
      } else {
        throw new Error(result.error?.message || '加载申请列表失败');
      }
    } catch (error) {
      errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        operation: 'loadApplications',
        activeTab: this.data.activeTab,
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
      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'getApplicationStats'
        }
      });

      if (result.result && result.result.success) {
        const stats = result.result.data;
        this.setData({
          stats: {
            pendingCount: stats.pendingCount || 0,
            todayCount: stats.todayCount || 0,
            totalCount: stats.totalCount || 0
          }
        });
      }
    } catch (error) {
      logger.error('[admin-application-review] 加载统计数据失败:', error);
    }
  },

  /**
   * 查看申请详情
   */
  viewApplicationDetail(e) {
    const id = e.currentTarget.dataset.id;
    const application = this.data.applications.find(item => item.id === id);

    if (application) {
      this.setData({
        selectedApplication: application,
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
      selectedApplication: null
    });
  },

  /**
   * 批准申请
   */
  approveApplication(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      reasonModalType: 'approve',
      reasonModalTitle: '批准申请',
      reviewReason: '',
      currentApplicationId: id,
      showReasonModal: true
    });
  },

  /**
   * 拒绝申请
   */
  rejectApplication(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      reasonModalType: 'reject',
      reasonModalTitle: '拒绝申请',
      reviewReason: '',
      currentApplicationId: id,
      showReasonModal: true
    });
  },

  /**
   * 理由输入
   */
  onReasonInput(e) {
    this.setData({
      reviewReason: e.detail.value
    });
  },

  /**
   * 关闭理由弹窗
   */
  closeReasonModal() {
    this.setData({
      showReasonModal: false,
      reasonModalType: '',
      reasonModalTitle: '',
      reviewReason: '',
      currentApplicationId: null
    });
  },

  /**
   * 确认审核
   */
  async confirmReview() {
    const { reasonModalType, currentApplicationId, reviewReason } = this.data;

    if (!reviewReason.trim()) {
      wx.showToast({
        title: '请输入审核理由',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: reasonModalType === 'approve' ? '批准中...' : '拒绝中...' });

      const action = reasonModalType === 'approve' ? 'approveRoleRequest' : 'rejectRoleRequest';

      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action,
          requestId: currentApplicationId,
          reason: reviewReason.trim()
        }
      });

      wx.hideLoading();

      if (result.result && result.result.success) {
        wx.showToast({
          title: reasonModalType === 'approve' ? '批准成功' : '拒绝成功',
          icon: 'success'
        });

        this.closeReasonModal();
        this.closeDetailModal();

        // 重新加载数据
        setTimeout(() => {
          this.loadApplications();
          this.loadStats();
        }, 1000);

      } else {
        throw new Error(result.result?.error?.message || '审核失败');
      }
    } catch (error) {
      wx.hideLoading();
      logger.error('[admin-application-review] 审核失败:', error);
      wx.showToast({
        title: error.message || '审核失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 获取状态文本
   */
  getStatusText(state) {
    const statusMap = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝'
    };
    return statusMap[state] || '未知状态';
  },

  /**
   * 获取角色描述
   */
  getRoleDescription(role) {
    return this.data.roleDescriptions[role] || '未知角色';
  },

  /**
   * 格式化日期
   */
  formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // 今天
      return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } else if (diffDays === 1) {
      // 昨天
      return `昨天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    } else if (diffDays < 7) {
      // 本周
      return `${diffDays}天前`;
    } else {
      // 超过一周
      return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      applications: []
    });

    Promise.all([
      this.loadApplications(),
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
      this.loadApplications();
    }
  },

  /**
   * 计算空状态描述
   */
  get emptyDesc() {
    const { activeTab } = this.data;
    const descMap = {
      all: '暂时没有任何申请记录',
      pending: '暂时没有待审核的申请',
      approved: '暂时没有已通过的申请',
      rejected: '暂时没有已拒绝的申请'
    };
    return descMap[activeTab] || '';
  }
});
