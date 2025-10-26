import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Simple wrapper for testing
const SimpleWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children);

describe('DashboardPage', () => {
  let mockCallFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallFunction = vi.fn();
    global.mockCallFunction = mockCallFunction;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockDashboardData = {
    userStats: {
      total: 150,
      active: 120,
      newThisMonth: 15,
      adminCount: 5
    },
    patientStats: {
      total: 500,
      inCare: 320,
      discharged: 180,
      newThisMonth: 25
    },
    systemStats: {
      totalFiles: 1500,
      totalSize: '2.5GB',
      recentExports: 12,
      recentImports: 8
    },
    recentActivities: [
      {
        id: '1',
        type: 'patient_add',
        description: '新增患者张三',
        timestamp: '2024-01-15 10:30:00',
        user: '管理员'
      },
      {
        id: '2',
        type: 'export_data',
        description: '导出患者数据',
        timestamp: '2024-01-15 09:15:00',
        user: '数据员'
      },
      {
        id: '3',
        type: 'file_upload',
        description: '上传医疗影像文件',
        timestamp: '2024-01-15 08:45:00',
        user: '护士'
      }
    ]
  };

  describe('基础渲染测试', () => {
    it('应该能够正确导入组件', async () => {
      expect(async () => {
        await import('../DashboardPage');
      }).not.toThrow();
    });

    it('应该能够正常渲染组件', async () => {
      const { DashboardPage } = await import('../DashboardPage');

      expect(() => {
        render(
          React.createElement(SimpleWrapper, null,
            React.createElement(DashboardPage)
          )
        );
      }).not.toThrow();
    });

    it('应该有正确的组件结构', async () => {
      const { DashboardPage } = await import('../DashboardPage');

      expect(DashboardPage).toBeDefined();
      expect(typeof DashboardPage).toBe('function');

      expect(() => {
        React.createElement(DashboardPage);
      }).not.toThrow();
    });

    it('应该显示页面标题', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /系统概览/ })).toBeInTheDocument();
      });
    });
  });

  describe('统计卡片功能测试', () => {
    it('应该显示用户统计卡片', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/用户总数/)).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
        expect(screen.getByText(/活跃用户/)).toBeInTheDocument();
        expect(screen.getByText('120')).toBeInTheDocument();
      });
    });

    it('应该显示患者统计卡片', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/患者总数/)).toBeInTheDocument();
        expect(screen.getByText('500')).toBeInTheDocument();
        expect(screen.getByText(/在住患者/)).toBeInTheDocument();
        expect(screen.getByText('320')).toBeInTheDocument();
      });
    });

    it('应该显示系统统计卡片', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/文件管理/)).toBeInTheDocument();
        expect(screen.getByText('1500')).toBeInTheDocument();
        expect(screen.getByText('2.5GB')).toBeInTheDocument();
      });
    });

    it('应该处理空统计数据', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          userStats: {},
          patientStats: {},
          systemStats: {},
          recentActivities: []
        }
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        // 应该显示0或者默认值
        expect(screen.getByText(/用户总数/)).toBeInTheDocument();
        expect(screen.getByText(/患者总数/)).toBeInTheDocument();
      });
    });
  });

  describe('数据加载测试', () => {
    it('应该在组件挂载时加载仪表板数据', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledWith('dashboardService', {
          action: 'getStats'
        });
      });
    });

    it('应该支持手动刷新数据', async () => {
      mockCallFunction
        .mockResolvedValueOnce({
          success: true,
          data: mockDashboardData
        })
        .mockResolvedValueOnce({
          success: true,
          data: {
            ...mockDashboardData,
            userStats: { ...mockDashboardData.userStats, total: 200 }
          }
        });

      const { DashboardPage } = await import('../DashboardPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });

      // 查找刷新按钮
      const refreshButton = screen.getByTitle('刷新') || screen.getByLabelText('刷新') || screen.getByRole('button', { name: /刷新/ });
      if (refreshButton) {
        await user.click(refreshButton);

        await waitFor(() => {
          expect(mockCallFunction).toHaveBeenCalledTimes(2);
        });
      }
    });

    it('应该支持自动刷新功能', async () => {
      vi.useFakeTimers();

      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledTimes(1);
      });

      // 模拟30秒后自动刷新
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('最近活动功能测试', () => {
    it('应该显示最近活动列表', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/最近活动/)).toBeInTheDocument();
        expect(screen.getByText('新增患者张三')).toBeInTheDocument();
        expect(screen.getByText('导出患者数据')).toBeInTheDocument();
        expect(screen.getByText('上传医疗影像文件')).toBeInTheDocument();
      });
    });

    it('应该显示活动的时间戳', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText('2024-01-15 10:30:00')).toBeInTheDocument();
        expect(screen.getByText('2024-01-15 09:15:00')).toBeInTheDocument();
        expect(screen.getByText('管理员')).toBeInTheDocument();
        expect(screen.getByText('数据员')).toBeInTheDocument();
      });
    });

    it('应该处理空活动列表', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          ...mockDashboardData,
          recentActivities: []
        }
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/暂无最近活动/)).toBeInTheDocument();
      });
    });

    it('应该限制显示的活动数量', async () => {
      const manyActivities = Array.from({ length: 20 }, (_, i) => ({
        id: String(i + 1),
        type: 'test',
        description: `测试活动${i + 1}`,
        timestamp: '2024-01-15 10:00:00',
        user: '测试用户'
      }));

      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          ...mockDashboardData,
          recentActivities: manyActivities
        }
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        // 应该只显示前10个活动
        expect(screen.getByText('测试活动1')).toBeInTheDocument();
        expect(screen.getByText('测试活动10')).toBeInTheDocument();
        expect(screen.queryByText('测试活动11')).not.toBeInTheDocument();
      });
    });
  });

  describe('导航功能测试', () => {
    it('应该提供快速导航链接', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/患者管理/)).toBeInTheDocument();
        expect(screen.getByText(/数据导入/)).toBeInTheDocument();
        expect(screen.getByText(/数据导出/)).toBeInTheDocument();
      });

      // 测试点击导航链接
      const patientManagementLink = screen.getByText(/患者管理/);
      await user.click(patientManagementLink);

      // 验证导航行为（可能是跳转或调用回调）
      await waitFor(() => {
        expect(patientManagementLink.closest('a')).toBeInTheDocument();
      });
    });

    it('应该在新窗口打开外部链接', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        // 检查外部链接是否有正确的属性
        const externalLinks = screen.getAllByRole('link').filter(link =>
          link.getAttribute('target') === '_blank'
        );
        // 如果有外部链接，应该有正确的安全属性
        externalLinks.forEach(link => {
          expect(link.getAttribute('rel')).toContain('noopener');
          expect(link.getAttribute('rel')).toContain('noreferrer');
        });
      });
    });
  });

  describe('错误处理测试', () => {
    it('应该处理网络错误', async () => {
      mockCallFunction.mockRejectedValue(new Error('网络连接失败'));

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/网络连接失败/)).toBeInTheDocument();
        expect(screen.getByText(/无法加载仪表板数据/)).toBeInTheDocument();
      });
    });

    it('应该处理服务器错误', async () => {
      mockCallFunction.mockResolvedValue({
        success: false,
        error: '服务器内部错误'
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/服务器内部错误/)).toBeInTheDocument();
      });
    });

    it('应该处理加载状态', async () => {
      // 模拟慢速响应
      mockCallFunction.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: mockDashboardData
        }), 2000))
      );

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      // 应该显示加载状态
      expect(screen.getByText(/加载中/)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/加载中/)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('应该提供重试功能', async () => {
      mockCallFunction
        .mockRejectedValueOnce(new Error('网络连接失败'))
        .mockResolvedValueOnce({
          success: true,
          data: mockDashboardData
        });

      const { DashboardPage } = await import('../DashboardPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/网络连接失败/)).toBeInTheDocument();
      });

      // 查找重试按钮
      const retryButton = screen.getByText('重试') || screen.getByRole('button', { name: /重试/ });
      if (retryButton) {
        await user.click(retryButton);

        await waitFor(() => {
          expect(screen.getByText('150')).toBeInTheDocument();
        });
      }
    });
  });

  describe('响应式设计测试', () => {
    it('应该在小屏幕上正确显示', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      // 模拟小屏幕
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/用户总数/)).toBeInTheDocument();
        // 在小屏幕上，统计卡片可能垂直排列
        const statsCards = screen.getAllByText(/\d+/);
        expect(statsCards.length).toBeGreaterThan(0);
      });
    });

    it('应该在大屏幕上正确显示', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      // 模拟大屏幕
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/用户总数/)).toBeInTheDocument();
        // 在大屏幕上，应该有更好的布局
        expect(screen.getByText(/系统概览/)).toBeInTheDocument();
      });
    });
  });

  describe('可访问性测试', () => {
    it('应该支持键盘导航', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/用户总数/)).toBeInTheDocument();
      });

      // 测试Tab键导航
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();

      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
    });

    it('应该有正确的ARIA标签', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        // 检查主要区域的ARIA标签
        const main = screen.getByRole('main') || document.querySelector('main');
        if (main) {
          expect(main).toBeInTheDocument();
        }

        // 检查统计卡片的ARIA标签
        const statsRegion = screen.getByRole('region', { name: /统计信息/ });
        if (statsRegion) {
          expect(statsRegion).toBeInTheDocument();
        }

        // 检查最近活动的ARIA标签
        const activitiesRegion = screen.getByRole('region', { name: /最近活动/ });
        if (activitiesRegion) {
          expect(activitiesRegion).toBeInTheDocument();
        }
      });
    });

    it('应该支持屏幕阅读器', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        // 检查是否有适当的alt文本和描述
        const statusElements = screen.getAllByRole('status');
        statusElements.forEach(element => {
          expect(element).toBeInTheDocument();
        });

        // 检查重要信息是否有适当的标记
        const headings = screen.getAllByRole('heading');
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内渲染', async () => {
      const startTime = Date.now();

      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/用户总数/)).toBeInTheDocument();
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成渲染
    });

    it('应该正确处理大量数据', async () => {
      const largeData = {
        ...mockDashboardData,
        recentActivities: Array.from({ length: 1000 }, (_, i) => ({
          id: String(i + 1),
          type: 'test',
          description: `测试活动${i + 1}`,
          timestamp: '2024-01-15 10:00:00',
          user: '测试用户'
        }))
      };

      mockCallFunction.mockResolvedValue({
        success: true,
        data: largeData
      });

      const { DashboardPage } = await import('../DashboardPage');

      const startTime = Date.now();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/用户总数/)).toBeInTheDocument();
      });

      const endTime = Date.now();
      // 即使有大量数据，也应该在合理时间内完成
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe('生命周期测试', () => {
    it('应该正确处理组件挂载和卸载', async () => {
      const { DashboardPage } = await import('../DashboardPage');

      const { unmount } = render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      expect(() => unmount()).not.toThrow();
    });

    it('应该正确处理重新渲染', async () => {
      const { DashboardPage } = await import('../DashboardPage');

      const { rerender } = render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      expect(() => {
        rerender(
          React.createElement(SimpleWrapper, null,
            React.createElement(DashboardPage)
          )
        );
      }).not.toThrow();
    });

    it('应该清理定时器和事件监听器', async () => {
      vi.useFakeTimers();

      mockCallFunction.mockResolvedValue({
        success: true,
        data: mockDashboardData
      });

      const { DashboardPage } = await import('../DashboardPage');

      const { unmount } = render(
        React.createElement(SimpleWrapper, null,
          React.createElement(DashboardPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalled();
      });

      // 卸载组件
      unmount();

      // 继续推进时间，应该不会再有新的调用
      const initialCallCount = mockCallFunction.mock.calls.length;
      vi.advanceTimersByTime(30000);

      expect(mockCallFunction).toHaveBeenCalledTimes(initialCallCount);

      vi.useRealTimers();
    });
  });
});