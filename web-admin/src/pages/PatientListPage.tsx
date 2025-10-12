import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPatientList, deletePatient, exportPatients } from '../api/patient';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientSummary } from '../types/patient';
import '../styles/patient-list.css';
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

  // 状态调整对话框
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [statusDialogSubmitting, setStatusDialogSubmitting] = useState(false);
  const [statusForm, setStatusForm] = useState<{ value: 'in_care' | 'pending' | 'discharged' | '' ; note: string }>({ value: '', note: '' });
  const [statusTargetKey, setStatusTargetKey] = useState<string>('');

  // 视图模式（默认表格视图）
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + K 聚焦搜索框
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Escape 清除搜索或关闭对话框
      if (event.key === 'Escape') {
        if (statusDialogVisible) {
          setStatusDialogVisible(false);
        } else if (filterPanelVisible) {
          setFilterPanelVisible(false);
        } else if (keyword) {
          setKeyword('');
        }
      }

      // Ctrl/Cmd + A 全选
      if ((event.ctrlKey || event.metaKey) && event.key === 'a' && !event.shiftKey) {
        const activeElement = document.activeElement;
        const isInputField = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

        if (!isInputField && rows.length > 0) {
          event.preventDefault();
          setSelected(new Set(rows.map(r => r.key)));
        }
      }

      // Delete 删除选中项
      if (event.key === 'Delete' && selected.size > 0 && !statusDialogVisible && !filterPanelVisible) {
        const activeElement = document.activeElement;
        const isInputField = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

        if (!isInputField) {
          event.preventDefault();
          handleBulkDelete();
        }
      }

      // 数字键快速切换状态筛选
      if (event.key === '1') {
        setActiveStatFilter('all');
      } else if (event.key === '2') {
        setActiveStatFilter('in_care');
      } else if (event.key === '3') {
        setActiveStatFilter('pending');
      } else if (event.key === '4') {
        setActiveStatFilter('discharged');
      }

      // T 切换视图
      if (event.key === 't' && !event.ctrlKey && !event.metaKey) {
        const activeElement = document.activeElement;
        const isInputField = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

        if (!isInputField) {
          event.preventDefault();
          setViewMode(prev => prev === 'card' ? 'table' : 'card');
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [statusDialogVisible, filterPanelVisible, keyword, displayPatients, selected]);

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

  // 渲染单个患者卡片
  const renderPatientCard = (row: TableRow) => {
    const isSelected = selected.has(row.key);

    return (
      <div
        key={row.key}
        className={`patient-card-enhanced ${isSelected ? 'selected' : ''}`}
        onClick={() => navigate(`/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`)}
      >
        {/* 头部 */}
        <div className="patient-card-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h4 style={{ fontSize: 20, fontWeight: 600, color: '#1f2937', margin: 0 }}>
                  {row.patientName || '-'}
                </h4>
                <span style={{ fontSize: 15, color: '#6b7280', fontWeight: 500 }}>
                  {row.gender} · {row.ageText}
                </span>
              </div>
              {/* 徽章 */}
              <div className="patient-badges">
                {row.badges.map((badge, idx) => {
                  const isStatusBadge = badge.text === '在住' || badge.text === '待入住' || badge.text === '已离开';
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
                      className={`badge-enhanced ${isStatusBadge ? 'clickable' : ''}`}
                      onClick={onClick}
                      style={{
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
                      title={isStatusBadge ? '点击调整状态' : undefined}
                    >
                      {badge.text}
                    </span>
                  );
                })}
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
              style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#2563eb' }}
            />
          </div>
        </div>

        {/* 主体内容 */}
        <div className="patient-card-body">
          {/* 最新事件 */}
          <div style={{
            marginBottom: 16,
            padding: 16,
            backgroundColor: '#f8fafc',
            borderRadius: 8,
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>{row.latestEvent}</div>
          </div>

          {/* 标签 */}
          {row.tags && row.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {row.tags.map((tag, idx) => (
                <span
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 500,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  🏷️ {tag}
                </span>
              ))}
            </div>
          )}

          {/* 快速信息 */}
          <div className="patient-meta">
            {row.nativePlace && (
              <div className="meta-item">
                <span className="meta-icon">📍</span>
                <span>{row.nativePlace}</span>
              </div>
            )}
            {row.latestHospital && (
              <div className="meta-item">
                <span className="meta-icon">🏥</span>
                <span>{row.latestHospital}</span>
              </div>
            )}
            {row.phone && (
              <div className="meta-item">
                <span className="meta-icon">📞</span>
                <span>{row.phone}</span>
              </div>
            )}
            {row.idNumber && (
              <div className="meta-item">
                <span className="meta-icon">🆔</span>
                <span>{row.idNumber.slice(-4)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="patient-card-actions">
          <button
            className="button-enhanced link-button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`);
            }}
            style={{ flex: 1 }}
          >
            👁️ 查看详情
          </button>
          <button
            className="button-enhanced danger-button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteSingle(row.patientKey || row.recordKey || '');
            }}
          >
            🗑️ 删除
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
    <div className="patient-list-container">
      {/* 统计卡片 */}
      <div className="stats-grid">
        <div
          className={`stat-card ${activeStatFilter === 'all' ? 'active' : ''}`}
          onClick={() => handleStatFilterClick('all')}
        >
          <div className="stat-number">{statsData.total}</div>
          <div className="stat-label">全部住户</div>
        </div>

        <div
          className={`stat-card ${activeStatFilter === 'in_care' ? 'active' : ''}`}
          onClick={() => handleStatFilterClick('in_care')}
        >
          <div className="stat-number" style={{ color: '#10b981' }}>{statsData.inCare}</div>
          <div className="stat-label">在住</div>
        </div>

        <div
          className={`stat-card ${activeStatFilter === 'pending' ? 'active' : ''}`}
          onClick={() => handleStatFilterClick('pending')}
        >
          <div className="stat-number" style={{ color: '#f59e0b' }}>{statsData.pending}</div>
          <div className="stat-label">待入住</div>
        </div>

        <div
          className={`stat-card ${activeStatFilter === 'discharged' ? 'active' : ''}`}
          onClick={() => handleStatFilterClick('discharged')}
        >
          <div className="stat-number" style={{ color: '#6b7280' }}>{statsData.discharged}</div>
          <div className="stat-label">已退住</div>
        </div>
      </div>

      {/* 搜索和筛选工具栏 */}
      <div className="toolbar-enhanced">
        <div className="toolbar-section left">
          <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              type="search"
              placeholder="搜索姓名 / 证件号 / 电话 / 医院 / 诊断 (Ctrl+K)"
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              onFocus={() => setShowSuggestions(searchSuggestions.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {/* 搜索建议下拉框 */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="search-suggestions">
                {searchSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="search-suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <span className="search-suggestion-icon">🔍</span>
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="button-group">
            <button
              className={`button-enhanced ${hasActiveFilters ? 'primary-button' : 'secondary-button'}`}
              type="button"
              onClick={handleToggleAdvancedFilter}
            >
              高级筛选 {hasActiveFilters && `(已启用)`}
            </button>

            <button className="button-enhanced secondary-button" type="button" onClick={resetFilters}>
              重置筛选
            </button>

            <button
              className={`button-enhanced view-toggle ${viewMode === 'card' ? 'active' : ''}`}
              type="button"
              onClick={() => setViewMode('card')}
            >
              🎴 卡片视图
            </button>

            <button
              className={`button-enhanced view-toggle ${viewMode === 'table' ? 'active' : ''}`}
              type="button"
              onClick={() => setViewMode('table')}
            >
              📋 表格视图
            </button>
          </div>
        </div>

        <div className="toolbar-section right">
          <div className="button-group">
            <button className="button-enhanced secondary-button" type="button" onClick={() => loadPatients()} disabled={loading}>
              {loading ? '刷新中...' : '🔄 刷新'}
            </button>
            <button className="button-enhanced secondary-button" type="button" onClick={handleExportSelected} disabled={selected.size === 0}>
              📤 导出选中
            </button>
            <button className="button-enhanced secondary-button" type="button" onClick={handleBulkDelete} disabled={selected.size === 0}>
              🗑️ 删除选中
            </button>
            <button className="button-enhanced primary-button" type="button" onClick={() => navigate('/patients/new')}>
              ➕ 新增住户
            </button>
            <button
              className="button-enhanced secondary-button"
              type="button"
              onClick={() => alert('快捷键：\n\nCtrl+K: 聚焦搜索\nEsc: 清除搜索/关闭对话框\nCtrl+A: 全选\nDelete: 删除选中\n1-4: 状态筛选\nT: 切换视图')}
              style={{ padding: '10px 14px', minWidth: 'auto' }}
              title="查看快捷键"
            >
              ⌨️
            </button>
          </div>
        </div>
      </div>

      {/* Excel 导入输入已移除 */}

      {/* 筛选摘要 */}
      {hasActiveFilters && (
        <div className="filter-summary">
          <span className="filter-summary-icon">🔎</span>
          <span className="filter-summary-text">筛选条件：{summarizeFiltersForScheme(advancedFilters)}</span>
        </div>
      )}

      <div className="list-info-bar">
        <div className="list-info-text">
          显示 {rows.length} 条{patients.length !== rows.length && ` / 共 ${patients.length} 条`}
        </div>
        {selected.size > 0 && (
          <div className="selected-count">已选择 {selected.size} 条</div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      {/* 骨架屏加载状态 */}
      {loading && rows.length === 0 ? (
        <div className="loading-container">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-row">
                <div className="skeleton-text large"></div>
                <div className="skeleton-text medium"></div>
              </div>
              <div className="skeleton-text" style={{ width: '80%' }}></div>
              <div className="skeleton-row">
                <div className="skeleton-text medium"></div>
                <div className="skeleton-text medium"></div>
                <div className="skeleton-text small"></div>
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        // 智能空状态
        <div className="empty-state">
          <div className="empty-state-icon">
            {debouncedKeyword ? '🔍' : hasActiveFilters ? '🔎' : '📋'}
          </div>
          <h3 className="empty-state-title">
            {debouncedKeyword ? '未找到匹配的住户' : hasActiveFilters ? '无符合条件的住户' : '暂无住户档案'}
          </h3>
          <p className="empty-state-description">
            {debouncedKeyword
              ? `没有找到与"${debouncedKeyword}"相关的住户`
              : hasActiveFilters
              ? '当前筛选条件过于严格，请尝试调整筛选条件'
              : activeStatFilter !== 'all'
              ? '当前分类没有住户'
              : '点击右上角按钮添加第一位住户'}
          </p>
          {(debouncedKeyword || hasActiveFilters) && (
            <button
              className="button-enhanced secondary-button"
              onClick={resetFilters}
            >
              {debouncedKeyword ? '清除搜索' : '清除筛选'}
            </button>
          )}
        </div>
      ) : viewMode === 'card' ? (
        // 卡片视图
        <div className="cards-grid">
          {rows.map(row => renderPatientCard(row))}
        </div>
      ) : (
        // 表格视图
        <div className="table-container">
          <table className="table-enhanced">
            <thead>
              <tr>
                <th style={{ width: 50, textAlign: 'center' }}>
                  <input
                    className="table-checkbox"
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === rows.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelected(new Set(rows.map(r => r.key)));
                      } else {
                        setSelected(new Set());
                      }
                    }}
                  />
                </th>
                <th style={{ minWidth: 120 }}>姓名</th>
                <th style={{ width: 60, textAlign: 'center' }}>性别</th>
                <th style={{ width: 80 }}>年龄</th>
                <th style={{ minWidth: 120 }}>籍贯</th>
                <th style={{ width: 100 }}>状态</th>
                <th style={{ minWidth: 160 }}>就诊医院</th>
                <th style={{ width: 100, textAlign: 'center' }}>入住次数</th>
                <th style={{ width: 180, textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      className="table-checkbox"
                      type="checkbox"
                      checked={selected.has(row.key)}
                      onChange={() => toggleSelect(row.key)}
                    />
                  </td>
                  <td className="patient-name-cell">
                    {row.patientName || '-'}
                  </td>
                  <td style={{ textAlign: 'center', color: '#6b7280' }}>
                    {row.gender || '-'}
                  </td>
                  <td style={{ color: '#6b7280' }}>
                    {row.ageText}
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
                    <div className="patient-actions">
                      <button
                        className="button-enhanced link-button"
                        onClick={() =>
                          navigate(
                            `/patients/${encodeURIComponent(row.patientKey || row.recordKey || '')}`
                          )
                        }
                      >
                        查看
                      </button>
                      <button
                        className="button-enhanced danger-button"
                        type="button"
                        onClick={() => handleDeleteSingle(row.patientKey || row.recordKey || '')}
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

      {/* 状态调整对话框 */}
      {statusDialogVisible && (
        <div
          className="status-dialog-overlay"
          onClick={() => !statusDialogSubmitting && setStatusDialogVisible(false)}
        >
          <div
            className="status-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600 }}>调整住户状态</h3>
            <div style={{ fontSize: 15, color: '#6b7280', marginBottom: 20, lineHeight: 1.5 }}>
              选择新的住户状态，便于列表展示一致。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {STATUS_OPTIONS.map((option) => (
                <div
                  key={option.id}
                  className={`status-option ${statusForm.value === (option.id as any) ? 'selected' : ''}`}
                  onClick={() => !statusDialogSubmitting && setStatusForm({ ...statusForm, value: option.id as any })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 18, color: statusForm.value === (option.id as any) ? '#2563eb' : '#9ca3af' }}>
                      {statusForm.value === (option.id as any) ? '●' : '○'}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{option.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginLeft: 28, lineHeight: 1.4 }}>
                    {option.id === 'in_care' && '用于正在小家入住的住户'}
                    {option.id === 'pending' && '待入住房、随访等状态'}
                    {option.id === 'discharged' && '已办理离开或转出'}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 15, fontWeight: 600, marginBottom: 8, color: '#374151' }}>
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
                  minHeight: 100,
                  padding: 12,
                  border: '2px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  transition: 'border-color 0.2s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#2563eb';
                  e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, textAlign: 'right' }}>
                {statusForm.note.length}/120
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="button-enhanced secondary-button" onClick={() => setStatusDialogVisible(false)} disabled={statusDialogSubmitting}>
                取消
              </button>
              <button className="button-enhanced primary-button" onClick={handleConfirmStatusChange} disabled={statusDialogSubmitting}>
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
