import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPatientList, deletePatient, exportPatients } from '../api/patient';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientSummary } from '../types/patient';
type StatsData = { total: number; inCare: number; pending: number; discharged: number };
import {
  AdvancedFilters,
  FilterOption,
  getDefaultAdvancedFilters,
  applyAdvancedFilters,
  deriveHospitalOptions,
  deriveDiagnosisOptions,
  normalizeAdvancedFilters,
  summarizeFiltersForScheme,
  resolveAgeBucket,
  getAgeBucketLabelById,
  AGE_BUCKETS,
  calculateAge,
  formatAge,
} from '../shared/filters';
import AdvancedFilterPanel from '../components/AdvancedFilterPanel';

const PAGE_SIZE = 100;
const CACHE_KEY = 'patient_list_cache_web';
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const SUGGEST_DEBOUNCE_TIME = 300; // 搜索建议防抖时间
const MAX_SUGGESTIONS = 8; // 最大建议数量

type Badge = {
  text: string;
  type: 'success' | 'warning' | 'danger' | 'secondary' | 'info' | 'primary' | 'default';
  _type?: string;
};

type TableRow = PatientSummary & {
  key: string;
  careStatus: 'in_care' | 'pending' | 'discharged';
  cardStatus: 'success' | 'warning' | 'default';
  riskLevel: 'high' | 'medium' | 'low';
  badges: Badge[];
  ageText: string;
  ageYears: number | null;
  ageBucketId: string;
  ageBucketLabel: string;
  latestEvent: string;
  tags: string[];
  diffDaysSinceLatestAdmission: number | null;
};

type CacheData = {
  patients: TableRow[];
  timestamp: number;
  statsData: StatsData;
};

// Utility functions matching Mini Program logic
const safeString = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const formatDate = (value: any): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeCareStatus = (value: any, fallback: 'in_care' | 'pending' | 'discharged' = 'pending'): 'in_care' | 'pending' | 'discharged' => {
  const text = safeString(value).toLowerCase();
  if (!text) return fallback;
  if (['in_care', 'incare', 'in-care', 'active', '入住', '在住'].includes(text)) return 'in_care';
  if (['pending', 'followup', 'follow_up', '待入住', '待随访', '随访'].includes(text)) return 'pending';
  if (['discharged', 'left', 'checkout', '已离开', '已出院', '离开'].includes(text)) return 'discharged';
  return fallback;
};

const deriveCardStatus = (careStatus: string): 'success' | 'warning' | 'default' => {
  switch (careStatus) {
    case 'in_care': return 'success';
    case 'pending': return 'warning';
    case 'discharged': return 'default';
    default: return 'default';
  }
};

const mapPatientStatus = (latestAdmissionTimestamp: number) => {
  if (!Number.isFinite(latestAdmissionTimestamp) || latestAdmissionTimestamp <= 0) {
    return { cardStatus: 'default' as const, careStatus: 'discharged' as const, diffDays: null };
  }
  const now = Date.now();
  if (latestAdmissionTimestamp > now) {
    return { cardStatus: 'warning' as const, careStatus: 'pending' as const, diffDays: 0 };
  }
  const diffDays = Math.floor((now - latestAdmissionTimestamp) / (24 * 60 * 60 * 1000));
  if (diffDays <= 30) {
    return { cardStatus: 'success' as const, careStatus: 'in_care' as const, diffDays };
  }
  if (diffDays <= 90) {
    return { cardStatus: 'warning' as const, careStatus: 'pending' as const, diffDays };
  }
  return { cardStatus: 'default' as const, careStatus: 'discharged' as const, diffDays };
};

const identifyRiskLevel = (diffDays: number | null): 'high' | 'medium' | 'low' => {
  if (diffDays === null || diffDays === undefined) return 'low';
  if (diffDays <= 7) return 'high';
  if (diffDays <= 30) return 'medium';
  return 'low';
};

