import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissionControl } from '../hooks/usePermissionControl';
import { useRBAC } from '../hooks/useRBAC';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requireAdmin?: boolean;
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requireAdmin = false,
  fallbackPath = '/dashboard'
}) => {
  const { hasPermission } = usePermissionControl();
  const { isAdmin, isGuest } = useRBAC();

  // 游客只能访问特定页面
  if (isGuest) {
    const allowedGuestPaths = ['/dashboard', '/patients'];
    const currentPath = window.location.pathname;

    if (!allowedGuestPaths.includes(currentPath)) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  // 管理员权限检查
  if (requireAdmin && !isAdmin) {
    return <Navigate to={fallbackPath} replace />;
  }

  // 特定权限检查
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

interface RoleBasedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  fallbackPath?: string;
}

export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({
  children,
  allowedRoles,
  fallbackPath = '/dashboard'
}) => {
  const { hasRole } = useRBAC();

  if (allowedRoles && !allowedRoles.some(role => hasRole(role))) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};