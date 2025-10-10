import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchPatientList, deletePatient, exportPatients } from '../api/patient';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientSummary } from '../types/patient';

const PAGE_SIZE = 40;

type TableRow = PatientSummary & { key: string };

const PatientListPage: React.FC = () => {
  const { app, user } = useCloudbase();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<TableRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [filters, setFilters] = useState({ gender: '', careStatus: '', nativePlace: '' });

  const isAdmin = useMemo(() => user?.role === 'admin', [user]);

  useEffect(() => {
    if ((location.state as { error?: string })?.error === 'NO_ADMIN') {
      setError('当前账号无权限执行该操作');
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    setMessage(null);
  }, [debouncedKeyword, filters.gender, filters.careStatus, filters.nativePlace]);

  const loadPatients = useCallback(async () => {
    if (!app) {
      setError('CloudBase 未初始化或缺少环境 ID');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPatientList(app, {
        page: 0,
        pageSize: PAGE_SIZE,
        keyword: debouncedKeyword,
        filters: {
          gender: filters.gender || undefined,
          careStatus: filters.careStatus || undefined,
          nativePlace: filters.nativePlace || undefined,
        },
      });
      const rows = (result.patients || []).map(item => ({
        ...item,
        key: item.patientKey || item.recordKey || item._id || '',
      }));
      setPatients(rows);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载住户列表失败');
    } finally {
      setLoading(false);
    }
  }, [app, debouncedKeyword, filters.gender, filters.careStatus, filters.nativePlace]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleFilterChange = (field: 'gender' | 'careStatus' | 'nativePlace') =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFilters(prev => ({ ...prev, [field]: value }));
    };

  const resetFilters = () => {
    setFilters({ gender: '', careStatus: '', nativePlace: '' });
    setKeyword('');
  };

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDeleteSingle = async (patientKey: string) => {
    if (!app || !patientKey) {
      return;
    }
    const confirmed = window.confirm('确认删除该住户档案？此操作不可撤销。');
    if (!confirmed) {
      return;
    }
    try {
      await deletePatient(app, patientKey, user?.username || user?.uid || 'web-admin');
      setMessage('删除成功');
      await loadPatients();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleBulkDelete = async () => {
    if (!app || !isAdmin) {
      return;
    }
    if (selected.size === 0) {
      window.alert('请先勾选需要删除的住户');
      return;
    }
    const confirmed = window.confirm(`确认删除选中的 ${selected.size} 位住户？此操作不可撤销。`);
    if (!confirmed) {
      return;
    }
    try {
      setLoading(true);
      const keys = Array.from(selected);
      await Promise.all(
        keys.map(key => deletePatient(app, key, user?.username || user?.uid || 'web-admin'))
      );
      setMessage('批量删除成功');
      await loadPatients();
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量删除失败');
      setLoading(false);
    }
  };

  const handleExportSelected = async () => {
    if (!app) {
      setError('CloudBase 未初始化');
      return;
    }
    if (selected.size === 0) {
      window.alert('请先勾选需要导出的住户');
      return;
    }
    try {
      const patientKeys = Array.from(selected);
      const result = await exportPatients(app, patientKeys);
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      } else if (result.fileId) {
        window.alert(`导出成功，文件ID：${result.fileId}`);
      } else {
        window.alert('导出完成，可前往云存储下载文件');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  };

  const statusLabel = (row: TableRow) => {
    const careStatus = row.careStatus || (row.checkoutAt ? 'discharged' : 'in_care');
    if (careStatus === 'discharged') {
      return <span className="status-pill gray">已退住</span>;
    }
    return <span className="status-pill green">在住</span>;
  };

  const rows = useMemo(() => patients, [patients]);

  return (
    <div className="card">
      <div className="toolbar" style={{ alignItems: 'flex-start' }}>
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <input
            type="search"
            placeholder="搜索姓名 / 证件号 / 电话"
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            style={{ minWidth: 220, padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
          />
          <select
            value={filters.gender}
            onChange={handleFilterChange('gender')}
            style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
          >
            <option value="">全部性别</option>
            <option value="男">男</option>
            <option value="女">女</option>
            <option value="其他">其他</option>
          </select>
          <select
            value={filters.careStatus}
            onChange={handleFilterChange('careStatus')}
            style={{ padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
          >
            <option value="">全部状态</option>
            <option value="in_care">在住</option>
            <option value="discharged">已退住</option>
          </select>
          <input
            type="text"
            placeholder="籍贯关键词"
            value={filters.nativePlace}
            onChange={handleFilterChange('nativePlace')}
            style={{ minWidth: 200, padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
          />
          <button className="secondary-button" type="button" onClick={resetFilters}>
            重置筛选
          </button>
        </div>
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <button className="secondary-button" type="button" onClick={loadPatients} disabled={loading}>
            {loading ? '刷新中...' : '刷新列表'}
          </button>
          <button className="secondary-button" type="button" onClick={handleExportSelected}>
            导出选中
          </button>
          {isAdmin && (
            <>
              <button className="secondary-button" type="button" onClick={handleBulkDelete} disabled={selected.size === 0}>
                删除选中
              </button>
              <button className="primary-button" type="button" onClick={() => navigate('/patients/new')}>
                新增住户
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <span>共 {rows.length} 条</span>
        {selected.size > 0 && <span>已选择 {selected.size} 条</span>}
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 42 }}>选择</th>
            <th>姓名</th>
            <th>性别</th>
            <th>联系电话</th>
            <th>籍贯 / 地址</th>
            <th>状态</th>
            <th>最新医院</th>
            <th>入院次数</th>
            <th style={{ width: 220 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.key}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(row.key)}
                  onChange={() => toggleSelect(row.key)}
                />
              </td>
              <td>{row.patientName || '-'}</td>
              <td>{row.gender || '-'}</td>
              <td>{row.phone || row.backupPhone || '-'}</td>
              <td>{row.nativePlace || row.address || '-'}</td>
              <td>{statusLabel(row)}</td>
              <td>{row.latestHospital || '-'}</td>
              <td>{row.admissionCount ?? '-'}</td>
              <td className="flex-row" style={{ gap: 8 }}>
                <button
                  className="link-button"
                  onClick={() =>
                    navigate(
                      `/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`
                    )
                  }
                >
                  查看
                </button>
                {isAdmin && (
                  <button
                    className="link-button"
                    onClick={() =>
                      navigate(
                        `/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}/edit`
                      )
                    }
                  >
                    编辑
                  </button>
                )}
                {isAdmin && (
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDeleteSingle(row.patientKey || row.recordKey || '')}
                  >
                    删除
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PatientListPage;