const generatePatientBadges = (params: {
  careStatus: string;
  riskLevel: string;
  admissionCount: number;
}): Badge[] => {
  const badges: Badge[] = [];
  if (params.careStatus === 'in_care') {
    badges.push({ text: '在住', type: 'success' });
  } else if (params.careStatus === 'pending') {
    badges.push({ text: '随访', type: 'warning' });
  } else if (params.careStatus === 'discharged') {
    badges.push({ text: '已离开', type: 'secondary' });
  }
  if (params.riskLevel === 'high') {
    badges.push({ text: '需复查', type: 'danger' });
  } else if (params.riskLevel === 'medium') {
    badges.push({ text: '定期随访', type: 'warning' });
  }
  const count = Number(params.admissionCount || 0);
  if (count > 0) {
    badges.push({ text: `入住 ${count} 次`, type: 'secondary' });
  }
  return badges;
};

const buildLatestEvent = (params: {
  latestAdmissionDateFormatted: string;
  latestDiagnosis: string;
  importOrder: number | null;
  importedAtFormatted: string;
}): string => {
  const diagnosis = safeString(params.latestDiagnosis) || '暂无诊断';
  if (params.latestAdmissionDateFormatted) {
    return `${params.latestAdmissionDateFormatted} · ${diagnosis}`;
  }
  if (params.importOrder !== null && params.importOrder > 0) {
    return `Excel 第 ${params.importOrder} 行 · ${diagnosis}`;
  }
  if (params.importedAtFormatted) {
    return `${params.importedAtFormatted} 导入 · ${diagnosis}`;
  }
  return diagnosis;
};

const extractPatientTags = (params: {
  latestHospital: string;
  latestDoctor: string;
  firstDiagnosis: string;
  latestDiagnosis: string;
  importOrder: number | null;
}): string[] => {
  const tags: string[] = [];
  const append = (value: string) => {
    const item = safeString(value);
    if (item && !tags.includes(item)) {
      tags.push(item);
    }
  };
  append(params.latestHospital);
  append(params.latestDoctor);
  if (params.firstDiagnosis && safeString(params.firstDiagnosis) !== safeString(params.latestDiagnosis)) {
    append(params.firstDiagnosis);
  }
  if (params.importOrder !== null && params.importOrder > 0) {
    append(`Excel 行 ${params.importOrder}`);
  }
  return tags;
};

