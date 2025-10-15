const logger = require('../../utils/logger');
const themeManager = require('../../utils/theme');

const INITIAL_THEME_KEY = themeManager.getTheme();

const AGE_BUCKETS = [
  { id: '0-3', label: '0-3岁', min: 0, max: 3 },
  { id: '4-6', label: '4-6岁', min: 4, max: 6 },
  { id: '7-12', label: '7-12岁', min: 7, max: 12 },
  { id: '13-17', label: '13-17岁', min: 13, max: 17 },
  { id: '18+', label: '18岁及以上', min: 18, max: Infinity },
];

const SUMMARY_CARD_CONFIG = [
  { id: 'all', key: 'total', label: '全部', description: '当前住户总量' },
  { id: 'in_care', key: 'inCare', label: '在住', description: '近 30 天内仍在住的住户' },
  { id: 'pending', key: 'pending', label: '待入住', description: '待随访 / 待安排的住户' },
  { id: 'discharged', key: 'discharged', label: '已离开', description: '已出院或离家的住户' },
];

const LEGEND_ITEMS = [
  {
    id: 'success',
    status: 'success',
    label: '最高占比',
    description: '当前分面中数量最多的类目',
  },
  {
    id: 'info',
    status: 'info',
    label: '常规分布',
    description: '常规对比项，无特殊标记',
  },
  {
    id: 'warning',
    status: 'warning',
    label: '数据缺失',
    description: '缺少信息或未知的类目',
  },
];

const SELECTION_DISPLAY_LIMIT = 120;
const UNKNOWN_LABEL_PATTERN = /(未知|未记录)/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
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
const PANEL_DISPLAY_MODES = [
  { id: 'cards', label: '卡片' },
  { id: 'bars', label: '柱状图' },
  { id: 'pie', label: '圆饼图' },
];

// Storage keys for state persistence
const STORAGE_KEYS = {
  filters: 'analysis_filters',
  collapsed: 'analysis_panel_collapsed',
};

function safeString(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function mapGenderLabel(value) {
  const text = safeString(value);
  if (!text) {
    return '未标记性别';
  }
  const lower = text.toLowerCase();
  if (['m', 'male', '男'].includes(lower)) {
    return '男';
  }
  if (['f', 'female', '女'].includes(lower)) {
    return '女';
  }
  if (['other', '未知', '未说明', '不详'].includes(lower)) {
    return '其他';
  }
  return text;
}

function normalizeCareStatus(value, fallback = 'pending') {
  const text = safeString(value).toLowerCase();
  if (!text) {
    return fallback;
  }
  if (['in_care', 'incare', 'in-care', '入住', '在住', 'active'].includes(text)) {
    return 'in_care';
  }
  if (['pending', 'followup', 'follow_up', '随访', '待入住', '待随访', '待安排'].includes(text)) {
    return 'pending';
  }
  if (['discharged', 'checkout', 'checkedout', '已离开', '离开', '已出院', '出院', '离院'].includes(text)) {
    return 'discharged';
  }
  return fallback;
}

function mapPatientStatus(latestAdmissionTimestamp) {
  const timestamp = Number(latestAdmissionTimestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { careStatus: 'pending', diffDays: null };
  }
  const now = Date.now();
  if (timestamp > now) {
    return { careStatus: 'pending', diffDays: 0 };
  }
  const diffDays = Math.floor((now - timestamp) / MS_PER_DAY);
  if (diffDays <= 30) {
    return { careStatus: 'in_care', diffDays };
  }
  if (diffDays <= 90) {
    return { careStatus: 'pending', diffDays };
  }
  return { careStatus: 'discharged', diffDays };
}

function deriveCareStatusFromPatient(patient) {
  if (!patient || typeof patient !== 'object') {
    return 'pending';
  }
  const latestAdmissionTimestamp = Number(patient.latestAdmissionTimestamp || 0);
  const { careStatus: derivedCareStatus } = mapPatientStatus(latestAdmissionTimestamp);
  const checkoutAtRaw =
    patient.checkoutAt || (patient.metadata && patient.metadata.checkoutAt);
  const checkoutAt = Number(checkoutAtRaw);
  const hasCheckout = Number.isFinite(checkoutAt) && checkoutAt > 0;

  let careStatus = normalizeCareStatus(patient.careStatus, derivedCareStatus);
  const latestTimestampNumeric = Number.isFinite(latestAdmissionTimestamp)
    ? latestAdmissionTimestamp
    : null;
  const hasExplicitCareStatus = Boolean(safeString(patient.careStatus));

  if (
    hasCheckout &&
    (!hasExplicitCareStatus ||
      careStatus === derivedCareStatus ||
      (latestTimestampNumeric !== null && checkoutAt >= latestTimestampNumeric))
  ) {
    careStatus = 'discharged';
  }

  return careStatus;
}

function resolveAgeBucket(age) {
  const numericAge = Number(age);
  if (!Number.isFinite(numericAge) || numericAge < 0) {
    return null;
  }
  return (
    AGE_BUCKETS.find(bucket => {
      const minOk = numericAge >= bucket.min;
      const maxOk = bucket.max === undefined ? true : numericAge <= bucket.max;
      return minOk && maxOk;
    }) || null
  );
}

function parseDateValue(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    if (Math.abs(value) >= 1e10) {
      const fromNumber = new Date(value);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }
    return null;
  }
  const str = String(value).trim();
  if (!str) {
    return null;
  }
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (Number.isFinite(num) && Math.abs(num) >= 1e10) {
      const fromNumeric = new Date(num);
      if (!Number.isNaN(fromNumeric.getTime())) {
        return fromNumeric;
      }
    }
  }
  const normalized = str.replace(/[./]/g, '-');
  const fromString = new Date(normalized);
  return Number.isNaN(fromString.getTime()) ? null : fromString;
}

