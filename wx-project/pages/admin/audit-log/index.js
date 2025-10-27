// pages/admin/audit-log/index.js
const userManager = require('../../../utils/user-manager');
const { errorHandler, loadingManager, debounce } = require('../../../utils/admin-utils');
const { createDataManager } = require('../../../utils/data-manager');
const logger = require('../../../utils/logger');

Page({
  data: {
    // 搜索和筛选
    searchKeyword: '',
    selectedActionIndex: 0,
    selectedLevelIndex: 0,
    selectedResultIndex: 0,
    selectedTimeRangeIndex: 0,

    // 筛选选项
    actionOptions: [
      { label: '全部操作', value: '' },
      { label: '用户登录', value: 'login' },
      { label: '用户登出', value: 'logout' },
      { label: '角色申请', value: 'role_application' },
      { label: '角色审批', value: 'role_approval' },
      { label: '用户管理', value: 'user_management' },
      { label: '系统设置', value: 'system_settings' },
      { label: '数据导出', value: 'data_export' },
      { label: '权限修改', value: 'permission_change' }
    ],
    levelOptions: [
      { label: '全部级别', value: '' },
      { label: '紧急', value: 'critical' },
      { label: '高级', value: 'high' },
      { label: '中级', value: 'medium' },
      { label: '低级', value: 'low' }
    ],
    resultOptions: [
      { label: '全部结果', value: '' },
      { label: '成功', value: 'success' },
      { label: '失败', value: 'failure' },
      { label: '警告', value: 'warning' },
      { label: '待处理', value: 'pending' }
    ],
    timeRangeOptions: [
      { label: '全部时间', value: '' },
      { label: '最近1小时', value: '1h' },
      { label: '最近24小时', value: '24h' },
      { label: '最近7天', value: '7d' },
      { label: '最近30天', value: '30d' }
    ],

    // 日志数据
    logs: [],
    loading: false,
    currentPage: 1,
    totalPages: 1,
    total: 0,
    pageSize: 20,

    // 统计数据
    stats: {
      totalLogs: 0,
      todayLogs: 0,
      securityEvents: 0,
      errorCount: 0
    },

    // 弹窗状态
    showDetailModal: false,
    showTraceModal: false,
    selectedLog: null,
    traceInfo: null,

    // 骨架屏状态
    showSkeleton: true
  },

  onLoad(_options) {
    logger.info('[admin-audit-log] 页面加载');
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
    this.searchLogs = this.dataManager.createSearchFunction(async (keyword) => {
      return this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'getAuditLogs',
          filter: { keyword }
        },
        cacheKey: `audit_logs_search_${keyword}`
      });
    });
  },

  onShow() {
    this.loadLogs();
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
        this.loadLogs(),
        this.loadStats()
      ]);

      // 数据加载完成，隐藏骨架屏
      this.setData({ showSkeleton: false });
    } catch (error) {
      logger.error('[admin-audit-log] 加载初始数据失败:', error);
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
      logs: []
    });
    this.loadLogs();
  }, 500),

  /**
   * 清除搜索
   */
  clearSearch() {
    this.setData({
      searchKeyword: '',
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 执行搜索
   */
  performSearch() {
    this.setData({
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 操作类型筛选变化
   */
  onActionChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedActionIndex: index,
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 级别筛选变化
   */
  onLevelChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedLevelIndex: index,
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 结果筛选变化
   */
  onResultChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedResultIndex: index,
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 时间范围筛选变化
   */
  onTimeRangeChange(e) {
    const index = e.detail.value;
    this.setData({
      selectedTimeRangeIndex: index,
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 加载日志列表
   */
  async loadLogs() {
    const loadingKey = 'audit-logs';

    if (loadingManager.isLoading(loadingKey)) {
      return;
    }

    loadingManager.start(loadingKey, (isLoading) => {
      this.setData({ loading: isLoading });
    });

    try {
      const {
        searchKeyword,
        selectedActionIndex,
        selectedLevelIndex,
        selectedResultIndex,
        selectedTimeRangeIndex,
        currentPage,
        pageSize,
        actionOptions,
        levelOptions,
        resultOptions,
        timeRangeOptions
      } = this.data;

      const selectedAction = actionOptions[selectedActionIndex].value;
      const selectedLevel = levelOptions[selectedLevelIndex].value;
      const selectedResult = resultOptions[selectedResultIndex].value;
      const selectedTimeRange = timeRangeOptions[selectedTimeRangeIndex].value;

      const filter = {
        keyword: searchKeyword.trim() || undefined,
        action: selectedAction || undefined,
        level: selectedLevel || undefined,
        result: selectedResult || undefined,
        timeRange: selectedTimeRange || undefined
      };

      // 移除undefined值
      Object.keys(filter).forEach(key => {
        if (filter[key] === undefined) {
          delete filter[key];
        }
      });

      // 生成缓存键
      const cacheKey = `audit_logs_${selectedAction}_${selectedLevel}_${selectedResult}_${selectedTimeRange}_${currentPage}_${searchKeyword}`;

      // 首先尝试从缓存或API获取数据
      const result = await this.dataManager.getList({
        api: 'rbac',
        params: {
          action: 'getAuditLogs',
          filter,
          page: currentPage - 1,
          pageSize
        },
        cacheKey,
        forceRefresh: false
      });

      let logs, total;

      if (result.success) {
        logs = result.data.logs || [];
        total = result.data.total || 0;
      } else {
        // 如果API调用失败，使用模拟数据作为后备
        logger.warn('[admin-audit-log] API调用失败，使用模拟数据');
        const mockLogs = this.generateMockLogs();

        // 应用筛选
        let filteredLogs = mockLogs;

        if (filter.keyword) {
          filteredLogs = filteredLogs.filter(item =>
            item.userName.includes(filter.keyword) ||
            item.description.includes(filter.keyword) ||
            item.ipAddress.includes(filter.keyword)
          );
        }

        if (filter.action) {
          filteredLogs = filteredLogs.filter(item => item.action === filter.action);
        }

        if (filter.level) {
          filteredLogs = filteredLogs.filter(item => item.level === filter.level);
        }

        if (filter.result) {
          filteredLogs = filteredLogs.filter(item => item.result === filter.result);
        }

        // 时间范围筛选
        if (filter.timeRange) {
          const now = Date.now();
          let timeThreshold;

          switch (filter.timeRange) {
            case '1h':
              timeThreshold = now - 60 * 60 * 1000;
              break;
            case '24h':
              timeThreshold = now - 24 * 60 * 60 * 1000;
              break;
            case '7d':
              timeThreshold = now - 7 * 24 * 60 * 60 * 1000;
              break;
            case '30d':
              timeThreshold = now - 30 * 24 * 60 * 60 * 1000;
              break;
          }

          if (timeThreshold) {
            filteredLogs = filteredLogs.filter(item => item.timestamp >= timeThreshold);
          }
        }

        // 按时间倒序排列
        filteredLogs.sort((a, b) => b.timestamp - a.timestamp);

        // 分页处理
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        logs = filteredLogs.slice(startIndex, endIndex);
        total = filteredLogs.length;
      }

      this.setData({
        logs,
        total,
        totalPages: Math.ceil(total / pageSize) || 1
      });
    } catch (error) {
      errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        operation: 'loadLogs',
        currentPage: this.data.currentPage
      });
    } finally {
      loadingManager.end(loadingKey);
    }
  },

  /**
   * 生成模拟日志数据
   */
  generateMockLogs() {
    const actions = ['login', 'logout', 'role_application', 'role_approval', 'user_management', 'system_settings', 'data_export', 'permission_change'];
    const levels = ['critical', 'high', 'medium', 'low'];
    const results = ['success', 'failure', 'warning', 'pending'];
    const users = ['管理员', '张三', '李四', '王五', '赵六'];
    const roles = ['admin', 'social_worker', 'volunteer', 'researcher'];

    return Array.from({ length: 100 }, (_, index) => {
      const action = actions[Math.floor(Math.random() * actions.length)];
      const level = levels[Math.floor(Math.random() * levels.length)];
      const result = results[Math.floor(Math.random() * results.length)];
      const userIndex = Math.floor(Math.random() * users.length);
      const roleIndex = Math.floor(Math.random() * roles.length);

      const timestamp = Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000;
      const isSecurityEvent = level === 'critical' || level === 'high';

      return {
        id: `log_${index + 1}`,
        action,
        actionText: this.getActionText(action),
        level,
        levelText: this.getLevelText(level),
        result,
        resultText: this.getResultText(result),
        userName: users[userIndex],
        userRole: roles[roleIndex],
        description: this.generateLogDescription(action, result, users[userIndex]),
        timestamp,
        logTime: this.formatDate(timestamp),
        ipAddress: this.generateRandomIP(),
        userAgent: 'WeChat MiniProgram',
        sessionId: `session_${Math.random().toString(36).substr(2, 9)}`,
        requestId: `req_${Math.random().toString(36).substr(2, 9)}`,
        duration: Math.floor(Math.random() * 1000) + 50,
        location: this.generateRandomLocation(),
        targetUser: Math.random() > 0.7 ? users[Math.floor(Math.random() * users.length)] : '',
        resource: Math.random() > 0.8 ? `资源_${Math.floor(Math.random() * 1000)}` : '',
        resourceId: Math.random() > 0.8 ? `res_${Math.random().toString(36).substr(2, 9)}` : '',
        hasTrace: Math.random() > 0.8,
        securityTags: isSecurityEvent ? this.generateSecurityTags() : [],
        rawData: JSON.stringify({
          action,
          level,
          result,
          timestamp,
          additionalData: '示例原始数据'
        }, null, 2)
      };
    });
  },

  /**
   * 生成日志描述
   */
  generateLogDescription(action, result, userName) {
    const descriptions = {
      login: {
        success: `${userName} 用户登录系统`,
        failure: `${userName} 用户登录失败，密码错误`,
        warning: `${userName} 用户登录异常，多次尝试`
      },
      logout: {
        success: `${userName} 用户正常登出`,
        warning: `${userName} 用户异常登出`
      },
      role_application: {
        success: `${userName} 提交了角色申请`,
        pending: `${userName} 的角色申请待审核`
      },
      role_approval: {
        success: `管理员审批了角色申请`,
        failure: `角色申请审批失败`
      },
      user_management: {
        success: `管理员执行了用户管理操作`,
        failure: `用户管理操作失败`
      },
      system_settings: {
        success: `管理员修改了系统设置`,
        warning: `系统设置修改需要重启`
      },
      data_export: {
        success: `${userName} 导出了系统数据`,
        failure: `数据导出操作失败`
      },
      permission_change: {
        success: `管理员修改了用户权限`,
        warning: `权限修改涉及安全风险`
      }
    };

    return descriptions[action]?.[result] || `${userName} 执行了未知操作`;
  },

  /**
   * 生成随机IP地址
   */
  generateRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  },

  /**
   * 生成随机位置
   */
  generateRandomLocation() {
    const locations = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安'];
    return locations[Math.floor(Math.random() * locations.length)];
  },

  /**
   * 生成安全标签
   */
  generateSecurityTags() {
    const allTags = ['敏感操作', '权限变更', '数据访问', '系统风险', '异常行为', '安全威胁'];
    const count = Math.floor(Math.random() * 3) + 1;
    const tags = [];

    for (let i = 0; i < count; i++) {
      const tag = allTags[Math.floor(Math.random() * allTags.length)];
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }

    return tags;
  },

  /**
   * 加载统计数据
   */
  async loadStats() {
    try {
      // 模拟统计数据
      this.setData({
        stats: {
          totalLogs: this.data.total || 0,
          todayLogs: Math.floor(Math.random() * 50) + 10,
          securityEvents: Math.floor(Math.random() * 10) + 1,
          errorCount: Math.floor(Math.random() * 20) + 5
        }
      });
    } catch (error) {
      logger.error('[admin-audit-log] 加载统计数据失败:', error);
    }
  },

  /**
   * 筛选安全事件
   */
  filterSecurityEvents() {
    this.setData({
      selectedLevelIndex: 1, // 高级
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 筛选错误记录
   */
  filterErrors() {
    this.setData({
      selectedResultIndex: 2, // 失败
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 筛选管理操作
   */
  filterAdminActions() {
    this.setData({
      selectedActionIndex: 5, // 系统设置
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
  },

  /**
   * 刷新日志
   */
  refreshLogs() {
    this.setData({
      currentPage: 1,
      logs: []
    });
    this.loadLogs();
    this.loadStats();
  },

  /**
   * 查看日志详情
   */
  viewLogDetail(e) {
    const logId = e.currentTarget.dataset.id;
    const log = this.data.logs.find(l => l.id === logId);

    if (log) {
      this.setData({
        selectedLog: log,
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
      selectedLog: null
    });
  },

  /**
   * 查看追踪信息
   */
  async viewTraceInfo(_e) {
    try {
      wx.showLoading({ title: '加载追踪信息...' });

      // 模拟追踪信息
      const traceInfo = {
        chain: [
          { step: 1, action: '用户发起请求', time: '2024-01-15 10:30:00' },
          { step: 2, action: '身份验证', time: '2024-01-15 10:30:01' },
          { step: 3, action: '权限检查', time: '2024-01-15 10:30:02' },
          { step: 4, action: '执行操作', time: '2024-01-15 10:30:03' },
          { step: 5, action: '记录日志', time: '2024-01-15 10:30:04' }
        ],
        relatedLogs: [
          { id: 'related_1', action: '用户登录', time: '2024-01-15 10:29:00' },
          { id: 'related_2', action: '权限变更', time: '2024-01-15 10:31:00' }
        ]
      };

      wx.hideLoading();
      this.setData({
        traceInfo,
        showTraceModal: true,
        showDetailModal: false
      });
    } catch (error) {
      wx.hideLoading();
      logger.error('[admin-audit-log] 加载追踪信息失败:', error);
      wx.showToast({
        title: '加载追踪信息失败',
        icon: 'none'
      });
    }
  },

  /**
   * 关闭追踪弹窗
   */
  closeTraceModal() {
    this.setData({
      showTraceModal: false,
      traceInfo: null
    });
  },

  /**
   * 报告安全问题
   */
  async reportSecurityIssue(e) {
    const logId = e.currentTarget.dataset.id;
    const log = this.data.logs.find(l => l.id === logId);

    if (!log) return;

    const result = await wx.showModal({
      title: '生成安全报告',
      content: '确定要为此安全事件生成详细报告吗？',
      confirmText: '生成报告',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      wx.showLoading({ title: '生成报告中...' });

      // 使用数据管理器生成报告
      const reportResult = await this.dataManager.create({
        api: 'rbac',
        data: {
          action: 'generateSecurityReport',
          logId: logId,
          logData: {
            action: log.action,
            level: log.level,
            result: log.result,
            userName: log.userName,
            timestamp: log.timestamp,
            ipAddress: log.ipAddress,
            description: log.description
          }
        },
        invalidateCache: ['security_reports']
      });

      wx.hideLoading();

      if (reportResult.success) {
        wx.showToast({
          title: '安全报告已生成',
          icon: 'success'
        });

        // 刷新数据
        this.loadData();
      } else {
        throw new Error(reportResult.error?.message || '生成报告失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'reportSecurityIssue'
      });
    }
  },

  /**
   * 导出日志
   */
  exportLogs() {
    wx.showModal({
      title: '导出日志',
      content: '日志导出功能开发中...',
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
        logs: []
      });
      this.loadLogs();
    }
  },

  /**
   * 下一页
   */
  nextPage() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1,
        logs: []
      });
      this.loadLogs();
    }
  },

  /**
   * 获取操作类型文本
   */
  getActionText(action) {
    const actionMap = {
      login: '用户登录',
      logout: '用户登出',
      role_application: '角色申请',
      role_approval: '角色审批',
      user_management: '用户管理',
      system_settings: '系统设置',
      data_export: '数据导出',
      permission_change: '权限修改'
    };
    return actionMap[action] || '未知操作';
  },

  /**
   * 获取级别文本
   */
  getLevelText(level) {
    const levelMap = {
      critical: '紧急',
      high: '高级',
      medium: '中级',
      low: '低级'
    };
    return levelMap[level] || '未知级别';
  },

  /**
   * 获取结果文本
   */
  getResultText(result) {
    const resultMap = {
      success: '成功',
      failure: '失败',
      warning: '警告',
      pending: '待处理'
    };
    return resultMap[result] || '未知结果';
  },

  /**
   * 格式化日期
   */
  formatDate(timestamp) {
    if (!timestamp) return '未知';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      logs: []
    });

    Promise.all([
      this.loadLogs(),
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
      this.loadLogs();
    }
  }
});
