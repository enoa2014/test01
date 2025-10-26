import React, { useState, useEffect } from 'react';
import { useCloudbase } from '../hooks/useCloudbase';

interface Invite {
  id: string;
  code: string;
  role: string;
  scopeId: string | null;
  usesLeft: number;
  expiresAt: number | null;
  state: string;
  createdBy: string;
  createdAt: number;
  qrFileId?: string;
  qrUrl?: string;
  sharePath?: string;
}

interface InviteFormData {
  role: string;
  uses: number;
  expiresAt: string;
  patientId: string;
  note: string;
}

export const InvitesPage: React.FC = () => {
  const { app } = useCloudbase();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  const [filters, setFilters] = useState({
    role: '',
    state: 'active',
  });

  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>('');
  const [qrLoadingId, setQrLoadingId] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createdModal, setCreatedModal] = useState<{ code: string; role: string; sharePath: string; qrUrl?: string } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<InviteFormData>({
    role: '',
    uses: 1,
    expiresAt: '',
    patientId: '',
    note: '',
  });

  const fetchInvites = async () => {
    if (!app) return;

    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        pageSize,
      };

      if (filters.role) {
        params.role = filters.role;
      }
      if (filters.state) {
        params.state = filters.state;
      }

      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'listInvites',
          ...params,
        },
      });

      if (res.result?.success) {
        setInvites(res.result.data.items || []);
        setTotal(res.result.data.total || 0);
      } else {
        console.error('Failed to fetch invites:', res.result?.error);
      }
    } catch (error) {
      console.error('Error fetching invites:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, [app, currentPage, filters]);

  const handleCreateInvite = async () => {
    if (!app) return;

    if (!formData.role || formData.uses < 1) {
      alert('请填写角色和使用次数');
      return;
    }

    const params: any = {
      role: formData.role,
      uses: formData.uses,
    };

    if (formData.expiresAt) {
      params.expiresAt = new Date(formData.expiresAt).getTime();
    }

    if (formData.patientId) {
      params.patientId = formData.patientId;
    }

    if (formData.note) {
      params.note = formData.note;
    }

    try {
      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'createInvite',
          ...params,
        },
      });

      if (res.result?.success) {
        const { code, inviteId, sharePath } = res.result.data || {};
        const createdRole = formData.role || 'volunteer';
        // 自动生成二维码
        try {
          const qrRes = await app.callFunction({
            name: 'rbac',
            data: { action: 'generateInviteQr', inviteId }
          });
          const { success, data, error } = qrRes.result || {};
          if (!success) {
            // 仅提示，不阻塞后续操作
            alert(`邀请码 ${code} 已创建，但二维码生成失败：${error?.message || '未知错误'}`);
            setCreatedModal({ code, role: createdRole, sharePath: sharePath || `pages/auth/invite-code/index?code=${code}` });
          } else {
            if (data?.url) setQrPreviewUrl(data.url);
            setCreatedModal({ code, role: createdRole, sharePath: sharePath || `pages/auth/invite-code/index?code=${code}`, qrUrl: data?.url });
          }
        } catch (e: any) {
          console.error('auto generate qr failed', e);
          alert(`邀请码 ${code} 已创建，但二维码生成失败：${e?.message || '未知错误'}`);
          setCreatedModal({ code, role: createdRole, sharePath: sharePath || `pages/auth/invite-code/index?code=${code}` });
        }

        setShowCreateModal(false);
        setFormData({ role: '', uses: 1, expiresAt: '', patientId: '', note: '' });
        fetchInvites();
      } else {
        alert(`创建失败: ${res.result?.error?.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error creating invite:', error);
      alert('创建邀请码失败');
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!app) return;

    if (!window.confirm('确定要撤销此邀请码吗？')) return;

    try {
      const res = await app.callFunction({
        name: 'rbac',
        data: {
          action: 'revokeInvite',
          inviteId,
        },
      });

      if (res.result?.success) {
        alert('邀请码已撤销');
        fetchInvites();
      } else {
        alert(`撤销失败: ${res.result?.error?.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Error revoking invite:', error);
      alert('撤销邀请码失败');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('邀请码已复制到剪贴板');
    }).catch(() => {
      alert('复制失败，请手动复制');
    });
  };

  const handleGenerateQr = async (inviteId: string) => {
    if (!app) return;
    try {
      setQrLoadingId(inviteId);
      const res = await app.callFunction({
        name: 'rbac',
        data: { action: 'generateInviteQr', inviteId }
      });
      const { success, data, error } = res.result || {};
      if (!success) {
        alert(`生成失败：${error?.message || '未知错误'}`);
        setQrLoadingId('');
        return;
      }
      const url: string = (data && data.url) || '';
      if (url) {
        setQrPreviewUrl(url);
        setInvites((prev) =>
          prev.map((invite) =>
            invite.id === inviteId
              ? {
                  ...invite,
                  qrUrl: url,
                  qrFileId: data?.fileId || invite.qrFileId,
                }
              : invite
          )
        );
      }
      setQrLoadingId('');
    } catch (e: any) {
      console.error('generate qr failed', e);
      alert(`生成失败：${e?.message || '未知错误'}`);
      setQrLoadingId('');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const formatRole = (role: string) => {
    const roleMap: Record<string, string> = {
      volunteer: '志愿者',
      parent: '家长',
      social_worker: '社工',
    };
    return roleMap[role] || role;
  };

  const formatState = (state: string) => {
    const stateMap: Record<string, string> = {
      active: '有效',
      revoked: '已撤销',
      expired: '已过期',
    };
    return stateMap[state] || state;
  };

  const getStateColor = (state: string) => {
    const colorMap: Record<string, string> = {
      active: '#10b981',
      revoked: '#ef4444',
      expired: '#6b7280',
    };
    return colorMap[state] || '#6b7280';
  };

  const getRoleColor = (role: string) => {
    const colorMap: Record<string, string> = {
      volunteer: '#16a34a',
      parent: '#ca8a04',
      social_worker: '#2563eb',
    };
    return colorMap[role] || '#6b7280';
  };

  const isExpired = (invite: Invite) => {
    return invite.expiresAt && invite.expiresAt < Date.now();
  };

  const getExpiryStatus = (invite: Invite) => {
    if (invite.state === 'revoked') return '已撤销';
    if (isExpired(invite)) return '已过期';
    return invite.state;
  };

  const isSelected = (id: string) => selected.has(id);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const openPosterWindow = (html: string) => {
    const win = window.open('', '_blank');
    if (!win) {
      alert('请允许弹出窗口用于打印或生成 PDF');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (err) {
        console.error('打印失败', err);
      }
    }, 400);
  };

  const buildPosterHtml = (rows: Invite[]) => {
    const posterItems = rows.map((row) => {
      const roleLabel = formatRole(row.role);
      const expiry = row.expiresAt ? new Date(row.expiresAt).toLocaleString('zh-CN') : '永不过期';
      const qrSrc = row.qrUrl || '';
      return `
  <div class="poster">
    <div class="title">邀请加入（${roleLabel}） <span class="badge role-${row.role}">${roleLabel}</span></div>
    <div class="meta">过期时间：${expiry} ｜ 剩余次数：${row.usesLeft}</div>
    <div class="qr">
      <img src="${qrSrc}" alt="QR" />
      <div>
        <div class="code">邀请码：${row.code}</div>
        <div class="hint">微信内长按识别小程序码或在“邀请码激活”页手动输入上方 8 位邀请码。</div>
      </div>
    </div>
  </div>`;
    }).join('');

    return `<!doctype html>
<html><head><meta charset="utf-8"><title>邀请海报</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', Arial; }
  .poster { page-break-inside: avoid; border: 1px solid #ddd; padding: 16px; margin-bottom: 16px; border-radius: 8px; }
  .title { font-size: 18px; font-weight: 600; margin: 0 0 8px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 8px; }
  .qr { display: flex; align-items: center; gap: 16px; }
  .qr img { width: 180px; height: 180px; object-fit: contain; border: 1px solid #eee; }
  .code { font-family: monospace; font-weight: 700; font-size: 20px; }
  .hint { color: #666; font-size: 12px; }
  .badge { display: inline-block; padding: 2px 8px; color: #fff; border-radius: 12px; font-size: 12px; }
  .role-volunteer { background:#16a34a; }
  .role-parent { background:#ca8a04; }
  .role-social_worker { background:#2563eb; }
</style></head><body>
${posterItems}
</body></html>`;
  };

  const printSinglePoster = (invite: Invite) => {
    openPosterWindow(buildPosterHtml([invite]));
  };

  const handleExportPosters = () => {
    const rows = invites.filter((invite) => selected.has(invite.id));
    if (rows.length === 0) {
      alert('请先勾选需要导出的邀请');
      return;
    }
    openPosterWindow(buildPosterHtml(rows));
  };

  const handleBulkGenerateQr = async () => {
    if (!app) return;
    const ids = invites.filter((invite) => selected.has(invite.id)).map((invite) => invite.id);
    if (ids.length === 0) {
      alert('请先勾选需要生成二维码的邀请');
      return;
    }
    for (const id of ids) {
      await handleGenerateQr(id);
    }
    fetchInvites();
  };

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>邀请管理</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          创建邀请码
        </button>
      </div>

      {/* 筛选器 */}
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '24px',
        border: '1px solid #e5e7eb',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
      }}>
        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
            角色
          </label>
          <select
            value={filters.role}
            onChange={(e) => setFilters({ ...filters, role: e.target.value })}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="">全部角色</option>
            <option value="volunteer">志愿者</option>
            <option value="social_worker">社工</option>
            <option value="parent">家长</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
            状态
          </label>
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="">全部状态</option>
            <option value="active">有效</option>
            <option value="revoked">已撤销</option>
            <option value="expired">已过期</option>
          </select>
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
          <span style={{ fontSize: '14px', color: '#6b7280' }}>总邀请数：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px' }}>{total}</span>
        </div>
        <div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>有效邀请：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px', color: '#10b981' }}>
            {invites.filter(i => i.state === 'active' && !isExpired(i)).length}
          </span>
        </div>
        <div>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>已使用：</span>
          <span style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '8px', color: '#f59e0b' }}>
            {invites.reduce((sum, invite) => sum + (invite.usesLeft === 0 ? 1 : 0), 0)}
          </span>
        </div>
      </div>

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button onClick={handleBulkGenerateQr} disabled={selected.size === 0} style={{ padding: '8px 12px', backgroundColor: '#10b981', color:'#fff', border:'none', borderRadius: 6, cursor: selected.size===0?'not-allowed':'pointer' }}>批量生成二维码</button>
        <button onClick={handleExportPosters} disabled={selected.size === 0} style={{ padding: '8px 12px', backgroundColor: '#3b82f6', color:'#fff', border:'none', borderRadius: 6, cursor: selected.size===0?'not-allowed':'pointer' }}>导出海报(PDF)</button>
        <button onClick={() => {
          const links = invites.filter(i=>selected.has(i.id)).map(i=>i.sharePath || `pages/auth/invite-code/index?code=${i.code}`).join('\n');
          if (!links) { alert('请先勾选需要复制的邀请'); return; }
          navigator.clipboard.writeText(links).then(()=> alert('已复制所选邀请链接')).catch(()=> alert('复制失败，请手动复制'));
        }} disabled={selected.size===0} style={{ padding:'8px 12px', background:'#64748b', color:'#fff', border:'none', borderRadius: 6, cursor: selected.size===0?'not-allowed':'pointer' }}>批量复制链接</button>
      </div>

      {/* 邀请列表 */}
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
        ) : invites.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            暂无邀请码数据
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ padding: '12px' }}>
                    <input type="checkbox" checked={invites.length>0 && invites.every(i=>selected.has(i.id))}
                      onChange={(e)=>{
                        const all = new Set<string>();
                        if (e.target.checked) invites.forEach(i=>all.add(i.id));
                        setSelected(e.target.checked?all:new Set());
                      }} />
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    邀请码
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    角色
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    剩余次数
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    过期时间
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 'medium', color: '#374151' }}>
                    状态
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
                {invites.map((invite) => (
                  <tr key={invite.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px' }}>
                      <input type="checkbox" checked={isSelected(invite.id)} onChange={(e)=>toggleSelect(invite.id, e.target.checked)} />
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {invite.qrUrl && (
                          <img src={invite.qrUrl} alt="QR" onClick={()=> setQrPreviewUrl(invite.qrUrl!)}
                            style={{ width: 48, height: 48, border:'1px solid #e5e7eb', borderRadius: 4, cursor: 'zoom-in' }} />
                        )}
                        <code style={{
                          padding: '4px 8px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          color: '#111827',
                        }}>
                          {invite.code}
                        </code>
                        <button
                          onClick={() => copyToClipboard(invite.code)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          复制
                        </button>
                        <button
                          onClick={() => {
                            const link = invite.sharePath || `pages/auth/invite-code/index?code=${invite.code}`;
                            navigator.clipboard.writeText(link).then(()=> alert('邀请链接已复制')).catch(()=> alert('复制失败，请手动复制'));
                          }}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#64748b',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          复制链接
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'medium',
                        backgroundColor: getRoleColor(invite.role),
                        color: 'white',
                      }}>
                        {formatRole(invite.role)}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                      {invite.usesLeft}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                      {invite.expiresAt ? formatDate(invite.expiresAt) : '永不过期'}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'medium',
                        backgroundColor: getStateColor(getExpiryStatus(invite)),
                        color: 'white',
                      }}>
                        {formatState(getExpiryStatus(invite))}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                      {formatDate(invite.createdAt)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleGenerateQr(invite.id)}
                          disabled={qrLoadingId === invite.id}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: qrLoadingId === invite.id ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          {qrLoadingId === invite.id ? '生成中…' : '生成二维码'}
                        </button>

                        {invite.state === 'active' && !isExpired(invite) && (
                          <button
                            onClick={() => handleRevokeInvite(invite.id)}
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
                            撤销
                          </button>
                        )}
                        <button
                          onClick={() => printSinglePoster(invite)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#0ea5e9',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          打印海报
                        </button>
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

      {/* 二维码预览 */}
    {qrPreviewUrl && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
      }}>
        <div style={{ backgroundColor: 'white', borderRadius: 8, padding: 20, width: '90%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>二维码预览</h3>
              <button onClick={() => setQrPreviewUrl('')} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
              <img src={qrPreviewUrl} alt="邀请二维码" style={{ width: 360, height: 360, objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
              <a href={qrPreviewUrl} download target="_blank" rel="noreferrer" style={{
                padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', textDecoration: 'none', borderRadius: 4
              }}>下载</a>
              <button onClick={() => setQrPreviewUrl('')} style={{ padding: '8px 16px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: 4 }}>关闭</button>
            </div>
          </div>
      </div>
    )}

    {/* 创建成功弹窗 */}
    {createdModal && (
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }}>
        <div style={{ background:'#fff', borderRadius:8, padding:20, width:'90%', maxWidth:520 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ margin:0 }}>邀请码创建成功</h3>
            <button onClick={()=> setCreatedModal(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer' }}>×</button>
          </div>
          <div style={{ display:'flex', gap:16 }}>
            {createdModal.qrUrl && (
              <img src={createdModal.qrUrl} alt="QR" style={{ width:160, height:160, border:'1px solid #eee', borderRadius:4 }} />
            )}
            <div style={{ flex:1 }}>
              <div style={{ marginBottom:8 }}><strong>邀请码：</strong><code style={{ background:'#f3f4f6', padding:'2px 6px', borderRadius:4 }}>{createdModal.code}</code></div>
              <div style={{ marginBottom:8 }}><strong>角色：</strong><span style={{ padding:'2px 8px', borderRadius:12, color:'#fff', background: createdModal.role==='volunteer' ? '#16a34a' : createdModal.role==='parent' ? '#ca8a04' : createdModal.role==='social_worker' ? '#2563eb' : '#64748b' }}>{formatRole(createdModal.role)}</span></div>
              <div style={{ marginBottom:8 }}><strong>激活路径：</strong><span style={{ fontFamily:'monospace' }}>{createdModal.sharePath}</span></div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=> { navigator.clipboard.writeText(createdModal.sharePath).then(()=> alert('邀请链接已复制')).catch(()=> alert('复制失败，请手动复制')); }}
                  style={{ padding:'8px 12px', background:'#64748b', color:'#fff', border:'none', borderRadius:6, cursor:'pointer' }}>复制链接</button>
                {createdModal.qrUrl && (
                  <button onClick={()=> setQrPreviewUrl(createdModal.qrUrl!)}
                    style={{ padding:'8px 12px', background:'#10b981', color:'#fff', border:'none', borderRadius:6, cursor:'pointer' }}>打开二维码预览</button>
                )}
                <button onClick={()=> { printSinglePoster({ id:'new', code: createdModal.code, role: createdModal.role, scopeId:null, usesLeft:1, expiresAt:null, state:'active', createdBy:'', createdAt: Date.now(), qrUrl: createdModal.qrUrl || '', sharePath: createdModal.sharePath }); }}
                  style={{ padding:'8px 12px', background:'#0ea5e9', color:'#fff', border:'none', borderRadius:6, cursor:'pointer' }}>打印海报</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {/* 创建邀请码弹窗 */}
      {showCreateModal && (
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
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>创建邀请码</h3>
              <button
                onClick={() => setShowCreateModal(false)}
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
                    <option value="volunteer">志愿者</option>
                    <option value="social_worker">社工</option>
                    <option value="parent">家长</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                    使用次数 *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.uses}
                    onChange={(e) => setFormData({ ...formData, uses: parseInt(e.target.value) || 1 })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px',
                    }}
                  />
                </div>
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

              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'medium' }}>
                  关联患者ID（仅家长角色）
                </label>
                <input
                  type="text"
                  value={formData.patientId}
                  onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                  placeholder="可选，如需绑定特定患者请填写患者ID"
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
                  备注
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="可选备注信息"
                  rows={2}
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

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowCreateModal(false)}
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
                  onClick={handleCreateInvite}
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
                  创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
