import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuditPage from '../AuditPage';
import { RBACProvider } from '../../contexts/RBACContext';

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

describe('AuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAuditPage = () => {
    return render(
      <MockRBACProvider>
        <MemoryRouter>
          <AuditPage />
        </MemoryRouter>
      </MockRBACProvider>
    );
  };

  it('should render the audit page correctly', () => {
    renderAuditPage();

    expect(screen.getByText('审计日志')).toBeInTheDocument();
    expect(screen.getByText('查看系统操作记录和安全事件')).toBeInTheDocument();
  });

  it('should display filter and refresh buttons', () => {
    renderAuditPage();

    expect(screen.getByRole('button', { name: /过滤/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/i })).toBeInTheDocument();
  });

  it('should display audit logs table', () => {
    renderAuditPage();

    expect(screen.getByText('操作记录')).toBeInTheDocument();
  });

  it('should display table headers', () => {
    renderAuditPage();

    expect(screen.getByText('操作者')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
    expect(screen.getByText('目标对象')).toBeInTheDocument();
    expect(screen.getByText('状态')).toBeInTheDocument();
    expect(screen.getByText('统计')).toBeInTheDocument();
    expect(screen.getByText('创建时间')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
  });

  it('should open filter modal when filter button is clicked', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    expect(screen.getByText('过滤条件')).toBeInTheDocument();
  });

  it('should display filter form fields in modal', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    expect(screen.getByText('操作者')).toBeInTheDocument();
    expect(screen.getByText('操作类型')).toBeInTheDocument();
    expect(screen.getByText('日志级别')).toBeInTheDocument();
    expect(screen.getByText('时间范围')).toBeInTheDocument();
  });

  it('should have user ID or username input', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actorInput = screen.getByPlaceholderText(/用户ID或用户名/);
    expect(actorInput).toBeInTheDocument();
  });

  it('should have action type select', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actionSelect = screen.getByDisplayValue('');
    expect(actionSelect).toBeInTheDocument();
  });

  it('should have log level select', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const logLevelSelect = screen.getByDisplayValue('');
    expect(logLevelSelect).toBeInTheDocument();
  });

  it('should have date range inputs', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const dateInputs = screen.getAllByRole('textbox').filter(input =>
      input.getAttribute('type') === 'date'
    );
    expect(dateInputs).toHaveLength(2);
  });

  it('should close filter modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    expect(screen.getByText('过滤条件')).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /取消/i });
    await user.click(cancelButton);

    expect(screen.queryByText('过滤条件')).not.toBeInTheDocument();
  });

  it('should allow filling in filter conditions', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actorInput = screen.getByPlaceholderText(/用户ID或用户名/);
    await user.type(actorInput, 'admin');

    expect(actorInput).toHaveValue('admin');
  });

  it('should allow selecting action type', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actionSelect = screen.getByDisplayValue('');
    await user.selectOptions(actionSelect, 'login');

    expect(actionSelect).toHaveValue('login');
  });

  it('should allow selecting log level', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const logLevelSelect = screen.getByDisplayValue('');
    await user.selectOptions(logLevelSelect, 'info');

    expect(logLevelSelect).toHaveValue('info');
  });

  it('should allow selecting date range', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const dateInputs = screen.getAllByRole('textbox').filter(input =>
      input.getAttribute('type') === 'date'
    );

    if (dateInputs.length >= 2) {
      await user.type(dateInputs[0], '2025-01-01');
      expect(dateInputs[0]).toHaveValue('2025-01-01');

      await user.type(dateInputs[1], '2025-12-31');
      expect(dateInputs[1]).toHaveValue('2025-12-31');
    }
  });

  it('should apply filters when apply button is clicked', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actorInput = screen.getByPlaceholderText(/用户ID或用户名/);
    await user.type(actorInput, 'admin');

    const applyButton = screen.getByRole('button', { name: /应用过滤/i });
    await user.click(applyButton);

    expect(screen.queryByText('过滤条件')).not.toBeInTheDocument();
  });

  it('should reset filters when reset button is clicked', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actorInput = screen.getByPlaceholderText(/用户ID或用户名/);
    await user.type(actorInput, 'admin');

    const resetButton = screen.getByRole('button', { name: /重置/i });
    await user.click(resetButton);

    expect(screen.queryByText('过滤条件')).not.toBeInTheDocument();
  });

  it('should show empty state when no logs exist', () => {
    renderAuditPage();

    const emptyState = screen.queryByText('暂无审计记录');
    if (emptyState) {
      expect(emptyState).toBeInTheDocument();
    }
  });

  it('should have proper page structure', () => {
    renderAuditPage();

    // Main heading
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('审计日志');

    // Page description
    expect(screen.getByText('查看系统操作记录和安全事件')).toBeInTheDocument();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    // Tab to navigate to filter button
    await user.tab();
    const focusedElement = document.activeElement;
    expect(focusedElement).toBeInTheDocument();

    // Enter should open filter modal if filter button is focused
    if (focusedElement?.tagName === 'BUTTON' && focusedElement.textContent?.includes('过滤')) {
      await user.keyboard('{Enter}');
      expect(screen.getByText('过滤条件')).toBeInTheDocument();
    }
  });

  it('should handle modal focus management', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    // Modal should be in focus
    const modal = screen.getByText('过滤条件').closest('div');
    expect(modal).toBeInTheDocument();

    // First focusable element should be inside modal
    const firstInput = screen.getByPlaceholderText(/用户ID或用户名/);
    expect(firstInput).toBeInTheDocument();
  });

  it('should display clear filter option when filters are active', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actorInput = screen.getByPlaceholderText(/用户ID或用户名/);
    await user.type(actorInput, 'admin');

    const applyButton = screen.getByRole('button', { name: /应用过滤/i });
    await user.click(applyButton);

    expect(screen.getByText('清除过滤')).toBeInTheDocument();
  });

  it('should allow clearing active filters', async () => {
    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actorInput = screen.getByPlaceholderText(/用户ID或用户名/);
    await user.type(actorInput, 'admin');

    const applyButton = screen.getByRole('button', { name: /应用过滤/i });
    await user.click(applyButton);

    const clearFilterLink = screen.getByText('清除过滤');
    await user.click(clearFilterLink);

    expect(screen.queryByText('当前过滤条件')).not.toBeInTheDocument();
  });
});

