import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useRBAC } from '../hooks/useRBAC';
import { useCloudbase } from '../hooks/useCloudbase';
import { usePermissionControl } from '../hooks/usePermissionControl';
import { RoleBasedNav, DEFAULT_NAV_ITEMS, GUEST_NAV_ITEMS } from './RoleBasedNav';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, isAdmin, isGuest } = useRBAC();
  const { logout } = useCloudbase();
  const navigate = useNavigate();
  const location = useLocation();
  const permissionControl = usePermissionControl();
  // 记录侧边栏开关状态至本地，不随页面跳转改变
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem('ADMIN_SIDEBAR_OPEN');
      if (saved !== null) return saved === '1';
      // 首次按屏幕宽度决定默认：桌面端打开，移动端关闭
      return window.innerWidth > 768;
    } catch {
      return true;
    }
  });
  const [isMobile, setIsMobile] = useState(false);

  // 检测屏幕尺寸
  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // 不主动修改 sidebarOpen，保持用户选择与本地记录
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 持久化侧边栏状态
  React.useEffect(() => {
    try {
      window.localStorage.setItem('ADMIN_SIDEBAR_OPEN', sidebarOpen ? '1' : '0');
    } catch {}
  }, [sidebarOpen]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // 根据用户角色选择导航菜单
  const getNavItems = () => {
    if (isGuest) {
      return GUEST_NAV_ITEMS;
    }
    return DEFAULT_NAV_ITEMS;
  };

  const navItems = getNavItems();

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
          <RoleBasedNav
            items={navItems}
            variant="sidebar"
            showLabels={true}
            onItemClick={() => {
              // 仅在移动端点击菜单后自动关闭，桌面端保持用户选择
              if (isMobile) setSidebarOpen(false);
            }}
          />
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
              {navItems.find(item => item.path === location.pathname)?.label || '管理后台'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>
              欢迎，{user?.displayName || '管理员'}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '6px 10px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              title="退出登录"
            >
              退出登录
            </button>
          </div>
        </header>

        {/* 页面内容 */}
        <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
          {children}
        </div>
      </main>

      {/* 侧边栏遮罩 - 只有在移动端时显示 */}
      {sidebarOpen && isMobile && (
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
