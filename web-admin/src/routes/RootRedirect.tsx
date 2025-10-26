import React from 'react';
import { Navigate } from 'react-router-dom';
import { useCloudbaseContext } from '../providers/CloudbaseProvider';

// Redirects '/' to '/login' when not authenticated, otherwise to '/dashboard'.
const RootRedirect: React.FC = () => {
  const { user, loading } = useCloudbaseContext();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '16px',
        color: '#666',
        backgroundColor: '#f9fafb'
      }}>
        正在加载...
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

export default RootRedirect;
