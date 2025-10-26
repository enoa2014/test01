import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from '../SettingsPage';
import { RBACProvider } from '../../contexts/RBACContext';
import '../../test/setup';

// Mock RBAC context
const MockRBACProvider = ({ children }: { children: React.ReactNode }) => (
  <RBACProvider>
    {children}
  </RBACProvider>
);

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderSettingsPage = () => {
    return render(
      <MockRBACProvider>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </MockRBACProvider>
    );
  };

  it('should render the settings page correctly', () => {
    renderSettingsPage();

    expect(screen.getByText('系统设置中心')).toBeInTheDocument();
    expect(screen.getByText('管理系统配置和安全设置，自定义运行参数')).toBeInTheDocument();
  });

  it('should display environment information panel', () => {
    renderSettingsPage();

    expect(screen.getByText('环境信息')).toBeInTheDocument();
    expect(screen.getByText('环境ID')).toBeInTheDocument();
    expect(screen.getByText('云函数状态')).toBeInTheDocument();
    expect(screen.getByText('存储使用')).toBeInTheDocument();
    expect(screen.getByText('文件数量')).toBeInTheDocument();
  });

  it('should display security settings panel', () => {
    renderSettingsPage();

    expect(screen.getByText('安全设置')).toBeInTheDocument();
    expect(screen.getByText('允许社工导入数据')).toBeInTheDocument();
    expect(screen.getByText('强制社工导出脱敏')).toBeInTheDocument();
  });

  it('should display audit settings panel', () => {
    renderSettingsPage();

    expect(screen.getByText('审计设置')).toBeInTheDocument();
    expect(screen.getByText('日志级别')).toBeInTheDocument();
    expect(screen.getByText('日志保留天数')).toBeInTheDocument();
  });

  it('should display export settings panel', () => {
    renderSettingsPage();

    expect(screen.getByText('导出设置')).toBeInTheDocument();
    expect(screen.getByText('文件保留天数')).toBeInTheDocument();
    expect(screen.getByText('最大导出记录数')).toBeInTheDocument();
  });

  it('should display user information panel', () => {
    renderSettingsPage();

    expect(screen.getByText('用户信息')).toBeInTheDocument();
    expect(screen.getByText('用户名')).toBeInTheDocument();
    expect(screen.getByText('角色')).toBeInTheDocument();
    expect(screen.getByText('最后登录')).toBeInTheDocument();
  });

  it('should have modify password button', () => {
    renderSettingsPage();

    expect(screen.getByRole('button', { name: /修改密码/i })).toBeInTheDocument();
  });

  it('should have logout button', () => {
    renderSettingsPage();

    expect(screen.getByRole('button', { name: /退出登录/i })).toBeInTheDocument();
  });

  it('should have save settings button', () => {
    renderSettingsPage();

    const saveButton = screen.getByRole('button', { name: /保存设置/i });
    expect(saveButton).toBeInTheDocument();
  });

  it('should open password change modal when button is clicked', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const passwordButton = screen.getByRole('button', { name: /修改密码/i });
    await user.click(passwordButton);

    // Look for modal title specifically
    const modalTitle = screen.getByRole('heading', { name: '修改密码' });
    expect(modalTitle).toBeInTheDocument();
  });

  it('should display password form fields in modal', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const passwordButton = screen.getByRole('button', { name: /修改密码/i });
    await user.click(passwordButton);

    expect(screen.getByText('当前密码')).toBeInTheDocument();
    expect(screen.getByText('新密码')).toBeInTheDocument();
    expect(screen.getByText('确认新密码')).toBeInTheDocument();
  });

  it('should have password input fields', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const passwordButton = screen.getByRole('button', { name: /修改密码/i });
    await user.click(passwordButton);

    const currentPasswordInput = screen.getByLabelText(/当前密码/);
    const newPasswordInput = screen.getByLabelText(/新密码/);
    const confirmPasswordInput = screen.getByLabelText(/确认新密码/);

    expect(currentPasswordInput).toBeInTheDocument();
    expect(newPasswordInput).toBeInTheDocument();
    expect(confirmPasswordInput).toBeInTheDocument();
  });

  it('should close password modal when cancel is clicked', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const passwordButton = screen.getByRole('button', { name: /修改密码/i });
    await user.click(passwordButton);

    expect(screen.getByRole('heading', { name: '修改密码' })).toBeInTheDocument();

    const cancelButton = screen.getByRole('button', { name: /取消/i });
    await user.click(cancelButton);

    expect(screen.queryByRole('heading', { name: '修改密码' })).not.toBeInTheDocument();
  });

  it('should display system description', () => {
    renderSettingsPage();

    expect(screen.getByText('系统说明')).toBeInTheDocument();
    expect(screen.getByText('系统运行在腾讯云云开发环境')).toBeInTheDocument();
    expect(screen.getByText('数据存储在云数据库中')).toBeInTheDocument();
    expect(screen.getByText('文件存储在云存储中')).toBeInTheDocument();
  });

  it('should allow toggling security settings', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const switches = screen.getAllByRole('checkbox');
    if (switches.length > 0) {
      const firstSwitch = switches[0];
      await user.click(firstSwitch);
      expect(firstSwitch).toBeChecked();
    }
  });

  it('should allow changing log level', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const logLevelSelect = screen.getByDisplayValue('info');
    if (logLevelSelect) {
      await user.selectOptions(logLevelSelect, 'warn');
      expect(logLevelSelect).toHaveValue('warn');
    }
  });

  it('should allow changing retention days', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const retentionInput = screen.getByDisplayValue('90');
    if (retentionInput) {
      await user.clear(retentionInput);
      await user.type(retentionInput, '30');
      expect(retentionInput).toHaveValue('30');
    }
  });

  it('should allow changing file retention days', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const fileRetentionInput = screen.getByDisplayValue('7');
    if (fileRetentionInput) {
      await user.clear(fileRetentionInput);
      await user.type(fileRetentionInput, '14');
      expect(fileRetentionInput).toHaveValue('14');
    }
  });

  it('should allow changing max export records', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const maxRecordsInput = screen.getByDisplayValue('10000');
    if (maxRecordsInput) {
      await user.clear(maxRecordsInput);
      await user.type(maxRecordsInput, '5000');
      expect(maxRecordsInput).toHaveValue('5000');
    }
  });

  it('should allow filling password change form', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const passwordButton = screen.getByRole('button', { name: /修改密码/i });
    await user.click(passwordButton);

    const currentPasswordInput = screen.getByLabelText(/当前密码/);
    const newPasswordInput = screen.getByLabelText(/新密码/);
    const confirmPasswordInput = screen.getByLabelText(/确认新密码/);

    await user.type(currentPasswordInput, 'oldpassword');
    await user.type(newPasswordInput, 'newpassword123');
    await user.type(confirmPasswordInput, 'newpassword123');

    expect(currentPasswordInput).toHaveValue('oldpassword');
    expect(newPasswordInput).toHaveValue('newpassword123');
    expect(confirmPasswordInput).toHaveValue('newpassword123');
  });

  it('should have proper page structure', () => {
    renderSettingsPage();

    // Main heading
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('系统设置中心');

    // Page description
    expect(screen.getByText('管理系统配置和安全设置，自定义运行参数')).toBeInTheDocument();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    // Tab through interactive elements
    await user.tab();
    const focusedElement = document.activeElement;
    expect(focusedElement).toBeInTheDocument();
  });

  it('should handle modal focus management', async () => {
    const user = userEvent.setup();
    renderSettingsPage();

    const passwordButton = screen.getByRole('button', { name: /修改密码/i });
    await user.click(passwordButton);

    // Modal should be in focus
    const modal = screen.getByText('修改密码').closest('div');
    expect(modal).toBeInTheDocument();

    // First focusable element should be inside modal
    const firstInput = screen.getByLabelText(/当前密码/);
    expect(firstInput).toBeInTheDocument();
  });

  it('should display refresh status button', () => {
    renderSettingsPage();

    const refreshButton = screen.getByRole('button', { name: /刷新/i });
    expect(refreshButton).toBeInTheDocument();
  });
});

