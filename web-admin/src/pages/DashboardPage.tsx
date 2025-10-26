import React, { useState, useEffect } from 'react';
import { useCloudbase } from '../hooks/useCloudbase';
import { useRBAC } from '../hooks/useRBAC';

interface DashboardStats {
  pendingApprovals: number;
  recentImports: number;
  recentExports: number;
  errorLogs: number;
  totalUsers: number;
  totalPatients: number;
}

export const DashboardPage: React.FC = () => {
  const { app } = useCloudbase();
  const { isAdmin } = useRBAC();
  const [stats, setStats] = useState<DashboardStats>({
    pendingApprovals: 0,
    recentImports: 0,
    recentExports: 0,
    errorLogs: 0,
    totalUsers: 0,
    totalPatients: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!app) return;

      setLoading(true);
      try {
        const promises = [];

        // 获取待审批数量 - 添加错误处理
        promises.push(
          app.callFunction({
            name: 'rbac',
            data: {
              action: 'listRoleRequests',
              state: 'pending',
              page: 1,
              pageSize: 1,
            },
          }).then(res => ({
            key: 'pendingApprovals',
            value: res.result?.data?.total || 0,
          })).catch(error => {
            console.warn('获取待审批数量失败，使用默认值:', error);
            return {
              key: 'pendingApprovals',
              value: 0
            };
          })
        );

        // 获取最近导入导出数量（简化版，实际应该查询jobs集合）
        promises.push(
          app.callFunction({
            name: 'audit',
            data: {
              action: 'listLogs',
              filters: {
                action: 'import.run',
                from: Date.now() - 7 * 24 * 60 * 60 * 1000, // 最近7天
              },
              page: 1,
              pageSize: 1,
            },
          }).then(res => ({
            key: 'recentImports',
            value: res.result?.data?.total || 0,
          })).catch(error => {
            console.warn('获取导入数量失败:', error);
            return { key: 'recentImports', value: 0 };
          })
        );

        promises.push(
          app.callFunction({
            name: 'audit',
            data: {
              action: 'listLogs',
              filters: {
                action: 'export.detail',
                from: Date.now() - 7 * 24 * 60 * 60 * 1000, // 最近7天
              },
              page: 1,
              pageSize: 1,
            },
          }).then(res => ({
            key: 'recentExports',
            value: res.result?.data?.total || 0,
          })).catch(error => {
            console.warn('获取导出数量失败:', error);
            return { key: 'recentExports', value: 0 };
          })
        );

        // 获取错误日志数量
        promises.push(
          app.callFunction({
            name: 'audit',
            data: {
              action: 'listLogs',
              filters: {
                level: 'error',
                from: Date.now() - 7 * 24 * 60 * 60 * 1000, // 最近7天
              },
              page: 1,
              pageSize: 1,
            },
          }).then(res => ({
            key: 'errorLogs',
            value: res.result?.data?.total || 0,
          })).catch(error => {
            console.warn('获取错误日志数量失败:', error);
            return { key: 'errorLogs', value: 0 };
          })
        );

        // 获取用户总数（仅管理员）
          if (isAdmin) {
            promises.push(
              app.callFunction({
                name: 'rbac',
                data: {
                  action: 'listUsers',
                  page: 1,
                  pageSize: 1,
                },
              }).then(res => ({
                key: 'totalUsers',
                value: res.result?.data?.total || 0,
              })).catch(error => {
                console.warn('获取用户总数失败:', error);
                return { key: 'totalUsers', value: 0 };
              })
            );
          }

        // 获取患者总数（需启用 includeTotal，且从第 0 页开始）
        promises.push(
          app.callFunction({
            name: 'patientProfile',
            data: {
              action: 'list',
              includeTotal: true,
              page: 0,
              pageSize: 1,
            },
          }).then(res => ({
            key: 'totalPatients',
            value: res.result?.totalCount || 0,
          })).catch(error => {
            console.warn('获取患者总数失败:', error);
            return { key: 'totalPatients', value: 0 };
          })
        );

        const results = await Promise.all(promises);
        const newStats = { ...stats };
        results.forEach(({ key, value }) => {
          (newStats as any)[key] = value;
        });
        setStats(newStats);

      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [app, isAdmin]);

  const StatCard: React.FC<{ title: string; value: number; icon: string; color: string }> = ({
    title,
    value,
    icon,
    color,
  }) => (
    <div style={{
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e5e7eb',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
            {title}
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', color }}>
            {loading ? '...' : value}
          </div>
        </div>
        <div style={{
          fontSize: '32px',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: color,
          borderRadius: '8px',
        }}>
          {icon}
        </div>
      </div>
    </div>
  );

  const QuickAction: React.FC<{ title: string; description: string; icon: string; path: string }> = ({
    title,
    description,
    icon,
    path,
  }) => (
    <div
      style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onClick={() => window.location.href = path}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
      }}
    >
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>{icon}</div>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#111827' }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
        {description}
      </p>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', color: '#111827' }}>
          系统概览
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}>
          <StatCard
            title="待审批申请"
            value={stats.pendingApprovals}
            icon="📋"
            color="#fbbf24"
          />
          <StatCard
            title="近7日导入"
            value={stats.recentImports}
            icon="📈"
            color="#34d399"
          />
          <StatCard
            title="近7日导出"
            value={stats.recentExports}
            icon="📊"
            color="#60a5fa"
          />
          <StatCard
            title="错误日志"
            value={stats.errorLogs}
            icon="⚠️"
            color="#f87171"
          />
          {isAdmin && (
            <StatCard
              title="用户总数"
              value={stats.totalUsers}
              icon="👥"
              color="#a78bfa"
            />
          )}
          <StatCard
            title="患者总数"
            value={stats.totalPatients}
            icon="🏥"
            color="#fb923c"
          />
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#111827' }}>
          快捷操作
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}>
          {stats.pendingApprovals > 0 && (
            <QuickAction
              title="处理审批"
              description={`有 ${stats.pendingApprovals} 个待审批申请`}
              icon="✅"
              path="/approvals"
            />
          )}

          {isAdmin && (
            <QuickAction
              title="创建邀请"
              description="为志愿者或家长创建邀请码"
              icon="📧"
              path="/invites"
            />
          )}

          {isAdmin && (
            <QuickAction
              title="导入数据"
              description="导入Excel文件更新患者数据"
              icon="📈"
              path="/import"
            />
          )}

          <QuickAction
            title="导出报告"
            description="导出患者数据分析报告"
            icon="📊"
            path="/export"
          />

          <QuickAction
            title="查看审计"
            description="查看系统操作审计日志"
            icon="📋"
            path="/audit"
          />
        </div>
      </div>

      <div>
        <h3 style={{ margin: '0 0 24px 0', fontSize: '20px', color: '#111827' }}>
          系统信息
        </h3>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                当前环境
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'medium' }}>
                {import.meta.env.VITE_TCB_ENV_ID || '未配置'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                当前角色
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'medium' }}>
                {isAdmin ? '管理员' : '社工'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
                系统状态
              </div>
              <div style={{ fontSize: '16px', fontWeight: 'medium', color: '#10b981' }}>
                正常运行
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