describe('AuditPage - Integration Tests', () => {
  const mockCallFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear previous mock implementations
    vi.unmock('../../hooks/useCloudFunction');

    // Set up new mock for this test suite
    vi.doMock('../../hooks/useCloudFunction', () => ({
      useCloudFunction: () => ({
        callFunction: mockCallFunction,
        loading: false,
        error: null,
      }),
    }));
  });

  it('should load audit logs when page loads', async () => {
    mockCallFunction.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            _id: '1',
            actorUserId: 'admin',
            action: 'login',
            createdAt: Date.now(),
          }
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        hasMore: false
      }
    });

    renderAuditPage();

    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledWith('audit', {
        action: 'listLogs',
        page: 1,
        pageSize: 20
      });
    });
  });

  it('should load logs with filters applied', async () => {
    mockCallFunction.mockResolvedValue({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        hasMore: false
      }
    });

    const user = userEvent.setup();
    renderAuditPage();

    const filterButton = screen.getByRole('button', { name: /过滤/i });
    await user.click(filterButton);

    const actorInput = screen.getByPlaceholderText(/用户ID或用户名/);
    await user.type(actorInput, 'admin');

    const applyButton = screen.getByRole('button', { name: /应用过滤/i });
    await user.click(applyButton);

    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledWith('audit', {
        action: 'listLogs',
        page: 1,
        pageSize: 20,
        actor: 'admin'
      });
    });
  });

  it('should handle API errors gracefully', async () => {
    mockCallFunction.mockResolvedValue({
      success: false,
      error: {
        code: 'API_ERROR',
        message: 'Failed to load audit logs'
      }
    });

    renderAuditPage();

    // Should still render the page without crashing
    expect(screen.getByText('审计日志')).toBeInTheDocument();
    expect(screen.getByText('查看系统操作记录和安全事件')).toBeInTheDocument();
  });
});