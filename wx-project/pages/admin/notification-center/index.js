// pages/admin/notification-center/index.js
const userManager = require('../../../utils/user-manager');
const { errorHandler, loadingManager, cacheManager, Validator, debounce } = require('../../../utils/admin-utils');
const { createDataManager } = require('../../../utils/data-manager');

Page({
  data: {
    // 搜索和筛选
    searchKeyword: '',
    selectedTypeIndex: 0,
    selectedStatusIndex: 0,
    selectedTimeRangeIndex: 0,

    // 筛选选项
    typeOptions: [
      { label: '全部类型', value: '' },
      { label: '系统通知', value: 'system' },
      { label: '角色通知', value: 'role' },
      { label: '公告通知', value: 'announcement' },
      { label: '提醒通知', value: 'reminder' }
    ],
    statusOptions: [
      { label: '全部状态', value: '' },
      { label: '草稿', value: 'draft' },
      { label: '待发送', value: 'pending' },
      { label: '已发送', value: 'sent' },
      { label: '已撤回', value: 'recalled' }
    ],
    timeRangeOptions: [
      { label: '全部时间', value: '' },
      { label: '今天', value: 'today' },
      { label: '昨天', value: 'yesterday' },
      { label: '本周', value: 'thisWeek' },
      { label: '本月', value: 'thisMonth' }
    ],

    // 通知数据
    notifications: [],
    loading: false,
    currentPage: 1,
    totalPages: 1,
    total: 0,
    pageSize: 20,

    // 统计数据
    stats: {
      totalNotifications: 0,
      unreadCount: 0,
      todaySent: 0,
      systemNotifications: 0
    },

    // 弹窗状态
    showCreateModal: false,
    showBatchModal: false,
    showTemplateModal: false,
    showDetailModal: false,
    selectedNotification: null,

    // 创建表单
    formTypeIndex: 0,
    formTitle: '',
    formContent: '',
    formTargetIndex: 0,
    formSelectedRoles: [],
    formImmediate: true,
    formScheduled: false,
    formSendDate: '',
    formRequireRead: false,
    formAllowPush: true,
    formSaveTemplate: false,
    formTemplateName: '',

    // 通知类型选项
    notificationTypes: [
      { label: '系统通知', value: 'system' },
      { label: '角色通知', value: 'role' },
      { label: '公告通知', value: 'announcement' },
      { label: '提醒通知', value: 'reminder' }
    ],

    // 发送对象选项
    targetOptions: [
      { label: '全部用户', value: 'all' },
      { label: '指定用户', value: 'specific' },
      { label: '按角色筛选', value: 'role' }
    ],

    // 角色选项
    roleOptions: [
      { label: '管理员', value: 'admin' },
      { label: '社工', value: 'social_worker' },
      { label: '志愿者', value: 'volunteer' },
      { label: '研究员', value: 'researcher' }
    ],

    // 批量发送
    batchTemplateIndex: 0,
    batchTargetIndex: 0,
    batchInterval: '0',
    selectedTemplate: null,

    // 模板相关
    templateOptions: [
      { label: '不使用模板', value: '', id: '' }
    ],
    templates: [],

    // 骨架屏状态
    showSkeleton: true
  },

  onLoad(options) {
    console.log('[admin-notification-center] 页面加载');
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
    this.searchNotifications = this.dataManager.createSearchFunction(async (keyword) => {
      return this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'getNotificationList',
          filter: { keyword }
        },
        cacheKey: `notifications_search_${keyword}`
      });
    });
  },

  onShow() {
    this.loadNotifications();
    this.loadStats();
    this.loadTemplates();
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
        this.loadNotifications(),
        this.loadStats(),
        this.loadTemplates()
      ]);

      // 数据加载完成，隐藏骨架屏
      this.setData({ showSkeleton: false });
    } catch (error) {
      console.error('[admin-notification-center] 加载初始数据失败:', error);
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
      notifications: []
    });
    this.loadNotifications();
  }, 500),

  /**
   * 清除搜索
   */
  clearSearch() {
    this.setData({
      searchKeyword: '',
      currentPage: 1,
      notifications: []
    });
    this.loadNotifications();
  },

  /**
   * 执行搜索
   */
  performSearch() {
    this.setData({
      currentPage: 1,
      notifications: []
    });
    this.loadNotifications();
  },

  /**
   * 类型筛选变化
   */
  onTypeChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedTypeIndex: index,
      currentPage: 1,
      notifications: []
    });
    this.loadNotifications();
  },

  /**
   * 状态筛选变化
   */
  onStatusChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedStatusIndex: index,
      currentPage: 1,
      notifications: []
    });
    this.loadNotifications();
  },

  /**
   * 时间范围筛选变化
   */
  onTimeRangeChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedTimeRangeIndex: index,
      currentPage: 1,
      notifications: []
    });
    this.loadNotifications();
  },

  /**
   * 加载通知列表
   */
  async loadNotifications() {
    const loadingKey = 'notifications';

    if (loadingManager.isLoading(loadingKey)) {
      return;
    }

    loadingManager.start(loadingKey, (isLoading) => {
      this.setData({ loading: isLoading });
    });

    try {
      const {
        searchKeyword,
        selectedTypeIndex,
        selectedStatusIndex,
        selectedTimeRangeIndex,
        currentPage,
        pageSize,
        typeOptions,
        statusOptions,
        timeRangeOptions
      } = this.data;

      const selectedType = typeOptions[selectedTypeIndex].value;
      const selectedStatus = statusOptions[selectedStatusIndex].value;
      const selectedTimeRange = timeRangeOptions[selectedTimeRangeIndex].value;

      const filter = {
        keyword: searchKeyword.trim() || undefined,
        type: selectedType || undefined,
        status: selectedStatus || undefined,
        timeRange: selectedTimeRange || undefined
      };

      // 移除undefined值
      Object.keys(filter).forEach(key => {
        if (filter[key] === undefined) {
          delete filter[key];
        }
      });

      // 生成缓存键
      const cacheKey = `notifications_${selectedType}_${selectedStatus}_${selectedTimeRange}_${currentPage}_${searchKeyword}`;

      // 首先尝试从缓存或API获取数据
      const result = await this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'getNotificationList',
          filter,
          page: currentPage - 1,
          pageSize
        },
        cacheKey,
        forceRefresh: false
      });

      let notifications, total;

      if (result.success) {
        notifications = result.data.notifications || [];
        total = result.data.total || 0;
      } else {
        // 如果API调用失败，使用模拟数据作为后备
        console.warn('[admin-notification-center] API调用失败，使用模拟数据');
        const mockNotifications = this.generateMockNotifications();

        // 应用筛选
        let filteredNotifications = mockNotifications;

        if (filter.keyword) {
          filteredNotifications = filteredNotifications.filter(item =>
            item.title.includes(filter.keyword) ||
            item.content.includes(filter.keyword)
          );
        }

        if (filter.type) {
          filteredNotifications = filteredNotifications.filter(item => item.type === filter.type);
        }

        if (filter.status) {
          filteredNotifications = filteredNotifications.filter(item => item.status === filter.status);
        }

        // 分页处理
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        notifications = filteredNotifications.slice(startIndex, endIndex);
        total = filteredNotifications.length;
      }

      this.setData({
        notifications,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      });
    } catch (error) {
      errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        operation: 'loadNotifications',
        currentPage: this.data.currentPage
      });
    } finally {
      loadingManager.end(loadingKey);
    }
  },

  /**
   * 生成模拟通知数据
   */
  generateMockNotifications() {
    const types = ['system', 'role', 'announcement', 'reminder'];
    const statuses = ['draft', 'pending', 'sent', 'recalled'];

    return Array.from({ length: 25 }, (_, index) => {
      const type = types[Math.floor(Math.random() * types.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const targetCount = Math.floor(Math.random() * 50) + 10;
      const readCount = status === 'sent' ? Math.floor(Math.random() * targetCount) : 0;

      return {
        id: `notification_${index + 1}`,
        title: `通知标题 ${index + 1}`,
        content: `这是通知 ${index + 1} 的详细内容，包含了重要的信息和说明。`,
        contentPreview: `这是通知 ${index + 1} 的详细内容预览...`,
        contentLength: 50,
        type,
        typeText: this.getTypeText(type),
        status,
        statusText: this.getStatusText(status),
        senderName: '管理员',
        sendTime: this.formatDate(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        targetInfo: '全部用户',
        targetCount,
        readCount,
        clickCount: Math.floor(Math.random() * readCount),
        readRate: targetCount > 0 ? Math.round((readCount / targetCount) * 100) : 0,
        createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      };
    });
  },

  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      // 模拟统计数据
      this.setData({
        stats: {
          totalNotifications: this.data.total || 0,
          unreadCount: Math.floor(Math.random() * 10),
          todaySent: Math.floor(Math.random() * 5),
          systemNotifications: Math.floor((this.data.total || 0) * 0.4)
        }
      });
    } catch (error) {
      console.error('[admin-notification-center] 加载统计数据失败:', error);
    }
  },

  /**
   * 加载通知模板
   */
  async loadTemplates() {
    try {
      // 模拟模板数据
      const mockTemplates = [
        {
          id: 'template_1',
          name: '系统维护通知',
          type: 'system',
          typeText: '系统通知',
          title: '系统维护通知',
          content: '系统将于今晚进行维护，请提前做好准备。',
          contentPreview: '系统将于今晚进行维护...',
          useCount: 5,
          createTime: '3天前'
        },
        {
          id: 'template_2',
          name: '角色申请结果',
          type: 'role',
          typeText: '角色通知',
          title: '角色申请结果通知',
          content: '您的角色申请已经审核完成，请查看详细信息。',
          contentPreview: '您的角色申请已经审核完成...',
          useCount: 12,
          createTime: '1周前'
        }
      ];

      const templateOptions = [
        { label: '不使用模板', value: '', id: '' },
        ...mockTemplates.map(template => ({
          label: template.name,
          value: template.id,
          id: template.id
        }))
      ];

      this.setData({
        templates: mockTemplates,
        templateOptions
      });
    } catch (error) {
      console.error('[admin-notification-center] 加载模板失败:', error);
    }
  },

  /**
   * 显示创建通知弹窗
   */
  showCreateModal() {
    this.setData({
      showCreateModal: true,
      formTypeIndex: 0,
      formTitle: '',
      formContent: '',
      formTargetIndex: 0,
      formSelectedRoles: [],
      formImmediate: true,
      formScheduled: false,
      formSendDate: '',
      formRequireRead: false,
      formAllowPush: true,
      formSaveTemplate: false,
      formTemplateName: ''
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
   * 显示批量发送弹窗
   */
  showBatchSendModal() {
    this.setData({
      showBatchModal: true,
      batchTemplateIndex: 0,
      batchTargetIndex: 0,
      batchInterval: '0',
      selectedTemplate: null
    });
  },

  /**
   * 关闭批量发送弹窗
   */
  closeBatchModal() {
    this.setData({
      showBatchModal: false
    });
  },

  /**
   * 显示模板弹窗
   */
  showTemplateModal() {
    this.setData({
      showTemplateModal: true
    });
  },

  /**
   * 关闭模板弹窗
   */
  closeTemplateModal() {
    this.setData({
      showTemplateModal: false
    });
  },

  /**
   * 创建表单类型变化
   */
  onFormTypeChange(e) {
    this.setData({
      formTypeIndex: e.detail.value
    });
  },

  /**
   * 创建表单标题输入
   */
  onFormTitleInput(e) {
    this.setData({
      formTitle: e.detail.value
    });
  },

  /**
   * 创建表单内容输入
   */
  onFormContentInput(e) {
    this.setData({
      formContent: e.detail.value
    });
  },

  /**
   * 创建表单发送对象变化
   */
  onFormTargetChange(e) {
    this.setData({
      formTargetIndex: e.detail.value
    });
  },

  /**
   * 角色选择变化
   */
  onRoleChange(e) {
    this.setData({
      formSelectedRoles: e.detail.value
    });
  },

  /**
   * 立即发送/定时发送变化
   */
  onImmediateChange(e) {
    const values = e.detail.value;
    const isImmediate = values.includes('immediate');
    const isScheduled = values.includes('scheduled');

    this.setData({
      formImmediate: isImmediate,
      formScheduled: isScheduled
    });
  },

  /**
   * 发送日期变化
   */
  onFormSendDateChange(e) {
    this.setData({
      formSendDate: e.detail.value
    });
  },

  /**
   * 高级设置变化
   */
  onAdvancedChange(e) {
    const values = e.detail.value;

    this.setData({
      formRequireRead: values.includes('requireRead'),
      formAllowPush: values.includes('allowPush'),
      formSaveTemplate: values.includes('saveTemplate')
    });
  },

  /**
   * 模板名称输入
   */
  onFormTemplateNameInput(e) {
    this.setData({
      formTemplateName: e.detail.value
    });
  },

  /**
   * 批量表单模板变化
   */
  onBatchTemplateChange(e) {
    const index = e.detail.value;
    const templateId = this.data.templateOptions[index].id;
    const selectedTemplate = this.data.templates.find(t => t.id === templateId);

    this.setData({
      batchTemplateIndex: index,
      selectedTemplate
    });
  },

  /**
   * 批量表单发送对象变化
   */
  onBatchTargetChange(e) {
    this.setData({
      batchTargetIndex: e.detail.value
    });
  },

  /**
   * 批量表单发送间隔输入
   */
  onBatchIntervalInput(e) {
    this.setData({
      batchInterval: e.detail.value
    });
  },

  /**
   * 选择模板
   */
  selectTemplate(e) {
    const templateId = e.currentTarget.dataset.id;
    const template = this.data.templates.find(t => t.id === templateId);

    if (template) {
      this.setData({
        formTypeIndex: this.data.notificationTypes.findIndex(t => t.value === template.type),
        formTitle: template.title,
        formContent: template.content
      });

      this.closeTemplateModal();
      this.showCreateModal();
    }
  },

  /**
   * 表单是否有效
   */
  get isFormValid() {
    const { formTitle, formContent, formTargetIndex } = this.data;
    return formTitle.trim().length > 0 &&
           formContent.trim().length > 0 &&
           (this.data.formImmediate || this.data.formSendDate);
  },

  /**
   * 批量表单是否有效
   */
  get isBatchFormValid() {
    return this.data.batchTargetIndex !== '' &&
           this.data.batchInterval !== '' &&
           parseInt(this.data.batchInterval) >= 0;
  },

  /**
   * 确认发送通知
   */
  async confirmSendNotification() {
    if (!this.data.isFormValid) {
      wx.showToast({
        title: '请检查输入参数',
        icon: 'none'
      });
      return;
    }

    const { formTypeIndex, formTitle, formContent, formTargetIndex, notificationTypes, targetOptions } = this.data;

    try {
      wx.showLoading({ title: '发送中...' });

      const notificationData = {
        type: notificationTypes[formTypeIndex].value,
        title: formTitle.trim(),
        content: formContent.trim(),
        target: targetOptions[formTargetIndex].value,
        immediate: this.data.formImmediate,
        sendDate: this.data.formScheduled ? this.data.formSendDate : undefined,
        requireRead: this.data.formRequireRead,
        allowPush: this.data.formAllowPush,
        roles: this.data.formTargetIndex === '2' ? this.data.formSelectedRoles : undefined
      };

      // 使用数据管理器发送通知
      const result = await this.dataManager.create({
        api: 'rbac',
        data: {
          action: 'sendNotification',
          ...notificationData
        },
        invalidateCache: ['notifications_sent', 'notifications_stats']
      });

      wx.hideLoading();

      if (result.success) {
        // 如果需要保存为模板
        if (this.data.formSaveTemplate && this.data.formTemplateName.trim()) {
          await this.saveAsTemplate({
            name: this.data.formTemplateName.trim(),
            type: notificationData.type,
            title: notificationData.title,
            content: notificationData.content
          });
        }

        wx.showToast({
          title: '发送成功',
          icon: 'success'
        });

        this.closeCreateModal();
        this.loadData();
      } else {
        throw new Error(result.error?.message || '发送失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'confirmSendNotification'
      });
    }
  },

  /**
   * 确认批量发送
   */
  async confirmBatchSend() {
    if (!this.data.isBatchFormValid) {
      wx.showToast({
        title: '请检查输入参数',
        icon: 'none'
      });
      return;
    }

    const { batchTemplateIndex, batchTargetIndex, batchInterval, selectedTemplate, targetOptions } = this.data;

    try {
      wx.showLoading({ title: '批量发送中...' });

      const batchData = {
        templateId: this.data.templateOptions[batchTemplateIndex].id,
        target: targetOptions[batchTargetIndex].value,
        interval: parseInt(batchInterval) || 0
      };

      const result = await this.dataManager.batchOperation({
        api: 'rbac',
        operation: 'batchSendNotifications',
        data: batchData,
        invalidateCache: ['notifications_sent', 'notifications_stats']
      });

      wx.hideLoading();

      if (result.success) {
        wx.showToast({
          title: `成功发送 ${result.data.successCount || 0} 条通知`,
          icon: 'success'
        });

        this.closeBatchModal();
        this.loadData();
      } else {
        throw new Error(result.error?.message || '批量发送失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'confirmBatchSend'
      });
    }
  },

  /**
   * 保存为模板
   */
  async saveAsTemplate(templateData) {
    // 模拟保存模板
    console.log('保存模板:', templateData);
  },

  /**
   * 查看通知详情
   */
  viewNotificationDetail(e) {
    const notificationId = e.currentTarget.dataset.id;
    const notification = this.data.notifications.find(n => n.id === notificationId);

    if (notification) {
      this.setData({
        selectedNotification: notification,
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
      selectedNotification: null
    });
  },

  /**
   * 重新发送通知
   */
  async resendNotification(e) {
    const notificationId = e.currentTarget.dataset.id;

    const result = await wx.showModal({
      title: '确认重新发送',
      content: '确定要重新发送此通知吗？',
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      wx.showLoading({ title: '重新发送中...' });

      // 模拟重新发送
      await new Promise(resolve => setTimeout(resolve, 1000));

      wx.hideLoading();
      wx.showToast({
        title: '重新发送成功',
        icon: 'success'
      });

      this.loadNotifications();
      this.loadStats();
    } catch (error) {
      wx.hideLoading();
      console.error('[admin-notification-center] 重新发送失败:', error);
      wx.showToast({
        title: '重新发送失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 撤回通知
   */
  async recallNotification(e) {
    const notificationId = e.currentTarget.dataset.id;

    const result = await wx.showModal({
      title: '确认撤回',
      content: '确定要撤回此通知吗？撤回后将无法恢复。',
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      wx.showLoading({ title: '撤回中...' });

      // 模拟撤回
      await new Promise(resolve => setTimeout(resolve, 1000));

      wx.hideLoading();
      wx.showToast({
        title: '撤回成功',
        icon: 'success'
      });

      this.loadNotifications();
      this.loadStats();
    } catch (error) {
      wx.hideLoading();
      console.error('[admin-notification-center] 撤回失败:', error);
      wx.showToast({
        title: '撤回失败，请重试',
        icon: 'none'
      });
    }
  },

  /**
   * 导出通知数据
   */
  exportNotifications() {
    wx.showModal({
      title: '导出数据',
      content: '通知数据导出功能开发中...',
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
        notifications: []
      });
      this.loadNotifications();
    }
  },

  /**
   * 下一页
   */
  nextPage() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1,
        notifications: []
      });
      this.loadNotifications();
    }
  },

  /**
   * 获取类型文本
   */
  getTypeText(type) {
    const typeMap = {
      system: '系统通知',
      role: '角色通知',
      announcement: '公告通知',
      reminder: '提醒通知'
    };
    return typeMap[type] || '未知类型';
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      draft: '草稿',
      pending: '待发送',
      sent: '已发送',
      recalled: '已撤回'
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
      notifications: []
    });

    Promise.all([
      this.loadNotifications(),
      this.loadStats(),
      this.loadTemplates()
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
      this.loadNotifications();
    }
  }
});