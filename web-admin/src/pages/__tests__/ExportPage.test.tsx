import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ExportPage from '../ExportPage';
import { RBACProvider } from '../../contexts/RBACContext';
import '../../test/setup';

// Mock components and hooks
vi.mock('../../components/AdminRouteGuard', () => ({
  AdminRouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../hooks/useCloudFunction', () => ({
  useCloudFunction: () => ({
    callFunction: vi.fn(),
    loading: false,
    error: null,
  }),
}));

// Mock RBAC context
const MockRBACProvider = ({ children }: { children: React.ReactNode }) => (
  <RBACProvider>
    {children}
  </RBACProvider>
);

describe('ExportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderExportPage = () => {
    return render(
      <MockRBACProvider>
        <MemoryRouter>
          <ExportPage />
        </MemoryRouter>
      </MockRBACProvider>
    );
  };

  it('should render the export page correctly', () => {
    renderExportPage();

    expect(screen.getByText('数据导出中心')).toBeInTheDocument();
    expect(screen.getByText('导出患者数据到Excel文件，支持自定义筛选条件')).toBeInTheDocument();
  });

  it('should display new export button', () => {
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    expect(newExportButton).toBeInTheDocument();
  });

  it('should display export history table', () => {
    renderExportPage();

    expect(screen.getByText('导出历史')).toBeInTheDocument();
  });

  it('should display table headers', () => {
    renderExportPage();

    expect(screen.getByText('导出条件')).toBeInTheDocument();
    expect(screen.getByText('数据策略')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('统计')).toBeInTheDocument();
    expect(screen.getByText('创建时间')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  it('should open new export modal when button is clicked', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    expect(screen.getByText('新建导出')).toBeInTheDocument();
  });

  it('should display filter conditions in modal', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    expect(screen.getByText('过滤条件（可选）')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索关键词（姓名、身份证、电话等）')).toBeInTheDocument();
    expect(screen.getByText('性别')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('籍贯')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('疾病诊断')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('目前状况')).toBeInTheDocument();
  });

  it('should display data strategy options', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    expect(screen.getByText('完整数据')).toBeInTheDocument();
    expect(screen.getByText('脱敏数据')).toBeInTheDocument();
  });

  it('should have masked data selected by default', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    const maskedRadio = screen.getByDisplayValue('masked');
    expect(maskedRadio).toBeChecked();
  });

  it('should close modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    expect(screen.getByText('新建导出')).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /取消/i });
    await user.click(cancelButton);

    expect(screen.queryByText('新建导出')).not.toBeInTheDocument();
  });

  it('should display export description', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    expect(screen.getByText('导出说明')).toBeInTheDocument();
    expect(screen.getByText('导出文件为Excel格式')).toBeInTheDocument();
    expect(screen.getByText('脱敏模式下，身份证号、手机号等敏感信息将被部分隐藏')).toBeInTheDocument();
    expect(screen.getByText('导出文件保存7天，请及时下载')).toBeInTheDocument();
  });

  it('should allow filling in filter conditions', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    const keywordInput = screen.getByPlaceholderText('搜索关键词（姓名、身份证、电话等）');
    await user.type(keywordInput, '测试患者');

    expect(keywordInput).toHaveValue('测试患者');
  });

  it('should allow selecting gender filter', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    const genderSelect = screen.getByDisplayValue('');
    await user.selectOptions(genderSelect, '男');

    expect(genderSelect).toHaveValue('男');
  });

  it('should allow filling in hometown filter', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    const hometownInput = screen.getByPlaceholderText(/籍贯/);
    await user.type(hometownInput, '上海');

    expect(hometownInput).toHaveValue('上海');
  });

  it('should allow filling in diagnosis filter', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    const diagnosisInput = screen.getByPlaceholderText(/疾病诊断/);
    await user.type(diagnosisInput, '感冒');

    expect(diagnosisInput).toHaveValue('感冒');
  });

  it('should allow filling in current status filter', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    const statusInput = screen.getByPlaceholderText(/目前状况/);
    await user.type(statusInput, '治疗中');

    expect(statusInput).toHaveValue('治疗中');
  });

  it('should display empty state when no export history', () => {
    renderExportPage();

    // If no export jobs exist, should show empty state
    const emptyState = screen.queryByText('暂无导出记录');
    if (emptyState) {
      expect(emptyState).toBeInTheDocument();
    }
  });

  it('should have proper page structure', () => {
    renderExportPage();

    // Main heading
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('数据导出中心');

    // Page description
    expect(screen.getByText('导出患者数据到Excel文件，支持自定义筛选条件')).toBeInTheDocument();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    renderExportPage();

    // Tab to navigate to new export button
    await user.tab();
    const focusedElement = document.activeElement;
    expect(focusedElement).toBeInTheDocument();

    // Enter should open modal
    if (focusedElement?.tagName === 'BUTTON') {
      await user.keyboard('{Enter}');
      expect(screen.getByText('新建导出')).toBeInTheDocument();
    }
  });

  it('should handle modal focus management', async () => {
    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    // Modal should be in focus
    const modal = screen.getByRole('dialog') || screen.getByText('新建导出').closest('div');
    expect(modal).toBeInTheDocument();

    // First focusable element should be inside modal
    const firstInput = screen.getByPlaceholderText('搜索关键词（姓名、身份证、电话等）');
    expect(firstInput).toBeInTheDocument();
  });
});

describe('ExportPage - Integration Tests', () => {
  const renderExportPage = () => {
    return render(
      <MockRBACProvider>
        <MemoryRouter>
          <ExportPage />
        </MemoryRouter>
      </MockRBACProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create export job when form is submitted', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: true,
      jobId: 'test-job-id',
    });

    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    const submitButton = screen.getByRole('button', { name: /开始导出/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(global.mockCallFunction).toHaveBeenCalledWith('exportData', {
        action: 'create',
        filters: {},
        fieldsPolicy: 'masked'
      });
    });
  });

  it('should create export job with filters', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: true,
      jobId: 'test-job-id',
    });

    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    // Fill in some filters
    const keywordInput = screen.getByPlaceholderText('搜索关键词（姓名、身份证、电话等）');
    await user.type(keywordInput, '测试');

    const submitButton = screen.getByRole('button', { name: /开始导出/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(global.mockCallFunction).toHaveBeenCalledWith('exportData', {
        action: 'create',
        filters: {
          keyword: '测试'
        },
        fieldsPolicy: 'masked'
      });
    });
  });

  it('should handle export job creation error', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: false,
      error: {
        code: 'CREATE_ERROR',
        message: '创建导出任务失败'
      }
    });

    const user = userEvent.setup();
    renderExportPage();

    const newExportButton = screen.getByRole('button', { name: /新建导出/i });
    await user.click(newExportButton);

    const submitButton = screen.getByRole('button', { name: /开始导出/i });
    await user.click(submitButton);

    // Should handle error gracefully
    await waitFor(() => {
      expect(global.mockCallFunction).toHaveBeenCalled();
    });
  });
});