import { UserRole } from '../contexts/RBACContext'

export interface DataFilter {
  field: string
  operator: 'eq' | 'in' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'
  value: any
}

export interface DataAccessConfig {
  canRead: boolean
  canWrite: boolean
  canDelete: boolean
  canExport: boolean
  filters: DataFilter[]
  maskedFields: string[]
}

export class DataFilterService {
  private static instance: DataFilterService

  static getInstance(): DataFilterService {
    if (!DataFilterService.instance) {
      DataFilterService.instance = new DataFilterService()
    }
    return DataFilterService.instance
  }

  /**
   * 根据用户角色获取数据访问配置
   */
  getDataAccessConfig(
    role: UserRole,
    userId: string,
    context?: {
      departmentId?: string
      assignedPatients?: string[]
      childrenIds?: string[]
      volunteerTasks?: string[]
    }
  ): DataAccessConfig {
    switch (role) {
      case 'admin':
        return {
          canRead: true,
          canWrite: true,
          canDelete: true,
          canExport: true,
          filters: [],
          maskedFields: []
        }

      case 'social_worker':
        return {
          canRead: true,
          canWrite: true,
          canDelete: false,
          canExport: true,
          filters: [
            ...(context?.departmentId ? [{
              field: 'departmentId',
              operator: 'eq' as const,
              value: context.departmentId
            }] : []),
            ...(context?.assignedPatients?.length ? [{
              field: 'patientId',
              operator: 'in' as const,
              value: context.assignedPatients
            }] : [])
          ],
          maskedFields: ['ssn', 'contactPhone', 'homeAddress']
        }

      case 'volunteer':
        return {
          canRead: true,
          canWrite: false,
          canDelete: false,
          canExport: false,
          filters: [
            ...(context?.assignedPatients?.length ? [{
              field: 'patientId',
              operator: 'in' as const,
              value: context.assignedPatients
            }] : []),
            ...(context?.volunteerTasks?.length ? [{
              field: 'taskId',
              operator: 'in' as const,
              value: context.volunteerTasks
            }] : [])
          ],
          maskedFields: ['ssn', 'contactPhone', 'homeAddress', 'medicalHistory', 'diagnosis']
        }

      case 'parent':
        return {
          canRead: true,
          canWrite: false,
          canDelete: false,
          canExport: false,
          filters: [
            ...(context?.childrenIds?.length ? [{
              field: 'patientId',
              operator: 'in' as const,
              value: context.childrenIds
            }] : [])
          ],
          maskedFields: ['ssn', 'contactPhone', 'homeAddress', 'medicalDetails']
        }

      case 'guest':
        return {
          canRead: true,
          canWrite: false,
          canDelete: false,
          canExport: false,
          filters: [{
            field: 'isPublic',
            operator: 'eq' as const,
            value: true
          }],
          maskedFields: ['ssn', 'contactPhone', 'homeAddress', 'medicalHistory', 'diagnosis', 'personalDetails']
        }

      default:
        return {
          canRead: false,
          canWrite: false,
          canDelete: false,
          canExport: false,
          filters: [{
            field: 'id',
            operator: 'eq' as const,
            value: null
          }],
          maskedFields: []
        }
    }
  }

  /**
   * 应用数据过滤器到查询参数
   */
  applyFilters(baseQuery: any, filters: DataFilter[]): any {
    let query = { ...baseQuery }

    filters.forEach(filter => {
      switch (filter.operator) {
        case 'eq':
          query[filter.field] = filter.value
          break
        case 'in':
          query[filter.field] = { $in: filter.value }
          break
        case 'ne':
          query[filter.field] = { $ne: filter.value }
          break
        case 'gt':
          query[filter.field] = { $gt: filter.value }
          break
        case 'gte':
          query[filter.field] = { $gte: filter.value }
          break
        case 'lt':
          query[filter.field] = { $lt: filter.value }
          break
        case 'lte':
          query[filter.field] = { $lte: filter.value }
          break
        case 'contains':
          query[filter.field] = { $regex: filter.value, $options: 'i' }
          break
      }
    })

    return query
  }

