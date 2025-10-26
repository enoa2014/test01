// 性能优化配置
const PERFORMANCE_CONFIG = {
  // 缓存配置
  CACHE: {
    // 默认缓存时间（毫秒）
    DEFAULT_TIMEOUT: 5 * 60 * 1000, // 5分钟

    // 各种数据的缓存时间
    TIMEOUTS: {
      USER_INFO: 10 * 60 * 1000,        // 用户信息 10分钟
      SYSTEM_STATUS: 1 * 60 * 1000,      // 系统状态 1分钟
      AUDIT_LOGS: 3 * 60 * 1000,         // 审计日志 3分钟
      APPLICATIONS: 5 * 60 * 1000,       // 申请列表 5分钟
      SERVICES: 2 * 60 * 1000,           // 服务状态 2分钟
      NOTIFICATIONS: 5 * 60 * 1000,      // 通知列表 5分钟
      INVITE_CODES: 10 * 60 * 1000,     // 邀请码 10分钟

      // 静态数据
      STATIC_DATA: 60 * 60 * 1000,       // 静态数据 1小时
      ROLE_PERMISSIONS: 30 * 60 * 1000   // 角色权限 30分钟
    },

    // 缓存键前缀
    KEYS: {
      USER: 'user_',
      SYSTEM: 'system_',
      AUDIT: 'audit_',
      APP: 'app_',
      SERVICE: 'service_',
      NOTIFICATION: 'notification_',
      INVITE: 'invite_',
      ROLE: 'role_'
    }
  },

  // 请求配置
  REQUEST: {
    // 默认超时时间
    TIMEOUT: 10000, // 10秒

    // 重试配置
    RETRY: {
      MAX_ATTEMPTS: 3,
      DELAY: 1000,      // 初始延迟 1秒
      MAX_DELAY: 5000,  // 最大延迟 5秒
      BACKOFF_FACTOR: 2
    },

    // 并发控制
    CONCURRENCY: {
      MAX_CONCURRENT: 5,  // 最大并发请求数
      QUEUE_SIZE: 20      // 请求队列大小
    }
  },

  // 防抖配置
  DEBOUNCE: {
    SEARCH_DELAY: 500,        // 搜索输入防抖 500ms
    FORM_INPUT_DELAY: 300,    // 表单输入防抖 300ms
    REFRESH_DELAY: 1000,      // 刷新操作防抖 1秒
    NAVIGATION_DELAY: 200     // 导航操作防抖 200ms
  },

  // 节流配置
  THROTTLE: {
    SCROLL_DELAY: 100,        // 滚动事件节流 100ms
    RESIZE_DELAY: 200,        // 窗口调整节流 200ms
    CLICK_DELAY: 300,         // 点击事件节流 300ms
    MOUSE_MOVE_DELAY: 50      // 鼠标移动节流 50ms
  },

  // 批量操作配置
  BATCH: {
    DEFAULT_SIZE: 20,         // 默认批量大小
    MAX_SIZE: 100,            // 最大批量大小
    DELAY: 100,               // 批量处理延迟 100ms
    TIMEOUT: 30000            // 批量操作超时 30秒
  },

  // 虚拟滚动配置
  VIRTUAL_SCROLL: {
    ITEM_HEIGHT: 60,          // 项目高度
    BUFFER_SIZE: 5,           // 缓冲区大小
    THRESHOLD: 50             // 启用阈值
  },

  // 图片懒加载配置
  LAZY_LOAD: {
    THRESHOLD: 100,           // 加载阈值
    PLACEHOLDER: '/images/placeholder.png',
    ERROR_PLACEHOLDER: '/images/error.png'
  },

  // 性能监控配置
  MONITORING: {
    // 启用性能监控
    ENABLED: true,

    // 采样率
    SAMPLE_RATE: 0.1,         // 10% 采样率

    // 性能指标阈值
    THRESHOLDS: {
      PAGE_LOAD_TIME: 3000,       // 页面加载时间 3秒
      API_RESPONSE_TIME: 2000,    // API响应时间 2秒
      INTERACTION_TIME: 100,      // 交互响应时间 100ms
      MEMORY_USAGE: 50,           // 内存使用率 50%
      ERROR_RATE: 0.05            // 错误率 5%
    }
  },

  // 资源优化配置
  OPTIMIZATION: {
    // 启用资源压缩
    ENABLE_COMPRESSION: true,

    // 图片优化
    IMAGE_OPTIMIZATION: {
      QUALITY: 80,
      FORMAT: 'webp',
      RESIZE: true
    },

    // 代码分割
    CODE_SPLITTING: {
      ENABLED: true,
      CHUNK_SIZE: 50000
    }
  },

  // 错误处理配置
  ERROR_HANDLING: {
    // 全局错误处理
    GLOBAL_HANDLER: true,

    // 错误重试
    AUTO_RETRY: true,

    // 错误上报
    REPORTING: {
      ENABLED: true,
      ENDPOINT: '/api/errors/report',
      BATCH_SIZE: 10,
      FLUSH_INTERVAL: 30000
    },

    // 用户友好错误消息
    USER_MESSAGES: {
      NETWORK_ERROR: '网络连接异常，请检查网络设置',
      TIMEOUT_ERROR: '请求超时，请稍后重试',
      PERMISSION_ERROR: '权限不足，请联系管理员',
      VALIDATION_ERROR: '输入信息有误，请检查后重新提交',
      SERVER_ERROR: '服务器暂时不可用，请稍后重试',
      UNKNOWN_ERROR: '发生未知错误，请稍后重试'
    }
  }
};

module.exports = PERFORMANCE_CONFIG;