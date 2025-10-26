import { useCallback, useMemo } from 'react'
import { useRBAC } from '../contexts/RBACContext'
import DataFilterService from '../services/dataFilterService'

export const usePermissionControl = () => {
  const { user, hasPermission, canAccessResource, getDataFilters } = useRBAC()
  const dataFilterService = DataFilterService.getInstance()

  /**
   * 检查是否有权限执行特定操作
   */
  const canPerformAction = useCallback((
    resource: string,
    action: 'read' | 'write' | 'delete' | 'export',
    resourceId?: string
  ) => {
    if (!user?.selectedRole) return false
    return canAccessResource(resource, action, { resourceId })
  }, [user, canAccessResource])

  /**
   * 获取数据查询过滤器
   */
  const getDataQueryFilters = useCallback((resourceType: string) => {
    if (!user?.selectedRole) return {}

    const context = {
      departmentId: user.departmentId,
      assignedPatients: user.assignedPatients,
      childrenIds: user.childrenIds,
      volunteerTasks: user.volunteerTasks
    }

    switch (resourceType) {
      case 'patient':
        return dataFilterService.getPatientDataFilter(user.selectedRole, context)
      case 'careLog':
        return dataFilterService.getCareLogDataFilter(user.selectedRole, context)
      default:
        return []
    }
  }, [user, dataFilterService])

  /**
   * 应用数据脱敏
   */
  const applyDataMasking = useCallback((data: any, resourceType: string) => {
    if (!user?.selectedRole) return data

    const config = dataFilterService.getDataAccessConfig(
      user.selectedRole,
      user.userId,
      {
        departmentId: user.departmentId,
        assignedPatients: user.assignedPatients,
        childrenIds: user.childrenIds,
        volunteerTasks: user.volunteerTasks
      }
    )

    return dataFilterService.maskData(data, config.maskedFields)
  }, [user, dataFilterService])

  /**
   * 过滤统计数据
   */
  const filterStatisticsData = useCallback((data: any) => {
    if (!user?.selectedRole) return null

    const context = {
      departmentId: user.departmentId,
      assignedPatients: user.assignedPatients,
      childrenIds: user.childrenIds,
      volunteerTasks: user.volunteerTasks
    }

    return dataFilterService.filterStatisticsData(data, user.selectedRole, context)
  }, [user, dataFilterService])

  /**
   * 过滤患者数据
   */
  const filterPatientData = useCallback((data: any[]) => {
    if (!user?.selectedRole) return data

    const context = {
      departmentId: user.departmentId,
      assignedPatients: user.assignedPatients,
      childrenIds: user.childrenIds,
      volunteerTasks: user.volunteerTasks
    }

    // 获取患者数据过滤器
    const filters = dataFilterService.getPatientDataFilter(user.selectedRole, context)

    // 如果没有过滤器，直接返回原数据
    if (!filters || filters.length === 0) {
      return data
    }

    // 应用过滤器
    return data.filter(patient => {
      return filters.every(filter => {
        const { field, operator, value } = filter

        // 获取患者字段值
        const patientValue = patient[field]

        // 应用过滤逻辑
        switch (operator) {
          case 'eq':
            return patientValue === value
          case 'in':
            return Array.isArray(value) && value.includes(patientValue)
          case 'ne':
            return patientValue !== value
          case 'contains':
            return typeof patientValue === 'string' &&
                   patientValue.toLowerCase().includes(String(value).toLowerCase())
          default:
            return true
        }
      })
    })
  }, [user, dataFilterService])

  /**
   * 检查页面访问权限
   */
  const canAccessPage = useCallback((pageKey: string) => {
    if (!user?.selectedRole) return false

    const pagePermissions: Record<string, UserRole[]> = {
      'dashboard': ['admin', 'social_worker', 'volunteer', 'parent', 'guest'],
      'patients': ['admin', 'social_worker', 'volunteer'],
      'patient-detail': ['admin', 'social_worker', 'volunteer', 'parent'],
      'care-logs': ['admin', 'social_worker', 'volunteer', 'parent'],
      'analysis': ['admin', 'social_worker'],
      'export': ['admin', 'social_worker'],
      'user-management': ['admin'],
      'role-management': ['admin'],
      'system-settings': ['admin'],
      'invites': ['admin'],
      'audit': ['admin']
    }

    const allowedRoles = pagePermissions[pageKey] || []
    return allowedRoles.includes(user.selectedRole)
  }, [user])

  /**
   * 获取用户可访问的菜单项
   */
  const getAccessibleMenuItems = useCallback(() => {
    if (!user?.selectedRole) return []

    const allMenuItems = [
      { key: 'dashboard', label: '仪表盘', icon: '📊', path: '/dashboard' },
      { key: 'patients', label: '患者管理', icon: '👥', path: '/patients' },
      { key: 'care-logs', label: '护理记录', icon: '📝', path: '/care-logs' },
      { key: 'analysis', label: '数据分析', icon: '📈', path: '/analysis' },
      { key: 'export', label: '数据导出', icon: '📤', path: '/export' },
      { key: 'user-management', label: '用户管理', icon: '👤', path: '/users' },
      { key: 'role-management', label: '角色管理', icon: '🏷️', path: '/roles' },
      { key: 'system-settings', label: '系统设置', icon: '⚙️', path: '/settings' },
      { key: 'invites', label: '邀请管理', icon: '✉️', path: '/invites' },
      { key: 'audit', label: '审计日志', icon: '🔍', path: '/audit' }
    ]

    return allMenuItems.filter(item => canAccessPage(item.key))
  }, [user, canAccessPage])

  /**
   * 获取操作按钮权限
   */
  const getActionPermissions = useCallback((resourceType: string) => {
    if (!user?.selectedRole) return {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canExport: false,
      canView: false
    }

    const basePermissions = {
      canView: hasPermission('read'),
      canCreate: hasPermission('write'),
      canEdit: hasPermission('write'),
      canDelete: hasPermission('delete'),
      canExport: hasPermission('export')
    }

    // 根据资源类型调整权限
    switch (resourceType) {
      case 'patient':
        return {
          ...basePermissions,
          canCreate: user.selectedRole === 'admin' || user.selectedRole === 'social_worker',
          canEdit: user.selectedRole === 'admin' || user.selectedRole === 'social_worker',
          canDelete: user.selectedRole === 'admin',
          canExport: user.selectedRole === 'admin' || user.selectedRole === 'social_worker'
        }

      case 'careLog':
        return {
          ...basePermissions,
          canCreate: ['admin', 'social_worker', 'volunteer'].includes(user.selectedRole),
          canEdit: ['admin', 'social_worker'].includes(user.selectedRole),
          canDelete: user.selectedRole === 'admin',
          canExport: ['admin', 'social_worker'].includes(user.selectedRole)
        }

      case 'task':
        return {
          ...basePermissions,
          canCreate: ['admin', 'social_worker'].includes(user.selectedRole),
          canEdit: ['admin', 'social_worker', 'volunteer'].includes(user.selectedRole),
          canDelete: user.selectedRole === 'admin',
          canExport: user.selectedRole === 'admin'
        }

      default:
        return basePermissions
    }
  }, [user, hasPermission])

  /**
   * 检查是否可以更新患者状态
   */
  const canUpdatePatientStatus = useCallback(() => {
    if (!user?.selectedRole) return false
    return ['admin', 'social_worker'].includes(user.selectedRole)
  }, [user])

  /**
   * 检查是否可以删除患者
   */
  const canDeletePatient = useCallback(() => {
    if (!user?.selectedRole) return false
    return user.selectedRole === 'admin'
  }, [user])

  /**
   * 检查是否可以导出患者
   */
  const canExportPatient = useCallback(() => {
    if (!user?.selectedRole) return false
    return ['admin', 'social_worker'].includes(user.selectedRole)
  }, [user])

  /**
   * 权限摘要信息
   */
  const permissionSummary = useMemo(() => {
    if (!user?.selectedRole) return null

    return {
      role: user.selectedRole,
      permissions: user.permissions || [],
      canAccessPages: getAccessibleMenuItems().map(item => item.key),
      dataScope: getDataFilters(),
      lastUpdated: user.lastLoginAt
    }
  }, [user, getAccessibleMenuItems, getDataFilters])

  return {
    // 权限检查
    canPerformAction,
    canAccessPage,
    hasPermission,

    // 数据过滤
    getDataQueryFilters,
    applyDataMasking,
    filterStatisticsData,
    filterPatientData,
    getDataFilters,

    // 菜单和操作权限
    getAccessibleMenuItems,
    getActionPermissions,

    // 患者相关权限
    canUpdatePatientStatus,
    canDeletePatient,
    canExportPatient,

    // 权限信息
    permissionSummary,

    // 用户信息
    currentUser: user,
    isAdmin: user?.roles?.includes('admin') || false,
    isSocialWorker: user?.roles?.includes('social_worker') || false,
    isVolunteer: user?.roles?.includes('volunteer') || false,
    isParent: user?.roles?.includes('parent') || false,
    isGuest: user?.roles?.includes('guest') || false
  }
}