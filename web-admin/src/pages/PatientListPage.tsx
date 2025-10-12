import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPatientList, deletePatient, exportPatients } from '../api/patient';
import { importExcelFromFile } from '../api/excel';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientSummary, StatsData, SearchSuggestion } from '../shared/types';
import {
  AdvancedFilters,
  FilterOption,
  getDefaultAdvancedFilters,
  applyAdvancedFilters,
  deriveHospitalOptions,
  deriveDiagnosisOptions,
  normalizeAdvancedFilters,
  summarizeFiltersForScheme,
} from '../shared/filters';
import AdvancedFilterPanel from '../components/AdvancedFilterPanel';

const PAGE_SIZE = 100;
const CACHE_KEY = 'patient_list_cache_web';
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const SUGGEST_DEBOUNCE_TIME = 300; // 搜索建议防抖时间
const MAX_SUGGESTIONS = 8; // 最大建议数量

type TableRow = PatientSummary & { key: string };

type CacheData = {
  patients: TableRow[];
  timestamp: number;
  statsData: StatsData;
};

const PatientListPage: React.FC = () => {
  const { app, user } = useCloudbase();
  const navigate = useNavigate();
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [patients, setPatients] = useState<TableRow[]>([]); // 原始数据
  const [displayPatients, setDisplayPatients] = useState<TableRow[]>([]); // 显示数据（经过筛选）
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  // 搜索建议
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 高级筛选相关状态
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(getDefaultAdvancedFilters());
  const [filterPanelVisible, setFilterPanelVisible] = useState(false);
  const [filterPreviewCount, setFilterPreviewCount] = useState(-1);
  const [filterPreviewLoading, setFilterPreviewLoading] = useState(false);

  // 筛选选项
  const [hospitalOptions, setHospitalOptions] = useState<FilterOption[]>([]);
  const [diagnosisOptions, setDiagnosisOptions] = useState<FilterOption[]>([]);
  const [allDiagnosisOptions, setAllDiagnosisOptions] = useState<FilterOption[]>([]);
  const [genderOptions, setGenderOptions] = useState<FilterOption[]>([
    { id: '男', label: '男' },
    { id: '女', label: '女' },
  ]);
  const [ethnicityOptions, setEthnicityOptions] = useState<FilterOption[]>([]);
  const [nativePlaceOptions, setNativePlaceOptions] = useState<FilterOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<FilterOption[]>([]);

  // 统计数据
  const [statsData, setStatsData] = useState<StatsData>({ total: 0, inCare: 0, pending: 0, discharged: 0 });
  const [activeStatFilter, setActiveStatFilter] = useState<'all' | 'in_care' | 'pending' | 'discharged'>('all');

  // 搜索关键词防抖
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  // 搜索建议防抖
  useEffect(() => {
    if (!keyword.trim() || keyword.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = window.setTimeout(() => {
      const kw = keyword.trim().toLowerCase();
      const suggestions = new Set<string>();

      patients.forEach(patient => {
        if (suggestions.size >= MAX_SUGGESTIONS) return;

        const candidates = [
          patient.patientName,
          patient.latestHospital,
          patient.latestDiagnosis,
          patient.latestDoctor,
        ];

        candidates.forEach(item => {
          if (suggestions.size >= MAX_SUGGESTIONS) return;
          const text = (item || '').trim();
          if (text && text.toLowerCase().includes(kw)) {
            suggestions.add(text);
          }
        });
      });

      setSearchSuggestions(Array.from(suggestions));
      setShowSuggestions(suggestions.size > 0);
    }, SUGGEST_DEBOUNCE_TIME);

    return () => window.clearTimeout(timer);
  }, [keyword, patients]);

  useEffect(() => {
    setMessage(null);
  }, [debouncedKeyword, advancedFilters]);

  // 本地缓存读取
  const readCache = useCallback((): CacheData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      const data: CacheData = JSON.parse(cached);
      if (Date.now() - data.timestamp > CACHE_TTL) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  // 本地缓存写入
  const writeCache = useCallback((data: CacheData) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // 忽略缓存写入失败
    }
  }, []);

  // 计算统计数据
  const calculateStats = useCallback((patientList: TableRow[]): StatsData => {
    const total = patientList.length;
    const inCare = patientList.filter(p => p.careStatus === 'in_care').length;
    const pending = patientList.filter(p => p.careStatus === 'pending').length;
    const discharged = patientList.filter(p => p.careStatus === 'discharged').length;
    return { total, inCare, pending, discharged };
  }, []);

  // 应用所有筛选（搜索 + 高级筛选 + 状态快速筛选）
  const applyFilters = useCallback((patientList: TableRow[]): TableRow[] => {
    let filtered = patientList;

    // 搜索关键词筛选
    if (debouncedKeyword) {
      const kw = debouncedKeyword.toLowerCase();
      filtered = filtered.filter(p => {
        const name = (p.patientName || '').toLowerCase();
        const phone = (p.phone || '').toLowerCase();
        const idNumber = (p.idNumber || '').toLowerCase();
        const hospital = (p.latestHospital || '').toLowerCase();
        const diagnosis = (p.latestDiagnosis || '').toLowerCase();
        return name.includes(kw) || phone.includes(kw) || idNumber.includes(kw) || hospital.includes(kw) || diagnosis.includes(kw);
      });
    }

    // 应用高级筛选
    filtered = applyAdvancedFilters(filtered, advancedFilters);

    // 状态快速筛选
    if (activeStatFilter !== 'all') {
      filtered = filtered.filter(p => p.careStatus === activeStatFilter);
    }

    return filtered;
  }, [debouncedKeyword, advancedFilters, activeStatFilter]);

  // 更新筛选选项
  const updateFilterOptions = useCallback((patientList: TableRow[]) => {
    const hospitals = deriveHospitalOptions(patientList);
    const diagnosis = deriveDiagnosisOptions(patientList);

    setHospitalOptions(hospitals);
    setAllDiagnosisOptions(diagnosis);
    setDiagnosisOptions(diagnosis.slice(0, 12));

    // 推导其他选项
    const ethnicitySet = new Set<string>();
    const nativePlaceSet = new Set<string>();
    const doctorSet = new Set<string>();

    patientList.forEach(p => {
      if (p.ethnicity) ethnicitySet.add(p.ethnicity);
      if (p.nativePlace) nativePlaceSet.add(p.nativePlace);
      if (p.latestDoctor) doctorSet.add(p.latestDoctor);
      if (p.firstDoctor) doctorSet.add(p.firstDoctor);
    });

    setEthnicityOptions(Array.from(ethnicitySet).map(id => ({ id, label: id })));
    setNativePlaceOptions(Array.from(nativePlaceSet).map(id => ({ id, label: id })));
    setDoctorOptions(Array.from(doctorSet).map(id => ({ id, label: id })));
  }, []);

  const loadPatients = useCallback(async (silent = false) => {
    if (!app) {
      setError('CloudBase 未初始化或缺少环境 ID');
      setLoading(false);
      return;
    }

    // 尝试使用缓存
    const cached = readCache();
    if (cached && !silent) {
      setPatients(cached.patients);
      setStatsData(cached.statsData);
      const filtered = applyFilters(cached.patients);
      setDisplayPatients(filtered);
      updateFilterOptions(cached.patients);
      setLoading(false);
    }

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await fetchPatientList(app, {
        page: 0,
        pageSize: PAGE_SIZE,
      });
      const rows = (result.patients || []).map(item => ({
        ...item,
        key: item.patientKey || item.recordKey || item._id || '',
      }));

      const stats = calculateStats(rows);
      setPatients(rows);
      setStatsData(stats);
      setSelected(new Set());

      // 写入缓存
      writeCache({ patients: rows, timestamp: Date.now(), statsData: stats });

      // 应用筛选
      const filtered = applyFilters(rows);
      setDisplayPatients(filtered);

      // 更新筛选选项
      updateFilterOptions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载住户列表失败');
    } finally {
      setLoading(false);
    }
  }, [app, readCache, writeCache, calculateStats, applyFilters, updateFilterOptions]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  // 当筛选条件变化时，重新应用筛选
  useEffect(() => {
    const filtered = applyFilters(patients);
    setDisplayPatients(filtered);
  }, [patients, applyFilters]);

  // 高级筛选相关处理
  const handleToggleAdvancedFilter = () => {
    setFilterPanelVisible(true);
  };

  const handleFilterPreview = (filters: AdvancedFilters) => {
    setFilterPreviewLoading(true);
    const filtered = applyAdvancedFilters(patients, filters);
    setFilterPreviewCount(filtered.length);
    setFilterPreviewLoading(false);
  };

  const handleFilterApply = (filters: AdvancedFilters) => {
    setAdvancedFilters(normalizeAdvancedFilters(filters));
    setFilterPanelVisible(false);
    setFilterPreviewCount(-1);
  };

  const handleFilterReset = () => {
    setAdvancedFilters(getDefaultAdvancedFilters());
  };

  const handleFilterClose = () => {
    setFilterPanelVisible(false);
    setFilterPreviewCount(-1);
  };

  const handleDiagnosisSearch = (keyword: string) => {
    if (!keyword) {
      setDiagnosisOptions(allDiagnosisOptions.slice(0, 12));
      return;
    }
    const kw = keyword.toLowerCase();
    const filtered = allDiagnosisOptions.filter(opt =>
      opt.label.toLowerCase().includes(kw)
    );
    setDiagnosisOptions(filtered.slice(0, 12));
  };

  // 统计卡片点击处理
  const handleStatFilterClick = (filter: typeof activeStatFilter) => {
    setActiveStatFilter(prevFilter => prevFilter === filter ? 'all' : filter);
  };

  // 重置所有筛选
  const resetFilters = () => {
    setKeyword('');
    setAdvancedFilters(getDefaultAdvancedFilters());
    setActiveStatFilter('all');
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
    if (!app) {
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

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!app) {
      setError('CloudBase 未初始化');
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // 检查文件类型
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|xls)$/i)) {
      setError('请选择有效的 Excel 文件（.xls 或 .xlsx）');
      event.target.value = '';
      return;
    }

    const confirmed = window.confirm(
      `确认导入 Excel 文件 "${file.name}"？\n\n导入操作将会：\n1. 上传文件到云存储\n2. 解析并导入患者数据\n3. 自动同步到数据库\n\n此过程可能需要几分钟，请耐心等待。`
    );
    if (!confirmed) {
      event.target.value = '';
      return;
    }

    setImporting(true);
    setMessage(null);
    setError(null);

    try {
      const result = await importExcelFromFile(app, file);
      const totalPatients = result.totalPatients || 0;
      setMessage(`导入成功！共导入 ${totalPatients} 位患者的数据`);
      // 刷新列表
      await loadPatients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel 导入失败');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setKeyword(suggestion);
    setShowSuggestions(false);
  };

  const statusLabel = (row: TableRow) => {
    const careStatus = row.careStatus || (row.checkoutAt ? 'discharged' : 'in_care');
    if (careStatus === 'discharged') {
      return <span className="status-pill gray">已退住</span>;
    }
    if (careStatus === 'pending') {
      return <span className="status-pill yellow">待入住</span>;
    }
    return <span className="status-pill green">在住</span>;
  };

  const rows = useMemo(() => displayPatients, [displayPatients]);

  // 计算是否有激活的高级筛选
  const hasActiveFilters = useMemo(() => {
    const filters = advancedFilters;
    return (
      filters.statuses.length > 0 ||
      filters.riskLevels.length > 0 ||
      filters.hospitals.length > 0 ||
      filters.diagnosis.length > 0 ||
      filters.genders.length > 0 ||
      filters.ethnicities.length > 0 ||
      filters.nativePlaces.length > 0 ||
      filters.ageRanges.length > 0 ||
      filters.doctors.length > 0 ||
      Boolean(filters.dateRange.start || filters.dateRange.end)
    );
  }, [advancedFilters]);

  return (
    <div className="card">
      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div
          onClick={() => handleStatFilterClick('all')}
          style={{
            padding: 16,
            borderRadius: 8,
            border: `2px solid ${activeStatFilter === 'all' ? '#2563eb' : '#e5e7eb'}`,
            backgroundColor: activeStatFilter === 'all' ? '#eff6ff' : 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>全部住户</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#1f2937' }}>{statsData.total}</div>
        </div>

        <div
          onClick={() => handleStatFilterClick('in_care')}
          style={{
            padding: 16,
            borderRadius: 8,
            border: `2px solid ${activeStatFilter === 'in_care' ? '#10b981' : '#e5e7eb'}`,
            backgroundColor: activeStatFilter === 'in_care' ? '#ecfdf5' : 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>在住</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#10b981' }}>{statsData.inCare}</div>
        </div>

        <div
          onClick={() => handleStatFilterClick('pending')}
          style={{
            padding: 16,
            borderRadius: 8,
            border: `2px solid ${activeStatFilter === 'pending' ? '#f59e0b' : '#e5e7eb'}`,
            backgroundColor: activeStatFilter === 'pending' ? '#fffbeb' : 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>待入住</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#f59e0b' }}>{statsData.pending}</div>
        </div>

        <div
          onClick={() => handleStatFilterClick('discharged')}
          style={{
            padding: 16,
            borderRadius: 8,
            border: `2px solid ${activeStatFilter === 'discharged' ? '#6b7280' : '#e5e7eb'}`,
            backgroundColor: activeStatFilter === 'discharged' ? '#f9fafb' : 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>已退住</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#6b7280' }}>{statsData.discharged}</div>
        </div>
      </div>

      {/* 搜索和筛选工具栏 */}
      <div className="toolbar" style={{ alignItems: 'flex-start' }}>
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 12, flex: 1 }}>
          {/* 搜索框 */}
          <div style={{ position: 'relative', minWidth: 280 }}>
            <input
              type="search"
              placeholder="搜索姓名 / 证件号 / 电话 / 医院 / 诊断"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              onFocus={() => setShowSuggestions(searchSuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}
            />
            {/* 搜索建议下拉框 */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  maxHeight: 240,
                  overflowY: 'auto',
                  zIndex: 10,
                }}
              >
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: index < searchSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 高级筛选按钮 */}
          <button
            className={hasActiveFilters ? 'primary-button' : 'secondary-button'}
            type="button"
            onClick={handleToggleAdvancedFilter}
          >
            高级筛选 {hasActiveFilters && `(已启用)`}
          </button>

          <button className="secondary-button" type="button" onClick={resetFilters}>
            重置筛选
          </button>
        </div>

        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <button className="secondary-button" type="button" onClick={() => loadPatients()} disabled={loading}>
            {loading ? '刷新中...' : '刷新列表'}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => excelInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? '导入中...' : '导入Excel'}
          </button>
          <button className="secondary-button" type="button" onClick={handleExportSelected}>
            导出选中
          </button>
          <button className="secondary-button" type="button" onClick={handleBulkDelete} disabled={selected.size === 0}>
            删除选中
          </button>
          <button className="primary-button" type="button" onClick={() => navigate('/intake')}>
            新增住户
          </button>
        </div>
      </div>

      {/* 隐藏的Excel文件input */}
      <input
        ref={excelInputRef}
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: 'none' }}
        onChange={handleImportExcel}
        disabled={importing}
      />

      {/* 筛选摘要 */}
      {hasActiveFilters && (
        <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#eff6ff', borderRadius: 6, fontSize: 14 }}>
          <span style={{ color: '#2563eb', fontWeight: 500 }}>筛选条件：</span>
          <span style={{ color: '#1f2937' }}>{summarizeFiltersForScheme(advancedFilters)}</span>
        </div>
      )}

      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <span>
          显示 {rows.length} 条{patients.length !== rows.length && ` / 共 ${patients.length} 条`}
        </span>
        {selected.size > 0 && <span>已选择 {selected.size} 条</span>}
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      {loading && rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>加载中...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          {debouncedKeyword || hasActiveFilters || activeStatFilter !== 'all'
            ? '没有找到符合条件的住户'
            : '暂无住户数据'}
        </div>
      ) : (
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
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDeleteSingle(row.patientKey || row.recordKey || '')}
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 高级筛选面板 */}
      <AdvancedFilterPanel
        visible={filterPanelVisible}
        filters={advancedFilters}
        hospitalOptions={hospitalOptions}
        diagnosisOptions={diagnosisOptions}
        genderOptions={genderOptions}
        ethnicityOptions={ethnicityOptions}
        nativePlaceOptions={nativePlaceOptions}
        doctorOptions={doctorOptions}
        previewCount={filterPreviewCount}
        previewLoading={filterPreviewLoading}
        onClose={handleFilterClose}
        onApply={handleFilterApply}
        onReset={handleFilterReset}
        onPreview={handleFilterPreview}
        onDiagnosisSearch={handleDiagnosisSearch}
      />
    </div>
  );
};

export default PatientListPage;
