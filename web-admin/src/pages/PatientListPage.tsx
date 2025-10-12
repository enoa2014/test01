import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  calculateAge,
  formatAge,
} from '../shared/filters';
import AdvancedFilterPanel from '../components/AdvancedFilterPanel';

const PAGE_SIZE = 100;
const CACHE_KEY = 'patient_list_cache_web';
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
const SUGGEST_DEBOUNCE_TIME = 300; // 搜索建议防抖时间
const MAX_SUGGESTIONS = 8; // 最大建议数量

// 列表页状态选项（与详情页保持一致）
const STATUS_OPTIONS = [
  { id: 'in_care', label: '在住' },
  { id: 'pending', label: '待入住' },
  { id: 'discharged', label: '已离开' },
];

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
  // 添加扩展字段以支持Excel数据
  firstAdmissionDate?: string;
  firstAdmissionTimestamp?: number;
  firstDiagnosis?: string;
  firstHospital?: string;
  firstDoctor?: string;
  importOrder?: number | null;
  importedAt?: number;
  _importedAt?: number;
  excelImportOrder?: number;
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
  const genderOptions = useMemo(() => [
    { id: '男', label: '男' },
    { id: '女', label: '女' },
  ], []);
  const [ethnicityOptions, setEthnicityOptions] = useState<FilterOption[]>([]);
  const [nativePlaceOptions, setNativePlaceOptions] = useState<FilterOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<FilterOption[]>([]);

  // 统计数据
  const [statsData, setStatsData] = useState<StatsData>({ total: 0, inCare: 0, pending: 0, discharged: 0 });
  const [activeStatFilter, setActiveStatFilter] = useState<'all' | 'in_care' | 'pending' | 'discharged'>('all');

  // 状态调整对话框
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [statusDialogSubmitting, setStatusDialogSubmitting] = useState(false);
  const [statusForm, setStatusForm] = useState<{ value: 'in_care' | 'pending' | 'discharged' | '' ; note: string }>({ value: '', note: '' });
  const [statusTargetKey, setStatusTargetKey] = useState<string>('');

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

  // 确认状态调整（列表页）
  const handleConfirmStatusChange = useCallback(async () => {
    if (!app) {
      setError('CloudBase 未初始化');
      return;
    }
    if (!statusTargetKey || !statusForm.value) {
      setError('请选择状态');
      return;
    }
    setStatusDialogSubmitting(true);
    setError(null);
    try {
      const res = await app.callFunction({
        name: 'patientIntake',
        data: {
          action: 'updateCareStatus',
          patientKey: statusTargetKey,
          status: statusForm.value,
          note: statusForm.note,
        },
      });
      const result = res.result as { success?: boolean; error?: { message?: string } };
      if (!result || result.success === false) {
        throw new Error(result?.error?.message || '更新失败');
      }
      const nextPatients = patients.map(r => {
        const matched = r.key === statusTargetKey || r.patientKey === statusTargetKey || r.recordKey === statusTargetKey;
        if (!matched) return r;
        const careStatus = statusForm.value as 'in_care' | 'pending' | 'discharged';
        const cardStatus = deriveCardStatus(careStatus);
        const admissionCount = Number(r.admissionCount || 0);
        const badges = generatePatientBadges({
          careStatus,
          riskLevel: identifyRiskLevel(r.diffDaysSinceLatestAdmission),
          admissionCount,
        });
        return { ...r, careStatus, cardStatus, badges };
      });
      setPatients(nextPatients);
      const nextDisplay = applyFilters(nextPatients);
      setDisplayPatients(nextDisplay);
      setStatsData(calculateStats(nextPatients));
      setMessage('状态已更新');
      setStatusDialogVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setStatusDialogSubmitting(false);
    }
  }, [app, statusTargetKey, statusForm.value, statusForm.note, patients, applyFilters, calculateStats]);

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
    const open = (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setStatusTargetKey(row.patientKey || row.recordKey || '');
      const next: any = careStatus || 'pending';
      setStatusForm({ value: next, note: '' });
      setStatusDialogVisible(true);
    };
    if (careStatus === 'discharged') {
      return (
        <span className="status-pill gray" onClick={open} style={{ cursor: 'pointer' }} title="点击调整状态">
          已退住
        </span>
      );
    }
    if (careStatus === 'pending') {
      return (
        <span className="status-pill yellow" onClick={open} style={{ cursor: 'pointer' }} title="点击调整状态">
          待入住
        </span>
      );
    }
    return (
      <span className="status-pill green" onClick={open} style={{ cursor: 'pointer' }} title="点击调整状态">
        在住
      </span>
    );
  };

  // 渲染单个患者卡片 - 现代化设计
  const renderPatientCard = (row: TableRow) => {
    const isSelected = selected.has(row.key);
    const statusColors = {
      success: { bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', border: '#10b981', text: '#065f46' },
      warning: { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#f59e0b', text: '#92400e' },
      default: { bg: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)', border: '#d1d5db', text: '#374151' }
    };

    const cardColor = statusColors[row.cardStatus];

    return (
      <div
        key={row.key}
        className="patient-card-modern"
        style={{
          background: 'white',
          borderRadius: 16,
          padding: 0,
          marginBottom: 0,
          border: `2px solid ${isSelected ? '#2563eb' : cardColor.border}`,
          boxShadow: isSelected
            ? '0 8px 32px rgba(37, 99, 235, 0.2), 0 0 0 1px rgba(37, 99, 235, 0.1)'
            : '0 4px 16px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          position: 'relative',
          height: '100%',
        }}
        onClick={() => navigate(`/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
          e.currentTarget.style.boxShadow = isSelected
            ? '0 20px 50px rgba(37, 99, 235, 0.25), 0 0 0 1px rgba(37, 99, 235, 0.15)'
            : '0 12px 40px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(226, 232, 240, 0.8)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = isSelected
            ? '0 12px 40px rgba(37, 99, 235, 0.2), 0 0 0 1px rgba(37, 99, 235, 0.1)'
            : '0 4px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)';
        }}
      >
        {/* 顶部状态条 */}
        <div
          style={{
            height: 4,
            background: cardColor.bg,
            width: '100%',
          }}
        />

        {/* 卡片主体 */}
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 头部区域 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* 姓名和基本信息 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${row.gender === '男' ? '#dbeafe' : '#fce7f3'} 0%, ${row.gender === '男' ? '#bfdbfe' : '#fbcfe8'} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 600,
                  color: row.gender === '男' ? '#1e40af' : '#be185d',
                  boxShadow: `0 2px 8px ${row.gender === '男' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)'}`,
                  border: `2px solid ${row.gender === '男' ? '#93c5fd' : '#fbcfe8'}`,
                }}>
                  {row.patientName ? row.patientName.charAt(0).toUpperCase() : '?'}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 600,
                    color: '#1f2937',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {row.patientName || '未知住户'}
                  </h3>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: '#6b7280',
                    marginTop: 2
                  }}>
                    <span>{row.gender || '-'}</span>
                    <span>•</span>
                    <span>{row.ageText || '-'}</span>
                    {row.nativePlace && (
                      <>
                        <span>•</span>
                        <span style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 100
                        }}>
                          📍 {row.nativePlace}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 状态徽章 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {row.badges.map((badge, idx) => {
                  const isStatusBadge = badge.text === '在住' || badge.text === '待入住' || badge.text === '已离开';
                  const badgeColors = {
                    success: { bg: '#d1fae5', color: '#065f46' },
                    warning: { bg: '#fef3c7', color: '#92400e' },
                    danger: { bg: '#fee2e2', color: '#991b1b' },
                    info: { bg: '#dbeafe', color: '#1e40af' },
                    primary: { bg: '#dbeafe', color: '#1e40af' },
                    secondary: { bg: '#f3f4f6', color: '#374151' },
                    default: { bg: '#f3f4f6', color: '#374151' }
                  };

                  const badgeColor = badgeColors[badge.type] || badgeColors.default;
                  const onClick = (e: React.MouseEvent) => {
                    if (!isStatusBadge) return;
                    e.stopPropagation();
                    setStatusTargetKey(row.patientKey || row.recordKey || '');
                    const next = (badge.text === '在住' ? 'in_care' : badge.text === '待入住' ? 'pending' : 'discharged') as 'in_care' | 'pending' | 'discharged';
                    setStatusForm({ value: next, note: '' });
                    setStatusDialogVisible(true);
                  };

                  return (
                    <span
                      key={idx}
                      onClick={onClick}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 500,
                        backgroundColor: badgeColor.bg,
                        color: badgeColor.color,
                        border: `1px solid ${badgeColor.bg}`,
                        cursor: isStatusBadge ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (isStatusBadge) {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      title={isStatusBadge ? '点击调整状态' : undefined}
                    >
                      {isStatusBadge && (
                        <span style={{ marginRight: 4, fontSize: 8 }}>●</span>
                      )}
                      {badge.text}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 选择框 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              marginLeft: 12
            }}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleSelect(row.key);
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 20,
                  height: 20,
                  cursor: 'pointer',
                  accentColor: '#2563eb'
                }}
              />
              {row.riskLevel === 'high' && (
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  animation: 'pulse 2s infinite',
                }} title="需复查"/>
              )}
            </div>
          </div>

          {/* 最新事件 - 信息卡片 */}
          <div style={{
            marginBottom: 12,
            padding: 12,
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 3, fontWeight: 500 }}>
              最近就诊
            </div>
            <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.4 }}>
              {row.latestEvent || '暂无就诊记录'}
            </div>
          </div>

          {/* 标签区域 */}
          {row.tags && row.tags.length > 0 && (
            <div style={{ marginBottom: 12, marginTop: 'auto' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 500 }}>
                相关信息
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {row.tags.slice(0, 2).map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {tag.includes('医院') && <span style={{ marginRight: 3, fontSize: 10 }}>🏥</span>}
                    {tag.includes('医生') && <span style={{ marginRight: 3, fontSize: 10 }}>👨‍⚕️</span>}
                    {tag.includes('Excel') && <span style={{ marginRight: 3, fontSize: 10 }}>📊</span>}
                    {tag}
                  </span>
                ))}
                {row.tags.length > 2 && (
                  <span style={{
                    padding: '4px 6px',
                    fontSize: 10,
                    color: '#64748b',
                    fontStyle: 'italic'
                  }}>
                    +{row.tags.length - 2} 更多
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 操作区域 */}
          <div className="patient-card-actions" style={{
            display: 'flex',
            gap: 8,
            paddingTop: 12,
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#fafbfc',
            margin: -18,
            padding: '12px 18px',
            flexWrap: 'nowrap',
            minWidth: 0,
            marginTop: 'auto',
          }}>
            <button
              className="modern-btn primary-btn"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`);
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 12px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: 12 }}>📋</span>
              查看详情
            </button>
            <button
              className="modern-btn danger-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSingle(row.patientKey || row.recordKey || '');
              }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: '8px 12px',
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: 12 }}>🗑️</span>
              删除
            </button>
          </div>
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
      {/* 现代化统计卡片 */}
      <div className="stats-grid-modern" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 20,
        marginBottom: 24
      }}>
        <div
          onClick={() => handleStatFilterClick('all')}
          className="stat-card-modern"
          style={{
            padding: 20,
            borderRadius: 16,
            border: `2px solid ${activeStatFilter === 'all' ? '#3b82f6' : '#e5e7eb'}`,
            background: activeStatFilter === 'all'
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: activeStatFilter === 'all'
              ? '0 8px 32px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1)'
              : '0 2px 12px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
            transform: activeStatFilter === 'all' ? 'scale(1.02)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (activeStatFilter !== 'all') {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(15, 23, 42, 0.12)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeStatFilter !== 'all') {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.08)';
            }
          }}
        >
          <div style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: activeStatFilter === 'all'
              ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.05) 100%)',
            transition: 'all 0.3s',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 28,
              marginBottom: 8,
              lineHeight: 1,
              filter: activeStatFilter === 'all' ? 'brightness(0) invert(1)' : 'none',
            }}>👥</div>
            <div style={{
              fontSize: 13,
              color: activeStatFilter === 'all' ? 'rgba(255, 255, 255, 0.9)' : '#64748b',
              marginBottom: 6,
              fontWeight: 500,
              letterSpacing: '0.5px'
            }}>全部住户</div>
            <div style={{
              fontSize: 36,
              fontWeight: 700,
              color: activeStatFilter === 'all' ? '#ffffff' : '#1e293b',
              lineHeight: 1,
              textShadow: activeStatFilter === 'all' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}>{statsData.total}</div>
          </div>
        </div>

        <div
          onClick={() => handleStatFilterClick('in_care')}
          className="stat-card-modern"
          style={{
            padding: 20,
            borderRadius: 16,
            border: `2px solid ${activeStatFilter === 'in_care' ? '#10b981' : '#e5e7eb'}`,
            background: activeStatFilter === 'in_care'
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: activeStatFilter === 'in_care'
              ? '0 8px 32px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(16, 185, 129, 0.1)'
              : '0 2px 12px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
            transform: activeStatFilter === 'in_care' ? 'scale(1.02)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (activeStatFilter !== 'in_care') {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(15, 23, 42, 0.12)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeStatFilter !== 'in_care') {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.08)';
            }
          }}
        >
          <div style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: activeStatFilter === 'in_care'
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.05) 100%)',
            transition: 'all 0.3s',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 28,
              marginBottom: 8,
              lineHeight: 1,
              filter: activeStatFilter === 'in_care' ? 'brightness(0) invert(1)' : 'none',
            }}>🏠</div>
            <div style={{
              fontSize: 13,
              color: activeStatFilter === 'in_care' ? 'rgba(255, 255, 255, 0.9)' : '#64748b',
              marginBottom: 6,
              fontWeight: 500,
              letterSpacing: '0.5px'
            }}>在住</div>
            <div style={{
              fontSize: 36,
              fontWeight: 700,
              color: activeStatFilter === 'in_care' ? '#ffffff' : '#1e293b',
              lineHeight: 1,
              textShadow: activeStatFilter === 'in_care' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}>{statsData.inCare}</div>
          </div>
        </div>

        <div
          onClick={() => handleStatFilterClick('pending')}
          className="stat-card-modern"
          style={{
            padding: 20,
            borderRadius: 16,
            border: `2px solid ${activeStatFilter === 'pending' ? '#f59e0b' : '#e5e7eb'}`,
            background: activeStatFilter === 'pending'
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: activeStatFilter === 'pending'
              ? '0 8px 32px rgba(245, 158, 11, 0.25), 0 0 0 1px rgba(245, 158, 11, 0.1)'
              : '0 2px 12px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
            transform: activeStatFilter === 'pending' ? 'scale(1.02)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (activeStatFilter !== 'pending') {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(15, 23, 42, 0.12)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeStatFilter !== 'pending') {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.08)';
            }
          }}
        >
          <div style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: activeStatFilter === 'pending'
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.05) 100%)',
            transition: 'all 0.3s',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 28,
              marginBottom: 8,
              lineHeight: 1,
              filter: activeStatFilter === 'pending' ? 'brightness(0) invert(1)' : 'none',
            }}>⏳</div>
            <div style={{
              fontSize: 13,
              color: activeStatFilter === 'pending' ? 'rgba(255, 255, 255, 0.9)' : '#64748b',
              marginBottom: 6,
              fontWeight: 500,
              letterSpacing: '0.5px'
            }}>待入住</div>
            <div style={{
              fontSize: 36,
              fontWeight: 700,
              color: activeStatFilter === 'pending' ? '#ffffff' : '#1e293b',
              lineHeight: 1,
              textShadow: activeStatFilter === 'pending' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}>{statsData.pending}</div>
          </div>
        </div>

        <div
          onClick={() => handleStatFilterClick('discharged')}
          className="stat-card-modern"
          style={{
            padding: 20,
            borderRadius: 16,
            border: `2px solid ${activeStatFilter === 'discharged' ? '#6b7280' : '#e5e7eb'}`,
            background: activeStatFilter === 'discharged'
              ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
              : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: activeStatFilter === 'discharged'
              ? '0 8px 32px rgba(107, 114, 128, 0.25), 0 0 0 1px rgba(107, 114, 128, 0.1)'
              : '0 2px 12px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
            transform: activeStatFilter === 'discharged' ? 'scale(1.02)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (activeStatFilter !== 'discharged') {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(15, 23, 42, 0.12)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeStatFilter !== 'discharged') {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.08)';
            }
          }}
        >
          <div style={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: activeStatFilter === 'discharged'
              ? 'linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(107, 114, 128, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.05) 100%)',
            transition: 'all 0.3s',
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              fontSize: 28,
              marginBottom: 8,
              lineHeight: 1,
              filter: activeStatFilter === 'discharged' ? 'brightness(0) invert(1)' : 'none',
            }}>🏃</div>
            <div style={{
              fontSize: 13,
              color: activeStatFilter === 'discharged' ? 'rgba(255, 255, 255, 0.9)' : '#64748b',
              marginBottom: 6,
              fontWeight: 500,
              letterSpacing: '0.5px'
            }}>已退住</div>
            <div style={{
              fontSize: 36,
              fontWeight: 700,
              color: activeStatFilter === 'discharged' ? '#ffffff' : '#1e293b',
              lineHeight: 1,
              textShadow: activeStatFilter === 'discharged' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}>{statsData.discharged}</div>
          </div>
        </div>
      </div>

      {/* 现代化搜索和筛选工具栏 */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        padding: 20,
        marginBottom: 20,
        border: '1px solid #e2e8f0',
      }}>
        {/* 搜索区域 */}
        <div style={{ marginBottom: 16 }}>
          <div className="patient-list-search" style={{ position: 'relative', maxWidth: 500 }}>
            <div style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 18,
              color: '#64748b',
              pointerEvents: 'none',
            }}>
              🔍
            </div>
            <input
              type="search"
              placeholder="搜索姓名 / 证件号 / 电话 / 医院 / 诊断..."
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              onFocus={() => setShowSuggestions(searchSuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              style={{
                width: '100%',
                padding: '14px 16px 14px 48px',
                borderRadius: 12,
                border: `2px solid ${keyword.trim() ? '#3b82f6' : '#e2e8f0'}`,
                fontSize: 15,
                background: 'white',
                transition: 'all 0.2s',
                boxShadow: keyword.trim() ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                if (!keyword.trim()) {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            />
            {/* 搜索建议下拉框 */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 8,
                  backgroundColor: 'white',
                  border: '2px solid #e2e8f0',
                  borderRadius: 12,
                  boxShadow: '0 10px 25px rgba(15, 23, 42, 0.1)',
                  maxHeight: 280,
                  overflowY: 'auto',
                  zIndex: 20,
                }}
              >
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: index < searchSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.paddingLeft = '20px';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.paddingLeft = '16px';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, color: '#64748b' }}>🔍</span>
                      <span style={{ fontSize: 14, color: '#1e293b' }}>{suggestion}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮区域 */}
        <div className="patient-list-toolbar" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            {/* 高级筛选按钮 */}
            <button
              className={hasActiveFilters ? 'primary-button' : 'secondary-button'}
              type="button"
              onClick={handleToggleAdvancedFilter}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <span>🎯</span>
              高级筛选
              {hasActiveFilters && (
                <span style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                }}>✓</span>
              )}
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={resetFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <span>🔄</span>
              重置筛选
            </button>

            {/* 视图切换按钮 */}
            <button
              className="secondary-button"
              type="button"
              onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <span>{viewMode === 'card' ? '📋' : '🎴'}</span>
              {viewMode === 'card' ? '表格视图' : '卡片视图'}
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            <button
              className="secondary-button"
              type="button"
              onClick={() => loadPatients()}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <span>{loading ? '⏳' : '🔄'}</span>
              {loading ? '刷新中...' : '刷新列表'}
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={handleExportSelected}
              disabled={selected.size === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                opacity: selected.size === 0 ? 0.5 : 1,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <span>📤</span>
              导出选中 {selected.size > 0 && `(${selected.size})`}
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={handleBulkDelete}
              disabled={selected.size === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                opacity: selected.size === 0 ? 0.5 : 1,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <span>🗑️</span>
              删除选中 {selected.size > 0 && `(${selected.size})`}
            </button>

            <button
              className="primary-button"
              type="button"
              onClick={() => navigate('/patients/new')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <span>➕</span>
              新增住户
            </button>
          </div>
        </div>
      </div>

      {/* Excel 导入输入已移除 */}

      {/* 筛选摘要 */}
      {hasActiveFilters && (
        <div className="patient-list-filter-summary" style={{ marginBottom: 12, padding: 10, backgroundColor: '#eff6ff', borderRadius: 8, fontSize: 14, border: '1px solid #bfdbfe' }}>
          <span style={{ color: '#2563eb', fontWeight: 500 }}>🎯 筛选条件：</span>
          <span style={{ color: '#1f2937', marginLeft: 6 }}>{summarizeFiltersForScheme(advancedFilters)}</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton-card"
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                borderRadius: 20,
                padding: 0,
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
                overflow: 'hidden',
              }}
            >
              {/* 骨架屏顶部状态条 */}
              <div style={{
                height: 4,
                background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }} />

              <div style={{ padding: 24 }}>
                {/* 头部骨架 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 1.5s ease-in-out infinite',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{
                        width: '60%',
                        height: 20,
                        backgroundColor: '#e2e8f0',
                        borderRadius: 6,
                        marginBottom: 8,
                        background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s ease-in-out infinite',
                      }} />
                      <div style={{
                        width: '40%',
                        height: 16,
                        backgroundColor: '#f1f5f9',
                        borderRadius: 4,
                        background: 'linear-gradient(90deg, #f1f5f9 0%, #f8fafc 50%, #f1f5f9 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s ease-in-out infinite',
                      }} />
                    </div>
                  </div>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    backgroundColor: '#e2e8f0',
                    background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }} />
                </div>

                {/* 内容骨架 */}
                <div style={{
                  marginBottom: 20,
                  padding: 14,
                  backgroundColor: '#f8fafc',
                  borderRadius: 10,
                }}>
                  <div style={{
                    width: '80%',
                    height: 14,
                    backgroundColor: '#e2e8f0',
                    borderRadius: 4,
                    marginBottom: 6,
                    background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }} />
                  <div style={{
                    width: '60%',
                    height: 14,
                    backgroundColor: '#f1f5f9',
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, #f1f5f9 0%, #f8fafc 50%, #f1f5f9 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }} />
                </div>

                {/* 标签骨架 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <div style={{
                    width: 60,
                    height: 24,
                    backgroundColor: '#f1f5f9',
                    borderRadius: 12,
                    background: 'linear-gradient(90deg, #f1f5f9 0%, #f8fafc 50%, #f1f5f9 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }} />
                  <div style={{
                    width: 80,
                    height: 24,
                    backgroundColor: '#e2e8f0',
                    borderRadius: 12,
                    background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }} />
                </div>

                {/* 操作按钮骨架 */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    flex: 1,
                    height: 40,
                    backgroundColor: '#e2e8f0',
                    borderRadius: 8,
                    background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }} />
                  <div style={{
                    width: 100,
                    height: 40,
                    backgroundColor: '#f1f5f9',
                    borderRadius: 8,
                    background: 'linear-gradient(90deg, #f1f5f9 0%, #f8fafc 50%, #f1f5f9 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s ease-in-out infinite',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        // 智能空状态
        <div style={{
          textAlign: 'center',
          padding: 80,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: 20,
          border: '2px solid #e2e8f0',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
        }}>
          <div style={{
            fontSize: 64,
            marginBottom: 24,
            animation: 'bounce 2s infinite',
          }}>
            {debouncedKeyword ? '🔍' : hasActiveFilters ? '🔎' : '📋'}
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: 12,
            letterSpacing: '0.5px'
          }}>
            {debouncedKeyword ? '未找到匹配的住户' : hasActiveFilters ? '无符合条件的住户' : '暂无住户档案'}
          </div>
          <div style={{
            fontSize: 16,
            color: '#64748b',
            marginBottom: 32,
            lineHeight: 1.6,
            maxWidth: 400,
            margin: '0 auto 32px'
          }}>
            {debouncedKeyword
              ? `没有找到与"${debouncedKeyword}"相关的住户，请尝试其他搜索词`
              : hasActiveFilters
              ? '当前筛选条件过于严格，请尝试调整筛选条件'
              : activeStatFilter !== 'all'
              ? '当前分类没有住户，请选择其他分类或添加新住户'
              : '开始添加第一位住户，建立完整的档案管理系统'}
          </div>
          {(debouncedKeyword || hasActiveFilters) && (
            <button
              className="secondary-button"
              onClick={resetFilters}
              style={{
                padding: '12px 24px',
                fontSize: 15,
                fontWeight: 500,
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span>🔄</span>
              {debouncedKeyword ? '清除搜索' : '清除筛选'}
            </button>
          )}
          {!debouncedKeyword && !hasActiveFilters && activeStatFilter === 'all' && (
            <button
              className="primary-button"
              onClick={() => navigate('/patients/new')}
              style={{
                padding: '12px 32px',
                fontSize: 15,
                fontWeight: 500,
                borderRadius: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span>➕</span>
              添加第一位住户
            </button>
          )}
        </div>
      ) : viewMode === 'card' ? (
        // 网格卡片视图
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 20,
          padding: '4px 0'
        }}>
          {rows.map(row => renderPatientCard(row))}
        </div>
      ) : (
        // 现代化表格视图
        <div style={{
          overflowX: 'auto',
          background: 'white',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: 14,
          }}>
            <thead>
              <tr style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                borderBottom: '2px solid #e2e8f0',
              }}>
                <th style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderRight: '1px solid #e2e8f0',
                  width: 50,
                }}>
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
                    style={{
                      width: 18,
                      height: 18,
                      cursor: 'pointer',
                      accentColor: '#3b82f6',
                    }}
                  />
                </th>
                <th style={{
                  padding: '16px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderRight: '1px solid #e2e8f0',
                  minWidth: 280,
                }}>住户信息</th>
                <th style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderRight: '1px solid #e2e8f0',
                  width: 120,
                }}>状态</th>
                <th style={{
                  padding: '16px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderRight: '1px solid #e2e8f0',
                  minWidth: 180,
                }}>就诊医院</th>
                <th style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderRight: '1px solid #e2e8f0',
                  width: 120,
                }}>入住次数</th>
                <th style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontWeight: 600,
                  color: '#374151',
                  fontSize: 13,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: 180,
                }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.key}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    backgroundColor: index % 2 === 0 ? 'white' : '#fafbfc',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.transform = 'scale(1.005)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.08)';
                    e.currentTarget.style.zIndex = '10';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#fafbfc';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.zIndex = '1';
                  }}
                >
                  <td style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid #f1f5f9',
                  }}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.key)}
                      onChange={() => toggleSelect(row.key)}
                      style={{
                        width: 18,
                        height: 18,
                        cursor: 'pointer',
                        accentColor: '#3b82f6',
                      }}
                    />
                  </td>
                  <td style={{
                    padding: '16px 12px',
                    borderRight: '1px solid #f1f5f9',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${row.gender === '男' ? '#dbeafe' : '#fce7f3'} 0%, ${row.gender === '男' ? '#bfdbfe' : '#fbcfe8'} 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        fontWeight: 600,
                        color: row.gender === '男' ? '#1e40af' : '#be185d',
                        boxShadow: `0 2px 8px ${row.gender === '男' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(236, 72, 153, 0.2)'}`,
                        border: `2px solid ${row.gender === '男' ? '#93c5fd' : '#fbcfe8'}`,
                      }}>
                        {row.patientName ? row.patientName.charAt(0).toUpperCase() : '?'}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontWeight: 600,
                          color: '#1e293b',
                          fontSize: 15,
                          marginBottom: 2,
                        }}>
                          {row.patientName || '未知住户'}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 13,
                          color: '#64748b',
                        }}>
                          <span>{row.gender || '-'}</span>
                          <span>•</span>
                          <span>{row.ageText || '-'}</span>
                          {row.nativePlace && (
                            <>
                              <span>•</span>
                              <span style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 100
                              }}>
                                📍 {row.nativePlace}
                              </span>
                            </>
                          )}
                        </div>
                        {row.riskLevel === 'high' && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 4,
                            padding: '2px 6px',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500,
                          }}>
                            <span style={{ fontSize: 8 }}>●</span>
                            需复查
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{
                    padding: '16px 12px',
                    borderRight: '1px solid #f1f5f9',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {statusLabel(row)}
                      {/* 状态徽章 */}
                      {row.badges.slice(0, 2).map((badge, idx) => {
                        const isStatusBadge = badge.text === '在住' || badge.text === '待入住' || badge.text === '已离开';
                        if (isStatusBadge) return null;
                        const badgeColors = {
                          success: { bg: '#d1fae5', color: '#065f46' },
                          warning: { bg: '#fef3c7', color: '#92400e' },
                          danger: { bg: '#fee2e2', color: '#991b1b' },
                          info: { bg: '#dbeafe', color: '#1e40af' },
                          primary: { bg: '#dbeafe', color: '#1e40af' },
                          secondary: { bg: '#f3f4f6', color: '#374151' },
                          default: { bg: '#f3f4f6', color: '#374151' }
                        };
                        const badgeColor = badgeColors[badge.type] || badgeColors.default;
                        return (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 500,
                              backgroundColor: badgeColor.bg,
                              color: badgeColor.color,
                              border: `1px solid ${badgeColor.bg}`,
                            }}
                          >
                            {badge.text}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{
                    padding: '16px 12px',
                    borderRight: '1px solid #f1f5f9',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                      }}>
                        🏥
                      </div>
                      <div>
                        <div style={{
                          fontWeight: 500,
                          color: '#1e293b',
                          fontSize: 14,
                          marginBottom: 2,
                        }}>
                          {row.latestHospital || '未知医院'}
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 120,
                        }}>
                          {row.latestDiagnosis || '暂无诊断'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{
                    padding: '16px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid #f1f5f9',
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      border: '1px solid #e2e8f0',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#1e293b',
                      }}>
                        <span>🏠</span>
                        {row.admissionCount ?? '0'}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: '#64748b',
                        fontWeight: 500,
                      }}>
                        入住次数
                      </div>
                    </div>
                  </td>
                  <td style={{
                    padding: '16px 12px',
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexWrap: 'nowrap',
                      minWidth: 0,
                    }}>
                      <button
                        className="modern-btn table-btn-primary"
                        onClick={() =>
                          navigate(
                            `/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`
                          )
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '8px 12px',
                          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                          color: '#1e40af',
                          border: '1px solid #93c5fd',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                          minWidth: 80,
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <span>📋</span>
                        查看
                      </button>
                      <button
                        className="modern-btn table-btn-danger"
                        type="button"
                        onClick={() => handleDeleteSingle(row.patientKey || row.recordKey || '')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '8px 12px',
                          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                          minWidth: 80,
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <span>🗑️</span>
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

      {/* 状态调整对话框 */}
      {statusDialogVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !statusDialogSubmitting && setStatusDialogVisible(false)}
        >
          <div
            className="patient-list-dialog"
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>调整状态</h3>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
              选择新的住户状态，便于列表展示一致。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {STATUS_OPTIONS.map((option) => (
                <div
                  key={option.id}
                  onClick={() => !statusDialogSubmitting && setStatusForm({ ...statusForm, value: option.id as any })}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: `2px solid ${statusForm.value === (option.id as any) ? '#3b82f6' : '#e5e7eb'}`,
                    backgroundColor: statusForm.value === (option.id as any) ? '#eff6ff' : 'white',
                    cursor: statusDialogSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{statusForm.value === (option.id as any) ? '●' : '○'}</span>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{option.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, marginLeft: 24 }}>
                    {option.id === 'in_care' && '用于正在小家入住的住户'}
                    {option.id === 'pending' && '待入住房、随访等状态'}
                    {option.id === 'discharged' && '已办理离开或转出'}
                  </div>
                </div>
              ))}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                备注（可选）
              </label>
              <textarea
                value={statusForm.note}
                onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
                disabled={statusDialogSubmitting}
                placeholder="可选，说明状态调整原因"
                maxLength={120}
                style={{
                  width: '100%',
                  minHeight: 80,
                  padding: 8,
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="secondary-button" onClick={() => setStatusDialogVisible(false)} disabled={statusDialogSubmitting}>
                取消
              </button>
              <button className="primary-button" onClick={handleConfirmStatusChange} disabled={statusDialogSubmitting}>
                {statusDialogSubmitting ? '处理中...' : '确认调整'}
              </button>
            </div>
          </div>
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
