import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';
import { callCloudFunction } from '../utils/cloudbase';
import { createSelectionState } from '../utils/analysisUtils';
import type { CloudBase } from '@cloudbase/js-sdk';
import type { PatientSummary } from '../types/patient';

// 常量定义 - 参考小程序
const SUMMARY_CARD_CONFIG = [
  { id: 'all', key: 'total', label: '全部', description: '当前住户总量' },
  { id: 'in_care', key: 'inCare', label: '在住', description: '近 30 天内仍在住的住户' },
  { id: 'pending', key: 'pending', label: '待入住', description: '待随访 / 待安排的住户' },
  { id: 'discharged', key: 'discharged', label: '已离开', description: '已出院或离家的住户' },
];

const PANEL_DISPLAY_MODES = [
  { id: 'cards', label: '卡片' },
  { id: 'bars', label: '柱状图' },
  { id: 'pie', label: '圆饼图' },
];

const CHART_COLOR_PALETTE = [
  '#3366FF',
  '#33CC99',
  '#FFAA33',
  '#FF6F91',
  '#9C27B0',
  '#4DD0E1',
  '#FF7043',
  '#8D6E63',
];

// 类型定义
interface AnalysisStat {
  label: string;
  count: number;
  patients: Array<{
    key: string;
    patientKey: string;
    name: string;
  }>;
  sampleNames?: string;
  status?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary' | 'secondary';
  variant?: 'default' | 'outlined' | 'elevated';
  hint?: string;
  filter?: {
    type: string;
    value: any;
  };
  percentage?: number;
  percentageLabel?: string;
  color?: string;
}

interface AnalysisPanel {
  title: string;
  panelKey: string;
  stats: AnalysisStat[];
  totalCount: number;
  emptyText?: string;
  trend?: {
    points: Array<{
      label: string;
      value: number;
      ratio: number;
    }>;
  };
}

interface SelectionState {
  visible: boolean;
  title: string;
  items: Array<{
    key: string;
    patientKey: string;
    name: string;
  }>;
  totalCount: number;
  filterPayload: {
    type: string;
    value: any;
  } | null;
  filterAvailable: boolean;
  hint: string;
}

