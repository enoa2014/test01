import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRBAC } from '../hooks/useRBAC';

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
if (!document.head.querySelector('style[data-component="AdminRouteGuard"]')) {
  style.setAttribute('data-component', 'AdminRouteGuard');
  document.head.appendChild(style);
}

interface AdminRouteGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSocialWorker?: boolean;
  requireAnyRole?: string[];
  fallback?: string;
}

export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({
  children,
  requireAdmin = false,
  requireSocialWorker = false,
  requireAnyRole = [],
  fallback = '/login',
}) => {
  const { user, loading, isAdmin, isSocialWorker, hasAnyRole } = useRBAC();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }}></div>
        <div>正在验证权限...</div>
        <div style={{ fontSize: '14px', color: '#9ca3af', marginTop: '8px' }}>
          首次登录可能需要几秒钟时间
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={fallback} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        fontSize: '16px',
        color: '#dc2626'
      }}>
        <h2>权限不足</h2>
        <p>您需要管理员权限才能访问此页面</p>
      </div>
    );
  }

  if (requireSocialWorker && !isAdmin && !isSocialWorker) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        fontSize: '16px',
        color: '#dc2626'
      }}>
        <h2>权限不足</h2>
        <p>您需要管理员或社工权限才能访问此页面</p>
      </div>
    );
  }

  if (requireAnyRole.length > 0 && !hasAnyRole(requireAnyRole)) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        fontSize: '16px',
        color: '#dc2626'
      }}>
        <h2>权限不足</h2>
        <p>您需要相应角色权限才能访问此页面</p>
      </div>
    );
  }

  return <>{children}</>;
};