  /**
   * 脱敏处理数据
   */
  maskData(data: any, maskedFields: string[]): any {
    if (!data || !maskedFields.length) return data

    const maskedData = Array.isArray(data) ? [...data] : { ...data }

    const maskValue = (value: any): string => {
      if (typeof value !== 'string') return '***'
      if (value.length <= 3) return '***'
      return value.substring(0, 2) + '***' + value.substring(value.length - 1)
    }

    const maskObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj

      if (Array.isArray(obj)) {
        return obj.map(item => maskObject(item))
      }

      const masked = { ...obj }
      maskedFields.forEach(field => {
        if (masked[field] !== undefined) {
          masked[field] = maskValue(masked[field])
        }
      })

      return masked
    }

    return maskObject(maskedData)
  }

  /**
   * 检查用户是否有权限访问特定资源
   */
  canAccessResource(
    role: UserRole,
    resource: string,
    action: 'read' | 'write' | 'delete' | 'export',
    resourceId?: string,
    context?: any
  ): boolean {
    const config = this.getDataAccessConfig(role, '', context)

    switch (action) {
      case 'read':
        return config.canRead
      case 'write':
        return config.canWrite
      case 'delete':
        return config.canDelete
      case 'export':
        return config.canExport
      default:
        return false
    }
  }

  /**
   * 获取患者数据过滤器
   */
  getPatientDataFilter(
    role: UserRole,
    context?: {
      departmentId?: string
      assignedPatients?: string[]
      childrenIds?: string[]
    }
  ): DataFilter[] {
    const config = this.getDataAccessConfig(role, '', context)
    return config.filters
  }

  /**
   * 获取护理记录数据过滤器
   */
  getCareLogDataFilter(
    role: UserRole,
    context?: {
      departmentId?: string
      assignedPatients?: string[]
      childrenIds?: string[]
    }
  ): DataFilter[] {
    switch (role) {
      case 'admin':
        return []

      case 'social_worker':
        return [
          ...(context?.departmentId ? [{
            field: 'departmentId',
            operator: 'eq' as const,
            value: context.departmentId
          }] : []),
          ...(context?.assignedPatients?.length ? [{
            field: 'patientId',
            operator: 'in' as const,
            value: context.assignedPatients
          }] : [])
        ]

      case 'volunteer':
        return [
          ...(context?.assignedPatients?.length ? [{
            field: 'patientId',
            operator: 'in' as const,
            value: context.assignedPatients
          }] : []),
          {
            field: 'isPublic',
            operator: 'eq' as const,
            value: true
          }
        ]

      case 'parent':
        return [
          ...(context?.childrenIds?.length ? [{
            field: 'patientId',
            operator: 'in' as const,
            value: context.childrenIds
          }] : [])
        ]

      case 'guest':
        return [{
          field: 'isPublic',
          operator: 'eq' as const,
          value: true
        }]

      default:
        return [{
          field: 'id',
          operator: 'eq' as const,
          value: null
        }]
    }
  }

  /**
   * 过滤统计数据
   */
  filterStatisticsData(
    data: any,
    role: UserRole,
    context?: any
  ): any {
    const config = this.getDataAccessConfig(role, '', context)

    if (!config.canRead) {
      return {
        totalPatients: 0,
        inCare: 0,
        pending: 0,
        discharged: 0
      }
    }

    // 根据角色限制数据范围
    switch (role) {
      case 'guest':
        // 只返回公开统计数据
        return {
          totalPatients: data.totalPatients || 0,
          publicStats: data.publicStats || {}
        }

      case 'parent':
        // 只返回与自己孩子相关的统计
        if (context?.childrenIds?.length) {
          return {
            totalPatients: context.childrenIds.length,
            childrenStats: data.childrenStats || {}
          }
        }
        return { totalPatients: 0 }

      case 'volunteer':
        // 只返回分配任务的统计
        if (context?.volunteerTasks?.length) {
          return {
            totalPatients: context.assignedPatients?.length || 0,
            taskStats: data.taskStats || {}
          }
        }
        return { totalPatients: 0 }

      case 'social_worker':
        // 返回科室范围的统计
        if (context?.departmentId) {
          return {
            ...data,
            departmentId: context.departmentId
          }
        }
        return data

      case 'admin':
      default:
        return data
    }
  }
}

export default DataFilterService