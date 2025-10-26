import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePermissionControl } from '../hooks/usePermissionControl';
import { useRBAC } from '../hooks/useRBAC';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  permission?: string;
  requireAdmin?: boolean;
  badge?: string;
  divider?: boolean;
}

interface RoleBasedNavProps {
  items: NavItem[];
  className?: string;
  onItemClick?: () => void;
  showLabels?: boolean;
  variant?: 'sidebar' | 'topbar' | 'mobile';
}

export const RoleBasedNav: React.FC<RoleBasedNavProps> = ({
  items,
  className = '',
  onItemClick,
  showLabels = true,
  variant = 'sidebar'
}) => {
  const { hasPermission } = usePermissionControl();
  const { isAdmin } = useRBAC();
  const location = useLocation();

  // 过滤菜单项
  const filteredItems = items.filter(item => {
    // 分隔符始终显示（如果前后有可见项）
    if (item.divider) return true;

    // 管理员权限检查
    if (item.requireAdmin && !isAdmin) {
      return false;
    }

    // 权限检查
    if (item.permission && !hasPermission(item.permission)) {
      return false;
    }

    return true;
  });

  const getItemStyles = (item: NavItem, isActive: boolean) => {
    const baseStyles: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      textDecoration: 'none',
      transition: 'all 0.2s ease',
      position: 'relative',
    };

    switch (variant) {
      case 'sidebar':
        return {
          ...baseStyles,
          padding: '12px 16px',
          color: isActive ? '#3b82f6' : '#d1d5db',
          backgroundColor: isActive ? '#374151' : 'transparent',
          borderLeft: isActive ? '4px solid #3b82f6' : '4px solid transparent',
          borderRadius: '0 4px 4px 0',
          margin: '2px 8px',
          ...(showLabels ? {} : { justifyContent: 'center', padding: '12px' }),
          '&:hover': {
            backgroundColor: isActive ? '#374151' : '#4b5563',
          }
        };
      case 'topbar':
        return {
          ...baseStyles,
          padding: '8px 16px',
          color: isActive ? '#3b82f6' : '#6b7280',
          borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
          ...(showLabels ? {} : { justifyContent: 'center', padding: '8px' }),
          '&:hover': {
            color: '#3b82f6',
            backgroundColor: '#f3f4f6',
          }
        };
      case 'mobile':
        return {
          ...baseStyles,
          padding: '16px 20px',
          color: isActive ? '#3b82f6' : '#374151',
          backgroundColor: isActive ? '#eff6ff' : 'transparent',
          borderBottom: '1px solid #e5e7eb',
          ...(showLabels ? {} : { justifyContent: 'center', padding: '16px' }),
          '&:hover': {
            backgroundColor: '#f9fafb',
          }
        };
      default:
        return baseStyles;
    }
  };

  const renderNavItem = (item: NavItem) => {
    if (item.divider) {
      return (
        <div
          key={`divider-${Math.random()}`}
          style={{
            height: '1px',
            backgroundColor: '#374151',
            margin: variant === 'sidebar' ? '8px 16px' : '4px 0',
          }}
        />
      );
    }

    const isActive = location.pathname === item.path;
    const styles = getItemStyles(item, isActive);

    return (
      <Link
        key={item.path}
        to={item.path}
        style={styles}
        onClick={onItemClick}
        className={`nav-item ${isActive ? 'active' : ''}`}
      >
        <span
          style={{
            fontSize: showLabels ? '16px' : '20px',
            marginRight: showLabels ? '12px' : '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: showLabels ? 'auto' : '24px',
            height: showLabels ? 'auto' : '24px',
          }}
        >
          {item.icon}
        </span>

        {showLabels && (
          <span style={{ flex: 1, fontSize: '14px', fontWeight: '500' }}>
            {item.label}
          </span>
        )}

        {item.badge && (
          <span
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '10px',
              marginLeft: '8px',
              minWidth: '16px',
              textAlign: 'center',
            }}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <nav className={`role-based-nav ${className}`}>
      {filteredItems.map(renderNavItem)}
    </nav>
  );
};

// 预定义的导航菜单
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: '概览', icon: '📊', permission: 'read' },
  { path: '/patients', label: '患者管理', icon: '👨‍⚕️', permission: 'read' },
  { path: '/analysis', label: '数据分析', icon: '📈', permission: 'read' },
  { divider: true },
  { path: '/users', label: '用户管理', icon: '👥', permission: 'user_manage', requireAdmin: true },
  { path: '/roles', label: '角色管理', icon: '🔑', permission: 'role_assign', requireAdmin: true },
  { path: '/approvals', label: '申请审批', icon: '✅', permission: 'write' },
  { path: '/invites', label: '邀请管理', icon: '📧', permission: 'write' },
  { divider: true },
  { path: '/import', label: '导入Excel', icon: '📊', permission: 'write', requireAdmin: true },
  { path: '/export', label: '导出中心', icon: '📊', permission: 'export' },
  { path: '/audit', label: '审计日志', icon: '📋', permission: 'read' },
  { divider: true },
  { path: '/settings', label: '系统设置', icon: '⚙️', permission: 'system_config', requireAdmin: true },
];

// 游客用户的简化导航
export const GUEST_NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: '概览', icon: '📊', permission: 'view_dashboard' },
  { path: '/patients', label: '患者列表', icon: '👨‍⚕️', permission: 'view_patients' },
];