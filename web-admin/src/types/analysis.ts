export type AnalysisPatientSummary = {
  key: string;
  patientKey: string;
  recordKey: string;
  name: string;
  patientName: string;
  gender: string;
  genderLabel: string;
  birthDate: string;
  ageYears?: number;
  ageBucketId?: string;
  ageBucketLabel?: string;
  nativePlace: string;
  ethnicity: string;
  careStatus: string;
  latestAdmissionTimestamp?: number;
  latestAdmissionDateFormatted?: string;
  firstAdmissionDateFormatted?: string;
  latestHospital: string;
  firstHospital: string;
  latestDiagnosis: string;
  firstDiagnosis: string;
  latestDoctor: string;
  contacts: any[];
  address: string;
  phone?: string;
  idNumber?: string;
};

export type SummaryStats = {
  total: number;
  inCare: number;
  pending: number;
  discharged: number;
};

export type SummaryCard = {
  id: string;
  key: string;
  label: string;
  description: string;
  value: number;
  isMax?: boolean;
};

export type AnalysisStat = {
  label: string;
  count: number;
  patients: AnalysisPatientSummary[];
  sampleNames?: string;
  color?: string;
  percentage?: number;
  percentageLabel?: string;
  share?: number;
  variant?: 'default' | 'elevated' | 'outlined';
  status?: 'default' | 'info' | 'success' | 'warning' | 'error';
  filter?: AnalysisFilterPayload;
  hint?: string;
};

export type AnalysisPanel = {
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
};

export type LegendItem = {
  id: string;
  status: 'success' | 'info' | 'warning';
  label: string;
  description: string;
};

export type PanelDisplayMode = 'cards' | 'bars' | 'pie';

export type TimeRangeFilter = 'all' | 'last30' | 'month' | 'year';

export type StatusFilter = 'all' | 'in_care' | 'pending' | 'discharged';

export type AnalysisFilterPayload = {
  type: 'statFilter' | 'advancedFilter';
  value: any;
};

export type SelectionState = {
  visible: boolean;
  title: string;
  items: AnalysisPatientSummary[];
  totalCount: number;
  filterPayload: AnalysisFilterPayload | null;
  filterAvailable: boolean;
  hint: string;
};

export type AnalysisViewState = {
  loading: boolean;
  error: string;
  patientsSource: AnalysisPatientSummary[];
  patients: AnalysisPatientSummary[];
  panels: AnalysisPanel[];
  summaryStats: SummaryStats;
  summaryCards: SummaryCard[];
  legendItems: LegendItem[];
  panelDisplayModes: PanelDisplayMode[];
  panelViewModes: Record<string, PanelDisplayMode>;
  activeSummaryFilter: string;
  selection: SelectionState;
  timeRange: TimeRangeFilter;
  statusFilter: StatusFilter;
  isDefaultFilter: boolean;
  panelCollapsed: Record<string, boolean>;
};