import React, { useState, useCallback, useEffect } from 'react';
import { useCloudFunction } from '../hooks/useCloudFunction';
import { useRBAC } from '../contexts/RBACContext';
import { useCloudbase } from '../hooks/useCloudbase';
import { AdminRouteGuard } from '../components/AdminRouteGuard';
import {
  Settings,
  Server,
  Shield,
  Database,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  User,
  LogOut,
  Save,
  Eye,
  EyeOff
} from 'lucide-react';

interface SystemInfo {
  envId: string;
  functions: Array<{
    name: string;
    status: 'healthy' | 'error';
    lastCheck: number;
  }>;
  storage: {
    used: number;
    total: number;
    fileCount: number;
  };
  database: {
    collections: number;
    records: number;
    indexes: number;
  };
}

interface SystemSettings {
  security: {
    allowWorkerImport: boolean;
    forceWorkerExportMasked: boolean;
  };
  audit: {
    logLevel: 'info' | 'warn' | 'error';
    retentionDays: number;
  };
  export: {
    fileRetentionDays: number;
    maxExportRecords: number;
  };
}

const SettingsPage: React.FC = () => {
  const { isAdmin, user: rbacUser } = useRBAC();
  const { logout } = useCloudbase();
  const { callFunction } = useCloudFunction();

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    security: {
      allowWorkerImport: false,
      forceWorkerExportMasked: true
    },
    audit: {
      logLevel: 'info',
      retentionDays: 90
    },
    export: {
      fileRetentionDays: 7,
      maxExportRecords: 10000
    }
  });
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // 加载系统信息
  const loadSystemInfo = useCallback(async () => {
    setIsLoadingInfo(true);
    try {
      // 这里应该调用实际的系统信息API，目前使用模拟数据
      const mockSystemInfo: SystemInfo = {
        envId: (import.meta as any)?.env?.VITE_TCB_ENV_ID || 'cloud1-6g2fzr5f7cf51e38',
        functions: [
          { name: 'auth', status: 'healthy', lastCheck: Date.now() },
          { name: 'rbac', status: 'healthy', lastCheck: Date.now() },
          { name: 'patientProfile', status: 'healthy', lastCheck: Date.now() },
          { name: 'importExcel', status: 'healthy', lastCheck: Date.now() },
          { name: 'exportData', status: 'healthy', lastCheck: Date.now() },
          { name: 'audit', status: 'healthy', lastCheck: Date.now() }
        ],
        storage: {
          used: 1024 * 1024 * 500, // 500MB
          total: 1024 * 1024 * 1024 * 5, // 5GB
          fileCount: 1250
        },
        database: {
          collections: 12,
          records: 8560,
          indexes: 8
        }
      };

      setSystemInfo(mockSystemInfo);
    } catch (error) {
      console.error('加载系统信息失败:', error);
    } finally {
      setIsLoadingInfo(false);
    }
  }, []);

  useEffect(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  // 保存系统设置
  const handleSaveSettings = useCallback(async () => {
    setIsSavingSettings(true);
    try {
      // 这里应该调用实际的设置保存API
      console.log('保存系统设置:', systemSettings);

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert('系统设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      alert('保存设置失败：' + (error as Error).message);
    } finally {
      setIsSavingSettings(false);
    }
  }, [systemSettings]);

  // 修改密码
  const handleChangePassword = useCallback(async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('新密码和确认密码不匹配');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      alert('新密码长度至少为6位');
      return;
    }

    try {
      // 这里应该调用实际的密码修改API
      console.log('修改密码:', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert('密码修改成功，请重新登录');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordChange(false);
      logout();
    } catch (error) {
      console.error('修改密码失败:', error);
      alert('修改密码失败：' + (error as Error).message);
    }
  }, [passwordForm, logout]);

  // 刷新系统状态
  const handleRefreshStatus = useCallback(() => {
    loadSystemInfo();
  }, [loadSystemInfo]);

  // 格式化存储大小
  const formatStorageSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return '正常';
      case 'error': return '异常';
      default: return status;
    }
  };

  // 检查权限
  const canManageSettings = isAdmin;

  if (!canManageSettings) {
    return (
      <AdminRouteGuard requireAdmin={true}>
        <div className="p-6">
          <div className="text-center py-12">
            <Shield className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">无权限访问</h3>
            <p className="mt-1 text-sm text-gray-500">您没有访问系统设置的权限</p>
          </div>
        </div>
      </AdminRouteGuard>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 现代化页面头部 */}
      <div className="hero" style={{
        padding: 'var(--space-8) var(--space-5) var(--space-4)',
        background: 'linear-gradient(180deg, var(--color-bg-primary, #ffffff) 0%, var(--color-bg-secondary, #f8fafc) 100%)',
        borderRadius: 16,
        marginBottom: 24,
        border: '1px solid var(--color-border-secondary, #e2e8f0)',
        boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(15, 23, 42, 0.08))'
      }}>
        <div className="hero-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap'
        }}>
          <div>
            <h1 className="title" style={{
              fontSize: 'var(--text-xl, 20px)',
              fontWeight: 'var(--font-semibold, 600)',
              color: 'var(--color-text-primary, #1f2937)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              margin: 0
            }}>
              <span style={{ color: 'var(--color-primary, #3b82f6)' }}>⚙️</span>
              系统设置中心
            </h1>
            <p className="hero-subtitle" style={{
              margin: 'var(--space-1) 0 0',
              fontSize: 'var(--text-sm, 14px)',
              color: 'var(--color-text-secondary, #64748b)'
            }}>
              管理系统配置和安全设置，自定义运行参数
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 现代化系统信息 */}
        <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* 环境信息 */}
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
            padding: 24
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <h2 style={{
                fontSize: 18,
                fontWeight: 600,
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: '#4f46e5'
                }}>
                  🖥️
                </div>
                环境信息
              </h2>
              <button
                onClick={handleRefreshStatus}
                disabled={isLoadingInfo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid #d1d5db',
                  background: '#ffffff',
                  color: '#374151',
                  cursor: isLoadingInfo ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: isLoadingInfo ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoadingInfo) {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#9ca3af';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoadingInfo) {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }
                }}
              >
                <RefreshCw style={{
                  width: 14,
                  height: 14,
                  animation: isLoadingInfo ? 'spin 1s linear infinite' : 'none'
                }} />
                刷新
              </button>
            </div>

            {systemInfo ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">环境ID</label>
                  <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-2 rounded">
                    {systemInfo.envId}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">云函数状态</label>
                  <div className="grid grid-cols-2 gap-2">
                    {systemInfo.functions.map((func) => (
                      <div key={func.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium text-gray-900">{func.name}</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(func.status)}`}>
                          {getStatusText(func.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">存储使用</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {formatStorageSize(systemInfo.storage.used)} / {formatStorageSize(systemInfo.storage.total)}
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${(systemInfo.storage.used / systemInfo.storage.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">文件数量</label>
                    <div className="mt-1 text-sm text-gray-900">{systemInfo.storage.fileCount.toLocaleString()}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">数据集合</label>
                    <div className="mt-1 text-sm text-gray-900">{systemInfo.database.collections}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">记录总数</label>
                    <div className="mt-1 text-sm text-gray-900">{systemInfo.database.records.toLocaleString()}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">索引数量</label>
                    <div className="mt-1 text-sm text-gray-900">{systemInfo.database.indexes}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">加载中...</p>
              </div>
            )}
          </div>

          {/* 安全设置 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-gray-400" />
              安全设置
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">允许社工导入数据</label>
                  <p className="text-sm text-gray-500">是否允许社工角色执行数据导入操作</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemSettings.security.allowWorkerImport}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, allowWorkerImport: e.target.checked }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">强制社工导出脱敏</label>
                  <p className="text-sm text-gray-500">社工角色导出数据时自动应用脱敏规则</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemSettings.security.forceWorkerExportMasked}
                    onChange={(e) => setSystemSettings(prev => ({
                      ...prev,
                      security: { ...prev.security, forceWorkerExportMasked: e.target.checked }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* 审计设置 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-gray-400" />
              审计设置
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日志级别</label>
                <select
                  value={systemSettings.audit.logLevel}
                  onChange={(e) => setSystemSettings(prev => ({
                    ...prev,
                    audit: { ...prev.audit, logLevel: e.target.value as 'info' | 'warn' | 'error' }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="info">信息</option>
                  <option value="warn">警告</option>
                  <option value="error">错误</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">日志保留天数</label>
                <input
                  type="number"
                  min="7"
                  max="365"
                  value={systemSettings.audit.retentionDays}
                  onChange={(e) => setSystemSettings(prev => ({
                    ...prev,
                    audit: { ...prev.audit, retentionDays: parseInt(e.target.value) || 90 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">超过此天数的日志将被自动清理</p>
              </div>
            </div>
          </div>

          {/* 导出设置 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2 text-gray-400" />
              导出设置
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">文件保留天数</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={systemSettings.export.fileRetentionDays}
                  onChange={(e) => setSystemSettings(prev => ({
                    ...prev,
                    export: { ...prev.export, fileRetentionDays: parseInt(e.target.value) || 7 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">导出文件在云存储中的保留时间</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">最大导出记录数</label>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="100"
                  value={systemSettings.export.maxExportRecords}
                  onChange={(e) => setSystemSettings(prev => ({
                    ...prev,
                    export: { ...prev.export, maxExportRecords: parseInt(e.target.value) || 10000 }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">单次导出操作的最大记录数限制</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingSettings ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存设置
                </>
              )}
            </button>
          </div>
        </div>

        {/* 用户信息 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-gray-400" />
              用户信息
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">用户名</label>
                  <div className="mt-1 text-sm text-gray-900">{rbacUser?.displayName || '-'}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">角色</label>
                <div className="mt-1">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                    {rbacUser?.roles?.join(', ') || '未分配'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">最后登录</label>
                <div className="mt-1 text-sm text-gray-900">
                  {rbacUser?.lastLoginAt ? new Date(rbacUser.lastLoginAt).toLocaleString() : '未知'}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowPasswordChange(true)}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  修改密码
                </button>
              </div>

              <div>
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </button>
              </div>
            </div>
          </div>

          {/* 系统说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 mr-2" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-2">系统说明</p>
                <ul className="space-y-1 text-xs">
                  <li>• 系统运行在腾讯云云开发环境</li>
                  <li>• 数据存储在云数据库中</li>
                  <li>• 文件存储在云存储中</li>
                  <li>• 所有操作都会记录审计日志</li>
                  <li>• 建议定期备份数据</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 修改密码模态框 */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">修改密码</h3>
              <button
                onClick={() => setShowPasswordChange(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">当前密码</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">确认新密码</label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowPasswordChange(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
