import React, { createContext, useContext, useEffect, useState } from 'react';
import { useCloudbase } from '../hooks/useCloudbase';

export interface RBACUser {
  userId: string;
  openid: string;
  roles: string[];
  displayName: string;
  avatar: string;
  lastLoginAt: number;
}

export interface RBACContextValue {
  user: RBACUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSocialWorker: boolean;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  refreshUser: () => Promise<void>;
}

const RBACContext = createContext<RBACContextValue | undefined>(undefined);

export const RBACProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { app, user: authUser } = useCloudbase();
  const [user, setUser] = useState<RBACUser | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshUser = async () => {
    if (!app) {
      setUser(null);
      return;
    }

    if (!authUser) {
      setUser(null);
      return;
    }

    setLoading(true);
    try {
      const res = await app.callFunction({
        name: 'rbac',
        data: { action: 'getCurrentUser' },
      });

      if (res.result?.success && res.result?.data) {
        setUser(res.result.data);
      } else {
        console.warn('Failed to get current user:', res.result?.error);
        setUser(null);
      }
    } catch (error) {
      console.error('Error getting current user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [app, authUser]);

  const isAdmin = user?.roles?.includes('admin') || false;
  const isSocialWorker = user?.roles?.includes('social_worker') || false;

  const hasRole = (role: string) => {
    return user?.roles?.includes(role) || false;
  };

  const hasAnyRole = (roles: string[]) => {
    return roles.some(role => user?.roles?.includes(role)) || false;
  };

  const value: RBACContextValue = {
    user,
    loading,
    isAdmin,
    isSocialWorker,
    hasRole,
    hasAnyRole,
    refreshUser,
  };

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
};

export function useRBAC(): RBACContextValue {
  const ctx = useContext(RBACContext);
  if (!ctx) {
    throw new Error('useRBAC must be used within RBACProvider');
  }
  return ctx;
}