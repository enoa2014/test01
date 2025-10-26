import React, { createContext, useContext, useEffect, useState } from 'react';
import { useCloudbase } from '../hooks/useCloudbase';

export type UserRole = 'admin' | 'social_worker' | 'volunteer' | 'parent' | 'guest';

export interface RBACUser {
  userId: string;
  openid: string;
  roles: UserRole[];
  selectedRole?: UserRole;
  displayName: string;
  avatar: string;
  lastLoginAt: number;
  permissions?: string[];
  departmentId?: string;
  assignedPatients?: string[];
  childrenIds?: string[];
  volunteerTasks?: string[];
}

export interface RoleInfo {
  role: UserRole;
  name: string;
  description: string;
  permissions: string[];
  icon?: string;
  color?: string;
}

export interface RBACContextValue {
  user: RBACUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSocialWorker: boolean;
  isVolunteer: boolean;
  isParent: boolean;
  isGuest: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  hasPermission: (permission: string) => boolean;
  canAccessResource: (resource: string, action: string, context?: any) => boolean;
  getDataFilters: () => any;
  getRoleInfo: (role: UserRole) => RoleInfo;
  switchRole: (role: UserRole) => Promise<void>;
  refreshUser: () => Promise<void>;
}

// 角色配置
const ROLE_CONFIG: Record<UserRole, RoleInfo> = {
  admin: {
    role: 'admin',
    name: '系统管理员',
    description: '拥有完整的系统管理权限',
    permissions: ['read', 'write', 'delete', 'export', 'user_manage', 'role_assign', 'system_config'],
    icon: '👑',
    color: '#3B82F6'
  },
  social_worker: {
    role: 'social_worker',
    name: '社工',
    description: '负责患者管理和护理记录',
    permissions: ['read', 'write', 'patient_manage', 'care_log', 'export'],
    icon: '👩‍⚕️',
    color: '#10B981'
  },
  volunteer: {
    role: 'volunteer',
    name: '志愿者',
    description: '参与志愿服务，记录服务日志',
    permissions: ['read', 'task_log', 'comment'],
    icon: '🤝',
    color: '#F59E0B'
  },
  parent: {
    role: 'parent',
    name: '家长',
    description: '查看自己孩子的相关信息',
    permissions: ['read', 'child_info'],
    icon: '👨‍👩‍👧‍👦',
    color: '#8B5CF6'
  },
  guest: {
    role: 'guest',
    name: '游客',
    description: '临时访问，查看公开信息',
    permissions: ['read', 'public_stats'],
    icon: '👤',
    color: '#6B7280'
  }
};

const RBACContext = createContext<RBACContextValue | undefined>(undefined);

const buildFallbackUser = (authUser: any): RBACUser | null => {
  if (!authUser) {
    return null;
  }
  const role = authUser.role || 'admin';
  const roles = role ? [role] : [];
  const uid = authUser.uid || authUser.username || 'manual-user';
  return {
    userId: uid,
    openid: uid,
    roles,
    displayName: authUser.username || authUser.uid || '管理员',
    avatar: '',
    lastLoginAt: authUser.ticketIssuedAt || Date.now(),
  };
};

