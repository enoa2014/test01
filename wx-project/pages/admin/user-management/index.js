// pages/admin/user-management/index.js
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
    selectedSortIndex: 0,

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
      { label: '活跃', value: 'active' },
      { label: '暂停', value: 'inactive' },
      { label: '待审核', value: 'pending' }
    ],
    sortOptions: [
      { label: '注册时间降序', value: 'registerTimeDesc' },
      { label: '注册时间升序', value: 'registerTimeAsc' },
      { label: '最后活跃降序', value: 'lastActiveDesc' },
      { label: '最后活跃升序', value: 'lastActiveAsc' },
      { label: '姓名排序', value: 'nameAsc' }
    ],

    // 用户数据
    users: [],
    loading: false,
    currentPage: 1,
    totalPages: 1,
    total: 0,
    pageSize: 20,

    // 选择状态
    selectedUsers: [],
    allSelected: false,

    // 统计数据
    stats: {
      totalUsers: 0,
      activeUsers: 0,
      newUsers: 0
    },

    // 弹窗状态
    showDetailModal: false,
    showRoleModal: false,
    selectedUser: null,
    roleModalTitle: '',
    currentUserId: null,

    // 角色修改
    selectedRoles: [],
    roleChangeReason: '',
    availableRoles: [
      { label: '管理员', value: 'admin', description: '系统管理和用户权限管理' },
      { label: '社工', value: 'social_worker', description: '负责患者跟进、康复指导等日常工作' },
      { label: '志愿者', value: 'volunteer', description: '协助社工开展活动、陪伴患者' },
      { label: '研究员', value: 'researcher', description: '负责数据分析、研究报告等工作' }
    ],

    // 骨架屏状态
    showSkeleton: true
  },

  onLoad(_options) {
    logger.info('[admin-user-management] 页面加载');
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
    this.searchUsers = this.dataManager.createSearchFunction(async (keyword) => {
      return this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'getUserList',
          filter: { keyword }
        },
        cacheKey: `users_search_${keyword}`
      });
    });
  },

  onShow() {
    this.loadUsers();
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
        this.loadUsers(),
        this.loadStats()
      ]);

      // 数据加载完成，隐藏骨架屏
      this.setData({ showSkeleton: false });
    } catch (error) {
      logger.error('[admin-user-management] 加载初始数据失败:', error);
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
      users: []
    });
    this.loadUsers();
  }, 500),

  /**
   * 清除搜索
   */
  clearSearch() {
    this.setData({
      searchKeyword: '',
      currentPage: 1,
      users: []
    });
    this.loadUsers();
  },

  /**
   * 执行搜索
   */
  performSearch() {
    this.setData({
      currentPage: 1,
      users: []
    });
    this.loadUsers();
  },

  /**
   * 角色筛选变化
   */
  onRoleChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedRoleIndex: index,
      currentPage: 1,
      users: []
    });
    this.loadUsers();
  },

  /**
   * 状态筛选变化
   */
  onStatusChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedStatusIndex: index,
      currentPage: 1,
      users: []
    });
    this.loadUsers();
  },

  /**
   * 日期筛选变化
   */
  onDateChange(e) {
    const date = e.detail.value;
    this.setData({
      selectedDate: date,
      currentPage: 1,
      users: []
    });
    this.loadUsers();
  },

  /**
   * 排序变化
   */
  onSortChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedSortIndex: index,
      users: []
    });
    this.loadUsers();
  },

  /**
   * 加载用户列表
   */
  async loadUsers() {
    const loadingKey = 'users';

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
        selectedSortIndex,
        currentPage,
        pageSize,
        roleOptions,
        statusOptions,
        sortOptions
      } = this.data;

      const selectedRole = roleOptions[selectedRoleIndex].value;
      const selectedStatus = statusOptions[selectedStatusIndex].value;
      const sortBy = sortOptions[selectedSortIndex].value;

      const filter = {
        keyword: searchKeyword.trim() || undefined,
        role: selectedRole || undefined,
        status: selectedStatus || undefined,
        date: selectedDate || undefined,
        sortBy
      };

      // 移除undefined值
      Object.keys(filter).forEach(key => {
        if (filter[key] === undefined) {
          delete filter[key];
        }
      });

      // 生成缓存键
      const cacheKey = `users_${selectedRole}_${selectedStatus}_${selectedDate}_${sortBy}_${currentPage}_${searchKeyword}`;

      const result = await this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'getUserList',
          filter,
          page: currentPage - 1,
          pageSize
        },
        cacheKey,
        forceRefresh: false
      });

      if (result.success) {
        const { users, total } = result.data;

        const formattedUsers = users.map(user => ({
          id: user._id,
          openid: user.openid,
          displayName: user.displayName || user.profile?.realName || '未设置姓名',
          avatar: user.avatar || user.profile?.avatar || '',
          phone: user.phone || user.profile?.phone || '',
          email: user.email || user.profile?.email || '',
          roles: user.roles || [],
          status: user.status || 'inactive',
          statusText: this.getStatusText(user.status),
          profile: user.profile || {},
          createdAt: user.createdAt,
          registerTime: this.formatDate(user.createdAt),
          lastActiveAt: user.lastActiveAt,
          lastActiveTime: this.formatDate(user.lastActiveAt)
        }));

        this.setData({
          users: formattedUsers,
          total: total || 0,
          totalPages: Math.ceil(total / pageSize) || 1,
          selectedUsers: [],
          allSelected: false
        });
      } else {
        throw new Error(result.error?.message || '加载用户列表失败');
      }
    } catch (error) {
      errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        operation: 'loadUsers',
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
          action: 'getUserStats'
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
            totalUsers: this.data.total || 0,
            activeUsers: Math.floor((this.data.total || 0) * 0.8),
            newUsers: 3 // 模拟今日新增用户数
          }
        });
      }
    } catch (error) {
      logger.error('[admin-user-management] 加载统计数据失败:', error);
      // 设置默认统计数据
      this.setData({
        stats: {
          totalUsers: this.data.total || 0,
          activeUsers: Math.floor((this.data.total || 0) * 0.8),
          newUsers: 0
        }
      });
    }
  },

  /**
   * 切换用户选择
   */
  toggleUserSelection(e) {
    const userId = e.currentTarget.dataset.id;
    const { selectedUsers } = this.data;
    const index = selectedUsers.indexOf(userId);

    let newSelectedUsers;
    if (index > -1) {
      // 取消选择
      newSelectedUsers = [...selectedUsers];
      newSelectedUsers.splice(index, 1);
    } else {
      // 添加选择
      newSelectedUsers = [...selectedUsers, userId];
    }

    const allSelected = newSelectedUsers.length === this.data.users.length;

    this.setData({
      selectedUsers: newSelectedUsers,
      allSelected
    });
  },

  /**
   * 全选/取消全选
   */
  toggleSelectAll() {
    const { users, allSelected } = this.data;

    if (allSelected) {
      // 取消全选
      this.setData({
        selectedUsers: [],
        allSelected: false
      });
    } else {
      // 全选
      this.setData({
        selectedUsers: users.map(user => user.id),
        allSelected: true
      });
    }
  },

  /**
   * 显示批量角色修改弹窗
   */
  showBatchRoleModal() {
    if (this.data.selectedUsers.length === 0) {
      wx.showToast({
        title: '请先选择用户',
        icon: 'none'
      });
      return;
    }

    this.setData({
      roleModalTitle: '批量修改角色',
      currentUserId: null,
      selectedRoles: [],
      roleChangeReason: '',
      showRoleModal: true
    });
  },

  /**
   * 批量暂停用户
   */
  async batchSuspendUsers() {
    const { selectedUsers } = this.data;
    if (selectedUsers.length === 0) {
      wx.showToast({
        title: '请先选择用户',
        icon: 'none'
      });
      return;
    }

    const result = await wx.showModal({
      title: '确认操作',
      content: `确定要暂停这 ${selectedUsers.length} 个用户吗？`,
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      wx.showLoading({ title: '批量处理中...' });

      const batchResult = await this.dataManager.batchOperation({
        api: 'rbac',
        operation: 'batchSuspendUsers',
        data: selectedUsers,
        invalidateCache: ['users_active', 'users_stats']
      });

      wx.hideLoading();

      if (batchResult.success) {
        wx.showToast({
          title: `成功暂停 ${batchResult.data.successCount} 个用户`,
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
        operation: 'batchSuspendUsers'
      });
    }
  },

  /**
   * 批量激活用户
   */
  async batchActivateUsers() {
    const { selectedUsers } = this.data;
    if (selectedUsers.length === 0) {
      wx.showToast({
        title: '请先选择用户',
        icon: 'none'
      });
      return;
    }

    const result = await wx.showModal({
      title: '确认操作',
      content: `确定要激活这 ${selectedUsers.length} 个用户吗？`,
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      wx.showLoading({ title: '批量处理中...' });

      const batchResult = await this.dataManager.batchOperation({
        api: 'rbac',
        operation: 'batchActivateUsers',
        data: selectedUsers,
        invalidateCache: ['users_active', 'users_stats']
      });

      wx.hideLoading();

      if (batchResult.success) {
        wx.showToast({
          title: `成功激活 ${batchResult.data.successCount} 个用户`,
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
        operation: 'batchActivateUsers'
      });
    }
  },

  /**
   * 查看用户详情
   */
  viewUserDetail(e) {
    const userId = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u.id === userId);

    if (user) {
      this.setData({
        selectedUser: user,
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
      selectedUser: null
    });
  },

  /**
   * 编辑用户
   */
  editUser(_e) {
    wx.showModal({
      title: '编辑用户',
      content: '用户编辑功能开发中...',
      showCancel: false
    });
  },

  /**
   * 修改用户角色
   */
  modifyUserRole(e) {
    const userId = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u.id === userId);

    if (user) {
      this.setData({
        roleModalTitle: '修改用户角色',
        currentUserId: userId,
        selectedRoles: user.roles || [],
        roleChangeReason: '',
        showRoleModal: true
      });
    }
  },

  /**
   * 切换用户状态
   */
  async onToggleUserStatusTap(e) {
    const userId = e.currentTarget.dataset.id;
    const user = this.data.users.find(u => u.id === userId);

    if (!user) return;

    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    const actionText = newStatus === 'active' ? '激活' : '暂停';

    const result = await wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}用户 "${user.displayName}" 吗？`,
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      await this.toggleUserStatus(userId, newStatus === 'active');

      wx.showToast({
        title: `${actionText}成功`,
        icon: 'success'
      });

      // 重新加载数据
      setTimeout(() => {
        this.loadUsers();
        this.loadStats();
      }, 1000);

    } catch (error) {
      logger.error('[admin-user-management] 切换用户状态失败:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 切换用户状态（内部方法）
   */
  async toggleUserStatus(userId, active) {
    // 这里应该调用云函数来切换用户状态
    const result = await wx.cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'toggleUserStatus',
        userId,
        active
      }
    });

    if (!result.result?.success) {
      throw new Error(result.result?.error?.message || '操作失败');
    }

    return result.result;
  },

  /**
   * 关闭角色弹窗
   */
  closeRoleModal() {
    this.setData({
      showRoleModal: false,
      roleModalTitle: '',
      currentUserId: null,
      selectedRoles: [],
      roleChangeReason: ''
    });
  },

  /**
   * 角色复选框变化
   */
  onRoleCheckboxChange(e) {
    const { value } = e.currentTarget.dataset;
    const { selectedRoles } = this.data;
    const index = selectedRoles.indexOf(value);

    let newSelectedRoles;
    if (index > -1) {
      // 取消选择
      newSelectedRoles = [...selectedRoles];
      newSelectedRoles.splice(index, 1);
    } else {
      // 添加选择
      newSelectedRoles = [...selectedRoles, value];
    }

    this.setData({
      selectedRoles: newSelectedRoles
    });
  },

  /**
   * 角色修改原因输入
   */
  onRoleReasonInput(e) {
    this.setData({
      roleChangeReason: e.detail.value
    });
  },

  /**
   * 确认角色修改
   */
  async confirmRoleChange() {
    const { currentUserId, selectedRoles, roleChangeReason, selectedUsers } = this.data;

    if (!roleChangeReason.trim()) {
      wx.showToast({
        title: '请输入修改原因',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '处理中...' });

      let userIds = [];
      if (currentUserId) {
        // 单个用户修改
        userIds = [currentUserId];
      } else {
        // 批量修改
        userIds = selectedUsers;
      }

      // 批量修改用户角色
      for (const userId of userIds) {
        const result = await userManager.modifyUserRoles(
          userId,
          selectedRoles,
          roleChangeReason.trim()
        );

        if (!result.success) {
          throw new Error(result.error || '修改失败');
        }
      }

      wx.hideLoading();
      wx.showToast({
        title: '角色修改成功',
        icon: 'success'
      });

      this.closeRoleModal();

      // 重新加载数据
      setTimeout(() => {
        this.loadUsers();
        this.loadStats();
      }, 1000);

    } catch (error) {
      wx.hideLoading();
      logger.error('[admin-user-management] 修改用户角色失败:', error);
      wx.showToast({
        title: error.message || '修改失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 上一页
   */
  prevPage() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1,
        users: []
      });
      this.loadUsers();
    }
  },

  /**
   * 下一页
   */
  nextPage() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1,
        users: []
      });
      this.loadUsers();
    }
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      active: '活跃',
      inactive: '未激活',
      suspended: '已暂停',
      pending: '待审核'
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
   * 计算空状态描述
   */
  get emptyDesc() {
    const { searchKeyword, selectedRoleIndex, selectedStatusIndex, selectedDate } = this.data;

    if (searchKeyword.trim()) {
      return `没有找到包含"${searchKeyword}"的用户`;
    }

    if (selectedRoleIndex > 0) {
      return `暂时没有${this.data.roleOptions[selectedRoleIndex].label}用户`;
    }

    if (selectedStatusIndex > 0) {
      return `暂时没有${this.data.statusOptions[selectedStatusIndex].label}用户`;
    }

    if (selectedDate) {
      return `暂时没有在${selectedDate}注册的用户`;
    }

    return '系统暂时没有任何用户';
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      users: []
    });

    Promise.all([
      this.loadUsers(),
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
      this.loadUsers();
    }
  }
});
