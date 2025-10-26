import React, { useState, useCallback, useEffect } from 'react';
import { useCloudFunction } from '../hooks/useCloudFunction';
import { useRBAC } from '../contexts/RBACContext';
import { AdminRouteGuard } from '../components/AdminRouteGuard';
import {
  Download,
  FileSpreadsheet,
  Filter,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search
} from 'lucide-react';

interface ExportJob {
  _id: string;
  filters: any;
  fieldsPolicy: 'full' | 'masked';
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  stats?: {
    total: number;
    exported: number;
    failed: number;
  };
  fileId?: string;
  filename?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

interface ExportFilters {
  keyword?: string;
  gender?: string;
  hometown?: string;
  diagnosis?: string;
  currentStatus?: string;
}

const ExportPage: React.FC = () => {
  const { isAdmin, hasRole } = useRBAC();
  const { callFunction } = useCloudFunction();

  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isCreatingExport, setIsCreatingExport] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<ExportFilters>({});
  const [fieldsPolicy, setFieldsPolicy] = useState<'full' | 'masked'>('masked');

  // 加载导出任务列表
  const loadExportJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const response = await callFunction('exportData', {
        action: 'listJobs',
        page: 1,
        pageSize: 50
      });

      if (response.success) {
        setExportJobs(response.data.items);
      }
    } catch (error) {
      console.error('加载导出历史失败:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [callFunction]);

  useEffect(() => {
    loadExportJobs();
  }, [loadExportJobs]);

  // 创建导出任务
  const handleCreateExport = useCallback(async () => {
    setIsCreatingExport(true);
    try {
      const response = await callFunction('exportData', {
        action: 'create',
        filters,
        fieldsPolicy
      });

      if (response.success) {
        // 立即执行导出
        const executeResponse = await callFunction('exportData', {
          action: 'export',
          jobId: response.jobId
        });

        if (executeResponse.success) {
          setShowFilterModal(false);
          setFilters({});
          loadExportJobs();
        } else {
          throw new Error(executeResponse.error?.message || '导出失败');
        }
      } else {
        throw new Error(response.error?.message || '创建导出任务失败');
      }
    } catch (error) {
      console.error('创建导出失败:', error);
      alert('导出失败：' + (error as Error).message);
    } finally {
      setIsCreatingExport(false);
    }
  }, [callFunction, filters, fieldsPolicy, loadExportJobs]);

  // 下载导出文件
  const handleDownload = useCallback(async (jobId: string) => {
    try {
      const response = await callFunction('exportData', {
        action: 'download',
        jobId
      });

      if (response.success) {
        // 创建临时下载链接
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = response.filename || 'export.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error(response.error?.message || '获取下载链接失败');
      }
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败：' + (error as Error).message);
    }
  }, [callFunction]);

  // 获取状态颜色
  const getStateColor = (state: string) => {
    switch (state) {
      case 'queued': return 'text-yellow-600 bg-yellow-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      case 'succeeded': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // 获取状态文本
  const getStateText = (state: string) => {
    switch (state) {
      case 'queued': return '排队中';
      case 'running': return '导出中';
      case 'succeeded': return '导出成功';
      case 'failed': return '导出失败';
      default: return state;
    }
  };

  // 获取状态图标
  const getStateIcon = (state: string) => {
    switch (state) {
      case 'queued': return Clock;
      case 'running': return RefreshCw;
      case 'succeeded': return CheckCircle;
      case 'failed': return XCircle;
      default: return AlertTriangle;
    }
  };

  // 检查用户权限
  const canExport = isAdmin || hasRole('social_worker');
  const canExportFullData = isAdmin;

  if (!canExport) {
    return (
      <AdminRouteGuard>
        <div className="p-6">
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">无权限访问</h3>
            <p className="mt-1 text-sm text-gray-500">您没有导出数据的权限</p>
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
              <span style={{ color: 'var(--color-primary, #3b82f6)' }}>📤</span>
              数据导出中心
            </h1>
            <p className="hero-subtitle" style={{
              margin: 'var(--space-1) 0 0',
              fontSize: 'var(--text-sm, 14px)',
              color: 'var(--color-text-secondary, #64748b)'
            }}>
              导出患者数据到Excel文件，支持自定义筛选条件
            </p>
          </div>
          <button
            onClick={() => setShowFilterModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: '#ffffff',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            新建导出
          </button>
        </div>
      </div>

      {/* 现代化导出历史 */}
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
            📋 导出历史
          </h2>
          <button
            onClick={loadExportJobs}
            disabled={isLoadingJobs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              border: '1px solid #d1d5db',
              background: '#ffffff',
              color: '#374151',
              cursor: isLoadingJobs ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: isLoadingJobs ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!isLoadingJobs) {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.borderColor = '#9ca3af';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoadingJobs) {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.borderColor = '#d1d5db';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <RefreshCw style={{
              width: 14,
              height: 14,
              animation: isLoadingJobs ? 'spin 1s linear infinite' : 'none'
            }} />
            刷新
          </button>
        </div>

        {isLoadingJobs ? (
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
        ) : exportJobs.length === 0 ? (
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
              📊
            </div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#374151',
              marginBottom: 8
            }}>
              暂无导出记录
            </h3>
            <p style={{ fontSize: 14, color: '#64748b' }}>
              创建您的第一个导出任务来获取患者数据
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              fontSize: 14
            }}>
              <thead>
                <tr style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  borderBottom: '2px solid #e2e8f0'
                }}>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    导出条件
                  </th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    数据策略
                  </th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    状态
                  </th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    统计
                  </th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderRight: '1px solid #e2e8f0'
                  }}>
                    创建时间
                  </th>
                  <th style={{
                    padding: '16px 12px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {exportJobs.map((job) => {
                  const StateIcon = getStateIcon(job.state);
                  return (
                    <tr key={job._id} style={{
                      backgroundColor: exportJobs.indexOf(job) % 2 === 0 ? 'white' : '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.transform = 'scale(1.001)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = exportJobs.indexOf(job) % 2 === 0 ? 'white' : '#f8fafc';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    >
                      <td style={{
                        padding: '16px 12px',
                        borderRight: '1px solid #e2e8f0'
                      }}>
                        <div style={{ maxWidth: 200 }}>
                          {job.filters && Object.keys(job.filters).length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {job.filters.keyword && (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontSize: 11,
                                  color: '#374151',
                                  gap: 4
                                }}>
                                  <span>🔍</span>
                                  关键词: {job.filters.keyword}
                                </div>
                              )}
                              {job.filters.gender && (
                                <div style={{ fontSize: 11, color: '#374151' }}>
                                  性别: {job.filters.gender}
                                </div>
                              )}
                              {job.filters.hometown && (
                                <div style={{ fontSize: 11, color: '#374151' }}>
                                  籍贯: {job.filters.hometown}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: '#9ca3af' }}>全部数据</span>
                          )}
                        </div>
                      </td>
                      <td style={{
                        padding: '16px 12px',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>
                        <span style={{
                          display: 'inline-flex',
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 6,
                          background: job.fieldsPolicy === 'full'
                            ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                            : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                          color: job.fieldsPolicy === 'full' ? '#6b21a8' : '#1e40af',
                          border: `1px solid ${job.fieldsPolicy === 'full' ? '#c4b5fd' : '#93c5fd'}`
                        }}>
                          {job.fieldsPolicy === 'full' ? '🔓 完整数据' : '🔒 脱敏数据'}
                        </span>
                      </td>
                      <td style={{
                        padding: '16px 12px',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            background: job.state === 'succeeded'
                              ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                              : job.state === 'failed'
                              ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                              : job.state === 'running'
                              ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                              : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            color: job.state === 'succeeded'
                              ? '#065f46'
                              : job.state === 'failed'
                              ? '#991b1b'
                              : job.state === 'running'
                              ? '#1e40af'
                              : '#92400e',
                            border: `1px solid ${
                              job.state === 'succeeded' ? '#6ee7b7' :
                              job.state === 'failed' ? '#fca5a5' :
                              job.state === 'running' ? '#93c5fd' : '#fbbf24'
                            }`
                          }}>
                            {job.state === 'succeeded' ? '✓' :
                             job.state === 'failed' ? '✗' :
                             job.state === 'running' ? '⚡' : '⏳'}
                          </div>
                          <span style={{
                            display: 'inline-flex',
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            background: job.state === 'succeeded'
                              ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                              : job.state === 'failed'
                              ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                              : job.state === 'running'
                              ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                              : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            color: job.state === 'succeeded'
                              ? '#065f46'
                              : job.state === 'failed'
                              ? '#991b1b'
                              : job.state === 'running'
                              ? '#1e40af'
                              : '#92400e'
                          }}>
                            {getStateText(job.state)}
                          </span>
                        </div>
                        {job.state === 'running' && (
                          <div style={{ fontSize: 11, color: '#64748b', marginLeft: 40 }}>
                            正在处理中...
                          </div>
                        )}
                        {job.state === 'failed' && job.error && (
                          <div style={{
                            fontSize: 11,
                            color: '#991b1b',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginLeft: 40
                          }} title={job.error}>
                            {job.error}
                          </div>
                        )}
                      </td>
                      <td style={{
                        padding: '16px 12px',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                        fontSize: 12,
                        color: '#374151'
                      }}>
                        {job.stats && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>📊</span>
                              总计: {job.stats.total}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span>✅</span>
                              成功: {job.stats.exported}
                            </div>
                            {job.stats.failed > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#991b1b' }}>
                                <span>❌</span>
                                失败: {job.stats.failed}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{
                        padding: '16px 12px',
                        borderRight: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap',
                        fontSize: 12,
                        color: '#374151'
                      }}>
                        <div style={{ marginBottom: 4 }}>
                          {new Date(job.createdAt).toLocaleString()}
                        </div>
                        {job.completedAt && (
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>
                            完成: {new Date(job.completedAt).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        {job.state === 'succeeded' && job.fileId && (
                          <button
                            onClick={() => handleDownload(job._id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '8px 16px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              border: 'none',
                              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                              color: '#ffffff',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.25)';
                            }}
                          >
                            <Download style={{ width: 14, height: 14 }} />
                            下载
                          </button>
                        )}
                        {job.state === 'failed' && (
                          <span style={{
                            display: 'inline-flex',
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                            color: '#991b1b'
                          }}>
                            ❌ 已失败
                          </span>
                        )}
                        {job.state === 'running' && (
                          <span style={{
                            display: 'inline-flex',
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                            color: '#1e40af'
                          }}>
                            ⚡ 处理中...
                          </span>
                        )}
                        {job.state === 'queued' && (
                          <span style={{
                            display: 'inline-flex',
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 6,
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            color: '#92400e'
                          }}>
                            ⏳ 排队中
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 过滤条件模态框 */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">新建导出</h3>
              <button
                onClick={() => setShowFilterModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 过滤条件 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  过滤条件（可选）
                </label>
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      placeholder="搜索关键词（姓名、身份证、电话等）"
                      value={filters.keyword || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <select
                      value={filters.gender || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value || undefined }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">全部性别</option>
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="籍贯"
                      value={filters.hometown || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, hometown: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="疾病诊断"
                      value={filters.diagnosis || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, diagnosis: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="目前状况"
                      value={filters.currentStatus || ''}
                      onChange={(e) => setFilters(prev => ({ ...prev, currentStatus: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* 数据策略 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  数据策略
                </label>
                <div className="space-y-2">
                  {canExportFullData && (
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="fieldsPolicy"
                        value="full"
                        checked={fieldsPolicy === 'full'}
                        onChange={(e) => setFieldsPolicy(e.target.value as any)}
                        className="mr-2"
                      />
                      <div>
                        <span className="font-medium">完整数据</span>
                        <span className="text-gray-500 text-sm ml-2">包含所有敏感信息</span>
                      </div>
                    </label>
                  )}
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="fieldsPolicy"
                      value="masked"
                      checked={fieldsPolicy === 'masked'}
                      onChange={(e) => setFieldsPolicy(e.target.value as any)}
                      className="mr-2"
                    />
                    <div>
                      <span className="font-medium">脱敏数据</span>
                      <span className="text-gray-500 text-sm ml-2">隐藏敏感信息（推荐）</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 说明 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start">
                  <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 mr-2" />
                  <div className="text-sm text-blue-900">
                    <p className="font-medium">导出说明</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li>• 导出文件为Excel格式，包含所有符合条件的患者数据</li>
                      <li>• 脱敏模式下，身份证号、手机号等敏感信息将被部分隐藏</li>
                      <li>• 导出文件保存7天，请及时下载</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateExport}
                disabled={isCreatingExport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreatingExport ? (
                  <div className="flex items-center">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    导出中...
                  </div>
                ) : (
                  '开始导出'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportPage;
