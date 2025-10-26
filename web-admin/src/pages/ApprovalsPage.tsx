import React, { useState, useEffect } from 'react';
import { useCloudbase } from '../hooks/useCloudbase';
import { useRBAC } from '../hooks/useRBAC';

interface RoleRequest {
  id: string;
  applicantOpenId: string;
  type: 'role' | 'contact_access';
  role?: string;
  scopeType?: string;
  scopeId?: string;
  state: 'pending' | 'approved' | 'rejected';
  attachments?: { name: string; fileId: string }[];
  reason?: string;
  reviewerId?: string;
  reviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface ApprovalFilters {
  state: string;
  type: string;
  role: string;
}

export const ApprovalsPage: React.FC = () => {
  const { app } = useCloudbase();

  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const [filters, setFilters] = useState<ApprovalFilters>({
    state: 'pending',
    type: '',
    role: '',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RoleRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchRequests = async () => {
    if (!app) return;

    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        pageSize,
      };

      if (filters.state) {
        params.state = filters.state;
      }

      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'listRoleRequests',
          ...params,
        },
      });

      if (res.result?.success) {
        setRequests(res.result.data.items || []);
        setTotal(res.result.data.total || 0);
      } else {
        console.error('Failed to fetch requests:', res.result?.error);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [app, currentPage, filters]);