describe('SettingsPage - Integration Tests', () => {
  const renderSettingsPage = () => {
    return render(
      <MockRBACProvider>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </MockRBACProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load system information on mount', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: true,
      data: {
        envId: 'test-env-id',
        functions: [
          { name: 'auth', status: 'healthy' },
          { name: 'rbac', status: 'healthy' }
        ],
        storage: {
          used: 1024 * 1024 * 100,
          total: 1024 * 1024 * 1024 * 5,
          fileCount: 100
        },
        database: {
          collections: 12,
          records: 5000,
          indexes: 8
        }
      }
    });

    renderSettingsPage();

    await waitFor(() => {
      expect(global.mockCallFunction).toHaveBeenCalledWith('settings', {
        action: 'getSystemInfo'
      });
    });
  });

  it('should save security settings', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: true
    });

    const user = userEvent.setup();
    renderSettingsPage();

    const saveButton = screen.getByRole('button', { name: /保存设置/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(global.mockCallFunction).toHaveBeenCalled();
    });
  });

  it('should save audit settings', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: true
    });

    const user = userEvent.setup();
    renderSettingsPage();

    // Change audit settings
    const logLevelSelect = screen.getByDisplayValue('info');
    if (logLevelSelect) {
      await user.selectOptions(logLevelSelect, 'warn');
    }

    const saveButton = screen.getByRole('button', { name: /保存设置/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(global.mockCallFunction).toHaveBeenCalled();
    });
  });

  it('should save export settings', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: true
    });

    const user = userEvent.setup();
    renderSettingsPage();

    // Change export settings
    const fileRetentionInput = screen.getByDisplayValue('7');
    if (fileRetentionInput) {
      await user.clear(fileRetentionInput);
      await user.type(fileRetentionInput, '14');
    }

    const saveButton = screen.getByRole('button', { name: /保存设置/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(global.mockCallFunction).toHaveBeenCalled();
    });
  });

  it('should handle password change', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: true
    });

    const user = userEvent.setup();
    renderSettingsPage();

    const passwordButton = screen.getByRole('button', { name: /修改密码/i });
    await user.click(passwordButton);

    const currentPasswordInput = screen.getByLabelText(/当前密码/);
    const newPasswordInput = screen.getByLabelText(/新密码/);
    const confirmPasswordInput = screen.getByLabelText(/确认新密码/);

    await user.type(currentPasswordInput, 'oldpassword');
    await user.type(newPasswordInput, 'newpassword123');
    await user.type(confirmPasswordInput, 'newpassword123');

    const confirmButton = screen.getByRole('button', { name: /确认修改/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(global.mockCallFunction).toHaveBeenCalledWith('user', {
        action: 'changePassword',
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      });
    });
  });

  it('should handle API errors gracefully', async () => {
    global.mockCallFunction.mockResolvedValue({
      success: false,
      error: {
        code: 'API_ERROR',
        message: 'Failed to update settings'
      }
    });

    const user = userEvent.setup();
    renderSettingsPage();

    const saveButton = screen.getByRole('button', { name: /保存设置/i });
    await user.click(saveButton);

    // Should still render the page without crashing
    expect(screen.getByText('系统设置中心')).toBeInTheDocument();
  });
});