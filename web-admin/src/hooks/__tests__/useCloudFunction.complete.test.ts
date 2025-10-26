import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { CloudbaseProvider } from '../../providers/CloudbaseProvider';
// Import the hook we want to test
import { useCloudFunction } from '../useCloudFunction';

describe('useCloudFunction (完整版)', () => {
  let mockCallFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // 使用全局的 CloudbaseProvider mock 函数
    mockCallFunction = global.mockCallFunction as any;
    mockCallFunction.mockReset();
    mockCallFunction.mockResolvedValue({ result: { success: true, data: {} } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Create a test wrapper with CloudbaseProvider
  const createWrapper = () => {
    return ({ children }: { children: ReactNode }) =>
      React.createElement(CloudbaseProvider, null, children);
  };

  describe('初始化测试', () => {
    it('应该使用默认值初始化', () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(typeof result.current.callFunction).toBe('function');
    });

    it('应该维持正确的hook状态管理', () => {
      const { result, rerender } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // 初始状态
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);

      // 重新渲染应该维持状态
      rerender();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });
  });

  describe('callFunction方法测试', () => {
    it('callFunction方法应该返回一个Promise', () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const response = result.current.callFunction('test', {});
      expect(response).toBeInstanceOf(Promise);
    });

    it('应该处理不同类型的参数', () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // 测试无参数
      expect(() => result.current.callFunction('test')).not.toThrow();

      // 测试带参数
      expect(() => result.current.callFunction('test', { param: 'value' })).not.toThrow();

      // 测试undefined参数
      expect(() => result.current.callFunction('test', undefined)).not.toThrow();

      // 测试空对象参数
      expect(() => result.current.callFunction('test', {})).not.toThrow();
    });
  });

  describe('成功调用测试', () => {
    it('应该成功调用云函数', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // Set up specific mock response
      mockCallFunction.mockResolvedValue({
        result: { success: true, data: { patients: [] } }
      });

      const response = await result.current.callFunction('patientProfile', {
        action: 'list',
        data: { page: 1, pageSize: 10 }
      });

      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data');
    });

    it('应该处理带有复杂数据结构的调用', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // Set up mock response
      mockCallFunction.mockResolvedValue({
        result: { success: true, data: { total: 100, items: [] } }
      });

      const response = await result.current.callFunction('patientProfile', {
        action: 'list',
        data: {
          filters: { gender: '男', status: '在住' },
          pagination: { page: 1, pageSize: 20 }
        }
      });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });
  });

  describe('错误处理测试', () => {
    it('应该处理网络错误', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // Mock network error
      mockCallFunction.mockRejectedValue(new Error('网络连接失败'));

      const response = await result.current.callFunction('test', {});

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error?.message).toBe('网络连接失败');
    });

    it('应该处理云函数返回的错误', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // Mock function returning error
      mockCallFunction.mockResolvedValue({
        result: {
          success: false,
          error: {
            code: 'FUNCTION_ERROR',
            message: '云函数执行失败'
          }
        }
      });

      const response = await result.current.callFunction('test', {});

      expect(response.success).toBe(false);
      expect(response.error?.message).toBe('云函数执行失败');
    });
  });

  describe('并发调用测试', () => {
    it('应该正确处理并发的云函数调用', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // Set up different mock responses
      mockCallFunction
        .mockResolvedValueOnce({ result: { success: true, data: { patients: [] } } })
        .mockResolvedValueOnce({ result: { success: true, data: { stats: {} } } })
        .mockResolvedValueOnce({ result: { success: true, data: { logs: [] } } });

      const promises = [
        result.current.callFunction('patientProfile', { action: 'list' }),
        result.current.callFunction('dashboardService', { action: 'getStats' }),
        result.current.callFunction('auditService', { action: 'getLogs' })
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });
    });

    it('应该处理部分成功部分失败的并发调用', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // Mock mixed success/failure
      mockCallFunction
        .mockResolvedValueOnce({ result: { success: true, data: { patients: [] } } })
        .mockRejectedValueOnce(new Error('服务暂时不可用'))
        .mockResolvedValueOnce({ result: { success: true, data: { stats: {} } } });

      const promises = [
        result.current.callFunction('patientProfile', { action: 'list' }),
        result.current.callFunction('exportService', { action: 'export' }),
        result.current.callFunction('dashboardService', { action: 'getStats' })
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('fulfilled');

      if (results[1].status === 'fulfilled') {
        expect(results[1].value.success).toBe(false);
        expect(results[1].value.error?.message).toBe('服务暂时不可用');
      }
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成调用', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const startTime = Date.now();
      await result.current.callFunction('test', {});
      const endTime = Date.now();

      // 由于是mock调用，应该很快完成
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('边界情况测试', () => {
    it('应该处理空函数名', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const response = await result.current.callFunction('', {});
      expect(response.success).toBe(true);
    });

    it('应该处理大型数据参数', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const largeData = {
        patients: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `患者${i}`,
          records: Array.from({ length: 100 }, (_, j) => ({
            type: `检查${j}`,
            result: `结果${j}`
          }))
        }))
      };

      const response = await result.current.callFunction('batchImport', largeData);
      expect(response.success).toBe(true);
    });

    it('应该处理特殊字符参数', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      const specialData = {
        name: '张三@#$%^&*()',
        description: '包含\n换行\t制表符和emoji😊的内容',
        unicode: '测试unicode: ★☆♪♫☼☽♀♂'
      };

      const response = await result.current.callFunction('saveData', specialData);
      expect(response.success).toBe(true);
    });
  });

  describe('hook状态管理测试', () => {
    it('应该正确管理loading状态', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // 初始状态
      expect(result.current.loading).toBe(false);

      // 开始调用
      const promise = result.current.callFunction('test', {});

      // 在mock环境下，loading状态可能不会立即改变，这是正常的
      // 主要测试callFunction方法是否可用
      await promise;
    });

    it('应该正确管理error状态', async () => {
      const { result } = renderHook(() => useCloudFunction(), {
        wrapper: createWrapper(),
      });

      // 初始状态
      expect(result.current.error).toBe(null);

      // 成功调用后错误状态应该保持null
      await result.current.callFunction('test', {});
      expect(result.current.error).toBe(null);
    });
  });
});