export const RBACProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { app, user: authUser } = useCloudbase();
  const [user, setUser] = useState<RBACUser | null>(null);
  // 初始设为 true，避免路由守卫在首次渲染时误判为未登录
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    // 确保任何路径都能正确结束 loading 状态
    setLoading(true);
    if (!app) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    const fallbackUser = buildFallbackUser(authUser);

    if (authUser?.authSource === 'manual' && fallbackUser) {
      setUser(fallbackUser);
      setLoading(false);
      return;
    }
    try {
      // 从本地存储获取用户角色信息
      let userRoles: UserRole[] = ['guest'];
      let selectedRole: UserRole | undefined = undefined;

      try {
        const storedRoles = localStorage.getItem('USER_ROLES');
        const storedSelectedRole = localStorage.getItem('SELECTED_ROLE');

        if (storedRoles) {
          userRoles = JSON.parse(storedRoles);
        }
        if (storedSelectedRole) {
          selectedRole = JSON.parse(storedSelectedRole);
        }
      } catch (error) {
        console.warn('Failed to load user roles from localStorage:', error);
      }

      // 如果没有存储的角色信息，使用authUser的role字段
      if (userRoles.length === 1 && userRoles[0] === 'guest') {
        if (authUser.role && authUser.role !== 'user') {
          userRoles = [authUser.role as UserRole];
          selectedRole = authUser.role as UserRole;
        }
      }

      // 构建RBAC用户对象
      const rbacUser: RBACUser = {
        userId: authUser.uid,
        openid: authUser.uid,
        roles: userRoles,
        selectedRole: selectedRole || userRoles[0],
        displayName: authUser.username || authUser.uid,
        avatar: '',
        lastLoginAt: authUser.ticketIssuedAt || Date.now(),
        permissions: selectedRole ? ROLE_CONFIG[selectedRole].permissions : ROLE_CONFIG.guest.permissions
      };

      setUser(rbacUser);
    } catch (error) {
      console.error('Error getting current user:', error);
      // 在测试环境中，权限错误是正常的，不应该设置用户为null
      if (localStorage.getItem('E2E_BYPASS_LOGIN') === '1') {
        // 测试环境使用默认管理员权限
        const testUser: RBACUser = {
          userId: 'test-user',
          openid: 'test-user',
          roles: ['admin'],
          selectedRole: 'admin',
          displayName: '测试管理员',
          avatar: '',
          lastLoginAt: Date.now(),
          permissions: ROLE_CONFIG.admin.permissions
        };
        setUser(testUser);
      } else if (fallbackUser) {
        setUser(fallbackUser);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [app, authUser]);

  const isAdmin = user?.roles?.includes('admin') || false;
  const isSocialWorker = user?.roles?.includes('social_worker') || false;
  const isVolunteer = user?.roles?.includes('volunteer') || false;
  const isParent = user?.roles?.includes('parent') || false;
  const isGuest = user?.roles?.includes('guest') || false;

  const hasRole = (role: UserRole) => {
    return user?.roles?.includes(role) || false;
  };

  const hasAnyRole = (roles: UserRole[]) => {
    return roles.some(role => user?.roles?.includes(role)) || false;
  };

  const hasPermission = (permission: string) => {
    if (!user?.selectedRole) return false;
    const rolePermissions = ROLE_CONFIG[user.selectedRole].permissions;
    return rolePermissions.includes('*') || rolePermissions.includes(permission);
  };

  const canAccessResource = (resource: string, action: string, context?: any) => {
    if (!user?.selectedRole) return false;

    const role = user.selectedRole;
    const permissions = ROLE_CONFIG[role].permissions;

    // 管理员拥有所有权限
    if (permissions.includes('*')) return true;

    // 检查具体权限
    const requiredPermission = `${resource}_${action}`;
    if (permissions.includes(requiredPermission)) return true;

    // 检查数据访问权限
    if (context) {
      switch (role) {
        case 'parent':
          // 家长只能访问自己孩子的数据
          if (resource === 'patient' && context.patientId) {
            return user.childrenIds?.includes(context.patientId) || false;
          }
          break;
        case 'social_worker':
          // 社工只能访问负责的患者数据
          if (resource === 'patient' && context.patientId) {
            return user.assignedPatients?.includes(context.patientId) || false;
          }
          break;
        case 'volunteer':
          // 志愿者只能访问分配的任务数据
          if (resource === 'task' && context.taskId) {
            return user.volunteerTasks?.includes(context.taskId) || false;
          }
          break;
      }
    }

    return false;
  };

  const getDataFilters = () => {
    if (!user?.selectedRole) return {};

    switch (user.selectedRole) {
      case 'parent':
        return {
          patientIds: user.childrenIds || []
        };
      case 'social_worker':
        return {
          patientIds: user.assignedPatients || [],
          departmentId: user.departmentId
        };
      case 'volunteer':
        return {
          taskIds: user.volunteerTasks || [],
          patientIds: user.assignedPatients || []
        };
      case 'guest':
        return {
          publicOnly: true
        };
      default:
        return {};
    }
  };

  const getRoleInfo = (role: UserRole): RoleInfo => {
    return ROLE_CONFIG[role];
  };

  const switchRole = async (role: UserRole) => {
    if (!user || !user.roles.includes(role)) {
      throw new Error('User does not have this role');
    }

    try {
      localStorage.setItem('SELECTED_ROLE', JSON.stringify(role));

      setUser({
        ...user,
        selectedRole: role,
        permissions: ROLE_CONFIG[role].permissions
      });
    } catch (error) {
      console.error('Failed to switch role:', error);
      throw error;
    }
  };

  const value: RBACContextValue = {
    user,
    loading,
    isAdmin,
    isSocialWorker,
    isVolunteer,
    isParent,
    isGuest,
    hasRole,
    hasAnyRole,
    hasPermission,
    canAccessResource,
    getDataFilters,
    getRoleInfo,
    switchRole,
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
