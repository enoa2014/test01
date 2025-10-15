import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useRBAC } from '../hooks/useRBAC';
import { useCloudbase } from '../hooks/useCloudbase';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, isAdmin } = useRBAC();
  const { logout } = useCloudbase();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    { path: '/', label: '概览', icon: '📊' },
    { path: '/users', label: '用户管理', icon: '👥', requireAdmin: true },
    { path: '/roles', label: '角色管理', icon: '🔑', requireAdmin: true },
    { path: '/approvals', label: '申请审批', icon: '✅' },
    { path: '/invites', label: '邀请管理', icon: '📧' },
    { path: '/import', label: '导入Excel', icon: '📈', requireAdmin: true },
    { path: '/export', label: '导出中心', icon: '📊' },
    { path: '/audit', label: '审计日志', icon: '📋' },
    { path: '/settings', label: '系统设置', icon: '⚙️' },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.requireAdmin && !isAdmin) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* 侧边栏 */}
      <aside style={{
        width: sidebarOpen ? '250px' : '0',
        backgroundColor: '#1f2937',
        color: 'white',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #374151',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>管理后台</h3>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        <nav style={{ flex: 1, padding: '20px 0' }}>
          {filteredMenuItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 20px',
                color: location.pathname === item.path ? '#3b82f6' : '#d1d5db',
                textDecoration: 'none',
                backgroundColor: location.pathname === item.path ? '#374151' : 'transparent',
                borderLeft: location.pathname === item.path ? '4px solid #3b82f6' : '4px solid transparent',
              }}
              onClick={() => setSidebarOpen(false)}
            >
              <span style={{ marginRight: '12px', fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div style={{
          padding: '20px',
          borderTop: '1px solid #374151',
        }}>
          <div style={{ marginBottom: '15px', fontSize: '14px', opacity: 0.8 }}>
            <div style={{ fontWeight: 'bold' }}>{user?.displayName || '管理员'}</div>
            <div style={{ fontSize: '12px' }}>
              {user?.roles?.join(', ') || '无角色'}
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 顶部导航栏 */}
        <header style={{
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                marginRight: '16px',
              }}
            >
              ☰
            </button>
            <h1 style={{ margin: 0, fontSize: '20px', color: '#111827' }}>
              {filteredMenuItems.find(item => item.path === location.pathname)?.label || '管理后台'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
              欢迎，{user?.displayName || '管理员'}
            </span>
          </div>
        </header>

        {/* 页面内容 */}
        <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {children}
        </div>
      </main>

      {/* 侧边栏遮罩 */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 40,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};