const PatientListPage: React.FC = () => {
  const { app, user } = useCloudbase();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
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

  // 视图模式（默认表格视图）
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');

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

      // Map patients with enriched fields (matching Mini Program logic)
      const rows: TableRow[] = (result.patients || []).map(item => {
        const latestAdmissionDateFormatted = formatDate(item.latestAdmissionDate || item.firstAdmissionDate);
        const firstAdmissionDateFormatted = formatDate(item.firstAdmissionDate || item.latestAdmissionDate);
        const firstAdmissionTimestamp = Number(item.firstAdmissionTimestamp || 0);
        const firstDiagnosis = item.firstDiagnosis || item.latestDiagnosis || '';
        const latestDiagnosis = item.latestDiagnosis || item.firstDiagnosis || '';
        const firstHospital = item.firstHospital || item.latestHospital || '';
        const latestHospital = item.latestHospital || item.firstHospital || '';
        const latestDoctor = item.latestDoctor || '';
        const firstDoctor = item.firstDoctor || '';
        const latestAdmissionTimestamp = Number(item.latestAdmissionTimestamp || 0);

        const {
          cardStatus: derivedCardStatus,
          careStatus: derivedCareStatus,
          diffDays,
        } = mapPatientStatus(latestAdmissionTimestamp);

        const checkoutAt = Number(item.checkoutAt || 0);
        const hasCheckout = Number.isFinite(checkoutAt) && checkoutAt > 0;

        let careStatus = normalizeCareStatus(item.careStatus, derivedCareStatus);

        if (hasCheckout && (!item.careStatus || careStatus === derivedCareStatus)) {
          careStatus = 'discharged';
        }

        const cardStatus = deriveCardStatus(careStatus);
        const riskLevel = identifyRiskLevel(diffDays);
        const admissionCount = Number(item.admissionCount || 0);
        const badges = generatePatientBadges({ careStatus, riskLevel, admissionCount });

        const importOrder = Number(item.importOrder || item.excelImportOrder || 0) || null;
        const importedAtTs = Number(item.importedAt || item._importedAt || 0);
        const importedAtFormatted = importedAtTs ? formatDate(importedAtTs) : '';

        const latestEvent = buildLatestEvent({
          latestAdmissionDateFormatted,
          latestDiagnosis,
          importOrder,
          importedAtFormatted,
        });

        const tags = extractPatientTags({
          latestHospital,
          latestDoctor,
          firstDiagnosis,
          latestDiagnosis,
          importOrder,
        });

        const key = item.patientKey || item.recordKey || item._id || '';
        const ageYears = calculateAge(item.birthDate);
        const ageBucket = resolveAgeBucket(ageYears);

        return {
          ...item,
          key,
          careStatus,
          cardStatus,
          riskLevel,
          badges,
          ageText: formatAge(item.birthDate),
          ageYears,
          ageBucketId: ageBucket ? ageBucket.id : '',
          ageBucketLabel: ageBucket ? ageBucket.label : '',
          latestEvent,
          tags,
          diffDaysSinceLatestAdmission: diffDays,
          firstAdmissionDateFormatted,
          latestAdmissionDateFormatted,
          firstDiagnosis,
          latestDiagnosis,
          firstHospital,
          latestHospital,
          latestDoctor,
          firstDoctor,
          firstAdmissionTimestamp,
        };
      });

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


  const handleSuggestionClick = (suggestion: string) => {
    setKeyword(suggestion);
    setShowSuggestions(false);
  };

  const rows = useMemo(() => displayPatients, [displayPatients]);

  // 状态标签渲染
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

  // 渲染单个患者卡片
  const renderPatientCard = (row: TableRow) => {
    const borderColor = row.cardStatus === 'success' ? '#10b981' : row.cardStatus === 'warning' ? '#f59e0b' : '#e5e7eb';
    const isSelected = selected.has(row.key);

    return (
      <div
        key={row.key}
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          border: `2px solid ${isSelected ? '#2563eb' : borderColor}`,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onClick={() => navigate(`/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`)}
      >
        {/* 头部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#1f2937' }}>
                {row.patientName || '-'}
              </span>
              <span style={{ fontSize: 14, color: '#6b7280' }}>
                {row.gender} · {row.ageText}
              </span>
            </div>
            {/* 徽章 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {row.badges.map((badge, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    backgroundColor:
                      badge.type === 'success' ? '#d1fae5' :
                      badge.type === 'warning' ? '#fef3c7' :
                      badge.type === 'danger' ? '#fee2e2' :
                      badge.type === 'info' ? '#dbeafe' :
                      badge.type === 'primary' ? '#dbeafe' :
                      '#f3f4f6',
                    color:
                      badge.type === 'success' ? '#065f46' :
                      badge.type === 'warning' ? '#92400e' :
                      badge.type === 'danger' ? '#991b1b' :
                      badge.type === 'info' ? '#1e40af' :
                      badge.type === 'primary' ? '#1e40af' :
                      '#374151',
                  }}
                >
                  {badge.text}
                </span>
              ))}
            </div>
          </div>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelect(row.key);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
        </div>

        {/* 最新事件 */}
        <div style={{ marginBottom: 12, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 }}>
          <div style={{ fontSize: 14, color: '#4b5563' }}>{row.latestEvent}</div>
        </div>

        {/* 标签 */}
        {row.tags && row.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {row.tags.map((tag, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 13,
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 快速信息 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {row.phone && (
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              📱 {row.phone}
            </div>
          )}
          {row.nativePlace && (
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              📍 {row.nativePlace}
            </div>
          )}
          {row.latestHospital && (
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              🏥 {row.latestHospital}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
          <button
            className="link-button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`);
            }}
            style={{ flex: 1, padding: '6px 12px', fontSize: 14 }}
          >
            查看详情
          </button>
          <button
            className="danger-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteSingle(row.patientKey || row.recordKey || '');
            }}
            style={{ padding: '6px 12px', fontSize: 14 }}
          >
            删除
          </button>
        </div>
      </div>
    );
  };

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

          {/* 视图切换按钮 */}
          <button
            className="secondary-button"
            type="button"
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {viewMode === 'card' ? '📋 表格视图' : '🎴 卡片视图'}
          </button>
        </div>

        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 12 }}>
          <button className="secondary-button" type="button" onClick={() => loadPatients()} disabled={loading}>
            {loading ? '刷新中...' : '刷新列表'}
          </button>
          {/* Excel 导入功能已移除 */}
          <button className="secondary-button" type="button" onClick={handleExportSelected}>
            导出选中
          </button>
          <button className="secondary-button" type="button" onClick={handleBulkDelete} disabled={selected.size === 0}>
            删除选中
          </button>
          <button className="primary-button" type="button" onClick={() => navigate('/patients/new')}>
            新增住户
          </button>
        </div>
      </div>

      {/* Excel 导入输入已移除 */}

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

      {/* 骨架屏加载状态 */}
      {loading && rows.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: 12,
                padding: 16,
                border: '1px solid #e5e7eb',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            >
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 100, height: 20, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
                <div style={{ width: 60, height: 20, backgroundColor: '#e5e7eb', borderRadius: 4 }} />
              </div>
              <div style={{ width: '80%', height: 16, backgroundColor: '#f3f4f6', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 80, height: 24, backgroundColor: '#f3f4f6', borderRadius: 4 }} />
                <div style={{ width: 80, height: 24, backgroundColor: '#f3f4f6', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        // 智能空状态
        <div style={{
          textAlign: 'center',
          padding: 60,
          background: 'white',
          borderRadius: 12,
          border: '1px solid #e5e7eb'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {debouncedKeyword ? '🔍' : hasActiveFilters ? '🔎' : '📋'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1f2937', marginBottom: 8 }}>
            {debouncedKeyword ? '未找到匹配的住户' : hasActiveFilters ? '无符合条件的住户' : '暂无住户档案'}
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>
            {debouncedKeyword
              ? `没有找到与"${debouncedKeyword}"相关的住户`
              : hasActiveFilters
              ? '当前筛选条件过于严格，请尝试调整筛选条件'
              : activeStatFilter !== 'all'
              ? '当前分类没有住户'
              : '点击右上角按钮添加第一位住户'}
          </div>
          {(debouncedKeyword || hasActiveFilters) && (
            <button
              className="secondary-button"
              onClick={resetFilters}
              style={{ marginTop: 8 }}
            >
              {debouncedKeyword ? '清除搜索' : '清除筛选'}
            </button>
          )}
        </div>
      ) : viewMode === 'card' ? (
        // 卡片视图
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map(row => renderPatientCard(row))}
        </div>
      ) : (
        // 表格视图
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(rows.map(r => r.key)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                </th>
                <th style={{ minWidth: 120 }}>姓名</th>
                <th style={{ width: 60, textAlign: 'center' }}>性别</th>
                <th style={{ width: 80 }}>年龄</th>
                <th style={{ minWidth: 140 }}>联系电话</th>
                <th style={{ minWidth: 120 }}>籍贯</th>
                <th style={{ width: 100 }}>状态</th>
                <th style={{ minWidth: 160 }}>最新医院</th>
                <th style={{ width: 100, textAlign: 'center' }}>入院次数</th>
                <th style={{ width: 180, textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.key)}
                      onChange={() => toggleSelect(row.key)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>
                      {row.patientName || '-'}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', color: '#6b7280' }}>
                    {row.gender || '-'}
                  </td>
                  <td style={{ color: '#6b7280' }}>
                    {row.ageText}
                  </td>
                  <td style={{ color: '#6b7280', fontFamily: 'monospace' }}>
                    {row.phone || row.backupPhone || '-'}
                  </td>
                  <td style={{ color: '#6b7280' }}>
                    {row.nativePlace || row.address || '-'}
                  </td>
                  <td>{statusLabel(row)}</td>
                  <td style={{ color: '#6b7280' }}>
                    {row.latestHospital || '-'}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: '#1f2937' }}>
                    {row.admissionCount ?? '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button
                        className="link-button"
                        onClick={() =>
                          navigate(
                            `/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`
                          )
                        }
                        style={{ fontSize: 14, padding: '6px 12px' }}
                      >
                        查看
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => handleDeleteSingle(row.patientKey || row.recordKey || '')}
                        style={{ fontSize: 14, padding: '6px 12px' }}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
