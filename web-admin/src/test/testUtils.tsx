import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// 通用的测试组件Props
interface TestComponentProps {
  children?: React.ReactNode;
  [key: string]: any;
}

// 简化的测试包装器
const TestWrapper: React.FC<TestComponentProps> = ({ children }) => {
  return React.createElement(MemoryRouter, null, children);
};

// 增强的渲染函数，包含基础设置
const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: TestWrapper, ...options });
};

// 模拟组件创建器
const createMockComponent = (name: string, defaultProps: any = {}) => {
  return React.forwardRef<any, any>((props, ref) => {
    return React.createElement('div', {
      'data-testid': name.toLowerCase(),
      ref,
      ...defaultProps,
      ...props
    });
  });
};

// 等待异步操作的辅助函数
const waitForAsync = (ms: number = 0) => new Promise(resolve => setTimeout(resolve, ms));

// 模拟数据生成器
const generateMockData = {
  // 模拟用户数据
  user: (overrides: any = {}) => ({
    uid: 'test-user-123',
    role: 'admin',
    email: 'test@example.com',
    ...overrides
  }),

  // 模拟患者数据
  patient: (overrides: any = {}) => ({
    key: 'patient-1',
    patientName: '测试患者',
    gender: '男',
    birthDate: '1990-01-01',
    phone: '13800138000',
    careStatus: 'in_care',
    ...overrides
  }),

  // 模拟导入任务数据
  importJob: (overrides: any = {}) => ({
    _id: 'import-job-1',
    fileId: 'file-123',
    status: 'pending',
    createdAt: Date.now(),
    ...overrides
  }),

  // 模拟云函数响应
  cloudFunctionResponse: (data: any = null, error: any = null) => ({
    success: !error,
    result: data,
    error
  })
};

// 通用的测试断言辅助函数
const testUtils = {
  // 检查组件是否成功渲染
  expectComponentToRender: async (Component: React.ComponentType, props: any = {}) => {
    expect(() => {
      renderWithProviders(React.createElement(Component, props));
    }).not.toThrow();
  },

  // 检查元素是否存在
  expectElementToExist: (getByTestId: any, testId: string) => {
    const element = getByTestId(testId);
    expect(element).toBeInTheDocument();
  },

  // 模拟用户交互
  simulateUserInteraction: async (element: any, event: string = 'click') => {
    expect(element).toBeInTheDocument();
    await element.click();
  },

  // 等待元素出现
  waitForElement: async (getByTestId: any, testId: string, timeout: number = 5000) => {
    await new Promise(resolve => {
      const checkElement = () => {
        try {
          const element = getByTestId(testId);
          if (element) {
            resolve(element);
            return;
          }
        } catch (error) {
          // 元素还没找到，继续等待
        }
        setTimeout(checkElement, 100);
      };
      checkElement();
    });
  }
};

// 导出所有测试工具
export {
  TestWrapper,
  renderWithProviders,
  createMockComponent,
  waitForAsync,
  generateMockData,
  testUtils
};

// 重新导出testing-library的内容
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';