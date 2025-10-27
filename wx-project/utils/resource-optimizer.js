// 资源优化工具
const PERFORMANCE_CONFIG = require('../config/performance-config.js');
const performanceMonitor = require('./performance-monitor');
const logger = require('./logger');

class ResourceOptimizer {
  constructor() {
    this.imageCache = new Map();
    this.preloadQueue = [];
    this.lazyLoadObserver = null;
    this.resourceTiming = new Map();
    this.optimizationEnabled = PERFORMANCE_CONFIG.OPTIMIZATION.ENABLE_COMPRESSION;

    this.init();
  }

  /**
   * 初始化资源优化器
   */
  init() {
    this.setupLazyLoading();
    this.setupImageOptimization();
    this.setupPreloading();
    this.setupResourceMonitoring();
  }

  /**
   * 设置图片懒加载
   */
  setupLazyLoading() {
    if (typeof IntersectionObserver !== 'undefined') {
      this.lazyLoadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadImage(entry.target);
            this.lazyLoadObserver.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: `${PERFORMANCE_CONFIG.LAZY_LOAD.THRESHOLD}px`
      });
    }
  }

  /**
   * 观察需要懒加载的图片
   */
  observeImage(element) {
    if (this.lazyLoadObserver && element) {
      this.lazyLoadObserver.observe(element);
    } else {
      // 回退方案：直接加载
      this.loadImage(element);
    }
  }

  /**
   * 加载图片
   */
  loadImage(element) {
    if (!element || !element.dataset.src) return;

    const src = element.dataset.src;
    const cachedImage = this.imageCache.get(src);

    if (cachedImage) {
      element.src = cachedImage;
      return;
    }

    performanceMonitor.startTimer(`image_load_${src}`);

    const img = new Image();
    img.onload = () => {
      element.src = src;
      this.imageCache.set(src, src);
      performanceMonitor.endTimer(`image_load_${src}`);
    };

    img.onerror = () => {
      element.src = PERFORMANCE_CONFIG.LAZY_LOAD.ERROR_PLACEHOLDER;
      performanceMonitor.endTimer(`image_load_${src}`);
    };

    img.src = src;
  }

  /**
   * 设置图片优化
   */
  setupImageOptimization() {
    // 包装wx.chooseMedia以优化图片选择
    if (typeof wx !== 'undefined' && wx.chooseMedia) {
      const originalChooseMedia = wx.chooseMedia;
      const self = this;

      wx.chooseMedia = function(options) {
        const originalSuccess = options.success;
        const originalFail = options.fail;

        options.success = function(res) {
          // 优化选中的图片
          self.optimizeSelectedImages(res.tempFiles);
          if (typeof originalSuccess === 'function') {
            originalSuccess(res);
          }
        };

        options.fail = originalFail;

        return originalChooseMedia.call(this, options);
      };
    }
  }

  /**
   * 优化选中的图片
   */
  optimizeSelectedImages(files) {
    if (!files || !Array.isArray(files)) return;

    files.forEach(file => {
      // 压缩图片
      if (file.size > 1024 * 1024) { // 大于1MB
        this.compressImage(file);
      }

      // 转换格式
      if (PERFORMANCE_CONFIG.OPTIMIZATION.IMAGE_OPTIMIZATION.FORMAT === 'webp') {
        this.convertToWebP(file);
      }
    });
  }

  /**
   * 压缩图片
   */
  compressImage(file) {
    if (typeof wx !== 'undefined' && wx.compressImage) {
      wx.compressImage({
        src: file.path,
        quality: PERFORMANCE_CONFIG.OPTIMIZATION.IMAGE_OPTIMIZATION.QUALITY,
        success: (res) => {
          logger.info(`[ResourceOptimizer] Image compressed: ${file.size} -> ${res.size} bytes`);
        },
        fail: (error) => {
          logger.error('[ResourceOptimizer] Image compression failed:', error);
        }
      });
    }
  }

  /**
   * 转换为WebP格式
   */
  convertToWebP(_file) {
    // 在小程序中，WebP转换需要服务器支持
    logger.info('[ResourceOptimizer] WebP conversion requires server support');
  }

  /**
   * 设置预加载
   */
  setupPreloading() {
    // 监听页面加载完成，开始预加载
    if (typeof wx !== 'undefined') {
      if (typeof wx.onNetworkStatusChange === 'function') {
        wx.onNetworkStatusChange((res) => {
          if (res.isConnected && res.networkType !== 'none') {
            this.startPreloading();
          }
        });
      }
    }
  }

  /**
   * 添加预加载资源
   */
  addPreloadResource(type, url, priority = 'normal') {
    this.preloadQueue.push({
      type,
      url,
      priority,
      addedTime: Date.now()
    });

    // 按优先级排序
    this.preloadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 开始预加载
   */
  startPreloading() {
    if (this.preloadQueue.length === 0) return;

    const batch = this.preloadQueue.splice(0, 5); // 每次预加载5个资源

    batch.forEach(resource => {
      this.preloadResource(resource);
    });

    // 继续预加载下一批
    if (this.preloadQueue.length > 0) {
      setTimeout(() => {
        this.startPreloading();
      }, 1000);
    }
  }

  /**
   * 预加载单个资源
   */
  preloadResource(resource) {
    performanceMonitor.startTimer(`preload_${resource.type}_${resource.url}`);

    switch (resource.type) {
      case 'image':
        this.preloadImage(resource.url);
        break;
      case 'script':
        this.preloadScript(resource.url);
        break;
      case 'style':
        this.preloadStyle(resource.url);
        break;
      default:
        this.preloadGeneric(resource.url);
    }
  }

  /**
   * 预加载图片
   */
  preloadImage(url) {
    const img = new Image();
    img.onload = () => {
      this.imageCache.set(url, url);
      performanceMonitor.endTimer(`preload_image_${url}`);
    };
    img.onerror = () => {
      performanceMonitor.endTimer(`preload_image_${url}`);
    };
    img.src = url;
  }

  /**
   * 预加载脚本
   */
  preloadScript(url) {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'script';
      link.href = url;
      document.head.appendChild(link);
    }
  }

  /**
   * 预加载样式
   */
  preloadStyle(url) {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'style';
      link.href = url;
      document.head.appendChild(link);
    }
  }

  /**
   * 预加载通用资源
   */
  preloadGeneric(url) {
    if (typeof wx !== 'undefined') {
      wx.request({
        url: url,
        method: 'GET',
        success: () => {
          performanceMonitor.endTimer(`preload_generic_${url}`);
        },
        fail: () => {
          performanceMonitor.endTimer(`preload_generic_${url}`);
        }
      });
    }
  }

  /**
   * 设置资源监控
   */
  setupResourceMonitoring() {
    // 监控资源加载时间
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      this.monitorResourceTiming();
    }

    // 监控内存使用
    this.monitorMemoryUsage();
  }

  /**
   * 监控资源加载时间
   */
  monitorResourceTiming() {
    setInterval(() => {
      const resources = performance.getEntriesByType('resource');

      resources.forEach(resource => {
        if (!this.resourceTiming.has(resource.name)) {
          const timing = {
            name: resource.name,
            startTime: resource.startTime,
            duration: resource.duration,
            size: resource.transferSize || 0,
            type: this.getResourceType(resource.name)
          };

          this.resourceTiming.set(resource.name, timing);

          // 记录性能指标
          performanceMonitor.recordMetric(`resource_${timing.type}`, {
            value: timing.duration,
            unit: 'ms',
            type: 'resource_timing',
            metadata: {
              name: timing.name,
              size: timing.size
            }
          });
        }
      });
    }, 5000);
  }

  /**
   * 获取资源类型
   */
  getResourceType(url) {
    const extension = url.split('.').pop().toLowerCase();

    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const scriptExtensions = ['js', 'jsx', 'ts', 'tsx'];
    const styleExtensions = ['css', 'scss', 'less'];

    if (imageExtensions.includes(extension)) return 'image';
    if (scriptExtensions.includes(extension)) return 'script';
    if (styleExtensions.includes(extension)) return 'style';

    return 'other';
  }

  /**
   * 监控内存使用
   */
  monitorMemoryUsage() {
    setInterval(() => {
      if (typeof performance !== 'undefined' && performance.memory) {
        const memory = performance.memory;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        // 内存使用率过高时清理缓存
        if (usagePercent > 80) {
          this.cleanupMemory();
        }
      }
    }, 30000);
  }

  /**
   * 清理内存
   */
  cleanupMemory() {
    // 清理图片缓存
    if (this.imageCache.size > 50) {
      const entries = Array.from(this.imageCache.entries());
      const toDelete = entries.slice(0, entries.length - 20); // 保留最新20个

      toDelete.forEach(([key]) => {
        this.imageCache.delete(key);
      });
    }

    // 清理资源时间记录
    if (this.resourceTiming.size > 100) {
      const entries = Array.from(this.resourceTiming.entries());
      const toDelete = entries.slice(0, entries.length - 50);

      toDelete.forEach(([key]) => {
        this.resourceTiming.delete(key);
      });
    }

    logger.info('[ResourceOptimizer] Memory cleanup completed');
  }

  /**
   * 优化API请求
   */
  optimizeApiRequest(options) {
    const optimizedOptions = { ...options };

    // 添加缓存头
    if (!optimizedOptions.header) {
      optimizedOptions.header = {};
    }

    optimizedOptions.header['Cache-Control'] = 'max-age=300';

    // 启用压缩
    if (this.optimizationEnabled) {
      optimizedOptions.header['Accept-Encoding'] = 'gzip, deflate';
    }

    // 请求超时设置
    if (!optimizedOptions.timeout) {
      optimizedOptions.timeout = PERFORMANCE_CONFIG.REQUEST.TIMEOUT;
    }

    return optimizedOptions;
  }

  /**
   * 批量优化资源
   */
  optimizeBatch(resources) {
    return Promise.all(
      resources.map(resource => this.optimizeResource(resource))
    );
  }

  /**
   * 优化单个资源
   */
  async optimizeResource(resource) {
    switch (resource.type) {
      case 'image':
        return this.optimizeImageResource(resource);
      case 'data':
        return this.optimizeDataResource(resource);
      default:
        return resource;
    }
  }

  /**
   * 优化图片资源
   */
  async optimizeImageResource(resource) {
    // 图片压缩、格式转换等优化
    return resource;
  }

  /**
   * 优化数据资源
   */
  async optimizeDataResource(resource) {
    // 数据压缩、序列化优化等
    if (typeof resource.data === 'object') {
      // 移除不必要的属性
      const optimizedData = this.removeNullValues(resource.data);
      resource.data = optimizedData;
    }

    return resource;
  }

  /**
   * 移除空值
   */
  removeNullValues(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj
        .filter(item => item !== null && item !== undefined)
        .map(item => this.removeNullValues(item));
    }

    const result = {};
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value !== null && value !== undefined && value !== '') {
        result[key] = this.removeNullValues(value);
      }
    });

    return result;
  }

  /**
   * 获取优化统计
   */
  getOptimizationStats() {
    return {
      imageCacheSize: this.imageCache.size,
      preloadQueueSize: this.preloadQueue.length,
      resourceTimingCount: this.resourceTiming.size,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        usagePercent: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }

  /**
   * 清理资源优化器
   */
  cleanup() {
    this.imageCache.clear();
    this.preloadQueue = [];
    this.resourceTiming.clear();

    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect();
    }
  }
}

// 创建全局资源优化器实例
const resourceOptimizer = new ResourceOptimizer();

module.exports = resourceOptimizer;
