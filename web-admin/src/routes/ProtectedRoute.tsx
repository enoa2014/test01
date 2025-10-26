import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';

export const ProtectedRoute: React.FC = () => {
  const { user, loading } = useCloudbase();
  const location = useLocation();

  if (loading) {
    return <div className="app-content">正在加载会话信息...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

