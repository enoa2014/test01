import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';

export const AdminRoute: React.FC = () => {
  const { user, loading } = useCloudbase();
  const location = useLocation();

  if (loading) {
    return <div className="app-content">正在加载会话信息...</div>;
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/patients" replace state={{ from: location, error: 'NO_ADMIN' }} />;
  }

  return <Outlet />;
};

export default AdminRoute;
