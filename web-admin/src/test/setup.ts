import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// 声明全局类型
declare global {
  var testUtils: {
    waitForDOMUpdate: () => Promise<void>;
    mockNetworkDelay: (ms?: number) => Promise<void>;
    createMockEvent: (type: string, properties?: any) => Event;
  };
  var mockCallFunction: ReturnType<typeof vi.fn>;
  var hasRole: ReturnType<typeof vi.fn>;
}

// 全局测试工具
global.testUtils = {
  // 等待DOM更新
  waitForDOMUpdate: () => new Promise(resolve => setTimeout(resolve, 0)),

  // 模拟网络延迟
  mockNetworkDelay: (ms: number = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // 创建模拟事件
  createMockEvent: (type: string, properties: any = {}) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, properties);
    return event;
  }
};

// Mock console methods to reduce test noise
global.console = {
  ...console,
  // 保留error和warn用于调试
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
};

// Mock alert
global.alert = vi.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock CloudBase
vi.mock('@cloudbase/js-sdk', () => ({
  default: {
    init: vi.fn(() => ({
      auth: {
        signInAnonymously: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChanged: vi.fn(),
      },
      database: {
        collection: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ data: [] })),
            limit: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve({ data: [] })),
            })),
          })),
          add: vi.fn(() => Promise.resolve({ _id: 'test-id' })),
          doc: vi.fn(() => ({
            get: vi.fn(() => Promise.resolve({ data: {} })),
            update: vi.fn(() => Promise.resolve()),
            delete: vi.fn(() => Promise.resolve()),
          })),
        })),
      },
      callFunction: vi.fn(() => Promise.resolve({ result: { success: true } })),
    })),
  },
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => vi.fn(() => ({ pathname: '/' })),
    useParams: () => vi.fn(() => ({})),
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Upload: () => React.createElement('div', { 'data-testid': 'upload-icon' }, 'Upload'),
  FileSpreadsheet: () => React.createElement('div', { 'data-testid': 'file-spreadsheet-icon' }, 'FileSpreadsheet'),
  CheckCircle: () => React.createElement('div', { 'data-testid': 'check-circle-icon' }, 'CheckCircle'),
  AlertCircle: () => React.createElement('div', { 'data-testid': 'alert-circle-icon' }, 'AlertCircle'),
  AlertTriangle: () => React.createElement('div', { 'data-testid': 'alert-triangle-icon' }, 'AlertTriangle'),
  Download: () => React.createElement('div', { 'data-testid': 'download-icon' }, 'Download'),
  Filter: () => React.createElement('div', { 'data-testid': 'filter-icon' }, 'Filter'),
  RefreshCw: () => React.createElement('div', { 'data-testid': 'refresh-icon' }, 'RefreshCw'),
  Search: () => React.createElement('div', { 'data-testid': 'search-icon' }, 'Search'),
  Server: () => React.createElement('div', { 'data-testid': 'server-icon' }, 'Server'),
  Shield: () => React.createElement('div', { 'data-testid': 'shield-icon' }, 'Shield'),
  Database: () => React.createElement('div', { 'data-testid': 'database-icon' }, 'Database'),
  Activity: () => React.createElement('div', { 'data-testid': 'activity-icon' }, 'Activity'),
  User: () => React.createElement('div', { 'data-testid': 'user-icon' }, 'User'),
  LogOut: () => React.createElement('div', { 'data-testid': 'logout-icon' }, 'LogOut'),
  Save: () => React.createElement('div', { 'data-testid': 'save-icon' }, 'Save'),
  Eye: () => React.createElement('div', { 'data-testid': 'eye-icon' }, 'Eye'),
  EyeOff: () => React.createElement('div', { 'data-testid': 'eye-off-icon' }, 'EyeOff'),
  X: () => React.createElement('div', { 'data-testid': 'x-icon' }, 'X'),
  XCircle: () => React.createElement('div', { 'data-testid': 'x-circle-icon' }, 'XCircle'),
  ChevronDown: () => React.createElement('div', { 'data-testid': 'chevron-down-icon' }, 'ChevronDown'),
  Clock: () => React.createElement('div', { 'data-testid': 'clock-icon' }, 'Clock'),
  Info: () => React.createElement('div', { 'data-testid': 'info-icon' }, 'Info'),
  Settings: () => React.createElement('div', { 'data-testid': 'settings-icon' }, 'Settings'),
  Plus: () => React.createElement('div', { 'data-testid': 'plus-icon' }, 'Plus'),
  Calendar: () => React.createElement('div', { 'data-testid': 'calendar-icon' }, 'Calendar'),
  Users: () => React.createElement('div', { 'data-testid': 'users-icon' }, 'Users'),
  FileText: () => React.createElement('div', { 'data-testid': 'file-text-icon' }, 'FileText'),
  Trash2: () => React.createElement('div', { 'data-testid': 'trash-2-icon' }, 'Trash2'),
}));

