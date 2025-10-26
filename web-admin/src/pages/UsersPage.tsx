import React, { useState, useEffect } from 'react';
import { useCloudbase } from '../hooks/useCloudbase';
import { useRBAC } from '../hooks/useRBAC';

interface User {
  id: string;
  openid: string;
  displayName: string;
  phone: string;
  avatar: string;
  status: 'active' | 'suspended';
  lastLoginAt: number;
  createdAt: number;
}

interface UserFilters {
  keyword: string;
  roles: string[];
  status: string[];
  timeRange: [number, number] | null;
}

export const UsersPage: React.FC = () => {
  const { app } = useCloudbase();
  const { isAdmin } = useRBAC();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const [filters, setFilters] = useState<UserFilters>({
    keyword: '',
    roles: [],
    status: [],
    timeRange: null,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDetail, setShowUserDetail] = useState(false);

  const fetchUsers = async () => {
    if (!app) return;

    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        pageSize,
      };

      if (filters.keyword) {
        params.keyword = filters.keyword;
      }
      if (filters.roles.length > 0) {
        params.roles = filters.roles;
      }
      if (filters.status.length > 0) {
        params.status = filters.status;
      }
      if (filters.timeRange) {
        params.timeRange = filters.timeRange;
      }

      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'listUsers',
          ...params,
        },
      });

      if (res.result?.success) {
        setUsers(res.result.data.items || []);
        setTotal(res.result.data.total || 0);
      } else {
        console.error('Failed to fetch users:', res.result?.error);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [app, currentPage, filters]);

  const handleStatusToggle = async (user: User) => {
    if (!app || !isAdmin) return;

    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    const confirmMessage = `确定要${newStatus === 'active' ? '启用' : '禁用'}用户 "${user.displayName || user.openid}" 吗？`;

    if (!window.confirm(confirmMessage)) return;

    try {
      // 这里需要实现用户状态更新的云函数action
      // 暂时显示提示信息
      alert('用户状态更新功能正在开发中...');
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('更新用户状态失败');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatStatus = (status: string) => {
    return status === 'active' ? '正常' : '已禁用';
  };

  const resetFilters = () => {
    setFilters({
      keyword: '',
      roles: [],
      status: [],
      timeRange: null,
    });
    setCurrentPage(1);
  };

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>用户管理</h2>
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
                关键词搜索
              </label>
              <input
                type="text"
                placeholder="姓名/手机号/openid"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                用户状态
              </label>
              <select
                multiple
                value={filters.status}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ ...filters, status: selected });
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  height: '80px',
                }}
              >
                <option value="active">正常</option>
                <option value="suspended">已禁用</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                用户角色
              </label>
              <select
                multiple
                value={filters.roles}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters({ ...filters, roles: selected });
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px',
                  height: '80px',
                }}
              >
                <option value="admin">管理员</option>
                <option value="social_worker">社工</option>
                <option value="volunteer">志愿者</option>
                <option value="parent">家长</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => {
                setFilters({ ...filters, timeRange: null });
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
              清除时间筛选
            </button>
            <button
              onClick={resetFilters}
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
              重置所有筛选
            </button>
          </div>
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
          <span style={{ fontSize: '14px', color: '#6b7280' }}>总计用户数：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px' }}>{total}</span>
        </div>
        <div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>当前页面：</span>
          <span style={{ fontSize: '16px', fontWeight: 'medium', marginLeft: '8px' }}>
            {users.length} / {total}
          </span>
        </div>
      </div>

      {/* 用户列表 */}
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
        ) : users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            暂无用户数据
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    用户信息
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    状态
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    最近登录
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    创建时间
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#e5e7eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          color: '#6b7280',
                        }}>
                          {user.avatar ? (
                            <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          ) : (
                            user.displayName?.charAt(0) || 'U'
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'medium', color: '#111827' }}>
                            {user.displayName || '未设置姓名'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {user.phone || user.openid.substring(0, 8) + '...'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'medium',
                        backgroundColor: user.status === 'active' ? '#d1fae5' : '#fee2e2',
                        color: user.status === 'active' ? '#065f46' : '#991b1b',
                      }}>
                        {formatStatus(user.status)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                      {user.lastLoginAt ? formatDate(user.lastLoginAt) : '从未登录'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserDetail(true);
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
                        {isAdmin && (
                          <button
                            onClick={() => handleStatusToggle(user)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: user.status === 'active' ? '#ef4444' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                            }}
                          >
                            {user.status === 'active' ? '禁用' : '启用'}
                          </button>
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

      {/* 用户详情弹窗 */}
      {showUserDetail && selectedUser && (
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
              <h3 style={{ margin: 0 }}>用户详情</h3>
              <button
                onClick={() => setShowUserDetail(false)}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  color: '#6b7280',
                }}>
                  {selectedUser.avatar ? (
                    <img src={selectedUser.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                  ) : (
                    selectedUser.displayName?.charAt(0) || 'U'
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                    {selectedUser.displayName || '未设置姓名'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    OpenID: {selectedUser.openid}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>手机号</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {selectedUser.phone || '未设置'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>状态</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {formatStatus(selectedUser.status)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>最近登录</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {selectedUser.lastLoginAt ? formatDate(selectedUser.lastLoginAt) : '从未登录'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>创建时间</div>
                  <div style={{ fontSize: '14px', color: '#111827' }}>
                    {formatDate(selectedUser.createdAt)}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>用户角色</div>
                <div style={{ fontSize: '14px', color: '#111827' }}>
                  角色信息需要通过角色管理页面查看
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};