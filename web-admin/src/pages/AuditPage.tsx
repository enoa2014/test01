import React, { useState, useCallback, useEffect } from 'react';
import { useCloudFunction } from '../hooks/useCloudFunction';
import { useRBAC } from '../contexts/RBACContext';
import { AdminRouteGuard } from '../components/AdminRouteGuard';
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Activity,
  AlertTriangle,
  Info,
  AlertCircle,
  ChevronDown,
  Clock
} from 'lucide-react';

interface AuditLog {
  _id: string;
  actorUserId: string;
  actorRole?: string;
  action: string;
  target?: {
    type: string;
    id?: string;
  };
  message?: string;
  changes?: any;
  level?: 'info' | 'warn' | 'error';
  ip?: string;
  ua?: string;
  createdAt: number;
}

interface AuditFilters {
  actor?: string;
  action?: string;
  targetType?: string;
  level?: string;
  from?: number;
  to?: number;
}

const AuditPage: React.FC = () => {
  const { isAdmin, hasRole } = useRBAC();
  const { callFunction } = useCloudFunction();

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false
  });

  // 加载审计日志
  const loadAuditLogs = useCallback(async (page = 1, append = false) => {
    setIsLoadingLogs(true);
    try {
      const response = await callFunction('audit', {
        action: 'listLogs',
        filters: {
          ...filters,
          // 转换日期时间戳
          from: filters.from ? new Date(filters.from).getTime() : undefined,
          to: filters.to ? new Date(filters.to).getTime() + 24 * 60 * 60 * 1000 - 1 : undefined
        },
        page,
        pageSize: pagination.pageSize
      });

      if (response.success) {
        const newLogs = response.data.items;
        setAuditLogs(prev => append ? [...prev, ...newLogs] : newLogs);
        setPagination(prev => ({
          ...prev,
          total: response.data.total,
          hasMore: response.data.hasMore,
          page
        }));
      }
    } catch (error) {
      console.error('加载审计日志失败:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [callFunction, filters, pagination.pageSize]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // 查看日志详情
  const handleViewDetail = useCallback(async (logId: string) => {
    try {
      const response = await callFunction('audit', {
        action: 'getLog',
        id: logId
      });

      if (response.success) {
        setSelectedLog(response.data);
        setShowDetailModal(true);
      } else {
        throw new Error(response.error?.message || '获取日志详情失败');
      }
    } catch (error) {
      console.error('获取日志详情失败:', error);
      alert('获取日志详情失败：' + (error as Error).message);
    }
  }, [callFunction]);

  // 应用过滤器
  const handleApplyFilters = useCallback(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadAuditLogs(1, false);
    setShowFilterModal(false);
  }, [loadAuditLogs]);

  // 重置过滤器
  const handleResetFilters = useCallback(() => {
    setFilters({});
    setPagination(prev => ({ ...prev, page: 1 }));
    loadAuditLogs(1, false);
    setShowFilterModal(false);
  }, [loadAuditLogs]);

  // 加载更多
  const handleLoadMore = useCallback(() => {
    if (pagination.hasMore && !isLoadingLogs) {
      loadAuditLogs(pagination.page + 1, true);
    }
  }, [loadAuditLogs, pagination.hasMore, pagination.page, isLoadingLogs]);

  // 获取级别颜色
  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warn': return 'text-yellow-600 bg-yellow-50';
      case 'info': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // 获取级别图标
  const getLevelIcon = (level?: string) => {
    switch (level) {
      case 'error': return AlertCircle;
      case 'warn': return AlertTriangle;
      case 'info': return Info;
      default: return Activity;
    }
  };

  // 获取操作描述
  const getActionDescription = (action: string) => {
    const actionMap: { [key: string]: string } = {
      'role.add': '添加角色',
      'role.remove': '移除角色',
      'role.approve': '审批角色申请',
      'role.reject': '拒绝角色申请',
      'invite.create': '创建邀请',
      'invite.revoke': '撤销邀请',
      'user.enable': '启用用户',
      'user.disable': '禁用用户',
      'patient.create': '创建患者',
      'patient.update': '更新患者',
      'patient.delete': '删除患者',
      'media.upload': '上传文件',
      'media.delete': '删除文件',
      'import.create': '创建导入任务',
      'import.run': '执行导入',
      'export.create': '创建导出任务',
      'export.run': '执行导出',
      'export.download': '下载导出文件',
      'login': '用户登录',
      'logout': '用户登出'
    };
    return actionMap[action] || action;
  };

  // 检查权限
  const canViewAudit = isAdmin || hasRole('social_worker');

  if (!canViewAudit) {
    return (
      <AdminRouteGuard>
        <div className="p-6">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">无权限访问</h3>
            <p className="mt-1 text-sm text-gray-500">您没有查看审计日志的权限</p>
          </div>
        </div>
      </AdminRouteGuard>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 现代化页面头部 */}
      <div className="hero" style={{
        padding: 'var(--space-8) var(--space-5) var(--space-4)',
        background: 'linear-gradient(180deg, var(--color-bg-primary, #ffffff) 0%, var(--color-bg-secondary, #f8fafc) 100%)',
        borderRadius: 16,
        marginBottom: 24,
        border: '1px solid var(--color-border-secondary, #e2e8f0)',
        boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(15, 23, 42, 0.08))'
      }}>
        <div className="hero-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap'
        }}>
          <div>
            <h1 className="title" style={{
              fontSize: 'var(--text-xl, 20px)',
              fontWeight: 'var(--font-semibold, 600)',
              color: 'var(--color-text-primary, #1f2937)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              margin: 0
            }}>
              <span style={{ color: 'var(--color-primary, #3b82f6)' }}>📋</span>
              审计日志中心
            </h1>
            <p className="hero-subtitle" style={{
              margin: 'var(--space-1) 0 0',
              fontSize: 'var(--text-sm, 14px)',
              color: 'var(--color-text-secondary, #64748b)'
            }}>
              查看系统操作记录和安全事件，支持高级筛选
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setShowFilterModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Filter style={{ width: 16, height: 16 }} />
              过滤
            </button>
            <button
              onClick={() => loadAuditLogs(1, false)}
              disabled={isLoadingLogs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#374151',
                cursor: isLoadingLogs ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: isLoadingLogs ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoadingLogs) {
                  e.currentTarget.style.background = '#f9fafb';
                  e.currentTarget.style.borderColor = '#9ca3af';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoadingLogs) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              <RefreshCw style={{
                width: 16,
                height: 16,
                animation: isLoadingLogs ? 'spin 1s linear infinite' : 'none'
              }} />
              刷新
            </button>
          </div>
        </div>
      </div>

      {/* 现代化过滤条件显示 */}
      {Object.keys(filters).some(key => filters[key as keyof AuditFilters]) && (
        <div style={{
          marginBottom: 20,
          padding: 16,
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          borderRadius: 12,
          border: '1px solid #bfdbfe',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flex: 1,
              minWidth: 0
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: '#1e40af'
              }}>
                <Filter style={{ width: 14, height: 14 }} />
                当前过滤条件
              </div>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                flex: 1,
                minWidth: 0
              }}>
                {filters.actor && (
                  <span style={{
                    display: 'inline-flex',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    color: '#1e40af',
                    border: '1px solid #93c5fd',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    👤 {filters.actor}
                  </span>
                )}
                {filters.action && (
                  <span style={{
                    display: 'inline-flex',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    color: '#1e40af',
                    border: '1px solid #93c5fd',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    🔧 {getActionDescription(filters.action)}
                  </span>
                )}
                {filters.level && (
                  <span style={{
                    display: 'inline-flex',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 6,
                    background: filters.level === 'error'
                      ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                      : filters.level === 'warn'
                      ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                      : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    color: filters.level === 'error'
                      ? '#991b1b'
                      : filters.level === 'warn'
                      ? '#92400e'
                      : '#1e40af',
                    border: filters.level === 'error'
                      ? '1px solid #fca5a5'
                      : filters.level === 'warn'
                      ? '1px solid #fbbf24'
                      : '1px solid #93c5fd'
                  }}>
                    {filters.level === 'error' ? '🚨' : filters.level === 'warn' ? '⚠️' : 'ℹ️'} {filters.level}
                  </span>
                )}
                {filters.from && (
                  <span style={{
                    display: 'inline-flex',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    color: '#1e40af',
                    border: '1px solid #93c5fd'
                  }}>
                    📅 {new Date(filters.from).toLocaleDateString()}
                  </span>
                )}
                {filters.to && (
                  <span style={{
                    display: 'inline-flex',
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                    color: '#1e40af',
                    border: '1px solid #93c5fd'
                  }}>
                    📅 {new Date(filters.to).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleResetFilters}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid #fca5a5',
                background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                color: '#991b1b',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              ✕ 清除过滤
            </button>
          </div>
        </div>
      )}

      {/* 现代化审计日志列表 */}
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: 24,
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            📋 操作记录
            {pagination.total > 0 && (
              <span style={{
                fontSize: 14,
                color: '#64748b',
                fontWeight: 400,
                marginLeft: 8
              }}>
                ({pagination.total})
              </span>
            )}
          </h2>
        </div>

        {isLoadingLogs && auditLogs.length === 0 ? (
          <div style={{
            padding: 64,
            textAlign: 'center'
          }}>
            <div style={{
              width: 48,
              height: 48,
              border: '3px solid #e2e8f0',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ fontSize: 14, color: '#64748b' }}>加载中...</p>
          </div>
        ) : auditLogs.length === 0 ? (
          <div style={{
            padding: 64,
            textAlign: 'center'
          }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 32,
              color: '#9ca3af'
            }}>
              📋
            </div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 8
            }}>
              暂无审计记录
            </h3>
            <p style={{ fontSize: 14, color: '#64748b' }}>
              暂时没有找到符合条件的操作记录
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {auditLogs.map((log, index) => {
              const LevelIcon = getLevelIcon(log.level);
              return (
                <div
                  key={log._id}
                  style={{
                    padding: 20,
                    borderBottom: index < auditLogs.length - 1 ? '1px solid #e2e8f0' : 'none',
                    backgroundColor: index % 2 === 0 ? 'white' : '#f8fafc',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                    e.currentTarget.style.transform = 'scale(1.001)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f8fafc';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                    flex: 1,
                    minWidth: 0
                  }}>
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                      background: log.level === 'error'
                        ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                        : log.level === 'warn'
                        ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                        : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                      color: log.level === 'error'
                        ? '#991b1b'
                        : log.level === 'warn'
                        ? '#92400e'
                        : '#1e40af',
                      border: `1px solid ${
                        log.level === 'error' ? '#fca5a5' :
                        log.level === 'warn' ? '#fbbf24' : '#93c5fd'
                      }`
                    }}>
                      {log.level === 'error' ? '🚨' : log.level === 'warn' ? '⚠️' : 'ℹ️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                        flexWrap: 'wrap'
                      }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#1e293b',
                          background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1'
                        }}>
                          {getActionDescription(log.action)}
                        </span>
                        {log.target && (
                          <span style={{
                            fontSize: 12,
                            color: '#64748b',
                            background: '#f8fafc',
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: '1px solid #e2e8f0',
                            maxWidth: 150,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            → {log.target.type}{log.target.id && `#${log.target.id}`}
                          </span>
                        )}
                      </div>
                      {log.message && (
                        <p style={{
                          fontSize: 13,
                          color: '#64748b',
                          marginBottom: 12,
                          lineHeight: 1.4,
                          background: '#f8fafc',
                          padding: 8,
                          borderRadius: 6,
                          border: '1px solid #e2e8f0'
                        }}>
                          {log.message}
                        </p>
                      )}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        fontSize: 11,
                        color: '#9ca3af',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          <span>👤</span>
                          {log.actorUserId}
                          {log.actorRole && (
                            <span style={{ color: '#64748ab8' }}>({log.actorRole})</span>
                          )}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: '#f1f5f9',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}>
                          <span>🕐</span>
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                        {log.ip && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#f1f5f9',
                            padding: '2px 6px',
                            borderRadius: 4
                          }}>
                            <span>🌐</span>
                            IP: {log.ip}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleViewDetail(log._id)}
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      color: '#6b7280',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#9ca3af';
                      e.currentTarget.style.color = '#374151';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.color = '#6b7280';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    <Eye style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 加载更多 */}
        {pagination.hasMore && (
          <div className="p-4 text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingLogs}
              className="flex items-center mx-auto px-4 py-2 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {isLoadingLogs ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  加载中...
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" />
                  加载更多
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 过滤条件模态框 */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">过滤条件</h3>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作者
                </label>
                <input
                  type="text"
                  placeholder="用户ID或用户名"
                  value={filters.actor || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, actor: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作类型
                </label>
                <select
                  value={filters.action || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部操作</option>
                  <option value="login">用户登录</option>
                  <option value="role.add">添加角色</option>
                  <option value="role.remove">移除角色</option>
                  <option value="role.approve">审批角色申请</option>
                  <option value="invite.create">创建邀请</option>
                  <option value="user.enable">启用用户</option>
                  <option value="user.disable">禁用用户</option>
                  <option value="patient.create">创建患者</option>
                  <option value="patient.update">更新患者</option>
                  <option value="import.create">创建导入任务</option>
                  <option value="export.create">创建导出任务</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日志级别
                </label>
                <select
                  value={filters.level || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">全部级别</option>
                  <option value="info">信息</option>
                  <option value="warn">警告</option>
                  <option value="error">错误</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  时间范围
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.from || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, from: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="date"
                    value={filters.to || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, to: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                重置
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                应用过滤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情模态框 */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">日志详情</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">操作者</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {selectedLog.actorUserId}
                    {selectedLog.actorRole && ` (${selectedLog.actorRole})`}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">操作</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {getActionDescription(selectedLog.action)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">时间</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">级别</label>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getLevelColor(selectedLog.level)}`}>
                      {selectedLog.level || 'info'}
                    </span>
                  </div>
                </div>
              </div>

              {selectedLog.target && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">目标对象</label>
                  <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                    <div>类型: {selectedLog.target.type}</div>
                    {selectedLog.target.id && <div>ID: {selectedLog.target.id}</div>}
                  </div>
                </div>
              )}

              {selectedLog.message && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                  <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                    {selectedLog.message}
                  </div>
                </div>
              )}

              {selectedLog.changes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">变更内容</label>
                  <div className="bg-gray-50 p-3 rounded">
                    <pre className="text-xs text-gray-900 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedLog.ip && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IP地址</label>
                    <div className="mt-1 text-sm text-gray-900">{selectedLog.ip}</div>
                  </div>
                )}
                {selectedLog.ua && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">用户代理</label>
                    <div className="mt-1 text-sm text-gray-900 truncate" title={selectedLog.ua}>
                      {selectedLog.ua}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditPage;
