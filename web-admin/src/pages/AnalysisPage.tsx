import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';
import { fetchPatientList } from '../api/patient';
import type { CloudBase } from '@cloudbase/js-sdk';
import type {
  AnalysisPatientSummary,
  AnalysisPanel,
  AnalysisStat,
  PanelDisplayMode,
  TimeRangeFilter,
  StatusFilter,
  SelectionState
} from '../types/analysis';
import {
  transformPatientData,
  buildAnalysisPanels,
  filterPatientsByCurrentFilters,
  calculateSummaryStats,
  buildSummaryCards,
  createSelectionState,
  PANEL_DISPLAY_MODES
} from '../utils/analysisUtils';

// Components
import SummaryCards from '../components/analysis/SummaryCards';
import FilterBar from '../components/analysis/FilterBar';
import LegendPanel from '../components/analysis/LegendPanel';
import AnalysisPanel from '../components/analysis/AnalysisPanel';
import SelectionModal from '../components/analysis/SelectionModal';
import LoadingSkeleton from '../components/analysis/LoadingSkeleton';
import ErrorMessage from '../components/analysis/ErrorMessage';

const AnalysisPage: React.FC = () => {
  const { app } = useCloudbase();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patientsSource, setPatientsSource] = useState<AnalysisPatientSummary[]>([]);
  const [patients, setPatients] = useState<AnalysisPatientSummary[]>([]);
  const [panels, setPanels] = useState<AnalysisPanel[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    inCare: 0,
    pending: 0,
    discharged: 0,
  });
  const [summaryCards, setSummaryCards] = useState([]);
  const [panelViewModes, setPanelViewModes] = useState<Record<string, PanelDisplayMode>>({});
  const [activeSummaryFilter, setActiveSummaryFilter] = useState('all');
  const [selection, setSelection] = useState<SelectionState>(createSelectionState());
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isDefaultFilter, setIsDefaultFilter] = useState(true);
  const [panelCollapsed, setPanelCollapsed] = useState<Record<string, boolean>>({});

  // Refs
  const panelObserverRef = useRef<IntersectionObserver | null>(null);

  // Data fetching
  const fetchPatients = useCallback(async () => {
    if (!app) return;

    setLoading(true);
    setError('');

    try {
      const result = await fetchPatientList(app, {
        page: 0,
        pageSize: 1000, // 获取足够的数据用于分析
        includeTotal: true,
      });

      const transformedData = transformPatientData(result.patients);
      setPatientsSource(transformedData);
    } catch (error) {
      console.error('Failed to load analysis data', error);
      setError((error as Error).message || '加载分析数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [app]);

  // Apply filters and build panels
  const applyFiltersAndBuild = useCallback(() => {
    const source = patientsSource || [];
    const filtered = filterPatientsByCurrentFilters(source, timeRange, statusFilter);
    const builtPanels = buildAnalysisPanels(filtered);
    const calculatedStats = calculateSummaryStats(filtered);
    const builtCards = buildSummaryCards(calculatedStats);
    const viewModes = computePanelViewModes(builtPanels);
    const defaultCollapsed = computeDefaultCollapsed(builtPanels);
    const isDefault = timeRange === 'all' && statusFilter === 'all';

    setPatients(filtered);
    setPanels(builtPanels);
    setSummaryStats(calculatedStats);
    setSummaryCards(builtCards);
    setPanelViewModes(viewModes);
    setIsDefaultFilter(isDefault);
    setPanelCollapsed(defaultCollapsed);
  }, [patientsSource, timeRange, statusFilter]);

  // Compute panel view modes
  const computePanelViewModes = useCallback((panels: AnalysisPanel[]) => {
    const preferred = (stats: AnalysisStat[]) => {
      const n = stats?.length || 0;
      if (!n) return 'cards';
      if (n <= 5) return 'pie';
      return 'bars';
    };

    const modes: Record<string, PanelDisplayMode> = {};
    panels.forEach(panel => {
      const key = panel.panelKey || panel.title;
      if (!key) return;
      modes[key] = PANEL_DISPLAY_MODES.includes(panelViewModes[key])
        ? panelViewModes[key]
        : preferred(panel.stats);
    });
    return modes;
  }, [panelViewModes]);

  // Compute default collapsed panels
  const computeDefaultCollapsed = useCallback((panels: AnalysisPanel[]) => {
    const defaults = { hospital: true, doctor: true };
    const result = { ...panelCollapsed };

    panels.forEach(panel => {
      const key = panel.panelKey || panel.title;
      if (!key) return;
      if (!(key in result)) {
        result[key] = Boolean(defaults[key]) || false;
      }
    });

    return result;
  }, [panelCollapsed]);

  // Handle summary card click
  const handleSummaryCardTap = useCallback((filterId: string) => {
    setActiveSummaryFilter(filterId);

    if (filterId === 'all') {
      navigate('/patients', { state: { filter: { type: 'statFilter', value: 'all' } } });
      return;
    }

    const filteredPatients = patients.filter(item => {
      const status = item.careStatus;
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
  const handleTimeRangeChange = useCallback((value: TimeRangeFilter) => {
    if (value === timeRange) return;
    setTimeRange(value);
  }, [timeRange]);

  const handleStatusFilterChange = useCallback((value: StatusFilter) => {
    if (value === statusFilter) return;
    setStatusFilter(value);
  }, [statusFilter]);

  const handleClearFilters = useCallback(() => {
    setTimeRange('all');
    setStatusFilter('all');
  }, []);

  // Handle panel mode toggle
  const handlePanelModeToggle = useCallback((panelKey: string, mode: PanelDisplayMode) => {
    setPanelViewModes(prev => ({ ...prev, [panelKey]: mode }));
  }, []);

  // Handle panel collapse toggle
  const handlePanelCollapseToggle = useCallback((panelKey: string) => {
    setPanelCollapsed(prev => ({ ...prev, [panelKey]: !prev[panelKey] }));
  }, []);

  // Handle patient navigation
  const handlePatientClick = useCallback((patient: AnalysisPatientSummary) => {
    setSelection(createSelectionState());
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

  // Apply filters and build panels when dependencies change
  useEffect(() => {
    if (patientsSource.length > 0) {
      applyFiltersAndBuild();
    }
  }, [applyFiltersAndBuild]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (panelObserverRef.current) {
        panelObserverRef.current.disconnect();
        panelObserverRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={fetchPatients} />;
  }

  return (
    <div className="analysis-page">
      <div className="analysis-container">
        <div className="analysis-layout">
          <aside className="analysis-sidebar">
            <SummaryCards
              cards={summaryCards}
              activeFilter={activeSummaryFilter}
              onCardClick={handleSummaryCardTap}
              onNavigateToList={handleNavigateToList}
            />

            <FilterBar
              timeRange={timeRange}
              statusFilter={statusFilter}
              isDefaultFilter={isDefaultFilter}
              onTimeRangeChange={handleTimeRangeChange}
              onStatusFilterChange={handleStatusFilterChange}
              onClearFilters={handleClearFilters}
            />

            <LegendPanel />
          </aside>

          <section className="analysis-main">
            <div className="analysis-panels">
              {panels.map((panel, panelIndex) => (
                <AnalysisPanel
                  key={panel.panelKey || panel.title}
                  panel={panel}
                  panelIndex={panelIndex}
                  viewMode={panelViewModes[panel.panelKey || panel.title] || 'cards'}
                  isCollapsed={panelCollapsed[panel.panelKey || panel.title] || false}
                  displayModes={PANEL_DISPLAY_MODES}
                  onModeToggle={handlePanelModeToggle}
                  onCollapseToggle={handlePanelCollapseToggle}
                  onStatClick={handleStatTap}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      {selection.visible && (
        <SelectionModal
          selection={selection}
          onApplyFilter={handleSelectionApplyFilter}
          onClose={() => setSelection(createSelectionState())}
          onPatientClick={handlePatientClick}
        />
      )}
    </div>
  );
};

export default AnalysisPage;
