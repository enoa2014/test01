import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRBAC } from '../hooks/useRBAC';

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
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        正在验证权限...
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