// Mock CloudbaseProvider
const globalMockCallFunction = vi.fn().mockImplementation((params: { name: string; data?: any }) => {
  // 根据函数名返回不同的mock数据
  if (params.name === 'patientProfile') {
    return Promise.resolve({
      result: {
        success: true,
        data: {
          items: [
            { key: '1', patientName: '张三', gender: '男', age: 65 },
            { key: '2', patientName: '李四', gender: '女', age: 70 }
          ],
          total: 2
        }
      }
    });
  } else if (params.name === 'dashboardService') {
    return Promise.resolve({
      result: {
        success: true,
        data: {
          userStats: { total: 150, active: 120, newThisMonth: 15, adminCount: 5 },
          patientStats: { total: 500, inCare: 320, discharged: 180, newThisMonth: 25 },
          systemStats: { totalFiles: 1500, totalSize: '2.5GB', recentExports: 12, recentImports: 8 },
          recentActivities: []
        }
      }
    });
  } else {
    // 默认响应
    return Promise.resolve({
      result: {
        success: true,
        data: { items: [] }
      }
    });
  }
});

vi.mock('../providers/CloudbaseProvider', () => ({
  CloudbaseProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'cloudbase-provider' }, children),
  useCloudbase: () => ({}),
  useCloudbaseContext: () => ({
    user: { uid: 'test-user', role: 'admin' },
    loading: false,
    error: null,
    app: {
      callFunction: globalMockCallFunction
    }
  }),
}));

// Expose for tests to control
// @ts-ignore
global.mockCallFunction = globalMockCallFunction;

// Mock RBACContext
const hasRole = vi.fn(() => true);
const hasPermission = vi.fn(() => true);

vi.mock('../contexts/RBACContext', () => ({
  RBACProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'rbac-provider' }, children),
  useRBAC: () => ({
    user: { role: 'admin', roles: ['admin'], displayName: 'Test Admin', lastLoginAt: new Date().toISOString() },
    hasRole,
    hasPermission,
    isAdmin: true, // 添加isAdmin属性
    loading: false,
    error: null,
  }),
}));

// Export for use in tests
global.hasRole = hasRole;

// 提示：不在全局 mock AdminRouteGuard，以便其行为在单元测试中被真实验证

// 不全局 mock useCloudFunction，避免与单元测试冲突

// Mock uploadService
vi.mock('../services/uploadService', () => ({
  uploadFile: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock Media API
vi.mock('../api/media', () => ({
  listMedia: vi.fn().mockResolvedValue({
    images: [],
    documents: [],
    quota: {
      totalCount: 0,
      totalBytes: 0,
      remainingCount: 20,
      remainingBytes: 31457280 // 30MB
    }
  }),
  uploadMedia: vi.fn().mockResolvedValue({ success: true }),
  deleteMediaItem: vi.fn().mockResolvedValue({ success: true }),
  getMediaDownloadUrl: vi.fn().mockResolvedValue({ url: 'https://example.com/download' }),
  getMediaPreviewUrl: vi.fn().mockResolvedValue({ url: 'https://example.com/preview' }),
  getTxtPreview: vi.fn().mockResolvedValue({ content: 'Mock text content' }),
}));

// Mock useCloudbase
vi.mock('../hooks/useCloudbase', () => ({
  useCloudbase: () => ({
    app: {
      callFunction: vi.fn().mockResolvedValue({
        result: { success: true, data: {} }
      })
    },
    user: {
      uid: 'test-user',
      username: 'test-user'
    }
  }),
}));
