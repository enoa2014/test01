// 性能监控器
const PERFORMANCE_CONFIG = require('../config/performance-config');

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Set();
    this.startTime = Date.now();
    this.pageStartTime = null;
    this.isMonitoring = PERFORMANCE_CONFIG.MONITORING.ENABLED;

    if (this.isMonitoring) {
      this.init();
    }
  }

  /**
   * 初始化性能监控
   */
  init() {
    this.pageStartTime = Date.now();
    this.observePageLoad();
    this.observeNetworkRequests();
    this.observeErrors();
    this.observeMemoryUsage();
    this.scheduleMetricsReport();
  }

  /**
   * 开始计时
   */
  startTimer(name) {
    if (!this.isMonitoring) return;

    this.metrics.set(name, {
      startTime: performance.now ? performance.now() : Date.now(),
      type: 'timer'
    });
  }

  /**
   * 结束计时并记录
   */
  endTimer(name) {
    if (!this.isMonitoring) return;

    const metric = this.metrics.get(name);
    if (metric && metric.type === 'timer') {
      const endTime = performance.now ? performance.now() : Date.now();
      const duration = endTime - metric.startTime;

      this.recordMetric(name, {
        value: duration,
        unit: 'ms',
        type: 'duration',
        timestamp: Date.now()
      });

      // 检查性能阈值
      this.checkThreshold(name, duration);
    }
  }

  /**
   * 记录指标
   */
  recordMetric(name, data) {
    if (!this.isMonitoring) return;

    const existing = this.metrics.get(name) || { measurements: [] };

    if (!existing.measurements) {
      existing.measurements = [];
    }

    existing.measurements.push({
      ...data,
      timestamp: data.timestamp || Date.now()
    });

    // 限制历史记录数量
    if (existing.measurements.length > 100) {
      existing.measurements.shift();
    }

    this.metrics.set(name, existing);
    this.notifyObservers(name, data);
  }

  /**
   * 记录网络请求
   */
  recordRequest(url, method, duration, status, error = null) {
    if (!this.isMonitoring) return;

    const name = `request_${method}_${url}`;
    this.recordMetric(name, {
      value: duration,
      unit: 'ms',
      type: 'network_request',
      metadata: {
        url,
        method,
        status,
        error: error ? error.message : null
      }
    });

    // 检查API响应时间阈值
    if (duration > PERFORMANCE_CONFIG.MONITORING.THRESHOLDS.API_RESPONSE_TIME) {
      console.warn(`[Performance] Slow API request: ${name} took ${duration}ms`);
    }
  }

  /**
   * 记录用户交互
   */
  recordInteraction(action, duration) {
    if (!this.isMonitoring) return;

    this.recordMetric(`interaction_${action}`, {
      value: duration,
      unit: 'ms',
      type: 'user_interaction'
    });

    // 检查交互响应时间阈值
    if (duration > PERFORMANCE_CONFIG.MONITORING.THRESHOLDS.INTERACTION_TIME) {
      console.warn(`[Performance] Slow interaction: ${action} took ${duration}ms`);
    }
  }

  /**
   * 记录错误
   */
  recordError(error, context = {}) {
    if (!this.isMonitoring) return;

    this.recordMetric('error', {
      value: 1,
      unit: 'count',
      type: 'error',
      metadata: {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 观察页面加载
   */
  observePageLoad() {
    if (typeof wx !== 'undefined') {
      // 小程序环境
      wx.onPageNotFound && wx.onPageNotFound((res) => {
        this.recordError(new Error('Page not found'), { path: res.path });
      });
    }
  }

  /**
   * 观察网络请求
   */
  observeNetworkRequests() {
    // 包装wx.request以监控网络请求
    if (typeof wx !== 'undefined' && wx.request) {
      const originalRequest = wx.request;
      const self = this;

      wx.request = function(options) {
        const startTime = Date.now();
        const { url, method = 'GET' } = options;

        const originalSuccess = options.success;
        const originalFail = options.fail;

        options.success = function(res) {
          const duration = Date.now() - startTime;
          self.recordRequest(url, method, duration, res.statusCode);
          originalSuccess && originalSuccess(res);
        };

        options.fail = function(error) {
          const duration = Date.now() - startTime;
          self.recordRequest(url, method, duration, null, error);
          originalFail && originalFail(error);
        };

        return originalRequest.call(this, options);
      };
    }
  }

  /**
   * 观察错误
   */
  observeErrors() {
    // 全局错误处理
    if (typeof wx !== 'undefined') {
      wx.onError && wx.onError((error) => {
        this.recordError(new Error(error), { source: 'wx.onError' });
      });
    }

    // 未处理的Promise拒绝
    if (typeof Promise !== 'undefined') {
      const originalHandler = window && window.onunhandledrejection;
      if (originalHandler) {
        window.onunhandledrejection = (event) => {
          this.recordError(event.reason, { source: 'unhandledRejection' });
          originalHandler(event);
        };
      }
    }
  }

  /**
   * 观察内存使用
   */
  observeMemoryUsage() {
    // 定期检查内存使用情况
    setInterval(() => {
      if (typeof performance !== 'undefined' && performance.memory) {
        const memory = performance.memory;
        const usagePercent = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;

        this.recordMetric('memory_usage', {
          value: usagePercent,
          unit: 'percent',
          type: 'memory',
          metadata: {
            used: memory.usedJSHeapSize,
            total: memory.totalJSHeapSize,
            limit: memory.jsHeapSizeLimit
          }
        });

        // 检查内存使用阈值
        if (usagePercent > PERFORMANCE_CONFIG.MONITORING.THRESHOLDS.MEMORY_USAGE) {
          console.warn(`[Performance] High memory usage: ${usagePercent.toFixed(2)}%`);
        }
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 检查性能阈值
   */
  checkThreshold(name, value) {
    const thresholds = PERFORMANCE_CONFIG.MONITORING.THRESHOLDS;

    switch (name) {
      case 'page_load':
        if (value > thresholds.PAGE_LOAD_TIME) {
          console.warn(`[Performance] Slow page load: ${value}ms`);
        }
        break;
      case 'interaction_click':
        if (value > thresholds.INTERACTION_TIME) {
          console.warn(`[Performance] Slow click interaction: ${value}ms`);
        }
        break;
    }
  }

  /**
   * 添加观察者
   */
  addObserver(callback) {
    this.observers.add(callback);
  }

  /**
   * 移除观察者
   */
  removeObserver(callback) {
    this.observers.delete(callback);
  }

  /**
   * 通知观察者
   */
  notifyObservers(name, data) {
    this.observers.forEach(callback => {
      try {
        callback(name, data);
      } catch (error) {
        console.error('[Performance] Observer callback error:', error);
      }
    });
  }

  /**
   * 获取性能报告
   */
  getReport() {
    const report = {
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      metrics: {}
    };

    this.metrics.forEach((data, name) => {
      if (data.measurements && data.measurements.length > 0) {
        const measurements = data.measurements;
        const values = measurements.map(m => m.value);

        report.metrics[name] = {
          count: measurements.length,
          total: values.reduce((sum, val) => sum + val, 0),
          average: values.reduce((sum, val) => sum + val, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          latest: measurements[measurements.length - 1],
          type: data.type || measurements[0].type
        };
      }
    });

    return report;
  }

  /**
   * 定期报告指标
   */
  scheduleMetricsReport() {
    setInterval(() => {
      if (Math.random() < PERFORMANCE_CONFIG.MONITORING.SAMPLE_RATE) {
        const report = this.getReport();
        this.reportMetrics(report);
      }
    }, 60000); // 每分钟报告一次
  }

  /**
   * 上报性能指标
   */
  reportMetrics(report) {
    if (!PERFORMANCE_CONFIG.ERROR_HANDLING.REPORTING.ENABLED) return;

    // 这里可以上报到服务器
    console.log('[Performance] Metrics report:', report);

    // 示例：上报到服务器
    /*
    wx.request({
      url: PERFORMANCE_CONFIG.ERROR_HANDLING.REPORTING.ENDPOINT,
      method: 'POST',
      data: report,
      success: () => {
        console.log('[Performance] Metrics reported successfully');
      },
      fail: (error) => {
        console.error('[Performance] Failed to report metrics:', error);
      }
    });
    */
  }

  /**
   * 清理监控数据
   */
  cleanup() {
    this.metrics.clear();
    this.observers.clear();
  }
}

// 创建全局性能监控实例
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;