const AnalysisPage: React.FC = () => {
  const { app } = useCloudbase();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientsSource, setPatientsSource] = useState<PatientSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [panels, setPanels] = useState<AnalysisPanel[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    inCare: 0,
    pending: 0,
    discharged: 0,
  });
  const [summaryCards, setSummaryCards] = useState<Array<typeof SUMMARY_CARD_CONFIG[0] & { value: number; isMax: boolean }>>([]);
  const [panelViewModes, setPanelViewModes] = useState<Record<string, string>>({});
  const [activeSummaryFilter, setActiveSummaryFilter] = useState('all');
  const [selection, setSelection] = useState<SelectionState>({
    visible: false,
    title: '',
    items: [],
    totalCount: 0,
    filterPayload: null,
    filterAvailable: false,
    hint: '',
  });
  const [timeRange, setTimeRange] = useState('all'); // all | last30 | month | year
  const [statusFilter, setStatusFilter] = useState('all'); // all | in_care | pending | discharged
  const [isDefaultFilter, setIsDefaultFilter] = useState(true);
  const [panelCollapsed, setPanelCollapsed] = useState<Record<string, boolean>>({});

  // 辅助函数 - 参考小程序
  const normalizeCareStatus = (value: string, fallback = 'pending') => {
    const text = String(value || '').toLowerCase();
    if (!text) return fallback;
    if (['in_care', 'incare', 'in-care', '入住', '在住', 'active'].includes(text)) return 'in_care';
    if (['pending', 'followup', 'follow_up', '随访', '待入住', '待随访', '待安排'].includes(text)) return 'pending';
    if (['discharged', 'checkout', 'checkedout', '已离开', '离开', '已出院', '出院', '离院'].includes(text)) return 'discharged';
    return fallback;
  };

  const calculateAge = (birthDate: any) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  };

  const formatDate = (value: any) => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Data fetching
  const fetchPatients = useCallback(async () => {
    if (!app) return;

    setLoading(true);
    setError('');

    try {
      const result = await callCloudFunction(app, 'patientProfile', {
        action: 'list'
      });

      const patients = result?.patients || [];
      setPatientsSource(patients);
    } catch (error) {
      console.error('Failed to load analysis data', error);
      setError((error as Error).message || '加载分析数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [app]);

  // 计算摘要统计 - 参考小程序
  const calculateSummaryStats = (patientsList: PatientSummary[]) => {
    const summary = {
      total: patientsList.length,
      inCare: 0,
      pending: 0,
      discharged: 0,
    };

    patientsList.forEach(patient => {
      const status = normalizeCareStatus(patient.careStatus);
      if (status === 'in_care') summary.inCare += 1;
      else if (status === 'pending') summary.pending += 1;
      else if (status === 'discharged') summary.discharged += 1;
    });

    return summary;
  };

  // 构建摘要卡片 - 参考小程序
  const buildSummaryCards = (summary: typeof summaryStats) => {
    const cards = SUMMARY_CARD_CONFIG.map(config => ({
      ...config,
      value: summary[config.key as keyof typeof summary] || 0,
      isMax: false,
    }));

    const focusable = cards.filter(card => card.id !== 'all');
    const maxValue = focusable.reduce((acc, card) => (card.value > acc ? card.value : acc), 0);

    if (maxValue > 0) {
      cards.forEach(card => {
        if (card.id !== 'all' && card.value === maxValue) {
          card.isMax = true;
        }
      });
    }

    return cards;
  };

  // 构建分析面板 - 参考小程序逻辑
  const buildPanelsFromData = useCallback((patientsList: PatientSummary[]) => {
    const panels: AnalysisPanel[] = [];

    // 状态分布面板
    const statusGroups = { '在住': [], '待入住/随访': [], '已离开': [] };
    if (patientsList && patientsList.length > 0) {
      patientsList.forEach(item => {
        if (!item) return;
        const status = normalizeCareStatus(item.careStatus);
        const ref = {
          key: item._id || Math.random().toString(36).substr(2, 9),
          patientKey: item.patientKey || item._id || Math.random().toString(36).substr(2, 9),
          name: item.patientName || '未命名住户',
        };
        if (status === 'in_care') statusGroups['在住'].push(ref);
        else if (status === 'discharged') statusGroups['已离开'].push(ref);
        else statusGroups['待入住/随访'].push(ref);
      });
    }

    const statusStats = Object.entries(statusGroups).map(([label, patientRefs]) => ({
      label,
      count: patientRefs.length,
      patients: patientRefs,
      sampleNames: patientRefs.slice(0, 3).map(p => p.name).join('、'),
      filter: {
        type: 'statFilter',
        value: label === '在住' ? 'in_care' : label === '已离开' ? 'discharged' : 'pending'
      }
    }));

    panels.push({
      title: '状态分布',
      panelKey: 'status',
      stats: statusStats,
      totalCount: patientsList.length,
      emptyText: '暂无状态数据'
    });

    // 年龄段分析面板
    const ageBuckets = [
      { id: '0-3', label: '0-3岁', min: 0, max: 3 },
      { id: '4-6', label: '4-6岁', min: 4, max: 6 },
      { id: '7-12', label: '7-12岁', min: 7, max: 12 },
      { id: '13-17', label: '13-17岁', min: 13, max: 17 },
      { id: '18+', label: '18岁及以上', min: 18, max: Infinity },
    ];

    const ageGroups: Record<string, any[]> = { '未知年龄': [] };
    ageBuckets.forEach(bucket => {
      ageGroups[bucket.label] = [];
    });

    if (patientsList && patientsList.length > 0) {
      patientsList.forEach(item => {
        if (!item) return;
        const age = calculateAge(item.birthDate);
        const ref = {
          key: item._id || Math.random().toString(36).substr(2, 9),
          patientKey: item.patientKey || item._id || Math.random().toString(36).substr(2, 9),
          name: item.patientName || '未命名住户',
        };

        if (age == null) {
          ageGroups['未知年龄'].push(ref);
        } else {
          const bucket = ageBuckets.find(b => age >= b.min && age <= b.max);
          if (bucket) {
            ageGroups[bucket.label].push(ref);
          } else {
            ageGroups['未知年龄'].push(ref);
          }
        }
      });
    }

    const ageStats = Object.entries(ageGroups).map(([label, patientRefs]) => {
      const stat: AnalysisStat = {
        label,
        count: patientRefs.length,
        patients: patientRefs,
        sampleNames: patientRefs.slice(0, 3).map(p => p.name).join('、'),
        status: label === '未知年龄' ? 'warning' : undefined,
        variant: label === '未知年龄' ? 'outlined' : undefined,
      };

      return stat;
    });

    panels.push({
      title: '按年龄段分析',
      panelKey: 'age',
      stats: ageStats,
      totalCount: patientsList.length,
      emptyText: '暂无年龄数据'
    });

    // 性别分析面板
    const genderGroups: Record<string, any[]> = { '未标记性别': [] };
    if (patientsList && patientsList.length > 0) {
      patientsList.forEach(item => {
        if (!item) return;
        try {
          const genderValue = item.genderLabel || item.gender || '';
          const gender = genderValue ? genderValue.toString().trim().toLowerCase() : '';
          let label = '未标记性别';
          if (['m', 'male', '男'].includes(gender)) label = '男';
          else if (['f', 'female', '女'].includes(gender)) label = '女';
          else if (['other', '未知', '未说明', '不详'].includes(gender)) label = '其他';

          if (!genderGroups[label]) genderGroups[label] = [];
          const ref = {
            key: item._id || Math.random().toString(36).substr(2, 9),
            patientKey: item.patientKey || item._id || Math.random().toString(36).substr(2, 9),
            name: item.patientName || '未命名住户',
          };
          genderGroups[label].push(ref);
        } catch (error) {
          console.error('Error processing gender for item:', item, error);
          // Add to unknown category
          const ref = {
            key: item._id || Math.random().toString(36).substr(2, 9),
            patientKey: item.patientKey || item._id || Math.random().toString(36).substr(2, 9),
            name: item.patientName || '未命名住户',
          };
          genderGroups['未标记性别'].push(ref);
        }
      });
    }

    const genderStats = Object.entries(genderGroups).map(([label, patientRefs]) => ({
      label,
      count: patientRefs.length,
      patients: patientRefs,
      sampleNames: patientRefs.slice(0, 3).map(p => p.name).join('、'),
    }));

    panels.push({
      title: '按性别分析',
      panelKey: 'gender',
      stats: genderStats,
      totalCount: patientsList.length,
      emptyText: '暂无性别数据'
    });

    // 籍贯分析面板
    const placeGroups: Record<string, any[]> = {};
    if (patientsList && patientsList.length > 0) {
      patientsList.forEach(item => {
        if (!item) return;
        const label = item.nativePlace?.toString().trim() || '未知籍贯';
        if (!placeGroups[label]) placeGroups[label] = [];
        placeGroups[label].push({
          key: item._id || Math.random().toString(36).substr(2, 9),
          patientKey: item.patientKey || item._id || Math.random().toString(36).substr(2, 9),
          name: item.patientName || '未命名住户',
        });
      });
    }

    const placeStats = Object.entries(placeGroups)
      .map(([label, patientRefs]) => ({
        label,
        count: patientRefs.length,
        patients: patientRefs,
        sampleNames: patientRefs.slice(0, 3).map(p => p.name).join('、'),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    panels.push({
      title: '按籍贯分析',
      panelKey: 'nativePlace',
      stats: placeStats,
      totalCount: patientsList.length,
      emptyText: '暂无籍贯数据'
    });

    return panels;
  }, []);

  // 过滤患者 - 参考小程序
  const filterPatientsByCurrentFilters = useCallback((source: PatientSummary[], timeFilter: string, statusFilterValue: string) => {
    const now = new Date();
    const day30 = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return source.filter(p => {
      // 时间过滤
      const timestamp = Number(p.latestAdmissionTimestamp || 0);
      let timeOk = true;
      if (timeFilter === 'last30') timeOk = timestamp >= day30;
      else if (timeFilter === 'month') timeOk = timestamp >= startOfMonth;
      else if (timeFilter === 'year') timeOk = timestamp >= startOfYear;

      if (!timeOk) return false;

      // 状态过滤
      if (statusFilterValue === 'all') return true;
      return normalizeCareStatus(p.careStatus) === statusFilterValue;
    });
  }, []);

  // 计算面板视图模式
  const computePanelViewModes = useCallback((panelsList: AnalysisPanel[], currentModes: Record<string, string>) => {
    const preferred = (stats: AnalysisStat[]) => {
      const n = stats?.length || 0;
      if (!n) return 'cards';
      if (n <= 5) return 'pie';
      return 'bars';
    };

    const modes: Record<string, string> = {};
    panelsList.forEach(panel => {
      const key = panel.panelKey || panel.title;
      if (!key) return;
      modes[key] = currentModes[key] || preferred(panel.stats);
    });
    return modes;
  }, []);

  // 计算默认折叠面板
  const computeDefaultCollapsed = useCallback((panelsList: AnalysisPanel[], currentCollapsed: Record<string, boolean>) => {
    const defaults = { hospital: true, doctor: true };
    const result = { ...currentCollapsed };

    panelsList.forEach(panel => {
      const key = panel.panelKey || panel.title;
      if (!key) return;
      if (!(key in result)) {
        result[key] = Boolean(defaults[key]) || false;
      }
    });

    return result;
  }, []);

  // Handle summary card click
  const handleSummaryCardTap = useCallback((filterId: string) => {
    setActiveSummaryFilter(filterId);

    if (filterId === 'all') {
      navigate('/patients', { state: { filter: { type: 'statFilter', value: 'all' } } });
      return;
    }

    const filteredPatients = patients.filter(item => {
      if (!item) return false;
      const status = normalizeCareStatus(item.careStatus);
      if (filterId === 'in_care') return status === 'in_care';
      if (filterId === 'pending') return status === 'pending';
      if (filterId === 'discharged') return status === 'discharged';
      return false;
    });

    let title = '全部住户';
    if (filterId === 'in_care') title = '在住住户';
    else if (filterId === 'pending') title = '待入住 / 随访住户';
    else if (filterId === 'discharged') title = '已离开住户';

    const filterPayload = { type: 'statFilter' as const, value: filterId };

    if (!filteredPatients.length) {
      navigate('/patients', { state: { filter: filterPayload } });
      return;
    }

    const items = filteredPatients.slice(0, 120);
    const truncated = filteredPatients.length > items.length;
    const hintParts = ['点击住户可打开详情'];
    hintParts.push('可跳转列表直接应用状态筛选');
    if (truncated) {
      hintParts.push(`已截取前120位`);
    }

    setSelection(createSelectionState({
      visible: true,
      title,
      items,
      totalCount: filteredPatients.length,
      filterPayload,
      filterAvailable: true,
      hint: hintParts.join(' · '),
    }));
  }, [patients, navigate]);

  // Handle stat click
  const handleStatTap = useCallback((panelIndex: number, statIndex: number) => {
    const panel = panels[panelIndex];
    const stat = panel?.stats[statIndex];

    if (!stat?.patients?.length) {
      return;
    }

    const totalCount = stat.patients.length;
    const items = stat.patients.slice(0, 120);
    const truncated = totalCount > items.length;

    const hints = [];
    if (stat.hint) {
      hints.push(stat.hint);
    } else if (panel.panelKey === 'dataQuality') {
      hints.push('点击住户可进入详情补录信息');
    } else {
      hints.push('点击住户可打开详情');
    }
    if (stat.filter) {
      hints.push('可跳转列表直接应用该筛选');
    }
    if (truncated) {
      hints.push(`已截取前120位`);
    }

    setSelection(createSelectionState({
      visible: true,
      title: `${panel.title} · ${stat.label}`,
      items,
      totalCount,
      filterPayload: stat.filter || null,
      filterAvailable: Boolean(stat.filter),
      hint: hints.join(' · '),
    }));
  }, [panels]);

  // Handle filter application
  const handleSelectionApplyFilter = useCallback(() => {
    if (!selection.filterPayload) return;

    navigate('/patients', { state: { filter: selection.filterPayload } });
    setSelection(createSelectionState());
  }, [selection.filterPayload, navigate]);

  // Handle filter changes
  const handleTimeRangeChange = useCallback((value: string) => {
    if (value === timeRange) return;
    setTimeRange(value);
  }, [timeRange]);

  const handleStatusFilterChange = useCallback((value: string) => {
    if (value === statusFilter) return;
    setStatusFilter(value);
  }, [statusFilter]);

  const handleClearFilters = useCallback(() => {
    setTimeRange('all');
    setStatusFilter('all');
  }, []);

  // Handle panel mode toggle
  const handlePanelModeToggle = useCallback((panelKey: string, mode: string) => {
    setPanelViewModes(prev => ({ ...prev, [panelKey]: mode }));
  }, []);

  // 应用过滤和构建面板
  const applyFiltersAndBuild = () => {
    const source = patientsSource || [];
    const filtered = filterPatientsByCurrentFilters(source, timeRange, statusFilter);
    const builtPanels = buildPanelsFromData(filtered);
    const calculatedStats = calculateSummaryStats(filtered);
    const builtCards = buildSummaryCards(calculatedStats);
    const viewModes = computePanelViewModes(builtPanels, panelViewModes || {} as Record<string, string>);
    const defaultCollapsed = computeDefaultCollapsed(builtPanels, panelCollapsed || {} as Record<string, boolean>);
    const isDefault = timeRange === 'all' && statusFilter === 'all';

    setPatients(filtered);
    setPanels(builtPanels);
    setSummaryStats(calculatedStats);
    setSummaryCards(builtCards);
    setPanelViewModes(viewModes);
    setIsDefaultFilter(isDefault);
    setPanelCollapsed(defaultCollapsed);
  };

  // Handle panel collapse toggle
  const handlePanelCollapseToggle = useCallback((panelKey: string) => {
    setPanelCollapsed(prev => ({ ...prev, [panelKey]: !prev[panelKey] }));
  }, []);

  // Handle patient navigation
  const handlePatientClick = useCallback((patient: any) => {
    setSelection({
      visible: false,
      title: '',
      items: [],
      totalCount: 0,
      filterPayload: null,
      filterAvailable: false,
      hint: '',
    });
    navigate(`/patients/${patient.patientKey}`);
  }, [navigate]);

  // Handle navigate to list
  const handleNavigateToList = useCallback(() => {
    navigate('/patients', { state: { filter: { type: 'statFilter', value: 'all' } } });
  }, [navigate]);

  // Initialize data
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Apply filters and build panels when data or filters change
  useEffect(() => {
    if (patientsSource.length > 0) {
      applyFiltersAndBuild();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientsSource, timeRange, statusFilter]);

  if (loading) {
    return (
      <div style={{
        padding: '32px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
              height: '120px',
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                height: '24px',
                borderRadius: '8px',
                marginBottom: '12px',
                animation: 'shimmer 2s infinite',
              }} />
              <div style={{
                background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                height: '16px',
                borderRadius: '6px',
                width: '60%',
                animation: 'shimmer 2s infinite',
              }} />
            </div>
          ))}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
        }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
            }}>
              <div style={{
                background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                height: '20px',
                borderRadius: '8px',
                marginBottom: '16px',
                width: '40%',
                animation: 'shimmer 2s infinite',
              }} />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px',
              }}>
                {[1, 2, 3].map(j => (
                  <div key={j} style={{
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    height: '80px',
                  }}>
                    <div style={{
                      background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                      height: '16px',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      animation: 'shimmer 2s infinite',
                    }} />
                    <div style={{
                      background: 'linear-gradient(90deg, #e2e8f0 0%, #f1f5f9 50%, #e2e8f0 100%)',
                      height: '12px',
                      borderRadius: '4px',
                      width: '60%',
                      animation: 'shimmer 2s infinite',
                    }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '16px',
      }}>
        <div style={{
          fontSize: '16px',
          color: '#ef4444',
          textAlign: 'center',
        }}>
          {error}
        </div>
        <button
          onClick={fetchPatients}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
          }}
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      minHeight: '100vh',
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        {/* 页面标题 */}
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '600',
              color: '#1e293b',
              margin: '0 0 8px 0',
            }}>
              📊 数据分析
            </h1>
            <p style={{
              fontSize: '16px',
              color: '#64748b',
              margin: 0,
            }}>
              全面的住户数据统计与分析
            </p>
          </div>
          <button
            onClick={handleNavigateToList}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.25)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            🏠 返回住户列表
          </button>
        </div>

        {/* 摘要卡片 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}>
          {summaryCards.map((card) => (
            <div
              key={card.id}
              onClick={() => handleSummaryCardTap(card.id)}
              style={{
                background: card.isMax && card.id !== 'all'
                  ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                  : activeSummaryFilter === card.id
                  ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
                  : 'white',
                borderRadius: '16px',
                padding: '24px',
                border: activeSummaryFilter === card.id
                  ? '2px solid #3b82f6'
                  : card.isMax && card.id !== 'all'
                  ? '2px solid #2563eb'
                  : '1px solid #e2e8f0',
                boxShadow: card.isMax && card.id !== 'all'
                  ? '0 8px 32px rgba(37, 99, 235, 0.2), 0 0 0 1px rgba(37, 99, 235, 0.1)'
                  : '0 4px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseOver={(e) => {
                if (activeSummaryFilter !== card.id) {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(15, 23, 42, 0.15)';
                }
              }}
              onMouseOut={(e) => {
                if (activeSummaryFilter !== card.id) {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = card.isMax && card.id !== 'all'
                    ? '0 8px 32px rgba(37, 99, 235, 0.2), 0 0 0 1px rgba(37, 99, 235, 0.1)'
                    : '0 4px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)';
                }
              }}
            >
              {card.isMax && card.id !== 'all' && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: '#fbbf24',
                  color: '#78350f',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                }}>
                  🔥 最高
                </div>
              )}
              <div style={{
                fontSize: '36px',
                fontWeight: '700',
                color: card.isMax && card.id !== 'all' ? '#1d4ed8' : '#1e293b',
                marginBottom: '8px',
              }}>
                {card.value}
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: '600',
                color: card.isMax && card.id !== 'all' ? '#1d4ed8' : '#374151',
                marginBottom: '4px',
              }}>
                {card.label}
              </div>
              <div style={{
                fontSize: '14px',
                color: card.isMax && card.id !== 'all' ? '#1e40af' : '#6b7280',
              }}>
                {card.description}
              </div>
            </div>
          ))}
        </div>

        {/* 筛选条 */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        }}>
          <div style={{
            display: 'flex',
            gap: '20px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <div>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
              }}>
                时间范围
              </h3>
              <div style={{
                display: 'flex',
                gap: '8px',
              }}>
                {[
                  { value: 'last30', label: '近30天' },
                  { value: 'month', label: '本月' },
                  { value: 'year', label: '本年' },
                  { value: 'all', label: '全部' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleTimeRangeChange(option.value)}
                    style={{
                      padding: '8px 16px',
                      background: timeRange === option.value
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : 'white',
                      color: timeRange === option.value ? 'white' : '#374151',
                      border: timeRange === option.value ? 'none' : '1px solid #d1d5db',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (timeRange !== option.value) {
                        e.currentTarget.style.background = '#f3f4f6';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (timeRange !== option.value) {
                        e.currentTarget.style.background = 'white';
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
              }}>
                状态筛选
              </h3>
              <div style={{
                display: 'flex',
                gap: '8px',
              }}>
                {[
                  { value: 'all', label: '全部' },
                  { value: 'in_care', label: '在住' },
                  { value: 'pending', label: '待入住' },
                  { value: 'discharged', label: '已离开' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusFilterChange(option.value)}
                    style={{
                      padding: '8px 16px',
                      background: statusFilter === option.value
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'white',
                      color: statusFilter === option.value ? 'white' : '#374151',
                      border: statusFilter === option.value ? 'none' : '1px solid #d1d5db',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                      if (statusFilter !== option.value) {
                        e.currentTarget.style.background = '#f3f4f6';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (statusFilter !== option.value) {
                        e.currentTarget.style.background = 'white';
                      }
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {!isDefaultFilter && (
              <button
                onClick={handleClearFilters}
                style={{
                  padding: '8px 16px',
                  background: 'white',
                  color: '#ef4444',
                  border: '1px solid #fecaca',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#fef2f2';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white';
                }}
              >
                清除筛选
              </button>
            )}
          </div>
        </div>

        {/* 图例说明 */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '32px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b',
          }}>
            📋 图例说明
          </h3>
          <div style={{
            display: 'flex',
            gap: '32px',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#10b981',
              }} />
              <span style={{ fontSize: '14px', color: '#374151' }}>最高占比</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#6b7280',
              }} />
              <span style={{ fontSize: '14px', color: '#374151' }}>常规分布</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#f59e0b',
              }} />
              <span style={{ fontSize: '14px', color: '#374151' }}>数据缺失</span>
            </div>
          </div>
        </div>

        {/* 分析面板 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
        }}>
          {panels.map((panel, panelIndex) => (
            <AnalysisPanelComponent
              key={panel.panelKey}
              panel={panel}
              panelIndex={panelIndex}
              viewMode={panelViewModes[panel.panelKey] || 'cards'}
              isCollapsed={panelCollapsed[panel.panelKey] || false}
              displayModes={PANEL_DISPLAY_MODES}
              onModeToggle={handlePanelModeToggle}
              onCollapseToggle={handlePanelCollapseToggle}
              onStatClick={handleStatTap}
            />
          ))}
        </div>

        {/* 选择弹窗 */}
        {selection.visible && (
          <SelectionModalComponent
            selection={selection}
            onApplyFilter={handleSelectionApplyFilter}
            onClose={() => setSelection({
              visible: false,
              title: '',
              items: [],
              totalCount: 0,
              filterAvailable: false,
              hint: '',
            })}
            onPatientClick={handlePatientClick}
          />
        )}
      </div>
    </div>
  );
};

// 内联组件：分析面板
const AnalysisPanelComponent: React.FC<{
  panel: AnalysisPanel;
  panelIndex: number;
  viewMode: string;
  isCollapsed: boolean;
  displayModes: Array<{ id: string; label: string }>;
  onModeToggle: (panelKey: string, mode: string) => void;
  onCollapseToggle: (panelKey: string) => void;
  onStatClick: (panelIndex: number, statIndex: number) => void;
}> = ({ panel, panelIndex, viewMode, isCollapsed, displayModes, onModeToggle, onCollapseToggle, onStatClick }) => {
  const enhanceStatsForVisualization = (stats: AnalysisStat[]) => {
    const totalCount = stats.reduce((sum, stat) => sum + (stat?.count || 0), 0);
    return stats.map((stat, index) => {
      const ratio = totalCount > 0 ? stat.count / totalCount : 0;
      const percentage = Math.round(ratio * 1000) / 10;
      const hasFraction = percentage % 1 !== 0;
      const percentageLabel = totalCount
        ? `${hasFraction ? percentage.toFixed(1) : percentage.toFixed(0)}%`
        : '0%';
      return {
        ...stat,
        color: stat.color || CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length],
        percentage,
        percentageLabel,
        share: ratio,
      };
    });
  };

  const enhancedStats = enhanceStatsForVisualization(panel.stats);

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
      overflow: 'hidden',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      {/* 面板头部 */}
      <div style={{
        padding: '20px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h3 style={{
            margin: '0 0 4px 0',
            fontSize: '16px',
            fontWeight: '600',
            color: '#1e293b',
          }}>
            {panel.title}
          </h3>
          {panel.totalCount > 0 && (
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#64748b',
            }}>
              共 {panel.totalCount} 人
            </p>
          )}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          {/* 视图模式切换 */}
          {displayModes.length > 1 && (
            <div style={{
              display: 'flex',
              gap: '4px',
              background: 'white',
              padding: '2px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}>
              {displayModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onModeToggle(panel.panelKey, mode.id)}
                  style={{
                    padding: '6px 12px',
                    background: viewMode === mode.id
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                      : 'transparent',
                    color: viewMode === mode.id ? 'white' : '#64748b',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500',
                    transition: 'all 0.2s',
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}

          {/* 折叠切换 */}
          <button
            onClick={() => onCollapseToggle(panel.panelKey)}
            style={{
              padding: '6px 12px',
              background: 'white',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f8fafc';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'white';
            }}
          >
            {isCollapsed ? '展开' : '收起'}
            <span>{isCollapsed ? '▸' : '▾'}</span>
          </button>
        </div>
      </div>

      {/* 面板内容 */}
      {!isCollapsed && (
        <div style={{ padding: '20px' }}>
          {panel.stats.length > 0 ? (
            <>
              {viewMode === 'cards' && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                }}>
                  {enhancedStats.map((stat, statIndex) => (
                    <div
                      key={statIndex}
                      onClick={() => onStatClick(panelIndex, statIndex)}
                      style={{
                        background: stat.variant === 'elevated'
                          ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                          : stat.variant === 'outlined'
                          ? 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)'
                          : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: stat.variant === 'elevated'
                          ? '2px solid #22c55e'
                          : stat.variant === 'outlined'
                          ? '2px solid #f59e0b'
                          : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(15, 23, 42, 0.15)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: stat.variant === 'elevated' ? '#166534' :
                               stat.variant === 'outlined' ? '#92400e' : '#1e293b',
                        marginBottom: '4px',
                      }}>
                        {stat.count}
                      </div>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: stat.variant === 'elevated' ? '#166534' :
                               stat.variant === 'outlined' ? '#92400e' : '#374151',
                        marginBottom: '4px',
                      }}>
                        {stat.label}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                      }}>
                        {stat.percentageLabel}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === 'bars' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {enhancedStats.map((stat, statIndex) => (
                    <div
                      key={statIndex}
                      onClick={() => onStatClick(panelIndex, statIndex)}
                      style={{
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#374151',
                        }}>
                          {stat.label}
                        </span>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#1e293b',
                        }}>
                          {stat.count} 人
                        </span>
                      </div>
                      <div style={{
                        background: '#f1f5f9',
                        borderRadius: '4px',
                        height: '8px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          background: stat.color,
                          height: '100%',
                          borderRadius: '4px',
                          width: `${stat.percentage}%`,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        marginTop: '2px',
                        textAlign: 'right',
                      }}>
                        {stat.percentageLabel}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {viewMode === 'pie' && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                }}>
                  <div style={{
                    width: '200px',
                    height: '200px',
                    position: 'relative',
                  }}>
                    {/* 简化的饼图显示 */}
                    <div style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: `conic-gradient(${enhancedStats.map((stat, index) => {
                        const startAngle = enhancedStats.slice(0, index).reduce((acc, s) => acc + s.percentage, 0);
                        return `${stat.color} 0deg ${startAngle + stat.percentage * 3.6}deg`;
                      }).join(', ')})`,
                      position: 'relative',
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '60%',
                        height: '60%',
                        borderRadius: '50%',
                        background: 'white',
                      }} />
                    </div>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '8px',
                    width: '100%',
                  }}>
                    {enhancedStats.map((stat, statIndex) => (
                      <div
                        key={statIndex}
                        onClick={() => onStatClick(panelIndex, statIndex)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px',
                          transition: 'all 0.2s',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: stat.color,
                        }} />
                        <div>
                          <div style={{
                            fontSize: '11px',
                            fontWeight: '500',
                            color: '#374151',
                          }}>
                            {stat.label}
                          </div>
                          <div style={{
                            fontSize: '10px',
                            color: '#6b7280',
                          }}>
                            {stat.count} · {stat.percentageLabel}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: '#6b7280',
              fontSize: '14px',
            }}>
              {panel.emptyText || '暂无数据'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// 内联组件：选择弹窗
const SelectionModalComponent: React.FC<{
  selection: SelectionState;
  onApplyFilter: () => void;
  onClose: () => void;
  onPatientClick: (patient: any) => void;
}> = ({ selection, onApplyFilter, onClose, onPatientClick }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      }}>
        {/* 头部 */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{
              margin: '0 0 4px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#1e293b',
            }}>
              {selection.title}
            </h3>
            {selection.totalCount > 0 && (
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#64748b',
              }}>
                共 {selection.totalCount} 人
              </p>
            )}
          </div>
          {selection.filterAvailable && (
            <button
              onClick={onApplyFilter}
              style={{
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              在列表中查看
            </button>
          )}
        </div>

        {/* 提示 */}
        {selection.hint && (
          <div style={{
            padding: '16px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#64748b',
            }}>
              💡 {selection.hint}
            </p>
          </div>
        )}

        {/* 列表 */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        }}>
          {selection.items.map((patient, index) => (
            <div
              key={patient.key}
              onClick={() => onPatientClick(patient)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderBottom: index < selection.items.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
              }}>
                {patient.name}
              </div>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'white',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPage;
