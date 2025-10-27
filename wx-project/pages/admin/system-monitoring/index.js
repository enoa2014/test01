// pages/admin/system-monitoring/index.js
const userManager = require('../../../utils/user-manager');
const { errorHandler, loadingManager } = require('../../../utils/admin-utils');
const { createDataManager } = require('../../../utils/data-manager');
const logger = require('../../../utils/logger');

Page({
  data: {
    // 系统状态
    systemStatus: {
      overall: 'healthy',
      updateTime: '2024-01-15 10:30:00'
    },

    // 骨架屏状态
    showSkeleton: true,

    // 快速统计
    quickStats: {
      onlineUsers: 156,
      activeConnections: 89,
      requestRate: 45
    },

    // 性能指标
    performance: {
      cpu: 45,
      cpuTrend: 2.5,
      memory: 62,
      memoryTrend: -1.2,
      storage: 38,
      storageTrend: 0.8,
      network: 12.5,
      networkIn: 65,
      networkOut: 35,
      networkTrend: 5.6
    },

    // 服务列表
    services: [
      {
        name: '用户认证服务',
        version: '1.2.3',
        status: 'running',
        responseTime: 85,
        successRate: 99.8,
        qps: 120,
        uptime: '15天',
        startTime: '2024-01-01 08:00:00'
      },
      {
        name: '数据管理服务',
        version: '2.1.0',
        status: 'running',
        responseTime: 120,
        successRate: 99.5,
        qps: 85,
        uptime: '12天',
        startTime: '2024-01-03 10:30:00'
      },
      {
        name: '通知推送服务',
        version: '1.0.8',
        status: 'warning',
        responseTime: 200,
        successRate: 95.2,
        qps: 45,
        uptime: '8天',
        startTime: '2024-01-07 14:15:00'
      },
      {
        name: '文件存储服务',
        version: '3.0.1',
        status: 'running',
        responseTime: 95,
        successRate: 99.9,
        qps: 67,
        uptime: '20天',
        startTime: '2023-12-26 09:00:00'
      }
    ],

    // 告警信息
    alerts: [
      {
        id: 'alert_1',
        title: '通知推送服务响应缓慢',
        description: '通知推送服务的平均响应时间超过200ms，可能影响用户体验',
        level: 'warning',
        status: 'active',
        time: '2024-01-15 09:45:00'
      },
      {
        id: 'alert_2',
        title: 'CPU使用率升高',
        description: '系统CPU使用率持续升高，当前使用率75%，建议检查资源占用',
        level: 'critical',
        status: 'active',
        time: '2024-01-15 09:30:00'
      },
      {
        id: 'alert_3',
        title: '磁盘空间不足',
        description: '系统磁盘使用率达到85%，请及时清理或扩容',
        level: 'warning',
        status: 'resolved',
        time: '2024-01-15 08:15:00'
      }
    ],

    alertFilter: 'all',
    filteredAlerts: [],

    // 实时日志
    logs: [],
    autoScroll: true,
    maxLogEntries: 50,

    // 弹窗状态
    showServiceModal: false,
    selectedService: null,

    // 定时器
    refreshTimer: null,
    logTimer: null
  },

  onLoad(_options) {
    logger.info('[admin-system-monitoring] 页面加载');
    this.initDataManager();
    this.checkAdminPermission();
  },

  /**
   * 初始化数据管理器
   */
  initDataManager() {
    this.dataManager = createDataManager({
      pageSize: 20,
      cacheTimeout: 1 * 60 * 1000, // 监控数据缓存1分钟
      enableCache: true,
      enableDebounce: true,
      debounceDelay: 300
    });

    // 创建系统状态获取函数
    this.getSystemStatus = this.dataManager.createCachedFunction(async () => {
      return this.dataManager.get({
        api: 'rbac',
        params: { action: 'getSystemStatus' },
        cacheKey: 'system_status',
        defaultValue: this.generateMockSystemStatus()
      });
    });

    // 创建性能指标获取函数
    this.getPerformanceMetrics = this.dataManager.createCachedFunction(async () => {
      return this.dataManager.get({
        api: 'rbac',
        params: { action: 'getPerformanceMetrics' },
        cacheKey: 'performance_metrics',
        defaultValue: this.generateMockPerformanceMetrics()
      });
    });

    // 创建服务状态获取函数
    this.getServicesStatus = this.dataManager.createCachedFunction(async () => {
      return this.dataManager.getList({
        api: 'rbac',
        params: { action: 'getServicesStatus' },
        cacheKey: 'services_status',
        defaultValue: this.generateMockServices()
      });
    });

    // 创建告警获取函数
    this.getAlerts = this.dataManager.createCachedFunction(async () => {
      return this.dataManager.getList({
        api: 'rbac',
        params: { action: 'getSystemAlerts' },
        cacheKey: 'system_alerts',
        defaultValue: this.generateMockAlerts()
      });
    });
  },

  onUnload() {
    this.stopAutoRefresh();
    this.stopLogStream();
  },

  onShow() {
    this.refreshAllData();
  },

  onHide() {
    this.stopAutoRefresh();
    this.stopLogStream();
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
      this.startAutoRefresh();
      this.startLogStream();
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
        this.refreshSystemData(),
        this.refreshPerformanceData(),
        this.refreshServicesData(),
        this.refreshAlertsData()
      ]);

      // 数据加载完成，隐藏骨架屏
      this.setData({ showSkeleton: false });
      this.updateFilteredAlerts();
    } catch (error) {
      logger.error('[admin-system-monitoring] 加载初始数据失败:', error);
      this.setData({ showSkeleton: false });
      errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        operation: 'loadData'
      });
    }
  },

  /**
   * 开始自动刷新
   */
  startAutoRefresh() {
    this.refreshTimer = setInterval(() => {
      this.refreshSystemData();
    }, 30000); // 30秒刷新一次
  },

  /**
   * 停止自动刷新
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  /**
   * 开始日志流
   */
  startLogStream() {
    this.logTimer = setInterval(() => {
      this.generateNewLog();
    }, 2000); // 2秒生成一条新日志
  },

  /**
   * 停止日志流
   */
  stopLogStream() {
    if (this.logTimer) {
      clearInterval(this.logTimer);
      this.logTimer = null;
    }
  },

  /**
   * 生成新日志
   */
  generateNewLog() {
    const levels = ['info', 'warning', 'critical'];
    const messages = [
      '用户登录成功',
      '系统资源检查完成',
      '数据库连接正常',
      '缓存更新完成',
      '定时任务执行成功',
      'API请求处理完成',
      '用户操作记录',
      '系统状态同步',
      '性能数据收集',
      '安全扫描完成'
    ];

    const level = levels[Math.floor(Math.random() * levels.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const timestamp = new Date();

    const log = {
      id: `log_${timestamp.getTime()}`,
      time: this.formatTime(timestamp),
      level,
      message
    };

    const logs = [...this.data.logs, log];
    if (logs.length > this.data.maxLogEntries) {
      logs.shift(); // 移除最旧的日志
    }

    this.setData({ logs });

    // 自动滚动到底部
    if (this.data.autoScroll) {
      this.scrollToBottom();
    }
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    this.createSelectorQuery()
      .select('#logsContainer')
      .boundingClientRect()
      .exec(res => {
        if (res[0]) {
          wx.pageScrollTo({
            scrollTop: res[0].bottom + 1000,
            duration: 300
          });
        }
      });
  },

  /**
   * 刷新所有数据
   */
  async refreshAllData() {
    try {
      loadingManager.start('refresh');

      await Promise.all([
        this.refreshSystemData(),
        this.refreshPerformanceData(),
        this.refreshServicesData(),
        this.refreshAlertsData()
      ]);

      this.updateFilteredAlerts();
    } catch (error) {
      logger.error('[admin-system-monitoring] 刷新数据失败:', error);
      errorHandler.handle(error, errorHandler.errorTypes.NETWORK, {
        operation: 'refreshAllData'
      });
    } finally {
      loadingManager.end('refresh');
    }
  },

  /**
   * 刷新系统数据
   */
  async refreshSystemData() {
    try {
      const systemStatus = await this.getSystemStatus();

      this.setData({
        systemStatus: {
          overall: systemStatus.overall || 'healthy',
          updateTime: systemStatus.updateTime || this.formatTime(new Date())
        },
        quickStats: {
          onlineUsers: systemStatus.onlineUsers || 0,
          activeConnections: systemStatus.activeConnections || 0,
          requestRate: systemStatus.requestRate || 0
        }
      });
    } catch (error) {
      logger.error('[admin-system-monitoring] 刷新系统数据失败:', error);
      // 使用默认数据
      this.generateMockSystemStatus();
    }
  },

  /**
   * 刷新性能数据
   */
  async refreshPerformanceData() {
    try {
      const performance = await this.getPerformanceMetrics();

      this.setData({
        performance: {
          cpu: performance.cpu || 0,
          cpuTrend: performance.cpuTrend || 0,
          memory: performance.memory || 0,
          memoryTrend: performance.memoryTrend || 0,
          storage: performance.storage || 0,
          storageTrend: performance.storageTrend || 0,
          network: performance.network || 0,
          networkIn: performance.networkIn || 0,
          networkOut: performance.networkOut || 0,
          networkTrend: performance.networkTrend || 0
        }
      });
    } catch (error) {
      logger.error('[admin-system-monitoring] 刷新性能数据失败:', error);
      // 使用默认数据
      this.generateMockPerformanceMetrics();
    }
  },

  /**
   * 刷新服务数据
   */
  async refreshServicesData() {
    try {
      const services = await this.getServicesStatus();

      if (services && services.length > 0) {
        this.setData({ services });
      }
    } catch (error) {
      logger.error('[admin-system-monitoring] 刷新服务数据失败:', error);
      // 使用默认数据
      this.generateMockServices();
    }
  },

  /**
   * 刷新告警数据
   */
  async refreshAlertsData() {
    try {
      const alerts = await this.getAlerts();

      if (alerts && alerts.length > 0) {
        this.setData({ alerts });
      }
    } catch (error) {
      logger.error('[admin-system-monitoring] 刷新告警数据失败:', error);
      // 使用默认数据
      this.generateMockAlerts();
    }
  },

  /**
   * 更新筛选的告警
   */
  updateFilteredAlerts() {
    const { alerts, alertFilter } = this.data;
    let filteredAlerts = alerts;

    if (alertFilter !== 'all') {
      filteredAlerts = alerts.filter(alert => alert.level === alertFilter);
    }

    this.setData({ filteredAlerts });
  },

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    const iconMap = {
      healthy: '✅',
      warning: '⚠️',
      critical: '❌'
    };
    return iconMap[status] || '❓';
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const textMap = {
      healthy: '系统正常',
      warning: '系统警告',
      critical: '系统异常'
    };
    return textMap[status] || '未知状态';
  },

  /**
   * 获取趋势样式类
   */
  getTrendClass(trend) {
    const trendValue = parseFloat(trend);
    if (trendValue > 2) return 'up';
    if (trendValue < -2) return 'down';
    return 'stable';
  },

  /**
   * 获取趋势图标
   */
  getTrendIcon(trend) {
    const trendValue = parseFloat(trend);
    if (trendValue > 0) return '↑';
    if (trendValue < 0) return '↓';
    return '→';
  },

  /**
   * 获取服务图标
   */
  getServiceIcon(status) {
    const iconMap = {
      running: '🟢',
      warning: '🟡',
      stopped: '🔴'
    };
    return iconMap[status] || '⚪';
  },

  /**
   * 获取服务状态文本
   */
  getServiceStatusText(status) {
    const textMap = {
      running: '运行中',
      warning: '警告',
      stopped: '已停止'
    };
    return textMap[status] || '未知';
  },

  /**
   * 获取告警图标
   */
  getAlertIcon(level) {
    const iconMap = {
      critical: '🚨',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return iconMap[level] || '❓';
  },

  /**
   * 获取告警状态文本
   */
  getAlertStatusText(status) {
    const textMap = {
      active: '活跃',
      resolved: '已处理',
      ignored: '已忽略'
    };
    return textMap[status] || '未知';
  },

  /**
   * 设置告警筛选器
   */
  setAlertFilter(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ alertFilter: filter });
    this.updateFilteredAlerts();
  },

  /**
   * 切换自动滚动
   */
  toggleAutoScroll() {
    this.setData({
      autoScroll: !this.data.autoScroll
    });
  },

  /**
   * 清空日志
   */
  clearLogs() {
    this.setData({ logs: [] });
  },

  /**
   * 生成模拟系统状态
   */
  generateMockSystemStatus() {
    const statuses = ['healthy', 'warning', 'critical'];
    const randomStatus = Math.random() > 0.8 ? statuses[Math.floor(Math.random() * statuses.length)] : 'healthy';

    this.setData({
      'systemStatus.overall': randomStatus,
      'systemStatus.updateTime': this.formatTime(new Date()),
      'quickStats.onlineUsers': Math.floor(Math.random() * 50) + 130,
      'quickStats.activeConnections': Math.floor(Math.random() * 30) + 70,
      'quickStats.requestRate': Math.floor(Math.random() * 20) + 35
    });
  },

  /**
   * 生成模拟性能指标
   */
  generateMockPerformanceMetrics() {
    const generateTrend = () => (Math.random() - 0.5) * 10;

    this.setData({
      'performance.cpu': Math.floor(Math.random() * 30) + 30,
      'performance.cpuTrend': generateTrend().toFixed(1),
      'performance.memory': Math.floor(Math.random() * 40) + 40,
      'performance.memoryTrend': generateTrend().toFixed(1),
      'performance.storage': Math.floor(Math.random() * 20) + 30,
      'performance.storageTrend': generateTrend().toFixed(1),
      'performance.network': (Math.random() * 15 + 5).toFixed(1),
      'performance.networkIn': Math.floor(Math.random() * 40) + 40,
      'performance.networkOut': Math.floor(Math.random() * 40) + 20,
      'performance.networkTrend': generateTrend().toFixed(1)
    });
  },

  /**
   * 生成模拟服务数据
   */
  generateMockServices() {
    const mockServices = [
      {
        name: '用户认证服务',
        version: '1.2.3',
        status: 'running',
        responseTime: 85,
        successRate: 99.8,
        qps: 120,
        uptime: '15天',
        startTime: '2024-01-01 08:00:00'
      },
      {
        name: '数据管理服务',
        version: '2.1.0',
        status: 'running',
        responseTime: 120,
        successRate: 99.5,
        qps: 85,
        uptime: '12天',
        startTime: '2024-01-03 10:30:00'
      },
      {
        name: '通知推送服务',
        version: '1.0.8',
        status: 'warning',
        responseTime: 200,
        successRate: 95.2,
        qps: 45,
        uptime: '8天',
        startTime: '2024-01-07 14:15:00'
      },
      {
        name: '文件存储服务',
        version: '3.0.1',
        status: 'running',
        responseTime: 95,
        successRate: 99.9,
        qps: 67,
        uptime: '20天',
        startTime: '2023-12-26 09:00:00'
      }
    ];

    this.setData({ services: mockServices });
  },

  /**
   * 生成模拟告警数据
   */
  generateMockAlerts() {
    const mockAlerts = [
      {
        id: 'alert_1',
        title: '通知推送服务响应缓慢',
        description: '通知推送服务的平均响应时间超过200ms，可能影响用户体验',
        level: 'warning',
        status: 'active',
        time: '2024-01-15 09:45:00'
      },
      {
        id: 'alert_2',
        title: 'CPU使用率升高',
        description: '系统CPU使用率持续升高，当前使用率75%，建议检查资源占用',
        level: 'critical',
        status: 'active',
        time: '2024-01-15 09:30:00'
      },
      {
        id: 'alert_3',
        title: '磁盘空间不足',
        description: '系统磁盘使用率达到85%，请及时清理或扩容',
        level: 'warning',
        status: 'resolved',
        time: '2024-01-15 08:15:00'
      }
    ];

    this.setData({ alerts: mockAlerts });
  },

  /**
   * 重启服务
   */
  async restartService(e) {
    const serviceName = e.currentTarget.dataset.name;

    const result = await wx.showModal({
      title: '确认重启',
      content: `确定要重启服务 "${serviceName}" 吗？`,
      confirmText: '确定',
      cancelText: '取消'
    });

    if (!result.confirm) return;

    try {
      loadingManager.start('restart');
      wx.showLoading({ title: '重启中...' });

      // 使用数据管理器重启服务
      const restartResult = await this.dataManager.create({
        api: 'rbac',
        data: {
          action: 'restartService',
          serviceName: serviceName
        },
        invalidateCache: ['services_status']
      });

      wx.hideLoading();

      if (restartResult.success) {
        wx.showToast({
          title: '服务重启成功',
          icon: 'success'
        });

        // 刷新服务数据
        await this.refreshServicesData();
      } else {
        throw new Error(restartResult.error?.message || '重启失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'restartService',
        serviceName
      });
    } finally {
      loadingManager.end('restart');
    }
  },

  /**
   * 查看服务详情
   */
  viewServiceDetail(e) {
    const serviceName = e.currentTarget.dataset.name;
    const service = this.data.services.find(s => s.name === serviceName);

    if (service) {
      this.setData({
        selectedService: service,
        showServiceModal: true
      });
    }
  },

  /**
   * 关闭服务详情弹窗
   */
  closeServiceModal() {
    this.setData({
      showServiceModal: false,
      selectedService: null
    });
  },

  /**
   * 处理告警
   */
  async resolveAlert(e) {
    const alertId = e.currentTarget.dataset.id;
    const alert = this.data.alerts.find(a => a.id === alertId);

    if (!alert) return;

    try {
      loadingManager.start('resolve');
      wx.showLoading({ title: '处理中...' });

      // 使用数据管理器处理告警
      const resolveResult = await this.dataManager.update({
        api: 'rbac',
        data: {
          action: 'resolveAlert',
          alertId: alertId,
          alertData: alert
        },
        invalidateCache: ['system_alerts']
      });

      wx.hideLoading();

      if (resolveResult.success) {
        wx.showToast({
          title: '告警已处理',
          icon: 'success'
        });

        // 更新本地数据
        const alerts = this.data.alerts.map(a =>
          a.id === alertId ? { ...a, status: 'resolved' } : a
        );
        this.setData({ alerts });
        this.updateFilteredAlerts();
      } else {
        throw new Error(resolveResult.error?.message || '处理告警失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'resolveAlert',
        alertId
      });
    } finally {
      loadingManager.end('resolve');
    }
  },

  /**
   * 忽略告警
   */
  async ignoreAlert(e) {
    const alertId = e.currentTarget.dataset.id;
    const alert = this.data.alerts.find(a => a.id === alertId);

    if (!alert) return;

    try {
      loadingManager.start('ignore');
      wx.showLoading({ title: '处理中...' });

      // 使用数据管理器忽略告警
      const ignoreResult = await this.dataManager.update({
        api: 'rbac',
        data: {
          action: 'ignoreAlert',
          alertId: alertId,
          alertData: alert
        },
        invalidateCache: ['system_alerts']
      });

      wx.hideLoading();

      if (ignoreResult.success) {
        wx.showToast({
          title: '告警已忽略',
          icon: 'success'
        });

        // 更新本地数据
        const alerts = this.data.alerts.map(a =>
          a.id === alertId ? { ...a, status: 'ignored' } : a
        );
        this.setData({ alerts });
        this.updateFilteredAlerts();
      } else {
        throw new Error(ignoreResult.error?.message || '忽略告警失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'ignoreAlert',
        alertId
      });
    } finally {
      loadingManager.end('ignore');
    }
  },

  /**
   * 查看告警详情
   */
  viewAlertDetail(e) {
    const alertId = e.currentTarget.dataset.id;
    const alert = this.data.alerts.find(a => a.id === alertId);

    if (alert) {
      wx.showModal({
        title: '告警详情',
        content: `标题：${alert.title}\n\n描述：${alert.description}\n\n级别：${alert.level}\n时间：${alert.time}`,
        showCancel: false
      });
    }
  },

  /**
   * 查看详细指标
   */
  viewDetailedMetrics() {
    wx.showModal({
      title: '详细指标',
      content: '详细指标页面开发中...',
      showCancel: false
    });
  },

  /**
   * 查看历史数据
   */
  viewHistoricalData() {
    wx.showModal({
      title: '历史数据',
      content: '历史数据分析页面开发中...',
      showCancel: false
    });
  },

  /**
   * 导出报告
   */
  async exportReport() {
    try {
      loadingManager.start('export');
      wx.showLoading({ title: '生成报告中...' });

      // 使用数据管理器生成报告
      const reportResult = await this.dataManager.create({
        api: 'rbac',
        data: {
          action: 'generateMonitorReport',
          reportData: {
            systemStatus: this.data.systemStatus,
            performance: this.data.performance,
            services: this.data.services,
            alerts: this.data.alerts,
            exportTime: new Date().toISOString()
          }
        }
      });

      wx.hideLoading();

      if (reportResult.success) {
        wx.showToast({
          title: '报告生成成功',
          icon: 'success'
        });
      } else {
        throw new Error(reportResult.error?.message || '生成报告失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'exportReport'
      });
    } finally {
      loadingManager.end('export');
    }
  },

  /**
   * 系统优化建议
   */
  getOptimizationSuggestions() {
    const suggestions = [];
    const { performance, services, alerts } = this.data;

    // CPU优化建议
    if (performance.cpu > 80) {
      suggestions.push({
        type: 'performance',
        level: 'critical',
        title: 'CPU使用率过高',
        description: '建议检查高CPU占用的进程，考虑升级服务器配置或优化代码'
      });
    }

    // 内存优化建议
    if (performance.memory > 85) {
      suggestions.push({
        type: 'performance',
        level: 'warning',
        title: '内存使用率较高',
        description: '建议清理不必要的进程，检查内存泄漏，或增加服务器内存'
      });
    }

    // 服务状态建议
    const warningServices = services.filter(s => s.status === 'warning');
    if (warningServices.length > 0) {
      suggestions.push({
        type: 'service',
        level: 'warning',
        title: '服务状态异常',
        description: `${warningServices.length}个服务处于警告状态，建议及时检查并修复`
      });
    }

    // 告警处理建议
    const activeAlerts = alerts.filter(a => a.status === 'active');
    if (activeAlerts.length > 5) {
      suggestions.push({
        type: 'alert',
        level: 'warning',
        title: '活跃告警过多',
        description: `当前有${activeAlerts.length}个活跃告警，建议优先处理高优先级告警`
      });
    }

    return suggestions;
  },

  /**
   * 查看优化建议
   */
  viewOptimizationSuggestions() {
    const suggestions = this.getOptimizationSuggestions();

    if (suggestions.length === 0) {
      wx.showModal({
        title: '系统状态良好',
        content: '当前系统运行状态良好，暂无优化建议',
        showCancel: false
      });
      return;
    }

    const suggestionTexts = suggestions.map((s, index) =>
      `${index + 1}. [${s.level.toUpperCase()}] ${s.title}\n   ${s.description}`
    ).join('\n\n');

    wx.showModal({
      title: '优化建议',
      content: `发现 ${suggestions.length} 个优化建议：\n\n${suggestionTexts}`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  /**
   * 系统健康检查
   */
  async performHealthCheck() {
    try {
      loadingManager.start('health');
      wx.showLoading({ title: '执行健康检查...' });

      // 使用数据管理器执行健康检查
      const healthResult = await this.dataManager.create({
        api: 'rbac',
        data: { action: 'performHealthCheck' }
      });

      wx.hideLoading();

      if (healthResult.success) {
        const healthScore = healthResult.data?.score || 85;
        const healthStatus = healthScore >= 90 ? 'excellent' : healthScore >= 70 ? 'good' : 'poor';

        wx.showModal({
          title: '健康检查完成',
          content: `系统健康评分：${healthScore}/100\n状态：${this.getHealthStatusText(healthStatus)}\n\n${this.getHealthAdvice(healthStatus)}`,
          showCancel: false
        });
      } else {
        throw new Error(healthResult.error?.message || '健康检查失败');
      }
    } catch (error) {
      wx.hideLoading();
      errorHandler.handle(error, errorHandler.errorTypes.BUSINESS, {
        operation: 'performHealthCheck'
      });
    } finally {
      loadingManager.end('health');
    }
  },

  /**
   * 获取健康状态文本
   */
  getHealthStatusText(status) {
    const statusMap = {
      excellent: '优秀',
      good: '良好',
      poor: '需要改进'
    };
    return statusMap[status] || '未知';
  },

  /**
   * 获取健康建议
   */
  getHealthAdvice(status) {
    const adviceMap = {
      excellent: '系统运行状态非常好，请继续保持！',
      good: '系统运行正常，建议定期检查并优化。',
      poor: '系统存在一些问题，建议立即处理相关告警并优化配置。'
    };
    return adviceMap[status] || '请联系系统管理员获取详细建议。';
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
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
    this.refreshAllData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  }
});
