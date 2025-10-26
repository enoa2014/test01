/**
 * 系统权限常量定义
 *
 * 权限命名规则：[资源]_[操作]
 * 例如：view_patients（查看患者）、edit_patients（编辑患者）
 */

// 患者管理权限
export const PATIENT_PERMISSIONS = {
  VIEW_PATIENTS: 'view_patients',
  VIEW_PATIENT_DETAIL: 'view_patient_detail',
  EDIT_PATIENTS: 'edit_patients',
  DELETE_PATIENTS: 'delete_patients',
  ADD_PATIENTS: 'add_patients',
  EXPORT_PATIENTS: 'export_patients',
  IMPORT_PATIENTS: 'import_patients',
  UPDATE_PATIENT_STATUS: 'update_patient_status',
} as const;

// 数据分析权限
export const ANALYTICS_PERMISSIONS = {
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_DASHBOARD: 'view_dashboard',
  EXPORT_REPORTS: 'export_reports',
  ADVANCED_ANALYTICS: 'advanced_analytics',
} as const;

// 用户管理权限
export const USER_PERMISSIONS = {
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  CREATE_USERS: 'create_users',
  DELETE_USERS: 'delete_users',
  ASSIGN_ROLES: 'assign_roles',
} as const;

// 角色管理权限
export const ROLE_PERMISSIONS = {
  VIEW_ROLES: 'view_roles',
  MANAGE_ROLES: 'manage_roles',
  CREATE_ROLES: 'create_roles',
  DELETE_ROLES: 'delete_roles',
  ASSIGN_PERMISSIONS: 'assign_permissions',
} as const;

// 系统管理权限
export const SYSTEM_PERMISSIONS = {
  SYSTEM_SETTINGS: 'system_settings',
  VIEW_AUDIT: 'view_audit',
  MANAGE_INVITES: 'manage_invites',
  APPROVE_REQUESTS: 'approve_requests',
  SYSTEM_BACKUP: 'system_backup',
  SYSTEM_MAINTENANCE: 'system_maintenance',
} as const;

// 内容管理权限
export const CONTENT_PERMISSIONS = {
  IMPORT_DATA: 'import_data',
  EXPORT_DATA: 'export_data',
  MANAGE_MEDIA: 'manage_media',
  VIEW_MEDIA: 'view_media',
  DELETE_MEDIA: 'delete_media',
} as const;

// 所有权限的联合类型
export type Permission =
  | typeof PATIENT_PERMISSIONS[keyof typeof PATIENT_PERMISSIONS]
  | typeof ANALYTICS_PERMISSIONS[keyof typeof ANALYTICS_PERMISSIONS]
  | typeof USER_PERMISSIONS[keyof typeof USER_PERMISSIONS]
  | typeof ROLE_PERMISSIONS[keyof typeof ROLE_PERMISSIONS]
  | typeof SYSTEM_PERMISSIONS[keyof typeof SYSTEM_PERMISSIONS]
  | typeof CONTENT_PERMISSIONS[keyof typeof CONTENT_PERMISSIONS];

// 权限分组
export const PERMISSION_GROUPS = {
  PATIENT_MANAGEMENT: Object.values(PATIENT_PERMISSIONS),
  DATA_ANALYTICS: Object.values(ANALYTICS_PERMISSIONS),
  USER_MANAGEMENT: Object.values(USER_PERMISSIONS),
  ROLE_MANAGEMENT: Object.values(ROLE_PERMISSIONS),
  SYSTEM_ADMINISTRATION: Object.values(SYSTEM_PERMISSIONS),
  CONTENT_MANAGEMENT: Object.values(CONTENT_PERMISSIONS),
} as const;

// 权限描述
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  // 患者管理
  [PATIENT_PERMISSIONS.VIEW_PATIENTS]: '查看患者列表',
  [PATIENT_PERMISSIONS.VIEW_PATIENT_DETAIL]: '查看患者详细信息',
  [PATIENT_PERMISSIONS.EDIT_PATIENTS]: '编辑患者信息',
  [PATIENT_PERMISSIONS.DELETE_PATIENTS]: '删除患者记录',
  [PATIENT_PERMISSIONS.ADD_PATIENTS]: '添加新患者',
  [PATIENT_PERMISSIONS.EXPORT_PATIENTS]: '导出患者数据',
  [PATIENT_PERMISSIONS.IMPORT_PATIENTS]: '导入患者数据',
  [PATIENT_PERMISSIONS.UPDATE_PATIENT_STATUS]: '更新患者状态',

  // 数据分析
  [ANALYTICS_PERMISSIONS.VIEW_ANALYTICS]: '查看数据分析',
  [ANALYTICS_PERMISSIONS.VIEW_DASHBOARD]: '查看仪表板',
  [ANALYTICS_PERMISSIONS.EXPORT_REPORTS]: '导出报告',
  [ANALYTICS_PERMISSIONS.ADVANCED_ANALYTICS]: '高级数据分析',

  // 用户管理
  [USER_PERMISSIONS.VIEW_USERS]: '查看用户列表',
  [USER_PERMISSIONS.MANAGE_USERS]: '管理用户信息',
  [USER_PERMISSIONS.CREATE_USERS]: '创建新用户',
  [USER_PERMISSIONS.DELETE_USERS]: '删除用户',
  [USER_PERMISSIONS.ASSIGN_ROLES]: '分配用户角色',

  // 角色管理
  [ROLE_PERMISSIONS.VIEW_ROLES]: '查看角色列表',
  [ROLE_PERMISSIONS.MANAGE_ROLES]: '管理角色信息',
  [ROLE_PERMISSIONS.CREATE_ROLES]: '创建新角色',
  [ROLE_PERMISSIONS.DELETE_ROLES]: '删除角色',
  [ROLE_PERMISSIONS.ASSIGN_PERMISSIONS]: '分配角色权限',

  // 系统管理
  [SYSTEM_PERMISSIONS.SYSTEM_SETTINGS]: '系统设置管理',
  [SYSTEM_PERMISSIONS.VIEW_AUDIT]: '查看审计日志',
  [SYSTEM_PERMISSIONS.MANAGE_INVITES]: '管理邀请码',
  [SYSTEM_PERMISSIONS.APPROVE_REQUESTS]: '审批申请',
  [SYSTEM_PERMISSIONS.SYSTEM_BACKUP]: '系统备份',
  [SYSTEM_PERMISSIONS.SYSTEM_MAINTENANCE]: '系统维护',

  // 内容管理
  [CONTENT_PERMISSIONS.IMPORT_DATA]: '导入数据',
  [CONTENT_PERMISSIONS.EXPORT_DATA]: '导出数据',
  [CONTENT_PERMISSIONS.MANAGE_MEDIA]: '管理媒体文件',
  [CONTENT_PERMISSIONS.VIEW_MEDIA]: '查看媒体文件',
  [CONTENT_PERMISSIONS.DELETE_MEDIA]: '删除媒体文件',
} as const;