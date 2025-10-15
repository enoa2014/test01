import React, { useState, useEffect } from 'react';
import { useCloudbase } from '../hooks/useCloudbase';
import { useRBAC } from '../hooks/useRBAC';

interface RoleBinding {
  id: string;
  userOpenId: string;
  role: string;
  scopeType: string;
  state: string;
  expiresAt: number | null;
  createdAt: number;
  createdBy: string;
}

interface UserInfo {
  displayName: string;
  phone: string;
  openid: string;
}

export const RolesPage: React.FC = () => {
  const { app } = useCloudbase();
  const { isAdmin } = useRBAC();

  const [roleBindings, setRoleBindings] = useState<RoleBinding[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [searchUserOpenId, setSearchUserOpenId] = useState('');

  const [formData, setFormData] = useState({
    userOpenId: '',
    role: '',
    expiresAt: '',
  });

  const fetchRoleBindings = async () => {
    if (!app) return;

    setLoading(true);
    try {
      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'listRoleBindings',
          userOpenId: searchUserOpenId || undefined,
        },
      });

      if (res.result?.success) {
        setRoleBindings(res.result.data.items || []);
      } else {
        console.error('Failed to fetch role bindings:', res.result?.error);
      }
    } catch (error) {
      console.error('Error fetching role bindings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoleBindings();
  }, [app, searchUserOpenId]);

  const handleAddRoleBinding = async () => {
    if (!app || !isAdmin) return;

    if (!formData.userOpenId || !formData.role) {
      alert('请填写用户ID和角色');
      return;
    }

    const params: any = {
      userOpenId: formData.userOpenId,
      role: formData.role,
    };

    if (formData.expiresAt) {
      params.expiresAt = new Date(formData.expiresAt).getTime();
    }

    try {
      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'addRoleBinding',
          ...params,
        },
      });

      if (res.result?.success) {
        alert('角色绑定添加成功');
        setShowAddModal(false);
        setFormData({ userOpenId: '', role: '', expiresAt: '' });
        fetchRoleBindings();
      } else {
        alert(`添加失败: ${res.result?.error?.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error adding role binding:', error);
      alert('添加角色绑定失败');
    }
  };

  const handleRemoveRoleBinding = async (binding: RoleBinding) => {
    if (!app || !isAdmin) return;

    if (binding.role === 'admin') {
      alert('不能移除管理员角色');
      return;
    }

    const confirmMessage = `确定要移除用户 ${binding.userOpenId} 的 ${binding.role} 角色吗？`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'removeRoleBinding',
          userOpenId: binding.userOpenId,
          role: binding.role,
        },
      });

      if (res.result?.success) {
        alert('角色绑定移除成功');
        fetchRoleBindings();
      } else {
        alert(`移除失败: ${res.result?.error?.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error removing role binding:', error);
      alert('移除角色绑定失败');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatRole = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: '管理员',
      social_worker: '社工',
      volunteer: '志愿者',
      parent: '家长',
      guest: '访客',
    };
    return roleMap[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colorMap: Record<string, string> = {
      admin: '#dc2626',
      social_worker: '#2563eb',
      volunteer: '#16a34a',
      parent: '#ca8a04',
      guest: '#6b7280',
    };
    return colorMap[role] || '#6b7280';
  };

  const groupByUser = (bindings: RoleBinding[]) => {
    const grouped: Record<string, RoleBinding[]> = {};
    bindings.forEach(binding => {
      if (!grouped[binding.userOpenId]) {
        grouped[binding.userOpenId] = [];
      }
      grouped[binding.userOpenId].push(binding);
    });
    return grouped;
  };

  const groupedBindings = groupByUser(roleBindings);

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>角色管理</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="搜索用户OpenID"
            value={searchUserOpenId}
            onChange={(e) => setSearchUserOpenId(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          />
          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              添加角色绑定
            </button>
          )}
        </div>
      </div>

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
          <span style={{ fontSize: '14px', color: '#6b7280' }}>总角色绑定数：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px' }}>{roleBindings.length}</span>
        </div>
        <div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>绑定用户数：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px' }}>{Object.keys(groupedBindings).length}</span>
        </div>
      </div>

      {/* 角色绑定列表 */}
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
        ) : roleBindings.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            暂无角色绑定数据
          </div>
        ) : (
          <div style={{ padding: '20px' }}>
            {Object.entries(groupedBindings).map(([userOpenId, bindings]) => (
              <div key={userOpenId} style={{
                marginBottom: '24px',
                padding: '16px',
                border: '1px solid #f3f4f6',
                borderRadius: '8px',
                backgroundColor: '#fafafa',
              }}>
                <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h4 style={{ margin: 0, color: '#111827' }}>{userOpenId}</h4>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                  }}>
                    {bindings.length} 个角色
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {bindings.map((binding) => (
                    <div key={binding.id} style={{
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      backgroundColor: 'white',
                      minWidth: '200px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'medium',
                          backgroundColor: getRoleColor(binding.role),
                          color: 'white',
                        }}>
                          {formatRole(binding.role)}
                        </span>
                        {isAdmin && binding.role !== 'admin' && (
                          <button
                            onClick={() => handleRemoveRoleBinding(binding)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              fontSize: '16px',
                              padding: '4px',
                            }}
                            title="移除角色"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        <div>状态: {binding.state === 'active' ? '激活' : '未激活'}</div>
                        <div>范围: {binding.scopeType}</div>
                        <div>创建时间: {formatDate(binding.createdAt)}</div>
                        {binding.expiresAt && (
                          <div>过期时间: {formatDate(binding.expiresAt)}</div>
                        )}
                        {binding.createdBy && (
                          <div>创建者: {binding.createdBy}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加角色绑定弹窗 */}
      {showAddModal && isAdmin && (
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
              <h3 style={{ margin: 0 }}>添加角色绑定</h3>
              <button
                onClick={() => setShowAddModal(false)}
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
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                  用户OpenID *
                </label>
                <input
                  type="text"
                  value={formData.userOpenId}
                  onChange={(e) => setFormData({ ...formData, userOpenId: e.target.value })}
                  placeholder="请输入用户OpenID"
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
                  角色 *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                >
                  <option value="">请选择角色</option>
                  <option value="social_worker">社工</option>
                  <option value="volunteer">志愿者</option>
                  <option value="parent">家长</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                  过期时间（可选）
                </label>
                <input
                  type="datetime-local"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowAddModal(false)}
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
                  onClick={handleAddRoleBinding}
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
                  添加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};