  const handleApprove = async (requestId: string, reason?: string) => {
    if (!app) return;

    try {
      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'approveRoleRequest',
          requestId,
          reason,
        },
      });

      if (res.result?.success) {
        alert('申请已通过');
        setShowApproveModal(false);
        setSelectedRequest(null);
        fetchRequests();
      } else {
        alert(`审批失败: ${res.result?.error?.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('审批申请失败');
    }
  };

  const handleReject = async (requestId: string, reason: string) => {
    if (!app) return;

    if (!reason.trim()) {
      alert('请填写驳回理由');
      return;
    }

    try {
      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'rejectRoleRequest',
          requestId,
          reason: reason.trim(),
        },
      });

      if (res.result?.success) {
        alert('申请已驳回');
        setShowRejectModal(false);
        setRejectReason('');
        setSelectedRequest(null);
        fetchRequests();
      } else {
        alert(`驳回失败: ${res.result?.error?.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('驳回申请失败');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatState = (state: string) => {
    const stateMap: Record<string, string> = {
      pending: '待审批',
      approved: '已通过',
      rejected: '已驳回',
    };
    return stateMap[state] || state;
  };

  const formatType = (type: string) => {
    const typeMap: Record<string, string> = {
      role: '角色申请',
      contact_access: '联系方式访问',
    };
    return typeMap[type] || type;
  };

  const formatRole = (role?: string) => {
    if (!role) return '';
    const roleMap: Record<string, string> = {
      admin: '管理员',
      social_worker: '社工',
      volunteer: '志愿者',
      parent: '家长',
    };
    return roleMap[role] || role;
  };

  const getStateColor = (state: string) => {
    const colorMap: Record<string, string> = {
      pending: '#f59e0b',
      approved: '#10b981',
      rejected: '#ef4444',
    };
    return colorMap[state] || '#6b7280';
  };

  const getFilteredRequests = () => {
    return requests.filter(request => {
      if (filters.type && request.type !== filters.type) return false;
      if (filters.role && request.role !== filters.role) return false;
      return true;
    });
  };

  const filteredRequests = getFilteredRequests();

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>申请审批</h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          {showFilters ? '隐藏筛选' : '显示筛选'}
        </button>
      </div>

      {/* 筛选器 */}
      {showFilters && (
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '24px',
          border: '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                申请状态
              </label>
              <select
                value={filters.state}
                onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="">全部状态</option>
                <option value="pending">待审批</option>
                <option value="approved">已通过</option>
                <option value="rejected">已驳回</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                申请类型
              </label>
              <select
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="">全部类型</option>
                <option value="role">角色申请</option>
                <option value="contact_access">联系方式访问</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                申请角色
              </label>
              <select
                value={filters.role}
                onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                <option value="">全部角色</option>
                <option value="volunteer">志愿者</option>
                <option value="parent">家长</option>
                <option value="social_worker">社工</option>
              </select>
            </div>
          </div>

          <button
            onClick={() => {
              setFilters({ state: 'pending', type: '', role: '' });
              setCurrentPage(1);
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            重置筛选
          </button>
        </div>
      )}

      {/* 统计信息 */}
      <div style={{
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '24px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        gap: '32px',
        alignItems: 'center',
      }}>
        <div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>待审批：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px', color: '#f59e0b' }}>
            {requests.filter(r => r.state === 'pending').length}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>已通过：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px', color: '#10b981' }}>
            {requests.filter(r => r.state === 'approved').length}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>已驳回：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px', color: '#ef4444' }}>
            {requests.filter(r => r.state === 'rejected').length}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>总计：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px' }}>
            {requests.length}
          </span>
        </div>
      </div>

      {/* 申请列表 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            加载中...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            暂无申请数据
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    申请人
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    申请类型
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    角色
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    状态
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    申请时间
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: '14px', color: '#111827', fontWeight: 'medium' }}>
                        {request.applicantOpenId}
                      </div>
                      {request.attachments && request.attachments.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          附件: {request.attachments.length} 个
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                      {formatType(request.type)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                      {formatRole(request.role) || '-'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'medium',
                        backgroundColor: getStateColor(request.state),
                        color: 'white',
                      }}>
                        {formatState(request.state)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                      {formatDate(request.createdAt)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowDetailModal(true);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          查看
                        </button>
                        {request.state === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowApproveModal(true);
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              通过
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowRejectModal(true);
                              }}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              驳回
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 分页 */}
      {total > pageSize && (
        <div style={{
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
        }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage === 1 ? '#e5e7eb' : '#3b82f6',
              color: currentPage === 1 ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            上一页
          </button>

          <span style={{ fontSize: '14px', color: '#374151' }}>
            第 {currentPage} 页，共 {Math.ceil(total / pageSize)} 页
          </span>

          <button
            onClick={() => setCurrentPage(Math.min(Math.ceil(total / pageSize), currentPage + 1))}
            disabled={currentPage >= Math.ceil(total / pageSize)}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage >= Math.ceil(total / pageSize) ? '#e5e7eb' : '#3b82f6',
              color: currentPage >= Math.ceil(total / pageSize) ? '#9ca3af' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage >= Math.ceil(total / pageSize) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
            }}
          >
            下一页
          </button>
        </div>
      )}

      {/* 详情弹窗 */}
      {showDetailModal && selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>申请详情</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>申请人</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {selectedRequest.applicantOpenId}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>申请类型</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {formatType(selectedRequest.type)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>申请角色</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {formatRole(selectedRequest.role) || '-'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>状态</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {formatState(selectedRequest.state)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>申请时间</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {formatDate(selectedRequest.createdAt)}
                  </div>
                </div>
                {selectedRequest.reviewedAt && (
                  <div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>处理时间</div>
                    <div style={{ fontSize: '14px', color: '#111827' }}>
                      {formatDate(selectedRequest.reviewedAt)}
                    </div>
                  </div>
                )}
              </div>

              {selectedRequest.reason && (
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>申请理由</div>
                  <div style={{ fontSize: '14px', color: '#111827', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '4px' }}>
                    {selectedRequest.reason}
                  </div>
                </div>
              )}

              {selectedRequest.attachments && selectedRequest.attachments.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>附件</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedRequest.attachments.map((attachment, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        backgroundColor: '#f9fafb',
                        borderRadius: '4px',
                        fontSize: '14px',
                        color: '#111827',
                      }}>
                        📎 {attachment.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 通过弹窗 */}
      {showApproveModal && selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>通过申请</h3>
              <button
                onClick={() => setShowApproveModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: 0, color: '#374151' }}>
                确定要通过 <strong>{selectedRequest.applicantOpenId}</strong> 的
                <strong> {formatRole(selectedRequest.role)}</strong> 角色申请吗？
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowApproveModal(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={() => handleApprove(selectedRequest.id)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 驳回弹窗 */}
      {showRejectModal && selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>驳回申请</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 16px 0', color: '#374151' }}>
                驳回 <strong>{selectedRequest.applicantOpenId}</strong> 的
                <strong> {formatRole(selectedRequest.role)}</strong> 角色申请
              </p>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                  驳回理由 *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="请输入驳回理由"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                取消
              </button>
              <button
                onClick={() => handleReject(selectedRequest.id, rejectReason)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                驳回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};