function formatDate(value) {
  const date = parseDateValue(value);
  if (!date) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateAge(birthDate) {
  const birth = parseDateValue(birthDate);
  if (!birth) {
    return null;
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function getPatientRef(item) {
  return {
    key: item.key,
    patientKey: item.patientKey || item.key,
    name: item.patientName || '未命名住户',
  };
}

function decorateStatCards(stats) {
  if (!stats || !stats.length) {
    return [];
  }

  const maxCount = stats.reduce((acc, stat) => {
    return stat && typeof stat.count === 'number' && stat.count > acc ? stat.count : acc;
  }, 0);

  return stats.map(stat => {
    if (!stat) {
      return stat;
    }

    const decorated = { ...stat };
    decorated.variant = 'default';
    decorated.status = 'info';

    const labelText = (stat.label || '').trim();
    if (UNKNOWN_LABEL_PATTERN.test(labelText)) {
      decorated.status = 'warning';
      decorated.variant = 'outlined';
      return decorated;
    }

    if (maxCount > 0 && stat.count === maxCount) {
      decorated.status = 'success';
      decorated.variant = 'elevated';
      return decorated;
    }

    if (!stat.count) {
      decorated.status = 'default';
    }

    return decorated;
  });
}

function enhanceStatsForVisualization(stats) {
  const totalCount = stats.reduce((sum, stat) => sum + (stat?.count || 0), 0);
  const enhanced = stats.map((stat, index) => {
    const ratio = totalCount > 0 ? stat.count / totalCount : 0;
    const percentage = Math.round(ratio * 1000) / 10; // 一位小数
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
  return { stats: enhanced, totalCount };
}

function toStat(label, patients) {
  if (!patients || !patients.length) {
    return null;
  }
  const sample = patients
    .slice(0, 3)
    .map(p => p.name)
    .join('、');
  return {
    label,
    count: patients.length,
    patients,
    sampleNames: sample,
  };
}

function isUnknownLabel(label) {
  return UNKNOWN_LABEL_PATTERN.test(safeString(label));
}

function createAdvancedFilterPayload(fields, summary, options = {}) {
  if (!fields || typeof fields !== 'object') {
    return null;
  }
  return {
    type: 'advancedFilter',
    value: {
      fields,
      summary,
      keepStatFilter: Boolean(options.keepStatFilter),
    },
  };
}

function createStatFilterPayload(filterId) {
  return {
    type: 'statFilter',
    value: filterId,
  };
}

function deriveMonthRange(label) {
  const match = /^([0-9]{4})-([0-9]{2})$/.exec(label || '');
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }
  const lastDay = new Date(year, month, 0).getDate();
  const start = `${match[1]}-${match[2]}-01`;
  const end = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function deriveYearRange(label) {
  const match = /^([0-9]{4})$/.exec(label || '');
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  if (!Number.isFinite(year)) {
    return null;
  }
  return {
    start: `${match[1]}-01-01`,
    end: `${match[1]}-12-31`,
  };
}

function buildSelectionHint({ panelKey, stat, truncated }) {
  const hints = [];
  if (stat && stat.hint) {
    hints.push(stat.hint);
  } else if (panelKey === 'dataQuality') {
    hints.push('点击住户可进入详情补录信息');
  } else {
    hints.push('点击住户可打开详情');
  }
  if (stat && stat.filter) {
    hints.push('可跳转列表直接应用该筛选');
  }
  if (truncated) {
    hints.push(`已截取前${SELECTION_DISPLAY_LIMIT}位`);
  }
  return hints.join(' · ');
}

function calculateSummaryStats(patients = []) {
  const summary = {
    total: patients.length,
    inCare: 0,
    pending: 0,
    discharged: 0,
  };
  patients.forEach(patient => {
    const status = normalizeCareStatus(patient.careStatus);
    if (status === 'in_care') {
      summary.inCare += 1;
    } else if (status === 'pending') {
      summary.pending += 1;
    } else if (status === 'discharged') {
      summary.discharged += 1;
    }
  });
  return summary;
}

function buildSummaryCards(summary) {
  const cards = SUMMARY_CARD_CONFIG.map(config => ({
    ...config,
    value: summary[config.key] || 0,
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
}

function buildAgePanel(patients) {
  const buckets = AGE_BUCKETS.map(bucket => ({ ...bucket, patients: [] }));
  const unknown = { label: '未知年龄', patients: [] };

  patients.forEach(item => {
    const age = calculateAge(item.birthDate);
    const ref = getPatientRef(item);
    if (age == null) {
      unknown.patients.push(ref);
      return;
    }
    const bucket = resolveAgeBucket(age);
    if (bucket) {
      const target = buckets.find(candidate => candidate.id === bucket.id);
      if (target) {
        target.patients.push(ref);
        return;
      }
    }
    unknown.patients.push(ref);
  });

  const stats = [];
  buckets.forEach(bucket => {
    const stat = toStat(bucket.label, bucket.patients);
    if (stat) {
      stat.filter = createAdvancedFilterPayload({ ageRanges: [bucket.id] }, `年龄:${bucket.label}`);
      stats.push(stat);
    }
  });
  const unknownStat = toStat(unknown.label, unknown.patients);
  if (unknownStat) {
    unknownStat.hint = '缺少出生日期的住户，建议回详情页补充。';
    stats.push(unknownStat);
  }

  const decorated = decorateStatCards(stats);
  const { stats: enhancedStats, totalCount } = enhanceStatsForVisualization(decorated);
  return {
    title: '按年龄段分析',
    panelKey: 'age',
    stats: enhancedStats,
    totalCount,
    emptyText: '暂无年龄数据',
  };
}

function buildStatusPanel(patients) {
  const groups = { '在住': [], '待入住/随访': [], '已离开': [] };
  (patients || []).forEach(item => {
    const status = normalizeCareStatus(item.careStatus);
    const ref = getPatientRef(item);
    if (status === 'in_care') groups['在住'].push(ref);
    else if (status === 'discharged') groups['已离开'].push(ref);
    else groups['待入住/随访'].push(ref);
  });
  const panel = buildGroupPanel('状态分布', groups, {
    panelKey: 'status',
    sortByValueDesc: true,
    buildFilter: label => {
      if (label === '在住') return createStatFilterPayload('in_care');
      if (label === '已离开') return createStatFilterPayload('discharged');
      return createStatFilterPayload('pending');
    },
  });
  return panel;
}

function buildGroupPanel(title, groups, options = {}) {
  const {
    emptyText = '暂无数据',
    sortByLabel = null,
    sortByValueDesc = true,
    panelKey = null,
    buildFilter = null,
    topN = 8,
    aggregateOthers = true,
  } = options;

  const entries = Object.keys(groups || {}).map(label => ({ label, patients: groups[label] || [] }));
  if (!entries.length) {
    return { title, panelKey, stats: [], totalCount: 0, emptyText };
  }

  // 排序（先按数量）
  if (sortByValueDesc) {
    entries.sort((a, b) => (b.patients.length - a.patients.length));
  }

  // Top-N + 其他
  let selected = entries;
  if (Number.isFinite(topN) && topN > 0 && entries.length > topN) {
    const top = entries.slice(0, topN);
    if (aggregateOthers) {
      const pooled = entries.slice(topN).reduce((acc, e) => acc.concat(e.patients), []);
      if (pooled.length) top.push({ label: '其他', patients: pooled });
    }
    selected = top;
  }

  if (sortByLabel === 'asc') {
    selected.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  } else if (sortByLabel === 'desc') {
    selected.sort((a, b) => String(b.label).localeCompare(String(a.label)));
  }

  const stats = selected
    .map(entry => {
      const stat = toStat(entry.label, entry.patients);
      if (!stat) return null;
      if (typeof buildFilter === 'function') {
        const filter = buildFilter(entry.label, stat);
        if (filter) stat.filter = filter;
      }
      if (!stat.hint) {
        if (panelKey === 'nativePlace' && isUnknownLabel(entry.label)) {
          stat.hint = '籍贯缺失的住户，建议补录信息。';
        } else if (panelKey === 'hospital' && isUnknownLabel(entry.label)) {
          stat.hint = '缺少医院记录，建议核对住户档案。';
        } else if (panelKey === 'doctor' && isUnknownLabel(entry.label)) {
          stat.hint = '缺少医生记录，可回列表补齐。';
        }
      }
      return stat;
    })
    .filter(Boolean);

  const decorated = decorateStatCards(stats);
  const { stats: enhancedStats, totalCount } = enhanceStatsForVisualization(decorated);
  return { title, panelKey, stats: enhancedStats, totalCount, emptyText };
}

function buildDataQualityPanel(patients) {
  const issues = [
    {
      id: 'missingAddress',
      label: '缺少常住地址',
      predicate: patient => !safeString(patient.address),
      hint: '请在详情页补充常住地址。',
    },
    {
      id: 'missingContacts',
      label: '联系人不足',
      predicate: patient => {
        const contacts = Array.isArray(patient.contacts) ? patient.contacts : [];
        const validContacts = contacts.filter(contact =>
          safeString(contact && contact.name) && safeString(contact && contact.phone)
        );
        return validContacts.length === 0;
      },
      hint: '建议至少录入一位联系人信息。',
    },
    {
      id: 'missingIdNumber',
      label: '证件信息缺失',
      predicate: patient => !safeString(patient.idNumber),
      hint: '补录证件类型与号码以便核验身份。',
    },
    {
      id: 'missingNativePlace',
      label: '缺少籍贯或民族',
      predicate: patient => !safeString(patient.nativePlace) || !safeString(patient.ethnicity),
      hint: '补充籍贯与民族信息，便于统计分析。',
    },
  ];

  const stats = [];
  issues.forEach(issue => {
    const affected = [];
    patients.forEach(patient => {
      try {
        if (issue.predicate(patient)) {
          affected.push(getPatientRef(patient));
        }
      } catch (error) {
        logger.warn('Failed to evaluate data quality predicate', issue.id, error);
      }
    });
    const stat = toStat(issue.label, affected);
    if (stat) {
      stat.status = 'warning';
      stat.variant = 'outlined';
      stat.hint = issue.hint;
      stats.push(stat);
    }
  });

  // 按问题人数降序展示，突出优先修复项
  stats.sort((a, b) => (b.count || 0) - (a.count || 0));

  if (!stats.length) {
    return null;
  }

  const { stats: enhancedStats, totalCount } = enhanceStatsForVisualization(stats);
  return {
    title: '数据完整度',
    panelKey: 'dataQuality',
    stats: enhancedStats,
    totalCount,
    emptyText: '暂无数据缺失问题',
  };
}

// 构建月份面板，并生成最近6个月迷你趋势
function buildMonthPanel(patients) {
  const groups = {};
  (patients || []).forEach(item => {
    const label = getMonthLabel(item);
    const ref = getPatientRef(item);
    if (!groups[label]) groups[label] = [];
    groups[label].push(ref);
  });
  const panel = buildGroupPanel('按入住月份分析', groups, {
    emptyText: '暂无入住数据',
    sortByLabel: 'asc',
    panelKey: 'month',
    buildFilter: label => {
      const range = deriveMonthRange(label);
      if (!range) return null;
      return createAdvancedFilterPayload({ dateRange: range }, `${label} 入住`, { keepStatFilter: false });
    },
  });

  const now = new Date();
  const labels = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`);
  }
  const statMap = new Map();
  (panel.stats || []).forEach(s => {
    const key = safeString(s.label);
    if (!key || key.includes('未知')) return;
    statMap.set(key, s.count || 0);
  });
  const points = labels.map(l => ({ label: l, value: statMap.get(l) || 0 }));
  const max = points.reduce((m, p) => (p.value > m ? p.value : m), 0) || 1;
  panel.trend = { points: points.map(p => ({ ...p, ratio: Math.round((p.value / max) * 100) })) };
  return panel;
}

function getMonthLabel(item) {
  const timestamp = Number(item.latestAdmissionTimestamp || 0);
  if (timestamp) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
    }
  }
  const formatted = item.latestAdmissionDateFormatted || formatDate(item.latestAdmissionDate || '');
  const parsed = parseDateValue(formatted);
  if (parsed) {
    return `${parsed.getFullYear()}-${`${parsed.getMonth() + 1}`.padStart(2, '0')}`;
  }
  return '未知月份';
}

function createSelectionState(overrides = {}) {
  return {
    visible: false,
    title: '',
    items: [],
    totalCount: 0,
    filterPayload: null,
    filterAvailable: false,
    hint: '',
    ...overrides,
  };
}

Page({
  data: {
    theme: INITIAL_THEME_KEY,
    themeClass: themeManager.resolveThemeClass(INITIAL_THEME_KEY),
    loading: true,
    error: '',
    patientsSource: [],
    patients: [],
    panels: [],
    summaryStats: {
      total: 0,
      inCare: 0,
      pending: 0,
      discharged: 0,
    },
    summaryCards: SUMMARY_CARD_CONFIG.map(config => ({ ...config, value: 0, isMax: false })),
    legendItems: LEGEND_ITEMS,
    panelDisplayModes: PANEL_DISPLAY_MODES,
    panelViewModes: {},
    activeSummaryFilter: 'all',
    selection: createSelectionState(),
    // 全局筛选
    timeRange: 'all', // all | last30 | month | year
    statusFilter: 'all', // all | in_care | pending | discharged
    isDefaultFilter: true,
    panelCollapsed: {},
  },

  onLoad() {
    const app = getApp();
    this.themeUnsubscribe =
      app && typeof app.watchTheme === 'function'
        ? app.watchTheme(theme => this.handleThemeChange(theme), { immediate: true })
        : themeManager.subscribeTheme(theme => this.handleThemeChange(theme));

    this.eventChannel =
      typeof this.getOpenerEventChannel === 'function' ? this.getOpenerEventChannel() : null;
    this.pendingPieRenders = new Set();
    // 读取持久化筛选/折叠状态
    try {
      const savedFilters = wx.getStorageSync(STORAGE_KEYS.filters) || null;
      if (savedFilters && typeof savedFilters === 'object') {
        const { timeRange, statusFilter } = savedFilters;
        if (timeRange) this.setData({ timeRange });
        if (statusFilter) this.setData({ statusFilter });
      }
    } catch (e) { /* noop: ignore storage read errors */ }
    try {
      const savedCollapsed = wx.getStorageSync(STORAGE_KEYS.collapsed) || null;
      if (savedCollapsed && typeof savedCollapsed === 'object') {
        this.setData({ panelCollapsed: savedCollapsed });
      }
    } catch (e) { /* noop: ignore storage read errors */ }
    this.fetchPatients();
  },

  onUnload() {
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
    if (this.panelObserver) {
      try { this.panelObserver.disconnect(); } catch (e) { /* noop */ }
      this.panelObserver = null;
    }
  },

  handleThemeChange(themeKey) {
    this.setData({
      theme: themeKey,
      themeClass: themeManager.resolveThemeClass(themeKey),
    });
  },

  async fetchPatients() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'patientProfile',
        data: { action: 'list' },
      });
      const sourcePatients = res?.result?.patients || [];
      const patientsMapped = sourcePatients.map(item => {
        const latestAdmissionDateFormatted = formatDate(
          item.latestAdmissionDate || item.firstAdmissionDate
        );
        const firstAdmissionDateFormatted = formatDate(
          item.firstAdmissionDate || item.latestAdmissionDate
        );
        const firstDiagnosis = item.firstDiagnosis || item.latestDiagnosis || '';
        const latestDiagnosis = item.latestDiagnosis || item.firstDiagnosis || '';
        const firstHospital = item.firstHospital || item.latestHospital || '';
        const latestHospital = item.latestHospital || item.firstHospital || '';
        const latestDoctor = item.latestDoctor || '';
        const genderLabel = mapGenderLabel(item.genderLabel || item.gender);
        const careStatus = deriveCareStatusFromPatient(item);
        const ageYears = calculateAge(item.birthDate);
        const ageBucket = resolveAgeBucket(ageYears);
        const contacts = Array.isArray(item.contacts)
          ? item.contacts
          : Array.isArray(item.familyContacts)
          ? item.familyContacts
          : [];
        return {
          ...item,
          latestAdmissionDateFormatted,
          firstAdmissionDateFormatted,
          firstDiagnosis,
          latestDiagnosis,
          firstHospital,
          latestHospital,
          latestDoctor,
          genderLabel,
          careStatus,
          ageYears,
          ageBucketId: ageBucket ? ageBucket.id : '',
          ageBucketLabel: ageBucket ? ageBucket.label : '',
          nativePlace: safeString(item.nativePlace),
          ethnicity: safeString(item.ethnicity),
          contacts,
        };
      });
      this.setData({ patientsSource: patientsMapped }, () => this.applyFiltersAndBuild());
    } catch (error) {
      logger.error('Failed to load analysis data', error);
      this.setData({
        loading: false,
        error: (error && error.errMsg) || '加载分析数据失败，请稍后重试',
      });
    }
  },

  // 过滤 + 构建
  applyFiltersAndBuild() {
    const source = this.data.patientsSource || [];
    const filtered = this.filterPatientsByCurrentFilters(source);
    const panels = this.buildPanels(filtered);
    const summaryStats = calculateSummaryStats(filtered);
    const summaryCards = buildSummaryCards(summaryStats);
    const panelViewModes = this.computePanelViewModes(panels);
    const isDefault = this.data.timeRange === 'all' && this.data.statusFilter === 'all';
    const panelCollapsed = this.computeDefaultCollapsed(panels);
    this.setData({ patients: filtered, panels, summaryStats, summaryCards, panelViewModes, loading: false, isDefaultFilter: isDefault, panelCollapsed }, () => {
      this.schedulePieRenderForActiveModes(panelViewModes);
      this.observePanels();
    });
  },

  filterPatientsByCurrentFilters(patients) {
    const time = this.data.timeRange || 'all';
    const status = this.data.statusFilter || 'all';
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    const day30 = now.getTime() - 30 * MS_PER_DAY;

    const matchTime = ts => {
      if (!Number.isFinite(ts) || ts <= 0) return time === 'all';
      if (time === 'all') return true;
      if (time === 'last30') return ts >= day30;
      if (time === 'month') return ts >= startOfMonth;
      if (time === 'year') return ts >= startOfYear;
      return true;
    };

    return (patients || []).filter(p => {
      const ts = Number(p.latestAdmissionTimestamp || 0);
      const timeOk = matchTime(ts);
      if (!timeOk) return false;
      if (status === 'all') return true;
      return normalizeCareStatus(p.careStatus) === status;
    });
  },

  buildPanels(patients) {
    const statusPanel = buildStatusPanel(patients);
    const agePanel = buildAgePanel(patients);

    const genderGroups = {};
    patients.forEach(item => {
      const label = mapGenderLabel(item.genderLabel || item.gender);
      const ref = getPatientRef(item);
      if (!genderGroups[label]) {
        genderGroups[label] = [];
      }
      genderGroups[label].push(ref);
    });
    const genderPanel = buildGroupPanel('按性别分析', genderGroups, {
      emptyText: '暂无性别数据',
      panelKey: 'gender',
      buildFilter: label => {
        if (!label || label === '未标记性别') {
          return null;
        }
        return createAdvancedFilterPayload({ genders: [label] }, `性别:${label}`);
      },
    });

    const placeGroups = {};
    patients.forEach(item => {
      const label = safeString(item.nativePlace) || '未知籍贯';
      const ref = getPatientRef(item);
      if (!placeGroups[label]) {
        placeGroups[label] = [];
      }
      placeGroups[label].push(ref);
    });
    const placePanel = buildGroupPanel('按籍贯分析', placeGroups, {
      emptyText: '暂无籍贯数据',
      panelKey: 'nativePlace',
      buildFilter: label => {
        if (isUnknownLabel(label)) {
          return null;
        }
        return createAdvancedFilterPayload({ nativePlaces: [label] }, `籍贯:${label}`);
      },
    });

    const monthPanel = buildMonthPanel(patients);

    const resolveAdmissionYear = patient => {
      const timestamp = Number(patient.latestAdmissionTimestamp || 0);
      if (Number.isFinite(timestamp) && timestamp > 0) {
        const date = new Date(timestamp);
        if (!Number.isNaN(date.getTime())) {
          return `${date.getFullYear()}`;
        }
      }
      const formatted =
        patient.latestAdmissionDateFormatted || formatDate(patient.latestAdmissionDate || '');
      const parsed = parseDateValue(formatted);
      if (parsed) {
        return `${parsed.getFullYear()}`;
      }
      return '未知年份';
    };

    const yearGroups = {};
    patients.forEach(item => {
      const label = resolveAdmissionYear(item);
      const ref = getPatientRef(item);
      if (!yearGroups[label]) {
        yearGroups[label] = [];
      }
      yearGroups[label].push(ref);
    });
    const yearPanel = buildGroupPanel('按入住年份分析', yearGroups, {
      emptyText: '暂无入住年份数据',
      sortByLabel: 'asc',
      panelKey: 'year',
      buildFilter: label => {
        const range = deriveYearRange(label);
        if (!range) {
          return null;
        }
        return createAdvancedFilterPayload({ dateRange: range }, `${label} 年入住`, {
          keepStatFilter: false,
        });
      },
    });

    const hospitalGroups = {};
    patients.forEach(item => {
      const label = safeString(item.latestHospital || item.firstHospital) || '未记录医院';
      const ref = getPatientRef(item);
      if (!hospitalGroups[label]) {
        hospitalGroups[label] = [];
      }
      hospitalGroups[label].push(ref);
    });
    const hospitalPanel = buildGroupPanel('按就诊医院分析', hospitalGroups, {
      emptyText: '暂无医院数据',
      panelKey: 'hospital',
      buildFilter: label => {
        if (isUnknownLabel(label)) {
          return null;
        }
        return createAdvancedFilterPayload({ hospitals: [label] }, `医院:${label}`);
      },
    });

    const doctorGroups = {};
    patients.forEach(item => {
      const label = safeString(item.latestDoctor) || safeString(item.firstDoctor) || '未记录医生';
      const ref = getPatientRef(item);
      if (!doctorGroups[label]) {
        doctorGroups[label] = [];
      }
      doctorGroups[label].push(ref);
    });
    const doctorPanel = buildGroupPanel('按医生分析', doctorGroups, {
      emptyText: '暂无医生数据',
      panelKey: 'doctor',
      buildFilter: label => {
        if (isUnknownLabel(label)) {
          return null;
        }
        return createAdvancedFilterPayload({ doctors: [label] }, `医生:${label}`);
      },
    });

    const dataQualityPanel = buildDataQualityPanel(patients);

    const panels = [];
    if (statusPanel) panels.push(statusPanel);
    if (dataQualityPanel) panels.push(dataQualityPanel);
    panels.push(agePanel, genderPanel, placePanel, monthPanel, yearPanel, hospitalPanel, doctorPanel);
    return panels;
  },

  computeDefaultCollapsed(panels) {
    const defaults = { hospital: true, doctor: true };
    const previous = this.data && this.data.panelCollapsed ? this.data.panelCollapsed : {};
    const result = { ...previous };
    (panels || []).forEach(p => {
      const key = p && (p.panelKey || p.title);
      if (!key) return;
      if (!(key in result)) {
        result[key] = Boolean(defaults[key]) || false;
      }
    });
    return result;
  },

  computePanelViewModes(panels) {
    const previous = this.data.panelViewModes || {};
    const next = {};
    const preferred = stats => {
      const n = (stats || []).length;
      if (!n) return 'cards';
      if (n <= 5) return 'pie';
      return 'bars';
    };
    (panels || []).forEach(panel => {
      const key = panel && (panel.panelKey || panel.title);
      if (!key) return;
      const prevMode = previous[key];
      next[key] = this.isSupportedPanelMode(prevMode) ? prevMode : preferred(panel.stats);
    });
    return next;
  },

  isSupportedPanelMode(mode) {
    return PANEL_DISPLAY_MODES.some(item => item.id === mode);
  },

  schedulePieRenderForActiveModes(viewModes) {
    Object.keys(viewModes || {}).forEach(panelKey => {
      if (viewModes[panelKey] === 'pie') {
        this.schedulePieRender(panelKey);
      }
    });
  },

  schedulePieRender(panelKey) {
    if (!panelKey) {
      return;
    }
    if (!this.pendingPieRenders) {
      this.pendingPieRenders = new Set();
    }
    if (this.pendingPieRenders.has(panelKey)) {
      return;
    }
    this.pendingPieRenders.add(panelKey);
    wx.nextTick(() => {
      this.renderPieChart(panelKey);
      this.pendingPieRenders.delete(panelKey);
    });
  },

  // 面板懒观察：仅在进入视口时才调度饼图渲染
  observePanels() {
    if (!this.data || !Array.isArray(this.data.panels)) return;
    if (this.panelObserver) {
      try { this.panelObserver.disconnect(); } catch (e) { /* noop */ }
      this.panelObserver = null;
    }
    try {
      const observer = wx.createIntersectionObserver && wx.createIntersectionObserver(this, { observeAll: true });
      if (!observer) return;
      this.panelObserver = observer;
      (this.data.panels || []).forEach(panel => {
        const key = panel && (panel.panelKey || panel.title);
        if (!key) return;
        observer.relativeToViewport({ top: 0, bottom: 0 }).observe(`#panel-${key}`, res => {
          if (!res || res.intersectionRatio <= 0) return;
          const mode = (this.data.panelViewModes || {})[key] || 'cards';
          if (mode === 'pie') {
            this.schedulePieRender(key);
          }
        });
      });
    } catch (e) {
      // ignore observer failures
    }
  },

  renderPieChart(panelKey) {
    const panel = this.getPanelByKey(panelKey);
    if (!panel || !panel.stats || !panel.stats.length) {
      return;
    }
    const query = wx.createSelectorQuery().in(this);
    query
      .select(`#pie-${panelKey}`)
      .fields({ node: true, size: true })
      .exec(res => {
        const result = res && res[0];
        if (!result || !result.node) {
          return;
        }
        const canvas = result.node;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return;
        }
        const { width, height } = result;
        const { pixelRatio } = wx.getSystemInfoSync();
        const dpr = pixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        if (typeof ctx.resetTransform === 'function') {
          ctx.resetTransform();
        }
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) - 6;
        const total = panel.stats.reduce((sum, stat) => sum + (stat.count || 0), 0);

        if (!(total > 0) || radius <= 0) {
          const fallbackRadius = Math.max(Math.min(centerX, centerY) - 6, 24);
          ctx.beginPath();
          ctx.fillStyle = '#E5E7EB';
          ctx.arc(centerX, centerY, fallbackRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = '#FFFFFF';
          ctx.arc(centerX, centerY, fallbackRadius * 0.55, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        let startAngle = -Math.PI / 2;
        panel.stats.forEach(stat => {
          const value = stat.count || 0;
          if (value <= 0) {
            return;
          }
          const ratio = value / total;
          const endAngle = startAngle + ratio * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(centerX, centerY, radius, startAngle, endAngle);
          ctx.closePath();
          ctx.fillStyle = stat.color || CHART_COLOR_PALETTE[0];
          ctx.fill();
          startAngle = endAngle;
        });

        ctx.beginPath();
        ctx.fillStyle = '#FFFFFF';
        ctx.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      });
  },

  getPanelByKey(panelKey) {
    if (!panelKey) {
      return null;
    }
    return (this.data.panels || []).find(panel => (panel.panelKey || panel.title) === panelKey) || null;
  },

  onPanelModeTap(event) {
    const { panelKey, mode } = event.currentTarget.dataset || {};
    if (!panelKey || !this.isSupportedPanelMode(mode)) {
      return;
    }
    const currentModes = this.data.panelViewModes || {};
    if (currentModes[panelKey] === mode) {
      return;
    }
    const nextModes = { ...currentModes, [panelKey]: mode };
    this.setData({ panelViewModes: nextModes }, () => {
      if (mode === 'pie') {
        this.schedulePieRender(panelKey);
      }
    });
  },

  onPanelCollapseToggle(event) {
    const key = event.currentTarget.dataset.panelKey;
    if (!key) return;
    const current = this.data.panelCollapsed || {};
    const next = { ...current, [key]: !current[key] };
    this.setData({ panelCollapsed: next }, () => {
      // 当展开且模式为饼图时，确保渲染
      if (!next[key]) {
        const mode = (this.data.panelViewModes || {})[key] || 'cards';
        if (mode === 'pie') this.schedulePieRender(key);
      }
      try { wx.setStorageSync(STORAGE_KEYS.collapsed, next); } catch (e) { /* noop */ }
    });
  },

  onSummaryCardTap(event) {
    const filterId = event.currentTarget.dataset.filter;
    if (!filterId) {
      return;
    }
    this.setData({ activeSummaryFilter: filterId });

    if (filterId === 'all') {
      this.navigateBackWithFilter(createStatFilterPayload('all'));
      return;
    }

    const patients = this.data.patients || [];
    let filtered = patients;
    let title = '全部住户';
    if (filterId === 'in_care') {
      filtered = patients.filter(item => normalizeCareStatus(item.careStatus) === 'in_care');
      title = '在住住户';
    } else if (filterId === 'pending') {
      filtered = patients.filter(item => normalizeCareStatus(item.careStatus) === 'pending');
      title = '待入住 / 随访住户';
    } else if (filterId === 'discharged') {
      filtered = patients.filter(item => normalizeCareStatus(item.careStatus) === 'discharged');
      title = '已离开住户';
    }

    const filterPayload = createStatFilterPayload(filterId);
    if (!filtered.length) {
      wx.showToast({ title: '暂无住户，已回列表应用筛选', icon: 'none' });
      this.navigateBackWithFilter(filterPayload);
      return;
    }

    const items = filtered.slice(0, SELECTION_DISPLAY_LIMIT).map(getPatientRef);
    const truncated = filtered.length > items.length;
    const hintParts = ['点击住户可打开详情'];
    hintParts.push('可跳转列表直接应用状态筛选');
    if (truncated) {
      hintParts.push(`已截取前${SELECTION_DISPLAY_LIMIT}位`);
    }

    this.setData({
      selection: createSelectionState({
        visible: true,
        title,
        items,
        totalCount: filtered.length,
        filterPayload,
        filterAvailable: true,
        hint: hintParts.join(' · '),
      }),
    });
  },

  onStatTap(event) {
    const { panelIndex, statIndex } = event.currentTarget.dataset;
    const panel = this.data.panels?.[panelIndex];
    const stat = panel?.stats?.[statIndex];
    if (!stat || !stat.patients?.length) {
      wx.showToast({ title: '暂无住户', icon: 'none' });
      return;
    }

    const totalCount = stat.patients.length;
    const items = stat.patients.slice(0, SELECTION_DISPLAY_LIMIT);
    const truncated = totalCount > items.length;
    const hint = buildSelectionHint({ panelKey: panel.panelKey, stat, truncated });

    this.setData({
      selection: createSelectionState({
        visible: true,
        title: `${panel.title} · ${stat.label}`,
        items,
        totalCount,
        filterPayload: stat.filter || null,
        filterAvailable: Boolean(stat.filter),
        hint,
      }),
    });
  },

  onSelectionApplyFilter() {
    const payload = this.data.selection.filterPayload;
    if (!payload) {
      return;
    }
    this.navigateBackWithFilter(payload);
  },

  onSelectionClose() {
    if (!this.data.selection.visible) {
      return;
    }
    this.setData({ selection: createSelectionState() });
  },

  // 全局筛选交互
  onTimeChipTap(event) {
    const value = event.currentTarget.dataset.value;
    if (!value || value === this.data.timeRange) return;
    this.setData({ timeRange: value }, () => {
      this.applyFiltersAndBuild();
      this.persistFilters();
    });
  },
  onStatusChipTap(event) {
    const value = event.currentTarget.dataset.value;
    if (!value || value === this.data.statusFilter) return;
    this.setData({ statusFilter: value }, () => {
      this.applyFiltersAndBuild();
      this.persistFilters();
    });
  },
  onClearFilters() {
    this.setData({ timeRange: 'all', statusFilter: 'all' }, () => {
      this.applyFiltersAndBuild();
      this.persistFilters();
    });
  },

  persistFilters() {
    try {
      wx.setStorageSync(STORAGE_KEYS.filters, {
        timeRange: this.data.timeRange,
        statusFilter: this.data.statusFilter,
      });
    } catch (e) { /* noop */ }
  },

  onSelectionItemTap(event) {
    const { key, patientKey, recordKey } = event.currentTarget.dataset || {};
    const profileKey = recordKey || key || patientKey;
    const resolvedPatientKey = patientKey || key || recordKey;
    if (!profileKey) {
      return;
    }
    this.setData({ selection: createSelectionState() }, () => {
      let url = `/pages/patient-detail/detail?key=${encodeURIComponent(profileKey)}`;
      if (resolvedPatientKey) {
        url += `&patientId=${encodeURIComponent(resolvedPatientKey)}`;
      }
      wx.navigateTo({ url });
    });
  },

  onNavigateListAll() {
    this.navigateBackWithFilter(createStatFilterPayload('all'));
  },

  emitFilterToList(payload) {
    if (this.eventChannel && typeof this.eventChannel.emit === 'function') {
      this.eventChannel.emit('analysis:applyFilter', payload);
      return true;
    }
    return false;
  },

  navigateBackWithFilter(payload) {
    if (!payload) {
      return false;
    }
    const success = this.emitFilterToList(payload);
    if (!success) {
      wx.showToast({ title: '无法应用筛选，请返回列表手动操作', icon: 'none' });
      return false;
    }
    this.setData({ selection: createSelectionState() }, () => {
      wx.navigateBack({ delta: 1 });
    });
    return true;
  },

  noop() {},
});
