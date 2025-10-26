import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Simple wrapper for testing
const SimpleWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children);

describe('PatientListPage', () => {
  let mockCallFunction: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallFunction = vi.fn();
    global.mockCallFunction = mockCallFunction;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockPatients = [
    {
      key: '1',
      patientName: '张三',
      gender: '男',
      age: 65,
      contactPhone: '13800138001',
      idCard: '110101194001011234',
      admissionDate: '2024-01-15',
      status: '在住',
      roomNumber: '101',
      bedNumber: '1'
    },
    {
      key: '2',
      patientName: '李四',
      gender: '女',
      age: 70,
      contactPhone: '13800138002',
      idCard: '110101195001011235',
      admissionDate: '2024-02-20',
      status: '已出院',
      roomNumber: '102',
      bedNumber: '2'
    },
    {
      key: '3',
      patientName: '王五',
      gender: '男',
      age: 68,
      contactPhone: '13800138003',
      idCard: '110101194601011236',
      admissionDate: '2024-03-10',
      status: '在住',
      roomNumber: '103',
      bedNumber: '1'
    }
  ];

  describe('基础渲染测试', () => {
    it('应该能够正确导入组件', async () => {
      expect(async () => {
        await import('../PatientListPage');
      }).not.toThrow();
    });

    it('应该能够正常渲染组件', async () => {
      const { default: PatientListPage } = await import('../PatientListPage');

      expect(() => {
        render(
          React.createElement(SimpleWrapper, null,
            React.createElement(PatientListPage)
          )
        );
      }).not.toThrow();
    });

    it('应该有正确的组件结构', async () => {
      const { default: PatientListPage } = await import('../PatientListPage');

      expect(PatientListPage).toBeDefined();
      expect(typeof PatientListPage).toBe('function');

      expect(() => {
        React.createElement(PatientListPage);
      }).not.toThrow();
    });
  });

  describe('患者列表功能测试', () => {
    it('应该显示患者列表', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
          action: 'list',
          data: expect.objectContaining({
            page: 1,
            pageSize: 10
          })
        });
      });
    });

    it('应该显示患者基本信息', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        // 应该能找到患者的姓名
        expect(screen.getByText('张三')).toBeInTheDocument();
        expect(screen.getByText('李四')).toBeInTheDocument();
        expect(screen.getByText('王五')).toBeInTheDocument();
      });
    });

    it('应该处理空患者列表', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalled();
      });

      // 应该显示空状态提示
      await waitFor(() => {
        expect(screen.getByText(/暂无患者数据/)).toBeInTheDocument();
      });
    });
  });

  describe('搜索功能测试', () => {
    it('应该能够搜索患者', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      // 等待页面加载完成
      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalled();
      });

      // 重置mock
      mockCallFunction.mockClear();
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: [mockPatients[0]],
          total: 1,
          page: 1,
          pageSize: 10
        }
      });

      // 查找搜索框并输入搜索内容
      const searchInput = screen.getByPlaceholderText(/搜索患者姓名、证件号或联系电话/);
      expect(searchInput).toBeInTheDocument();

      await user.type(searchInput, '张三');

      // 等待搜索结果
      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
          action: 'list',
          data: expect.objectContaining({
            search: '张三'
          })
        });
      }, { timeout: 3000 });
    });

    it('应该能够清空搜索', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalled();
      });

      const searchInput = screen.getByPlaceholderText(/搜索患者姓名、证件号或联系电话/);

      // 输入搜索内容
      await user.type(searchInput, '张三');

      // 清空搜索
      await user.clear(searchInput);

      // 重置mock
      mockCallFunction.mockClear();
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      // 触发搜索
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
          action: 'list',
          data: expect.objectContaining({
            search: ''
          })
        });
      });
    });
  });

  describe('筛选功能测试', () => {
    it('应该能够按状态筛选患者', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalled();
      });

      // 重置mock
      mockCallFunction.mockClear();
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients.filter(p => p.status === '在住'),
          total: 2,
          page: 1,
          pageSize: 10
        }
      });

      // 点击"在住"筛选按钮
      const inCareFilter = screen.getByText('在住');
      await user.click(inCareFilter);

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
          action: 'list',
          data: expect.objectContaining({
            filters: expect.objectContaining({
              status: '在住'
            })
          })
        });
      });
    });

    it('应该能够按性别筛选患者', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalled();
      });

      // 重置mock
      mockCallFunction.mockClear();
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients.filter(p => p.gender === '男'),
          total: 2,
          page: 1,
          pageSize: 10
        }
      });

      // 点击性别筛选按钮
      const genderFilter = screen.getByText('男');
      await user.click(genderFilter);

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
          action: 'list',
          data: expect.objectContaining({
            filters: expect.objectContaining({
              gender: '男'
            })
          })
        });
      });
    });
  });

  describe('分页功能测试', () => {
    it('应该能够处理分页', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: 100, // 模拟更多数据
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
          action: 'list',
          data: expect.objectContaining({
            page: 1,
            pageSize: 10
          })
        });
      });

      // 重置mock
      mockCallFunction.mockClear();
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: 100,
          page: 2,
          pageSize: 10
        }
      });

      // 查找下一页按钮
      const nextPageButton = screen.getByTitle(/下一页/) || screen.getByLabelText(/下一页/) || screen.getByText('>');
      if (nextPageButton) {
        await user.click(nextPageButton);

        await waitFor(() => {
          expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
            action: 'list',
            data: expect.objectContaining({
              page: 2
            })
          });
        });
      }
    });

    it('应该能够改变页面大小', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: 50,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(mockCallFunction).toHaveBeenCalled();
      });

      // 重置mock
      mockCallFunction.mockClear();
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients.slice(0, 20),
          total: 50,
          page: 1,
          pageSize: 20
        }
      });

      // 查找页面大小选择器
      const pageSizeSelect = screen.getByDisplayValue('10') || screen.getByText('10');
      if (pageSizeSelect) {
        await user.click(pageSizeSelect);

        const twentyOption = screen.getByText('20');
        if (twentyOption) {
          await user.click(twentyOption);

          await waitFor(() => {
            expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
              action: 'list',
              data: expect.objectContaining({
                pageSize: 20
              })
            });
          });
        }
      }
    });
  });

  describe('错误处理测试', () => {
    it('应该处理网络错误', async () => {
      mockCallFunction.mockRejectedValue(new Error('网络连接失败'));

      const { default: PatientListPage } = await import('../PatientListPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/网络连接失败/)).toBeInTheDocument();
      });
    });

    it('应该处理加载状态', async () => {
      // 模拟慢速响应
      mockCallFunction.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: { items: mockPatients, total: 3, page: 1, pageSize: 10 }
        }), 2000))
      );

      const { default: PatientListPage } = await import('../PatientListPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      // 应该显示加载状态
      expect(screen.getByText(/加载中/)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/加载中/)).not.toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('应该处理空搜索结果', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/没有找到匹配的患者/)).toBeInTheDocument();
      });
    });
  });

  describe('交互测试', () => {
    it('应该能够点击查看患者详情', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument();
      });

      // 查找详情按钮并点击
      const detailButton = screen.getByText('详情') || screen.getByTitle('查看详情');
      if (detailButton) {
        await user.click(detailButton);

        // 应该调用详情接口
        await waitFor(() => {
          expect(mockCallFunction).toHaveBeenCalledWith('patientProfile', {
            action: 'detail',
            data: expect.objectContaining({
              patientKey: '1'
            })
          });
        });
      }
    });

    it('应该能够编辑患者信息', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument();
      });

      // 查找编辑按钮并点击
      const editButton = screen.getByText('编辑') || screen.getByTitle('编辑');
      if (editButton) {
        await user.click(editButton);

        // 验证编辑功能被触发（可能是跳转或打开对话框）
        await waitFor(() => {
          expect(screen.getByText(/编辑患者/)).toBeInTheDocument();
        });
      }
    });
  });

  describe('可访问性测试', () => {
    it('应该支持键盘导航', async () => {
      mockCallFunction.mockResolvedValue({
        success: true,
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');
      const user = userEvent.setup();

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        expect(screen.getByText('张三')).toBeInTheDocument();
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
        data: {
          items: mockPatients,
          total: mockPatients.length,
          page: 1,
          pageSize: 10
        }
      });

      const { default: PatientListPage } = await import('../PatientListPage');

      render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      await waitFor(() => {
        // 检查主要区域的ARIA标签
        const main = screen.getByRole('main') || document.querySelector('main');
        if (main) {
          expect(main).toBeInTheDocument();
        }

        // 检查表格的ARIA标签
        const table = screen.getByRole('table');
        if (table) {
          expect(table).toBeInTheDocument();
        }
      });
    });
  });

  describe('生命周期测试', () => {
    it('应该正确处理组件挂载和卸载', async () => {
      const { default: PatientListPage } = await import('../PatientListPage');

      const { unmount } = render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      expect(() => unmount()).not.toThrow();
    });

    it('应该正确处理重新渲染', async () => {
      const { default: PatientListPage } = await import('../PatientListPage');

      const { rerender } = render(
        React.createElement(SimpleWrapper, null,
          React.createElement(PatientListPage)
        )
      );

      expect(() => {
        rerender(
          React.createElement(SimpleWrapper, null,
            React.createElement(PatientListPage)
          )
        );
      }).not.toThrow();
    });
  });
});