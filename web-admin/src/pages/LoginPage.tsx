import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';
import { QRLogin } from '../components/QRLogin';
import toast from 'react-hot-toast';

interface UserInfo {
  uid: string;
  username: string;
  roles: string[];
  selectedRole: string;
  permissions: string[];
  avatarUrl?: string;
  nickName?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isPrimary?: boolean;
  permissions: string[];
}

const LoginPage: React.FC = () => {
  const { user, login, loginWithTicket, loading } = useCloudbase();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'traditional' | 'qr'>('qr');
  const [showMoreRoles, setShowMoreRoles] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const qrLoginRef = useRef<any>(null);

  // 角色配置
  const roles: Role[] = [
    {
      id: 'social_worker',
      name: '社工',
      description: '患者管理和护理记录',
      icon: '👩‍⚕️',
      color: '#2563eb',
      isPrimary: true,
      permissions: ['patient.read', 'patient.write', 'record.read', 'record.write']
    },
    {
      id: 'parent',
      name: '家长',
      description: '查看孩子相关信息',
      icon: '👨‍👩‍👧‍👦',
      color: '#10b981',
      isPrimary: true,
      permissions: ['patient.read.own', 'record.read.own']
    },
    {
      id: 'admin',
      name: '系统管理员',
      description: '完整的系统管理权限',
      icon: '👑',
      color: '#8b5cf6',
      permissions: ['*']
    },
    {
      id: 'volunteer',
      name: '志愿者',
      description: '记录服务日志',
      icon: '🤝',
      color: '#f59e0b',
      permissions: ['patient.read', 'record.write']
    },
    {
      id: 'guest',
      name: '游客',
      description: '查看公开统计信息',
      icon: '👤',
      color: '#6b7280',
      permissions: ['stats.read']
    }
  ];

  // 处理角色选择
  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    if (qrLoginRef.current) {
      qrLoginRef.current.selectRole(role.id as any);
    }
    toast.success(`已选择${role.name}角色，请扫描二维码登录`);
  };

  const primaryRoles = roles.filter(role => role.isPrimary);
  const secondaryRoles = roles.filter(role => !role.isPrimary);

  useEffect(() => {
    if (user) {
      const redirectTo = (location.state as { from?: Location })?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, location.state]);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      toast.success('登录成功！');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登录失败，请稍后再试';
      setError(errorMessage);
      toast.error(errorMessage);
      setSubmitting(false);
    }
  };

  // 处理QR登录成功
  const handleQRLoginSuccess = (userInfo: UserInfo) => {
    console.log('QR登录成功:', userInfo);
    toast.success(`欢迎，${userInfo.nickName || userInfo.username}！`);
  };

  // 处理QR登录错误
  const handleQRLoginError = (error: Error) => {
    setError(error.message);
    toast.error(error.message);
  };

  // 处理QR登录状态变化
  const handleQRStatusChange = (status: any) => {
    console.log('QR登录状态:', status);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
          <p className="text-gray-600 text-lg">正在检测登录状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        {/* 头部 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            同心源 小家管理后台
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            选择您的角色，快速登录管理系统，为患者提供更好的服务
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* 左侧：登录方式选择 */}
          <div className="space-y-8">
            {/* 登录方式切换 */}
            <div className="bg-white rounded-2xl shadow-xl p-2 border border-gray-100">
              <div className="flex">
                <button
                  onClick={() => setLoginMode('qr')}
                  data-testid="qr-login-tab"
                  className={`flex-1 py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    loginMode === 'qr'
                      ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    扫码登录
                  </span>
                </button>
                <button
                  onClick={() => setLoginMode('traditional')}
                  data-testid="password-login-tab"
                  className={`flex-1 py-3 px-6 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    loginMode === 'traditional'
                      ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    账号密码
                  </span>
                </button>
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div
                className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-lg"
                data-testid="login-error-message"
              >
                <div className="flex items-center">
                  <svg className="h-6 w-6 text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-800">登录失败</p>
                    <p className="text-sm text-red-700 mt-1" data-testid="error-text">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 登录内容 */}
            {loginMode === 'qr' ? (
              <div className="space-y-6">
                {/* 角色选择卡片 */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3 text-3xl">🔐</span>
                    选择登录角色
                  </h2>

                  {/* 主要角色 */}
                  <div className="space-y-4 mb-6">
                    {primaryRoles.map((role) => (
                      <div
                        key={role.id}
                        onClick={() => handleRoleSelect(role)}
                        className={`group p-5 rounded-xl border-2 hover:shadow-lg transition-all duration-300 cursor-pointer ${
                          selectedRole?.id === role.id
                            ? 'border-blue-500 bg-blue-50 shadow-xl transform scale-105'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                        style={{ borderColor: selectedRole?.id === role.id ? role.color : role.color + '40' }}
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className="text-2xl p-3 rounded-xl transition-transform duration-300 group-hover:scale-105 w-12 h-12 flex items-center justify-center leading-none"
                            style={{ backgroundColor: role.color + '20' }}
                          >
                            {role.icon}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-lg text-gray-900 mb-1">
                              {role.name}
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              {role.description}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {role.permissions.slice(0, 3).map((permission, index) => (
                                <span
                                  key={index}
                                  className="text-xs px-2 py-1 rounded-full"
                                  style={{ backgroundColor: role.color + '20', color: role.color }}
                                >
                                  {permission}
                                </span>
                              ))}
                            </div>
                          </div>
                          {selectedRole?.id === role.id ? (
                            <div className="text-blue-500">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 其他角色 */}
                  <div className="max-w-md">
                    <button
                      onClick={() => setShowMoreRoles(!showMoreRoles)}
                      className="w-full flex items-center justify-center p-3 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-300 border border-gray-200 hover:border-gray-300"
                      style={{ maxWidth: '300px' }}
                    >
                      <span>{showMoreRoles ? '收起角色' : '更多角色'}</span>
                      <svg
                        className={`w-4 h-4 ml-2 transform transition-transform duration-300 ${showMoreRoles ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showMoreRoles && (
                      <div className="mt-4 space-y-3">
                        {secondaryRoles.map((role) => (
                          <div
                            key={role.id}
                            onClick={() => handleRoleSelect(role)}
                            className={`group p-4 rounded-lg border hover:shadow-md transition-all duration-300 cursor-pointer ${
                              selectedRole?.id === role.id
                                ? 'border-blue-500 bg-blue-50 shadow-md'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="text-xl p-2 rounded-lg group-hover:scale-105 transition-transform duration-300 w-8 h-8 flex items-center justify-center leading-none"
                                   style={{ backgroundColor: role.color + '20' }}>
                                {role.icon}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">{role.name}</div>
                                <div className="text-xs text-gray-600 mt-1">{role.description}</div>
                              </div>
                              {selectedRole?.id === role.id && (
                                <div className="text-blue-500">
                                  <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 使用指南 */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                    <span className="mr-3 text-2xl">📖</span>
                    使用指南
                  </h3>
                  <div className="space-y-4">
                    {[
                      { step: 1, title: '选择角色', desc: '选择适合您的登录角色', icon: '🎯', color: 'blue' },
                      { step: 2, title: '扫码登录', desc: '使用微信小程序扫描二维码', icon: '📱', color: 'green' },
                      { step: 3, title: '确认登录', desc: '在小程序中确认登录', icon: '✅', color: 'emerald' },
                      { step: 4, title: '完成登录', desc: '自动跳转到管理后台', icon: '🚀', color: 'purple' }
                    ].map((item) => (
                      <div key={item.step} className="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-50 transition-colors duration-300">
                        <div className={`w-12 h-12 bg-${item.color}-100 text-${item.color}-600 rounded-full flex items-center justify-center font-bold text-lg shadow-lg`}>
                          {item.step}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1">{item.title}</div>
                          <div className="text-sm text-gray-600">{item.desc}</div>
                        </div>
                        <div className="text-2xl w-8 h-8 flex items-center justify-center leading-none">{item.icon}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center">
                  <span className="mr-3 text-3xl">🔑</span>
                  账号密码登录
                </h2>
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                      用户名
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        id="username"
                        name="username"
                        data-testid="username-input"
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="appearance-none block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                        placeholder="请输入账号"
                        autoComplete="username"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                      口令
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        id="password"
                        name="password"
                        data-testid="password-input"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="appearance-none block w-full pl-10 pr-3 py-3 border-2 border-gray-300 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                        placeholder="请输入口令"
                        autoComplete="current-password"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      data-testid="login-submit-button"
                      disabled={submitting}
                      className="w-full flex justify-center items-center py-4 px-6 border-2 border-transparent text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-105 hover:shadow-lg"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                          登录中...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                          </svg>
                          立即登录
                        </>
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">首次使用须知</p>
                      <p>请在云函数 `auth` 中配置管理员账号，并在环境变量中启用自定义登录私钥。</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：QR登录组件 */}
          {loginMode === 'qr' && (
            <div className="lg:sticky lg:top-8 h-fit">
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <QRLogin
                  ref={qrLoginRef}
                  mode="multi"
                  onLoginSuccess={handleQRLoginSuccess}
                  onLoginError={handleQRLoginError}
                  onStatusChange={handleQRStatusChange}
                />

                {/* 帮助信息 */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="text-center space-y-4">
                    <div className="flex items-center justify-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      安全加密，快速登录
                    </div>
                    <button
                      onClick={() => window.open('/help', '_blank')}
                      className="text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors duration-200 flex items-center justify-center mx-auto"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      遇到问题？查看帮助
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
