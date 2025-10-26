import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { useCloudFunction } from '../useCloudFunction';

// Create a test wrapper
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => React.createElement(React.Fragment, null, children);
};

describe('useCloudFunction (优化版)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置全局mock函数
    if (global.mockCallFunction) {
      global.mockCallFunction.mockClear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('基础功能测试', () => {
    it('应该使用默认值初始化', () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.callFunction).toBe('function');
    });

    it('应该返回Promise', () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const response = result.current.callFunction('test', {});
      expect(response).toBeInstanceOf(Promise);
    });
  });

  describe('成功调用测试', () => {
    it('应该成功调用云函数并返回数据', async () => {
      const mockResponse = { success: true, data: { patients: [] } };

      if (global.mockCallFunction) {
        global.mockCallFunction.mockResolvedValue({ result: mockResponse });
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.callFunction('patientProfile', {
        action: 'list',
        data: { page: 1, pageSize: 10 }
      });

      expect(response).toEqual(mockResponse);
      expect(global.mockCallFunction).toHaveBeenCalledWith({
        name: 'patientProfile',
        data: {
          action: 'list',
          data: { page: 1, pageSize: 10 }
        }
      });
    });

    it('应该处理带有复杂数据结构的调用', async () => {
      const mockResponse = {
        success: true,
        data: {
          patients: [
            { id: 1, name: '张三', gender: '男', age: 65 },
            { id: 2, name: '李四', gender: '女', age: 70 }
          ],
          total: 2,
          page: 1
        }
      };

      if (global.mockCallFunction) {
        global.mockCallFunction.mockResolvedValue({ result: mockResponse });
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.callFunction('patientProfile', {
        action: 'list',
        data: {
          filters: { gender: '男', status: '在住' },
          pagination: { page: 1, pageSize: 20 }
        }
      });

      expect(response.data.patients).toHaveLength(2);
      expect(response.data.patients[0].name).toBe('张三');
    });
  });

  describe('错误处理测试', () => {
    it('应该处理网络错误', async () => {
      const networkError = new Error('网络连接失败');

      if (global.mockCallFunction) {
        global.mockCallFunction.mockRejectedValue(networkError);
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.callFunction('test', {});

      expect(response.success).toBe(false);
      expect(response.error?.message).toBe('网络连接失败');
    });

    it('应该更新hook的错误状态', async () => {
      const networkError = new Error('网络连接失败');

      if (global.mockCallFunction) {
        global.mockCallFunction.mockRejectedValue(networkError);
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      await result.current.callFunction('test', {});

      // 等待状态更新
      await waitFor(() => {
        expect(result.current.error).toBe('网络连接失败');
      });
    });
  });

  describe('并发调用测试', () => {
    it('应该正确处理并发的云函数调用', async () => {
      const mockResponse1 = { success: true, data: { patients: [] } };
      const mockResponse2 = { success: true, data: { stats: { total: 100 } } };
      const mockResponse3 = { success: true, data: { audits: [] } };

      if (global.mockCallFunction) {
        global.mockCallFunction
          .mockResolvedValueOnce({ result: mockResponse1 })
          .mockResolvedValueOnce({ result: mockResponse2 })
          .mockResolvedValueOnce({ result: mockResponse3 });
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const promises = [
        result.current.callFunction('patientProfile', { action: 'list' }),
        result.current.callFunction('dashboardService', { action: 'getStats' }),
        result.current.callFunction('auditService', { action: 'getLogs' })
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].data.patients).toEqual([]);
      expect(results[1].data.stats.total).toBe(100);
      expect(results[2].data.audits).toEqual([]);
    });
  });

  describe('加载状态测试', () => {
    it('应该在调用时显示加载状态', async () => {
      // 模拟慢速响应
      if (global.mockCallFunction) {
        global.mockCallFunction.mockImplementation(() =>
          new Promise(resolve => setTimeout(() =>
            resolve({ result: { success: true, data: {} } }), 100)
          )
        );
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // 开始调用
      const promise = result.current.callFunction('test', {});

      // 应该显示加载状态
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // 等待完成
      await promise;

      // 加载状态应该结束（等待一次调度）
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空函数名', async () => {
      const mockResponse = { success: true, data: {} };

      if (global.mockCallFunction) {
        global.mockCallFunction.mockResolvedValue({ result: mockResponse });
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.callFunction('', {});

      expect(response).toEqual(mockResponse);
    });

    it('应该处理不同参数类型', async () => {
      const mockResponse = { success: true, data: {} };

      if (global.mockCallFunction) {
        global.mockCallFunction.mockResolvedValue({ result: mockResponse });
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // 测试不同参数
      const responses = await Promise.all([
        result.current.callFunction('test'), // 无参数
        result.current.callFunction('test', {}), // 空对象
        result.current.callFunction('test', null), // null参数
        result.current.callFunction('test', undefined) // undefined参数
      ]);

      expect(responses).toHaveLength(4);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成调用', async () => {
      if (global.mockCallFunction) {
        global.mockCallFunction.mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { result: { success: true, data: {} } };
        });
      }

      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const startTime = Date.now();
      await result.current.callFunction('test', {});
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(40);
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('生命周期测试', () => {
    it('应该正确处理组件重新渲染', () => {
      const { result, rerender } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // 初始状态
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);

      // 重新渲染
      rerender();

      // 状态应该保持
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });
});
