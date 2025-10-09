const logger = require('../../utils/logger');
const themeManager = require('../../utils/theme');
const { formatDate, formatAge, calculateAge } = require('../../utils/date');
const { callPatientIntake, formatDateTime } = require('../../utils/intake');
const SORT_OPTIONS = [
  { label: '最近入住优先', value: 'latestAdmissionDesc' },
  { label: '入住次数优先', value: 'admissionCountDesc' },
  { label: '姓名排序', value: 'nameAsc' },
];
const PATIENT_CACHE_KEY = 'patient_list_cache';
const PATIENT_LIST_DIRTY_KEY = 'patient_list_dirty';
const PATIENT_CACHE_TTL = 5 * 60 * 1000;
const PATIENT_PAGE_SIZE = 80;
const MAX_SUGGESTIONS = 8;
const MIN_SUGGESTION_LENGTH = 2;
const SUGGEST_DEBOUNCE_TIME = 300; // 300ms防抖优化搜索建议
const FILTER_PREVIEW_DEBOUNCE_TIME = 500; // 500ms防抖优化筛选预览
const FAB_SCROLL_RESTORE_DELAY = 260;
const AGE_BUCKETS = [
  { id: '0-3', label: '0-3岁', min: 0, max: 3 },
  { id: '4-6', label: '4-6岁', min: 4, max: 6 },
  { id: '7-12', label: '7-12岁', min: 7, max: 12 },
  { id: '13-17', label: '13-17岁', min: 13, max: 17 },
  { id: '18+', label: '18岁及以上', min: 18, max: 200 },
];
const FILTER_STATUS_OPTIONS = [
  { id: 'in_care', label: '在住' },
  { id: 'followup', label: '随访' },
  { id: 'pending', label: '待入住' },
  { id: 'discharged', label: '已出院' },
];
const FILTER_RISK_OPTIONS = [
  { id: 'high', label: '高风险' },
  { id: 'medium', label: '中风险' },
  { id: 'low', label: '低风险' },
];
const FILTER_SCHEME_STORAGE_KEY = 'filter_panel_schemes';
const INITIAL_THEME_KEY = themeManager.getTheme();
const INITIAL_THEME_INDEX = themeManager.getThemeIndex(INITIAL_THEME_KEY);
const INITIAL_THEME_LABEL = themeManager.getThemeLabel(INITIAL_THEME_KEY);
const MEDIA_SUMMARY_TTL = 5 * 60 * 1000; // 5分钟缓存
// 快速筛选器已移除 - 功能已整合至统计卡片
function safeString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}
function formatTimeString(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}
function buildTimestampFromDateTime(dateStr, timeStr) {
  const dateText = safeString(dateStr);
  if (!dateText) {
    return null;
  }
  const timeText = safeString(timeStr) || '00:00';
  const timestamp = Date.parse(`${dateText}T${timeText}:00`);
  return Number.isFinite(timestamp) ? timestamp : null;
}
function mapGenderLabel(value) {
  const text = safeString(value);
  if (!text) {
    return '';
  }
  const lower = text.toLowerCase();
  if (['m', 'male', '男'].includes(lower)) {
    return '男';
  }
  if (['f', 'female', '女'].includes(lower)) {
    return '女';
  }
  return text;
}
function normalizeCareStatus(value, fallback = 'pending') {
  const text = safeString(value).toLowerCase();
  if (!text) {
    return fallback;
  }
  if (['in_care', 'incare', 'in-care', 'active', '入住', '在住'].includes(text)) {
    return 'in_care';
  }
  if (['pending', 'followup', 'follow_up', '待入住', '待随访', '随访'].includes(text)) {
    return 'pending';
  }
  if (['discharged', 'left', 'checkout', '已离开', '已出院', '离开'].includes(text)) {
    return 'discharged';
  }
  return fallback;
}
function deriveCardStatus(careStatus, fallback = 'info') {
  switch (careStatus) {
    case 'in_care':
      return 'success';
    case 'pending':
      return 'warning';
    case 'discharged':
      return 'default';
    default:
      return fallback;
  }
}

function resolveCreatePermission(payload, fallback = true) {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }
  const permissions = payload.permissions || payload.capabilities || {};
  const patientPerm = permissions.patient || permissions.patients || {};
  const candidates = [
    permissions.canCreatePatient,
    permissions.canCreate,
    permissions.create,
    permissions.add,
    patientPerm.canCreate,
    patientPerm.create,
    payload.canCreatePatient,
    payload.canCreate,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const value = candidates[i];
    if (typeof value === 'boolean') {
      return value;
    }
  }
  return fallback;
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
function getAgeBucketLabelById(id) {
  const bucket = AGE_BUCKETS.find(item => item.id === id);
  return bucket ? bucket.label : id;
}
function ensureArrayValue(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.slice() : [value];
}
function ensureDateRangeValue(value) {
  const next = value && typeof value === 'object' ? value : {};
  return {
    start: safeString(next.start),
    end: safeString(next.end),
  };
}
function getDefaultAdvancedFilters() {
  return {
    statuses: [],
    riskLevels: [],
    hospitals: [],
    diagnosis: [],
    dateRange: { start: '', end: '' },
    genders: [],
    ethnicities: [],
    nativePlaces: [],
    ageRanges: [],
    doctors: [],
    logicMode: 'AND',
  };
}
function normalizeAdvancedFilters(input) {
  const base = getDefaultAdvancedFilters();
  if (!input || typeof input !== 'object') {
    return base;
  }
  return {
    statuses: ensureArrayValue(input.statuses),
    riskLevels: ensureArrayValue(input.riskLevels),
    hospitals: ensureArrayValue(input.hospitals),
    diagnosis: ensureArrayValue(input.diagnosis),
    dateRange: ensureDateRangeValue(input.dateRange),
    genders: ensureArrayValue(input.genders),
    ethnicities: ensureArrayValue(input.ethnicities),
    nativePlaces: ensureArrayValue(input.nativePlaces),
    ageRanges: ensureArrayValue(input.ageRanges),
    doctors: ensureArrayValue(input.doctors),
    logicMode: input.logicMode === 'OR' ? 'OR' : 'AND',
  };
}
function parseDateToTimestamp(dateStr, endOfDay = false) {
  const value = safeString(dateStr);
  if (!value) {
    return null;
  }
  const timePart = endOfDay ? 'T23:59:59' : 'T00:00:00';
  const ts = Date.parse(`${value}${timePart}`);
  return Number.isFinite(ts) ? ts : null;
}
function applyAdvancedFilters(list, filters) {
  const source = Array.isArray(list) ? list : [];
  if (!filters || typeof filters !== 'object') {
    return source;
  }
  const statuses = ensureArrayValue(filters.statuses);
  const riskLevels = ensureArrayValue(filters.riskLevels);
  const hospitals = ensureArrayValue(filters.hospitals);
  const diagnosis = ensureArrayValue(filters.diagnosis);
  const genders = ensureArrayValue(filters.genders);
  const ethnicities = ensureArrayValue(filters.ethnicities);
  const nativePlaces = ensureArrayValue(filters.nativePlaces);
  const ageRanges = ensureArrayValue(filters.ageRanges);
  const doctors = ensureArrayValue(filters.doctors);
  const dateRange = ensureDateRangeValue(filters.dateRange);
  const logicMode = filters.logicMode === 'OR' ? 'OR' : 'AND';
  const hasDate = Boolean(dateRange.start || dateRange.end);
  const hasAnyFilter =
    statuses.length ||
    riskLevels.length ||
    hospitals.length ||
    diagnosis.length ||
    genders.length ||
    ethnicities.length ||
    nativePlaces.length ||
    ageRanges.length ||
    doctors.length ||
    hasDate;
  if (!hasAnyFilter) {
    return source;
  }
  const statusSet = new Set(statuses);
  const riskSet = new Set(riskLevels);
  const hospitalSet = new Set(hospitals.map(item => safeString(item).toLowerCase()));
  const diagnosisSet = new Set(diagnosis.map(item => safeString(item).toLowerCase()));
  const genderSet = new Set(genders.map(item => safeString(item).toLowerCase()));
  const ethnicitySet = new Set(ethnicities.map(item => safeString(item).toLowerCase()));
  const nativePlaceSet = new Set(nativePlaces.map(item => safeString(item).toLowerCase()));
  const ageRangeSet = new Set(ageRanges.map(item => safeString(item)));
  const doctorSet = new Set(doctors.map(item => safeString(item).toLowerCase()));
  const startTs = parseDateToTimestamp(dateRange.start, false);
  const endTs = parseDateToTimestamp(dateRange.end, true);
  const checkers = [];
  if (statusSet.size) {
    checkers.push(patient => statusSet.has(patient.careStatus));
  }
  if (riskSet.size) {
    checkers.push(patient => riskSet.has(patient.riskLevel));
  }
  if (hospitalSet.size) {
    checkers.push(patient => {
      const latest = safeString(patient.latestHospital).toLowerCase();
      const first = safeString(patient.firstHospital).toLowerCase();
      return (latest && hospitalSet.has(latest)) || (first && hospitalSet.has(first));
    });
  }
  if (doctorSet.size) {
    checkers.push(patient => {
      const latest = safeString(patient.latestDoctor).toLowerCase();
      const first = safeString(patient.firstDoctor).toLowerCase();
      return (latest && doctorSet.has(latest)) || (first && doctorSet.has(first));
    });
  }
  if (diagnosisSet.size) {
    checkers.push(patient => {
      const latest = safeString(patient.latestDiagnosis).toLowerCase();
      const first = safeString(patient.firstDiagnosis).toLowerCase();
      const tags = Array.isArray(patient.tags) ? patient.tags : [];
      if ((latest && diagnosisSet.has(latest)) || (first && diagnosisSet.has(first))) {
        return true;
      }
      return tags.some(tag => diagnosisSet.has(safeString(tag).toLowerCase()));
    });
  }
  if (genderSet.size) {
    checkers.push(patient => {
      const gender = safeString(patient.gender).toLowerCase();
      const label = safeString(patient.genderLabel).toLowerCase();
      return (gender && genderSet.has(gender)) || (label && genderSet.has(label));
    });
  }
  if (ethnicitySet.size) {
    checkers.push(patient => {
      const value = safeString(patient.ethnicity).toLowerCase();
      return value && ethnicitySet.has(value);
    });
  }
  if (nativePlaceSet.size) {
    checkers.push(patient => {
      const value = safeString(patient.nativePlace).toLowerCase();
      return value && nativePlaceSet.has(value);
    });
  }
  if (ageRangeSet.size) {
    checkers.push(patient => {
      const bucketId = safeString(patient.ageBucketId);
      return bucketId && ageRangeSet.has(bucketId);
    });
  }
  if (startTs !== null || endTs !== null) {
    checkers.push(patient => {
      const ts = Number(patient.latestAdmissionTimestamp || patient.firstAdmissionTimestamp || 0);
      if (!ts) {
        return false;
      }
      if (startTs !== null && ts < startTs) {
        return false;
      }
      if (endTs !== null && ts > endTs) {
        return false;
      }
      return true;
    });
  }
  if (!checkers.length) {
    return source;
  }
  if (logicMode === 'OR') {
    return source.filter(patient => checkers.some(check => check(patient)));
  }
  return source.filter(patient => checkers.every(check => check(patient)));
}
function createOptionsFromSet(values) {
  const unique = Array.from(values).filter(Boolean);
  unique.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { sensitivity: 'base' }));
  return unique.map(item => ({ id: item, label: item }));
}
function mapPatientStatus(latestAdmissionTimestamp) {
  const timestamp = Number(latestAdmissionTimestamp || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { cardStatus: 'default', careStatus: 'discharged', diffDays: null };
  }
  const now = Date.now();
  if (timestamp > now) {
    return { cardStatus: 'warning', careStatus: 'pending', diffDays: 0 };
  }
  const diffDays = Math.floor((now - timestamp) / (24 * 60 * 60 * 1000));
  if (diffDays <= 30) {
    return { cardStatus: 'success', careStatus: 'in_care', diffDays };
  }
  if (diffDays <= 90) {
    return { cardStatus: 'warning', careStatus: 'pending', diffDays };
  }
  return { cardStatus: 'default', careStatus: 'discharged', diffDays };
}
function identifyRiskLevel(diffDays) {
  if (diffDays === null || diffDays === undefined) {
    return 'low';
  }
  if (diffDays <= 7) {
    return 'high';
  }
  if (diffDays <= 30) {
    return 'medium';
  }
  return 'low';
}
function generatePatientBadges({ careStatus, riskLevel, admissionCount }) {
  const badges = [];
  if (careStatus === 'in_care') {
    badges.push({ text: '在住', type: 'success' });
  } else if (careStatus === 'pending') {
    badges.push({ text: '随访', type: 'warning' });
  } else if (careStatus === 'discharged') {
    badges.push({ text: '已离开', type: 'default' });
  }
  if (riskLevel === 'high') {
    badges.push({ text: '需复查', type: 'danger' });
  } else if (riskLevel === 'medium') {
    badges.push({ text: '定期随访', type: 'warning' });
  }
  const count = Number(admissionCount || 0);
  if (count > 0) {
    badges.push({ text: `入住 ${count} 次`, type: 'info' });
  }
  return badges;
}
function buildLatestEvent({
  latestAdmissionDateFormatted,
  latestDiagnosis,
  importOrder,
  importedAtFormatted,
}) {
  const diagnosis = safeString(latestDiagnosis) || '暂无诊断';
  if (latestAdmissionDateFormatted) {
    return `${latestAdmissionDateFormatted} · ${diagnosis}`;
  }
  if (Number.isFinite(importOrder) && importOrder > 0) {
    return `Excel 第 ${importOrder} 行 · ${diagnosis}`;
  }
  if (importedAtFormatted) {
    return `${importedAtFormatted} 导入 · ${diagnosis}`;
  }
  return diagnosis;
}
function extractPatientTags({
  latestHospital,
  latestDoctor,
  firstDiagnosis,
  latestDiagnosis,
  importOrder,
}) {
  const tags = [];
  const append = value => {
    const item = safeString(value);
    if (item && !tags.includes(item)) {
      tags.push(item);
    }
  };
  append(latestHospital);
  append(latestDoctor);
  if (firstDiagnosis && safeString(firstDiagnosis) !== safeString(latestDiagnosis)) {
    append(firstDiagnosis);
  }
  if (Number.isFinite(importOrder) && importOrder > 0) {
    append(`Excel 行 ${importOrder}`);
  }
  return tags;
}
function deriveHospitalOptions(patients) {
  const set = new Set();
  (patients || []).forEach(patient => {
    const latest = safeString(patient.latestHospital);
    const first = safeString(patient.firstHospital);
    if (latest) {
      set.add(latest);
    }
    if (first) {
      set.add(first);
    }
  });
  return createOptionsFromSet(set);
}
function deriveDiagnosisOptions(patients) {
  const set = new Set();
  (patients || []).forEach(patient => {
    const latest = safeString(patient.latestDiagnosis);
    const first = safeString(patient.firstDiagnosis);
    if (latest) {
      set.add(latest);
    }
    if (first) {
      set.add(first);
    }
    const tags = Array.isArray(patient.tags) ? patient.tags : [];
    tags.forEach(tag => {
      const text = safeString(tag);
      if (text) {
        set.add(text);
      }
    });
  });
  return createOptionsFromSet(set);
}
function mergeSelectedIntoOptions(options, selectedIds) {
  const map = new Map();
  (options || []).forEach(option => {
    if (option && option.id) {
      map.set(option.id, option.label || option.id);
    }
  });
  (selectedIds || []).forEach(id => {
    const key = safeString(id);
    if (key && !map.has(key)) {
      map.set(key, key);
    }
  });
  return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
}
function canonicalizeSchemeFilters(filters) {
  const normalized = normalizeAdvancedFilters(filters);
  const clone = { ...normalized };
  clone.statuses = ensureArrayValue(clone.statuses).slice().sort();
  clone.riskLevels = ensureArrayValue(clone.riskLevels).slice().sort();
  clone.hospitals = ensureArrayValue(clone.hospitals).slice().sort();
  clone.diagnosis = ensureArrayValue(clone.diagnosis).slice().sort();
  clone.genders = ensureArrayValue(clone.genders).slice().sort();
  clone.ethnicities = ensureArrayValue(clone.ethnicities).slice().sort();
  clone.nativePlaces = ensureArrayValue(clone.nativePlaces).slice().sort();
  clone.ageRanges = ensureArrayValue(clone.ageRanges).slice().sort();
  clone.doctors = ensureArrayValue(clone.doctors).slice().sort();
  clone.dateRange = ensureDateRangeValue(clone.dateRange);
  clone.logicMode = clone.logicMode === 'OR' ? 'OR' : 'AND';
  return clone;
}
function schemeFingerprint(filters) {
  return JSON.stringify(canonicalizeSchemeFilters(filters));
}
function summarizeFiltersForScheme(filters) {
  const normalized = canonicalizeSchemeFilters(filters);
  const parts = [];
  if (normalized.statuses.length) {
    parts.push(`状态:${normalized.statuses.join('/')}`);
  }
  if (normalized.riskLevels.length) {
    parts.push(`风险:${normalized.riskLevels.join('/')}`);
  }
  if (normalized.hospitals.length) {
    parts.push(
      `医院:${normalized.hospitals.slice(0, 2).join('/')}${normalized.hospitals.length > 2 ? '…' : ''}`
    );
  }
  if (normalized.diagnosis.length) {
    parts.push(
      `诊断:${normalized.diagnosis.slice(0, 2).join('/')}${normalized.diagnosis.length > 2 ? '…' : ''}`
    );
  }
  if (normalized.genders.length) {
    parts.push(`性别:${normalized.genders.join('/')}`);
  }
  if (normalized.ethnicities.length) {
    parts.push(
      `民族:${normalized.ethnicities.slice(0, 2).join('/')}${normalized.ethnicities.length > 2 ? '…' : ''}`
    );
  }
  if (normalized.nativePlaces.length) {
    parts.push(
      `籍贯:${normalized.nativePlaces.slice(0, 2).join('/')}${normalized.nativePlaces.length > 2 ? '…' : ''}`
    );
  }
  if (normalized.ageRanges.length) {
    const labels = normalized.ageRanges.map(getAgeBucketLabelById);
    parts.push(`年龄:${labels.slice(0, 2).join('/')}${labels.length > 2 ? '…' : ''}`);
  }
  if (normalized.doctors.length) {
    parts.push(
      `医生:${normalized.doctors.slice(0, 2).join('/')}${normalized.doctors.length > 2 ? '…' : ''}`
    );
  }
  const { start, end } = normalized.dateRange || {};
  if (start || end) {
    parts.push(`日期:${start || '∞'}~${end || '∞'}`);
  }
  parts.push(normalized.logicMode === 'OR' ? '任一条件' : '全部条件');
  return parts.join(' | ');
}
function loadSchemesFromStorage() {
  try {
    const raw = wx.getStorageSync(FILTER_SCHEME_STORAGE_KEY) || [];
    if (Array.isArray(raw)) {
      return raw
        .filter(item => item && item.id && item.filters)
        .slice(0, 5)
        .map(item => {
          const filters = canonicalizeSchemeFilters(item.filters);
          return {
            id: item.id,
            name: item.name || `方案 ${item.id.toString().slice(-4)}`,
            summary: item.summary || summarizeFiltersForScheme(filters),
            fingerprint: schemeFingerprint(filters),
            filters,
          };
        });
    }
  } catch (error) {
    logger.warn('loadSchemesFromStorage failed', error);
  }
  return [];
}
function persistSchemesToStorage(list) {
  try {
    wx.setStorageSync(FILTER_SCHEME_STORAGE_KEY, Array.isArray(list) ? list : []);
  } catch (error) {
    logger.warn('persistSchemesToStorage failed', error);
  }
}
function readPatientsCache() {
  try {
    const cache = wx.getStorageSync(PATIENT_CACHE_KEY);
    if (!cache || !cache.updatedAt || !Array.isArray(cache.patients)) {
      return null;
    }
    if (Date.now() - cache.updatedAt > PATIENT_CACHE_TTL) {
      return null;
    }
    return {
      patients: cache.patients,
      hasMore: cache.hasMore !== undefined ? cache.hasMore : true,
      nextPage: cache.nextPage !== undefined ? cache.nextPage : 1,
      pageSize: cache.pageSize || PATIENT_PAGE_SIZE,
    };
  } catch (error) {
    return null;
  }
}
function writePatientsCache(cacheData = {}) {
  try {
    const patients = Array.isArray(cacheData.patients) ? cacheData.patients : [];
    wx.setStorageSync(PATIENT_CACHE_KEY, {
      patients,
      hasMore: cacheData.hasMore,
      nextPage: cacheData.nextPage,
      pageSize: cacheData.pageSize,
      updatedAt: Date.now(),
    });
  } catch (error) {
    // ignore cache write errors
  }
}
function clearFabTimer(pageInstance) {
  if (!pageInstance) {
    return;
  }
  const timer = pageInstance.fabRestoreTimer;
  if (timer) {
    clearTimeout(timer);
    pageInstance.fabRestoreTimer = null;
  }
}
function clearPageEnterTimer(pageInstance) {
  if (!pageInstance) {
    return;
  }
  const timer = pageInstance.pageEnterTimer;
  if (timer) {
    clearTimeout(timer);
    pageInstance.pageEnterTimer = null;
  }
}
Page({
  // P0-1: 搜索建议防抖timer
  suggestTimer: null,
  // P0-4: 筛选预览防抖timer
  filterPreviewTimer: null,

  data: {
    theme: INITIAL_THEME_KEY,
    themeClass: themeManager.resolveThemeClass(INITIAL_THEME_KEY),
    themeOptions: themeManager.getThemeOptions(),
    themePickerIndex: INITIAL_THEME_INDEX < 0 ? 0 : INITIAL_THEME_INDEX,
    themePickerLabel: INITIAL_THEME_LABEL,
    patients: [],
    displayPatients: [],
    loading: true,
    error: '',
    searchKeyword: '',
    searchSuggestions: [],
    searchLoading: false,
    sortOptions: SORT_OPTIONS,
    sortIndex: 0,
    skeletonPlaceholders: [0, 1, 2, 3],
    cardActions: [
      { id: 'view', label: '查看详情', type: 'text', icon: '→' },
      { id: 'more', label: '更多操作', type: 'text', icon: '⋯' },
    ],
    cardActionsSimplified: [{ id: 'more', label: '更多操作', type: 'text', icon: '⋯' }],
    batchMode: false,
    selectedPatientMap: {},
    selectedCount: 0,
    allSelected: false,
    batchOperationType: '',
    page: 0,
    nextPage: 1,
    pageSize: PATIENT_PAGE_SIZE,
    hasMore: true,
    loadingMore: false,
    fabCompact: false,
    fabVisible: true,
    lastScrollTop: 0,
    pageTransitionClass: 'page-transition-enter',
    filterPanelVisible: false,
    filterStatusOptions: FILTER_STATUS_OPTIONS,
    filterRiskOptions: FILTER_RISK_OPTIONS,
    filterHospitalOptions: [],
    filterDiagnosisOptions: [],
    filterAllDiagnosisOptions: [],
    filterGenderOptions: [],
    filterEthnicityOptions: [],
    filterNativePlaceOptions: [],
    filterDoctorOptions: [],
    filterAgeRangeOptions: AGE_BUCKETS.map(bucket => ({ id: bucket.id, label: bucket.label })),
    filterPanelDefaults: getDefaultAdvancedFilters(),
    filterPreviewCount: -1,
    filterPreviewLoading: false,
    filterPreviewLabel: '名住户符合筛选',
    advancedFilters: getDefaultAdvancedFilters(),
    pendingAdvancedFilters: getDefaultAdvancedFilters(),
    // P1-1: 高级筛选激活状态
    hasActiveFilters: false,
    activeFilterCount: 0,
    // P1-7: FAB标签提示状态
    fabExpanded: false,
    batchOperationLoading: false,
    deletingPatientKey: '',
    filterSchemes: [],
    checkoutDialogVisible: false,
    checkoutSubmitting: false,
    checkoutForm: {
      reason: '',
      note: '',
      timestamp: null,
      date: '',
      time: '',
      dateTimeDisplay: '',
    },
    checkoutErrors: {},
    checkoutPatient: null,
    statusDialogVisible: false,
    statusDialogSubmitting: false,
    statusDialogOptions: [
      { id: 'in_care', label: '在住' },
      { id: 'pending', label: '待入住' },
      { id: 'discharged', label: '已离开' },
    ],
    statusDialogForm: {
      value: '',
      note: '',
    },
    statusDialogPatient: null,
    statusDialogBatchKeys: [],
    // P1-4: 卡片密度模式
    cardDensityMode: 'comfortable', // 'compact' | 'comfortable' | 'spacious'
    canCreatePatient: true,
    // 统计数据
    statsData: {
      total: 0,
      inCare: 0,
      pending: 0,
      discharged: 0,
    },
    // 媒体摘要缓存（内存）
    __mediaSummaryCache: {},
    __mediaSummaryFetching: {},
    activeStatFilter: 'all', // 当前激活的统计筛选
  },
  onLoad() {
    this.fabRestoreTimer = null;
    this.pageEnterTimer = null;

    const app = getApp();
    this.themeUnsubscribe = app && typeof app.watchTheme === 'function'
      ? app.watchTheme(theme => this.handleThemeChange(theme), { immediate: true })
      : themeManager.subscribeTheme(theme => this.handleThemeChange(theme));

    // P1-4: 加载用户偏好的卡片密度模式
    try {
      const savedDensityMode = wx.getStorageSync('card_density_mode');
      if (savedDensityMode && ['compact', 'comfortable', 'spacious'].includes(savedDensityMode)) {
        this.setData({ cardDensityMode: savedDensityMode });
      }
    } catch (error) {
      logger.warn('Failed to load density mode preference', error);
    }

    // P1-8: 动态计算骨架屏数量
    let screenHeight = 667;
    if (typeof wx.getWindowInfo === 'function') {
      const windowInfo = wx.getWindowInfo();
      screenHeight = windowInfo && windowInfo.windowHeight ? windowInfo.windowHeight : screenHeight;
    } else if (typeof wx.getSystemInfoSync === 'function') {
      const systemInfo = wx.getSystemInfoSync();
      screenHeight = systemInfo.windowHeight || systemInfo.screenHeight || screenHeight;
    }
    const estimatedCardHeight = 180; // 估计的卡片高度(rpx转px后约90px)
    const skeletonCount = Math.min(Math.ceil(screenHeight / estimatedCardHeight) + 1, 8); // 最多8个
    this.setData({
      skeletonPlaceholders: Array.from({ length: skeletonCount }, (_, i) => i),
    });

    // P1-1: 初始化高级筛选激活状态
    this.updateFilterActiveState(this.data.advancedFilters);

    const cached = readPatientsCache();
    if (cached && Array.isArray(cached.patients) && cached.patients.length) {
      const filtered = this.buildFilteredPatients(cached.patients);
      this.setData({
        patients: cached.patients,
        displayPatients: filtered,
        loading: false,
        page: 0,
        nextPage: cached.nextPage !== undefined ? cached.nextPage : 1,
        pageSize: cached.pageSize || PATIENT_PAGE_SIZE,
        hasMore: cached.hasMore !== undefined ? cached.hasMore : true,
        filterPreviewCount: filtered.length,
      });
      this.updateFilterOptions(cached.patients);
    }
    this.loadFilterSchemes();
    this.fetchPatients({
      silent: !!(cached && Array.isArray(cached.patients) && cached.patients.length),
      page: 0,
    });
  },
  onHide() {
    clearFabTimer(this);
    clearPageEnterTimer(this);
    if (this.data.fabCompact) {
      this.setData({ fabCompact: false });
    }
    if (this.data.pageTransitionClass !== 'page-transition-enter') {
      this.setData({ pageTransitionClass: 'page-transition-enter' });
    }
  },
  onUnload() {
    clearFabTimer(this);
    clearPageEnterTimer(this);
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
  },
  onShow() {
    this.applyPendingUpdates();
    this.playPageEnterAnimation();

    // P1-7: FAB标签提示 - 首次访问时自动展开
    const hasSeenFabTooltip = wx.getStorageSync('fab_tooltip_seen');
    if (!hasSeenFabTooltip && this.data.canCreatePatient) {
      setTimeout(() => {
        this.setData({ fabExpanded: true });
        // 3秒后自动收起并标记已查看
        setTimeout(() => {
          this.setData({ fabExpanded: false });
          wx.setStorageSync('fab_tooltip_seen', true);
        }, 3000);
      }, 1000);
    }
  },
  onReady() {
    this.playPageEnterAnimation();
  },
  playPageEnterAnimation() {
    clearPageEnterTimer(this);
    this.setData({ pageTransitionClass: 'page-transition-enter' });
    this.pageEnterTimer = setTimeout(() => {
      this.pageEnterTimer = null;
      this.setData({
        pageTransitionClass: 'page-transition-enter page-transition-enter-active',
      });
    }, 20);
  },

  handleThemeChange(themeKey) {
    const index = themeManager.getThemeIndex(themeKey);
    const options = this.data.themeOptions || [];
    const normalizedIndex = index < 0 ? 0 : index;
    const label = options[normalizedIndex]?.label || themeManager.getThemeLabel(themeKey);
    this.setData({
      theme: themeKey,
      themeClass: themeManager.resolveThemeClass(themeKey),
      themePickerIndex: normalizedIndex,
      themePickerLabel: label,
    });
  },

  onThemePick(event) {
    const rawIndex = Number(event?.detail?.value);
    const index = Number.isNaN(rawIndex) ? 0 : rawIndex;
    const options = this.data.themeOptions || [];
    const meta = options[index] || options[0];
    if (!meta) {
      return;
    }

    const app = getApp();
    if (app && typeof app.setTheme === 'function') {
      app.setTheme(meta.key);
    } else {
      themeManager.setTheme(meta.key);
    }

    this.setData({
      themePickerIndex: index,
      themePickerLabel: meta.label,
    });
  },
  async fetchPatients(options = {}) {
    const silent = !!(options && options.silent);
    const page = Math.max(Number.isFinite(options.page) ? Number(options.page) : 0, 0);
    const append = !!(options && options.append);
    const forceRefresh = !!(options && options.forceRefresh);
    const pageSize = Number(this.data.pageSize) || PATIENT_PAGE_SIZE;
    const shouldAppend = append && page > 0;
    if (!shouldAppend) {
      if (!silent) {
        this.setData({ loading: true, error: '' });
      } else {
        this.setData({ error: '' });
      }
    } else {
      this.setData({ error: '' });
    }
    try {
      const res = await wx.cloud.callFunction({
        name: 'patientProfile',
        data: {
          action: 'list',
          page,
          pageSize,
          forceRefresh: forceRefresh || (!silent && page === 0),
        },
      });
      const result = res && res.result ? res.result : {};
      const sourcePatients = Array.isArray(result.patients) ? result.patients : [];
      const resolvedLimit = Number(result.limit) || pageSize;
      const selectedMap = this.data.selectedPatientMap || {};
      const mappedPatients = sourcePatients.map(item => {
        const latestAdmissionDateFormatted = formatDate(
          item.latestAdmissionDate || item.firstAdmissionDate
        );
        const firstAdmissionDateFormatted = formatDate(
          item.firstAdmissionDate || item.latestAdmissionDate
        );
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
        const checkoutAtRaw = item.checkoutAt || (item.metadata && item.metadata.checkoutAt);
        const checkoutAt = Number(checkoutAtRaw);
        const hasCheckout = Number.isFinite(checkoutAt) && checkoutAt > 0;
        let careStatus = normalizeCareStatus(item.careStatus, derivedCareStatus);
        const latestTimestampNumeric = Number.isFinite(latestAdmissionTimestamp)
          ? latestAdmissionTimestamp
          : null;
        const hasExplicitCareStatus = Boolean(safeString(item.careStatus));
        if (
          hasCheckout &&
          (!hasExplicitCareStatus ||
            careStatus === derivedCareStatus ||
            (latestTimestampNumeric !== null && checkoutAt >= latestTimestampNumeric))
        ) {
          careStatus = 'discharged';
        }
        const cardStatus = deriveCardStatus(careStatus, derivedCardStatus);
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
        const key = this.resolvePatientKey(item);
        const selected = Boolean(key && selectedMap[key]);
        const genderLabel = mapGenderLabel(item.gender);
        const nativePlace = item.nativePlace || '';
        const ethnicity = item.ethnicity || '';
        const ageYears = calculateAge(item.birthDate);
        const ageBucket = resolveAgeBucket(ageYears);
        const latestAdmissionDisplay = latestAdmissionDateFormatted
          ? `最近入住 ${latestAdmissionDateFormatted}`
          : '未入住';
        return {
          ...item,
          name: item.patientName || item.name || '',
          ageText: formatAge(item.birthDate),
          ageYears,
          ageBucketId: ageBucket ? ageBucket.id : '',
          ageBucketLabel: ageBucket ? ageBucket.label : '',
          latestAdmissionDateFormatted,
          firstAdmissionDateFormatted,
          firstDiagnosis,
          latestDiagnosis,
          firstHospital,
          latestHospital,
          latestDoctor,
          firstDoctor,
          latestAdmissionDisplay,
          cardStatus,
          careStatus,
          riskLevel,
          badges,
          latestEvent,
          tags,
          firstAdmissionTimestamp,
          diffDaysSinceLatestAdmission: diffDays,
          gender: item.gender || '',
          genderLabel,
          nativePlace,
          ethnicity,
          checkoutAt: hasCheckout ? checkoutAt : null,
          selected,
        };
      });
      let mergedPatients = mappedPatients;
      if (shouldAppend) {
        const existing = Array.isArray(this.data.patients) ? this.data.patients.slice() : [];
        const seenKeys = new Set();
        existing.forEach(existingItem => {
          const existingKey = this.resolvePatientKey(existingItem);
          if (existingKey) {
            seenKeys.add(existingKey);
          }
        });
        mappedPatients.forEach(item => {
          const key = this.resolvePatientKey(item);
          if (!key || !seenKeys.has(key)) {
            existing.push(item);
            if (key) {
              seenKeys.add(key);
            }
          }
        });
        mergedPatients = existing;
      }
      const hasMore =
        typeof result.hasMore === 'boolean'
          ? result.hasMore
          : mappedPatients.length >= resolvedLimit;
      const nextPage = result.nextPage !== undefined ? result.nextPage : hasMore ? page + 1 : null;
      const canCreatePatient = resolveCreatePermission(result, this.data.canCreatePatient);
      const nextState = {
        patients: mergedPatients,
        loading: false,
        error: '',
        page,
        nextPage,
        pageSize: resolvedLimit,
        hasMore,
        loadingMore: false,
      };
      if (this.data.canCreatePatient !== canCreatePatient) {
        nextState.canCreatePatient = canCreatePatient;
      }
      if (!canCreatePatient && this.data.fabExpanded) {
        nextState.fabExpanded = false;
      }
      this.setData(nextState, () => {
        this.applyFilters();
        this.updateFilterOptions(mergedPatients);
      });
      if (!shouldAppend && page === 0) {
        writePatientsCache({
          patients: mappedPatients,
          hasMore,
          nextPage,
          pageSize: resolvedLimit,
        });
        try {
          wx.removeStorageSync(PATIENT_LIST_DIRTY_KEY);
        } catch (error) {
          // ignore removal errors
        }
      }
      return mappedPatients.length;
    } catch (error) {
      logger.error('Failed to load patients', error);
      if (shouldAppend) {
        throw error;
      }
      const errorMessage = (error && error.errMsg) || '读取患者数据失败，请稍后重试';
      const hasPatients = Array.isArray(this.data.patients) && this.data.patients.length > 0;
      if (!silent || !hasPatients) {
        this.setData({
          patients: hasPatients ? this.data.patients : [],
          displayPatients: hasPatients ? this.data.displayPatients : [],
          loading: false,
          error: errorMessage,
        });
      } else {
        this.setData({ loading: false, error: errorMessage });
      }
      return 0;
    }
  },
  applyPendingUpdates() {
    let flag = null;
    try {
      flag = wx.getStorageSync(PATIENT_LIST_DIRTY_KEY);
    } catch (error) {
      flag = null;
    }
    if (!flag) {
      return;
    }
    try {
      wx.removeStorageSync(PATIENT_LIST_DIRTY_KEY);
    } catch (error) {
      // ignore removal errors
    }

    const patientKey = this.resolvePatientKey(flag && flag.patientKey);
    if (!patientKey) {
      this.fetchPatients({ silent: false });
      return;
    }

    if (flag.deleted) {
      const nextPatients = (Array.isArray(this.data.patients) ? this.data.patients : []).filter(
        item => this.resolvePatientKey(item) !== patientKey
      );
      const selectedMap = { ...(this.data.selectedPatientMap || {}) };
      if (selectedMap[patientKey]) {
        delete selectedMap[patientKey];
      }
      const selectedCount = Object.keys(selectedMap).length;
      this.setData(
        {
          patients: nextPatients,
          selectedPatientMap: selectedMap,
          selectedCount,
          allSelected: false,
          deletingPatientKey:
            this.data.deletingPatientKey && this.data.deletingPatientKey === patientKey
              ? ''
              : this.data.deletingPatientKey,
        },
        () => {
          this.applyFilters();
          this.updateFilterOptions(nextPatients);
        }
      );
      this.fetchPatients({ silent: true, forceRefresh: true, page: 0 });
      return;
    }

    const updates = flag && flag.updates;
    if (!updates) {
      this.fetchPatients({ silent: false });
      return;
    }
    const mergeUpdates = (list = []) =>
      list.map(item => {
        const key = this.resolvePatientKey(item);
        if (!key) {
          return item;
        }
        if (key === patientKey) {
          const nextItem = { ...item, ...updates };
          const latestTimestamp = Number(nextItem.latestAdmissionTimestamp || 0) || null;
          const {
            cardStatus: derivedCardStatus,
            careStatus: derivedCareStatus,
            diffDays,
          } = mapPatientStatus(latestTimestamp);
          const normalizedCareStatus = normalizeCareStatus(nextItem.careStatus, derivedCareStatus);
          const cardStatus = deriveCardStatus(normalizedCareStatus, derivedCardStatus);
          const riskLevel = identifyRiskLevel(diffDays);
          const admissionCount = Number(nextItem.admissionCount || 0);
          const badges = generatePatientBadges({
            careStatus: normalizedCareStatus,
            riskLevel,
            admissionCount,
          });
          return {
            ...nextItem,
            careStatus: normalizedCareStatus,
            cardStatus,
            riskLevel,
            badges,
          };
        }
        return item;
      });
    const mergedPatients = mergeUpdates(this.data.patients || []);
    this.setData({ patients: mergedPatients }, () => {
      this.applyFilters();
      this.updateFilterOptions(mergedPatients);
    });
    this.fetchPatients({ silent: false });
  },
  buildFilteredPatients(source = [], options = {}) {
    const { searchKeyword, sortIndex } = this.data;
    const keyword = (searchKeyword || '').trim().toLowerCase();
    const sortValue = SORT_OPTIONS[sortIndex]
      ? SORT_OPTIONS[sortIndex].value
      : 'latestAdmissionDesc';
    let list = Array.isArray(source) ? source.slice() : [];
    const activeFilterId = this.data.activeStatFilter || 'all';
    if (activeFilterId === 'in_care') {
      list = list.filter(item => item && item.careStatus === 'in_care');
    } else if (activeFilterId === 'pending') {
      list = list.filter(item => item && item.careStatus === 'pending');
    } else if (activeFilterId === 'discharged') {
      list = list.filter(item => item && item.careStatus === 'discharged');
    }
    if (keyword) {
      list = list.filter(item => {
        const name = (item.patientName || '').toLowerCase();
        const firstDiagnosis = (item.firstDiagnosis || '').toLowerCase();
        const latestDiagnosis = (item.latestDiagnosis || '').toLowerCase();
        const firstHospital = (item.firstHospital || '').toLowerCase();
        const latestHospital = (item.latestHospital || '').toLowerCase();
        const latestDoctor = (item.latestDoctor || '').toLowerCase();
        const nativePlace = (item.nativePlace || '').toLowerCase();
        const ethnicity = (item.ethnicity || '').toLowerCase();
        const gender = (item.gender || '').toLowerCase();
        const genderLabel = (item.genderLabel || '').toLowerCase();
        const ageLabel = (item.ageText || '').toLowerCase();
        const ageBucketLabel = (item.ageBucketLabel || '').toLowerCase();
        return (
          name.includes(keyword) ||
          firstDiagnosis.includes(keyword) ||
          latestDiagnosis.includes(keyword) ||
          firstHospital.includes(keyword) ||
          latestHospital.includes(keyword) ||
          latestDoctor.includes(keyword) ||
          nativePlace.includes(keyword) ||
          ethnicity.includes(keyword) ||
          gender.includes(keyword) ||
          genderLabel.includes(keyword) ||
          ageLabel.includes(keyword) ||
          ageBucketLabel.includes(keyword)
        );
      });
    }
    const advancedFilters =
      options.advancedFilters || this.data.advancedFilters || getDefaultAdvancedFilters();
    list = applyAdvancedFilters(list, advancedFilters);
    if (sortValue === 'admissionCountDesc') {
      list.sort((a, b) => (b.admissionCount || 0) - (a.admissionCount || 0));
    } else if (sortValue === 'latestAdmissionDesc') {
      list.sort((a, b) => {
        const bTs = Number(b.latestAdmissionTimestamp || 0);
        const aTs = Number(a.latestAdmissionTimestamp || 0);
        if (bTs !== aTs) {
          return bTs - aTs;
        }
        const bDate =
          new Date(b.latestAdmissionDateFormatted || b.latestAdmissionDate || '').getTime() || 0;
        const aDate =
          new Date(a.latestAdmissionDateFormatted || a.latestAdmissionDate || '').getTime() || 0;
        return bDate - aDate;
      });
    } else if (sortValue === 'nameAsc') {
      list.sort((a, b) => {
        const nameA = safeString(a.patientName).localeCompare(
          safeString(b.patientName),
          'zh-Hans-CN',
          {
            sensitivity: 'base',
          }
        );
        if (nameA !== 0) {
          return nameA;
        }
        return safeString(a.recordKey).localeCompare(safeString(b.recordKey), 'zh-Hans-CN', {
          sensitivity: 'base',
        });
      });
    }
    const selectedMap = options.selectedMap || this.data.selectedPatientMap || {};
    return list.map(item => {
      const key = this.resolvePatientKey(item);
      const selected = Boolean(key && selectedMap[key]);
      let nextBadges = Array.isArray(item.badges) ? item.badges.slice() : [];
      if (this.data.batchMode) {
        nextBadges = nextBadges.filter(badge => !(badge && badge._type === 'selection'));
        nextBadges.unshift({
          text: selected ? '已选中' : '可选择',
          type: selected ? 'primary' : 'default',
          _type: 'selection',
        });
      } else {
        nextBadges = nextBadges.filter(badge => !(badge && badge._type === 'selection'));
      }
      return {
        ...item,
        selected,
        badges: nextBadges,
      };
    });
  },
  // 计算统计数据
  calculateStatsData(patients = []) {
    const total = patients.length;
    const inCare = patients.filter(p => p.careStatus === 'in_care').length;
    const pending = patients.filter(p => p.careStatus === 'pending').length;
    const discharged = patients.filter(p => p.careStatus === 'discharged').length;

    return {
      total,
      inCare,
      pending,
      discharged,
    };
  },

  applyFilters() {
    const filtered = this.buildFilteredPatients(this.data.patients || []);
    const statsData = this.calculateStatsData(this.data.patients || []);

    this.setData({
      displayPatients: filtered,
      filterPreviewCount: filtered.length,
      filterPreviewLoading: false,
      statsData,
      // P1-9: 更新空状态配置
      emptyStateConfig: this.getEmptyStateConfig(filtered),
    });
    // 异步更新媒体摘要徽标
    this.updateMediaBadges();
  },

  // 统计卡片点击筛选
  onStatFilterTap(e) {
    const filter = e.currentTarget.dataset.filter;

    // 切换激活状态 - 点击同一个卡片则取消筛选
    const newFilter = this.data.activeStatFilter === filter ? 'all' : filter;

    this.setData(
      {
        activeStatFilter: newFilter,
      },
      () => {
        this.applyFilters();
      }
    );
  },

  // 构建媒体摘要徽标
  buildMediaBadge(summary) {
    if (!summary) return null;
    const count = Number(summary.totalCount || 0);
    if (count <= 0) return null;
    const updatedAt = Number(summary.updatedAt || 0);
    const timeText = updatedAt ? formatTimeString(updatedAt) : '';
    const text = timeText ? `附件 ${count} · ${timeText}` : `附件 ${count}`;
    return { text, type: 'info', _type: 'media' };
  },

  // 列表项注入媒体徽标
  updateMediaBadges() {
    const list = Array.isArray(this.data.displayPatients) ? this.data.displayPatients.slice() : [];
    if (!list.length) return;
    const cache = this.data.__mediaSummaryCache || {};
    const needFetch = [];

    const updated = list.map(item => {
      const key = this.resolvePatientKey(item);
      let badges = Array.isArray(item.badges) ? item.badges.filter(b => !(b && b._type === 'media')) : [];
      const cached = cache[key];
      if (cached && Date.now() - cached.__ts < MEDIA_SUMMARY_TTL) {
        const badge = this.buildMediaBadge(cached);
        if (badge) badges.push(badge);
      } else if (key) {
        needFetch.push(key);
      }
      return { ...item, badges };
    });

    this.setData({ displayPatients: updated });
    if (needFetch.length) {
      this.fetchMediaSummaries(needFetch.slice(0, 8)); // 限制并发数量
    }
  },

  // 批量拉取媒体摘要（并发受限）
  async fetchMediaSummaries(keys) {
    if (!Array.isArray(keys)) return;
    const fetching = { ...(this.data.__mediaSummaryFetching || {}) };
    for (const key of keys) {
      if (!key || fetching[key]) continue;
      fetching[key] = true;
      this.setData({ __mediaSummaryFetching: fetching });
      try {
        const res = await wx.cloud.callFunction({
          name: 'patientMedia',
          data: { action: 'summary', patientKey: key },
        });
        const data = (res && res.result && res.result.data) || { totalCount: 0, updatedAt: 0 };
        const cache = { ...(this.data.__mediaSummaryCache || {}) };
        cache[key] = { ...data, __ts: Date.now() };
        this.setData({ __mediaSummaryCache: cache });
      } catch (error) {
        // 忽略摘要失败
      } finally {
        fetching[key] = false;
        this.setData({ __mediaSummaryFetching: fetching });
      }
    }
    // 拉取结束后刷新徽标
    this.updateMediaBadges();
  },

  // P1-9: 智能判断空状态类型
  getEmptyStateConfig(displayPatients = []) {
    const { searchKeyword, patients = [] } = this.data;
    const hasSearch = Boolean(searchKeyword && searchKeyword.trim());

    // 判断是否有激活的高级筛选
    const advFilters = this.data.advancedFilters || {};
    const hasActiveFilters =
      (advFilters.statuses && advFilters.statuses.length > 0) ||
      (advFilters.riskLevels && advFilters.riskLevels.length > 0) ||
      (advFilters.hospitals && advFilters.hospitals.length > 0) ||
      (advFilters.diagnosis && advFilters.diagnosis.length > 0) ||
      (advFilters.genders && advFilters.genders.length > 0) ||
      (advFilters.ethnicities && advFilters.ethnicities.length > 0) ||
      (advFilters.nativePlaces && advFilters.nativePlaces.length > 0) ||
      (advFilters.ageRanges && advFilters.ageRanges.length > 0) ||
      (advFilters.doctors && advFilters.doctors.length > 0) ||
      (advFilters.dateRange && (advFilters.dateRange.start || advFilters.dateRange.end));

    // 场景1: 搜索无结果
    if (hasSearch && displayPatients.length === 0) {
      return {
        type: 'search',
        title: '未找到匹配的住户',
        description: `没有找到与"${searchKeyword.trim()}"相关的住户`,
        actionText: '清除搜索',
        actionHandler: 'onSearchClear',
        showCreateButton: false,
      };
    }

    // 场景2: 筛选无结果
    if (hasActiveFilters && displayPatients.length === 0) {
      return {
        type: 'filter',
        title: '无符合条件的住户',
        description: '当前筛选条件过于严格,请尝试调整筛选条件',
        actionText: '清除筛选',
        actionHandler: 'onFilterReset',
        showCreateButton: false,
      };
    }

    // 场景3: 首次使用(真实为空)
    if (!patients || patients.length === 0) {
      return {
        type: 'initial',
        title: '暂无住户档案',
        description: '点击右下角按钮添加第一位住户',
        actionText: '立即添加',
        actionHandler: 'onCreatePatientTap',
        showCreateButton: true,
      };
    }

    // 默认空状态
    return null;
  },
  calculatePreviewCount(filters) {
    const normalized = normalizeAdvancedFilters(filters);
    const list = this.buildFilteredPatients(this.data.patients || [], {
      advancedFilters: normalized,
      selectedMap: this.data.selectedPatientMap || {},
    });
    return list.length;
  },
  // P1-1: 计算激活的高级筛选器数量
  calculateActiveFilterCount(filters) {
    const advFilters = filters || this.data.advancedFilters || {};
    let count = 0;

    if (advFilters.statuses && advFilters.statuses.length > 0) count++;
    if (advFilters.riskLevels && advFilters.riskLevels.length > 0) count++;
    if (advFilters.hospitals && advFilters.hospitals.length > 0) count++;
    if (advFilters.diagnosis && advFilters.diagnosis.length > 0) count++;
    if (advFilters.genders && advFilters.genders.length > 0) count++;
    if (advFilters.ethnicities && advFilters.ethnicities.length > 0) count++;
    if (advFilters.nativePlaces && advFilters.nativePlaces.length > 0) count++;
    if (advFilters.ageRanges && advFilters.ageRanges.length > 0) count++;
    if (advFilters.doctors && advFilters.doctors.length > 0) count++;
    if (advFilters.dateRange && (advFilters.dateRange.start || advFilters.dateRange.end)) count++;

    return count;
  },
  // P1-1: 更新高级筛选激活状态
  updateFilterActiveState(filters) {
    const count = this.calculateActiveFilterCount(filters);
    this.setData({
      hasActiveFilters: count > 0,
      activeFilterCount: count,
    });
  },
  // P0-4: 筛选预览即时反馈 - 防抖自动预览
  onFilterPreview(event) {
    const value = event && event.detail ? event.detail.value : null;
    const normalized = normalizeAdvancedFilters(value);

    // 立即更新pending状态
    this.setData({
      pendingAdvancedFilters: normalized,
      filterPreviewLoading: true,
    });

    // 清除之前的防抖定时器
    if (this.filterPreviewTimer) {
      clearTimeout(this.filterPreviewTimer);
      this.filterPreviewTimer = null;
    }

    // 防抖后自动计算预览数量
    this.filterPreviewTimer = setTimeout(() => {
      const count = this.calculatePreviewCount(normalized);
      this.setData({
        filterPreviewCount: count,
        filterPreviewLabel: `将显示 ${count} 条结果`,
        filterPreviewLoading: false,
      });
      this.filterPreviewTimer = null;
    }, FILTER_PREVIEW_DEBOUNCE_TIME);
  },
  onFilterApply(event) {
    const value = event && event.detail ? event.detail.value : null;
    const normalized = normalizeAdvancedFilters(value);
    const count = this.calculatePreviewCount(normalized);
    // P1-1: 更新高级筛选激活状态
    this.updateFilterActiveState(normalized);
    this.setData(
      {
        advancedFilters: normalized,
        pendingAdvancedFilters: normalized,
        filterPanelVisible: false,
        filterPreviewCount: count,
        filterPreviewLoading: false,
      },
      () => {
        this.applyFilters();
      }
    );
  },
  onFilterReset() {
    const defaults = getDefaultAdvancedFilters();
    const count = this.calculatePreviewCount(defaults);
    // P1-1: 重置时清除激活状态
    this.updateFilterActiveState(defaults);
    this.setData({
      pendingAdvancedFilters: defaults,
      filterPreviewCount: count,
      filterPreviewLoading: false,
    });
  },
  onFilterClose() {
    const normalized = normalizeAdvancedFilters(this.data.advancedFilters);
    this.setData({
      filterPanelVisible: false,
      pendingAdvancedFilters: normalized,
      filterPreviewCount: this.data.displayPatients.length,
      filterPreviewLoading: false,
    });
  },
  onFilterDiagnosisSearch(event) {
    const keywordRaw = event && event.detail ? event.detail.keyword : '';
    const keyword = safeString(keywordRaw).toLowerCase();
    const allOptions = this.data.filterAllDiagnosisOptions || [];
    if (!keyword) {
      this.setData({ filterDiagnosisOptions: allOptions.slice(0, 12) });
      return;
    }
    const filtered = allOptions.filter(option =>
      safeString(option.label).toLowerCase().includes(keyword)
    );
    this.setData({ filterDiagnosisOptions: filtered.slice(0, 12) });
  },
  onFilterDiagnosisSelect() {
    // 暂无额外处理，保留当前建议列表
  },
  updateFilterOptions(patients = []) {
    const source = Array.isArray(patients) ? patients : [];
    const applied = normalizeAdvancedFilters(this.data.advancedFilters);
    const pending = normalizeAdvancedFilters(this.data.pendingAdvancedFilters);
    const schemeFilters = Array.isArray(this.data.filterSchemes)
      ? this.data.filterSchemes.map(item => item && item.filters)
      : [];
    const baseHospitalOptions = deriveHospitalOptions(source);
    const hospitalSelectedSet = new Set([
      ...ensureArrayValue(applied.hospitals),
      ...ensureArrayValue(pending.hospitals),
    ]);
    schemeFilters.forEach(filters => {
      ensureArrayValue(filters && filters.hospitals).forEach(value => {
        hospitalSelectedSet.add(value);
      });
    });
    const hospitalSelected = Array.from(hospitalSelectedSet);
    const hospitalOptions = mergeSelectedIntoOptions(baseHospitalOptions, hospitalSelected);
    const baseDiagnosisOptions = deriveDiagnosisOptions(source);
    const diagnosisSelectedSet = new Set([
      ...ensureArrayValue(applied.diagnosis),
      ...ensureArrayValue(pending.diagnosis),
    ]);
    schemeFilters.forEach(filters => {
      ensureArrayValue(filters && filters.diagnosis).forEach(value => {
        diagnosisSelectedSet.add(value);
      });
    });
    const diagnosisSelected = Array.from(diagnosisSelectedSet);
    const diagnosisOptionsAll = mergeSelectedIntoOptions(baseDiagnosisOptions, diagnosisSelected);
    const genderValues = new Set();
    const ethnicityValues = new Set();
    const nativePlaceValues = new Set();
    const doctorValues = new Set();
    const ageBucketValues = new Set();
    source.forEach(patient => {
      const genderLabel = mapGenderLabel(patient.gender || patient.genderLabel);
      if (genderLabel) {
        genderValues.add(genderLabel);
      }
      const ethnicityValue = safeString(patient.ethnicity);
      if (ethnicityValue) {
        ethnicityValues.add(ethnicityValue);
      }
      const nativePlaceValue = safeString(patient.nativePlace);
      if (nativePlaceValue) {
        nativePlaceValues.add(nativePlaceValue);
      }
      const latestDoctorValue = safeString(patient.latestDoctor);
      if (latestDoctorValue) {
        doctorValues.add(latestDoctorValue);
      }
      const firstDoctorValue = safeString(patient.firstDoctor);
      if (firstDoctorValue) {
        doctorValues.add(firstDoctorValue);
      }
      const bucketId = safeString(patient.ageBucketId);
      if (bucketId) {
        ageBucketValues.add(bucketId);
      }
    });
    const genderSelectedSet = new Set([
      ...ensureArrayValue(applied.genders),
      ...ensureArrayValue(pending.genders),
    ]);
    const ethnicitySelectedSet = new Set([
      ...ensureArrayValue(applied.ethnicities),
      ...ensureArrayValue(pending.ethnicities),
    ]);
    const nativePlaceSelectedSet = new Set([
      ...ensureArrayValue(applied.nativePlaces),
      ...ensureArrayValue(pending.nativePlaces),
    ]);
    const ageSelectedSet = new Set([
      ...ensureArrayValue(applied.ageRanges),
      ...ensureArrayValue(pending.ageRanges),
    ]);
    const doctorSelectedSet = new Set([
      ...ensureArrayValue(applied.doctors),
      ...ensureArrayValue(pending.doctors),
    ]);
    schemeFilters.forEach(filters => {
      ensureArrayValue(filters && filters.genders).forEach(value => genderSelectedSet.add(value));
      ensureArrayValue(filters && filters.ethnicities).forEach(value =>
        ethnicitySelectedSet.add(value)
      );
      ensureArrayValue(filters && filters.nativePlaces).forEach(value =>
        nativePlaceSelectedSet.add(value)
      );
      ensureArrayValue(filters && filters.ageRanges).forEach(value => ageSelectedSet.add(value));
      ensureArrayValue(filters && filters.doctors).forEach(value => doctorSelectedSet.add(value));
    });
    genderSelectedSet.forEach(value => genderValues.add(safeString(value)));
    ethnicitySelectedSet.forEach(value => ethnicityValues.add(safeString(value)));
    nativePlaceSelectedSet.forEach(value => nativePlaceValues.add(safeString(value)));
    ageSelectedSet.forEach(value => ageBucketValues.add(safeString(value)));
    doctorSelectedSet.forEach(value => doctorValues.add(safeString(value)));
    const genderOptions = mergeSelectedIntoOptions(
      createOptionsFromSet(Array.from(genderValues)),
      Array.from(genderSelectedSet)
    );
    const ethnicityOptions = mergeSelectedIntoOptions(
      createOptionsFromSet(Array.from(ethnicityValues)),
      Array.from(ethnicitySelectedSet)
    );
    const nativePlaceOptions = mergeSelectedIntoOptions(
      createOptionsFromSet(Array.from(nativePlaceValues)),
      Array.from(nativePlaceSelectedSet)
    );
    const doctorOptions = mergeSelectedIntoOptions(
      createOptionsFromSet(Array.from(doctorValues)),
      Array.from(doctorSelectedSet)
    );
    const ageOptionsBase = AGE_BUCKETS.map(bucket => ({ id: bucket.id, label: bucket.label }));
    const ageOptions = mergeSelectedIntoOptions(ageOptionsBase, Array.from(ageSelectedSet));
    this.setData({
      filterHospitalOptions: Array.isArray(hospitalOptions) ? hospitalOptions : [],
      filterDiagnosisOptions: Array.isArray(diagnosisOptionsAll)
        ? diagnosisOptionsAll.slice(0, 12)
        : [],
      filterAllDiagnosisOptions: Array.isArray(diagnosisOptionsAll) ? diagnosisOptionsAll : [],
      filterGenderOptions: Array.isArray(genderOptions) ? genderOptions : [],
      filterEthnicityOptions: Array.isArray(ethnicityOptions) ? ethnicityOptions : [],
      filterNativePlaceOptions: Array.isArray(nativePlaceOptions) ? nativePlaceOptions : [],
      filterDoctorOptions: Array.isArray(doctorOptions) ? doctorOptions : [],
      filterAgeRangeOptions: Array.isArray(ageOptions) ? ageOptions : [],
    });
  },
  onFilterSaveScheme() {
    const normalized = canonicalizeSchemeFilters(this.data.pendingAdvancedFilters);
    const fingerprint = schemeFingerprint(normalized);
    const schemes = Array.isArray(this.data.filterSchemes) ? this.data.filterSchemes.slice() : [];

    if (schemes.some(scheme => scheme.fingerprint === fingerprint)) {
      wx.showToast({ icon: 'none', title: '已保存相同方案' });
      return;
    }

    // P1-2: 方案数量上限提示优化
    if (schemes.length >= 5) {
      wx.showModal({
        title: '方案已达上限',
        content: '最多可保存5个筛选方案,请先删除旧方案后再保存新方案',
        showCancel: false,
        confirmText: '知道了',
      });
      return;
    }

    const now = Date.now();
    const summary = summarizeFiltersForScheme(normalized);
    const name = `方案 ${now.toString().slice(-4)}`;
    const scheme = {
      id: `${now}`,
      name,
      summary,
      fingerprint,
      filters: normalized,
    };
    const nextSchemes = [scheme, ...schemes].slice(0, 5);
    this.saveFilterSchemes(nextSchemes);
    wx.showToast({ icon: 'success', title: '已保存方案' });
    this.updateFilterOptions(this.data.patients || []);
  },
  onFilterApplyScheme(event) {
    const schemeId = event && event.detail ? event.detail.id : '';
    const target = (this.data.filterSchemes || []).find(item => item && item.id === schemeId);
    if (!target) {
      wx.showToast({ icon: 'none', title: '方案不存在' });
      return;
    }
    this.onFilterApply({ detail: { value: target.filters } });
  },
  onFilterDeleteScheme(event) {
    const schemeId = event && event.detail ? event.detail.id : '';
    const schemes = Array.isArray(this.data.filterSchemes) ? this.data.filterSchemes.slice() : [];
    const nextSchemes = schemes.filter(item => item && item.id !== schemeId);
    this.saveFilterSchemes(nextSchemes);
    wx.showToast({ icon: 'none', title: '已删除方案' });
    this.updateFilterOptions(this.data.patients || []);
  },
  onFilterRenameScheme(event) {
    const schemeId = event && event.detail ? event.detail.id : '';
    if (!schemeId) {
      wx.showToast({ icon: 'none', title: '方案不存在' });
      return;
    }
    const schemes = Array.isArray(this.data.filterSchemes) ? this.data.filterSchemes.slice() : [];
    const index = schemes.findIndex(item => item && item.id === schemeId);
    if (index === -1) {
      wx.showToast({ icon: 'none', title: '方案不存在' });
      return;
    }
    const target = schemes[index];
    const showRenameModal = () => {
      wx.showModal({
        title: '重命名方案',
        editable: true,
        placeholderText: '输入方案名称',
        initialValue: target.name || '',
        confirmText: '保存',
        success: res => {
          if (!res.confirm) {
            return;
          }
          const nextName = safeString(res.content || '').slice(0, 20);
          if (!nextName) {
            wx.showToast({ icon: 'none', title: '名称不能为空' });
            return;
          }
          schemes[index] = {
            ...target,
            name: nextName,
            summary: summarizeFiltersForScheme(target.filters),
          };
          this.saveFilterSchemes(schemes);
          wx.showToast({ icon: 'success', title: '已重命名' });
        },
      });
    };
    if (typeof wx.showModal === 'function') {
      try {
        showRenameModal();
      } catch (error) {
        logger.warn('rename scheme modal failed', error);
        wx.showToast({ icon: 'none', title: '当前环境不支持重命名' });
      }
    } else {
      wx.showToast({ icon: 'none', title: '当前环境不支持重命名' });
    }
  },
  loadFilterSchemes() {
    const schemes = loadSchemesFromStorage();
    this.setData({ filterSchemes: Array.isArray(schemes) ? schemes : [] });
  },
  saveFilterSchemes(schemes) {
    const normalized = (schemes || [])
      .map(item => {
        const filters = canonicalizeSchemeFilters(item.filters);
        return {
          id: item.id,
          name: item.name || `方案 ${item.id.toString().slice(-4)}`,
          summary: item.summary || summarizeFiltersForScheme(filters),
          fingerprint: schemeFingerprint(filters),
          filters,
        };
      })
      .slice(0, 5);
    persistSchemesToStorage(normalized);
    this.setData({ filterSchemes: normalized });
  },
  resolvePatientKey(patientLike) {
    if (!patientLike) {
      return '';
    }
    if (typeof patientLike === 'string') {
      return patientLike;
    }
    return (
      patientLike.patientKey || patientLike.key || patientLike.recordKey || patientLike.id || ''
    );
  },
  markPatientDeletedFlag(patientKey) {
    const key = this.resolvePatientKey(patientKey);
    if (!key) {
      return;
    }
    try {
      wx.setStorageSync(PATIENT_LIST_DIRTY_KEY, {
        timestamp: Date.now(),
        patientKey: key,
        deleted: true,
      });
    } catch (error) {
      // ignore storage failure
    }

    try {
      wx.removeStorageSync(PATIENT_CACHE_KEY);
    } catch (error) {
      // ignore cache removal failure
    }
  },
  onSearchInput(event) {
    const value = (event.detail && event.detail.value) || '';
    this.setData({ searchKeyword: value }, () => {
      this.applyFilters();
    });
    if (!value) {
      this.setData({ searchSuggestions: [], searchLoading: false });
    }
  },
  // P0-1: 优化搜索建议 - 本地缓存 + 防抖
  async onSearchSuggest(event) {
    const keyword = (event.detail && event.detail.value) || '';
    if (!keyword) {
      this.setData({ searchSuggestions: [], searchLoading: false });
      return;
    }

    // 立即更新UI - 优先使用本地缓存
    const localSuggestions = this.getLocalSuggestions(keyword);
    if (localSuggestions.length > 0) {
      this.setData({ searchSuggestions: localSuggestions });
    }

    // 清除之前的防抖定时器
    if (this.suggestTimer) {
      clearTimeout(this.suggestTimer);
      this.suggestTimer = null;
    }

    // 防抖后调用云函数(如果有)或使用本地数据
    this.suggestTimer = setTimeout(async () => {
      this.setData({ searchLoading: true });
      try {
        const suggestions = await this.fetchSearchSuggestions(keyword);
        this.setData({ searchSuggestions: suggestions, searchLoading: false });
      } catch (error) {
        logger.warn('fetchSearchSuggestions failed', error);
        this.setData({ searchSuggestions: [], searchLoading: false });
      }
    }, SUGGEST_DEBOUNCE_TIME);
  },

  // P0-1: 本地快速搜索建议
  getLocalSuggestions(keyword) {
    const trimmed = safeString(keyword);
    if (!trimmed || trimmed.length < MIN_SUGGESTION_LENGTH) {
      return [];
    }

    const lowerKeyword = trimmed.toLowerCase();
    const patients = Array.isArray(this.data.patients) ? this.data.patients : [];
    const suggestions = new Set();

    patients.forEach(patient => {
      if (!patient || suggestions.size >= MAX_SUGGESTIONS) {
        return;
      }

      const candidates = [
        patient.patientName,
        patient.档案号,
        patient.latestHospital,
        patient.latestDiagnosis,
      ];

      candidates.forEach(item => {
        if (suggestions.size >= MAX_SUGGESTIONS) {
          return;
        }
        const text = safeString(item);
        if (text && text.toLowerCase().includes(lowerKeyword)) {
          suggestions.add(text);
        }
      });
    });

    return Array.from(suggestions);
  },
  async fetchSearchSuggestions(keyword) {
    const trimmed = safeString(keyword);
    if (!trimmed || trimmed.length < MIN_SUGGESTION_LENGTH) {
      return [];
    }
    const lowerKeyword = trimmed.toLowerCase();
    const patients = Array.isArray(this.data.patients) ? this.data.patients : [];
    const suggestions = new Set();
    patients.forEach(patient => {
      if (!patient) {
        return;
      }
      const candidates = [
        patient.patientName,
        patient.patientNo,
        patient.firstDiagnosis,
        patient.latestDiagnosis,
        patient.firstHospital,
        patient.latestHospital,
        patient.latestDoctor,
      ];
      candidates.forEach(item => {
        const text = safeString(item);
        if (text && text.toLowerCase().includes(lowerKeyword)) {
          suggestions.add(text);
        }
      });
    });
    return Array.from(suggestions).slice(0, MAX_SUGGESTIONS);
  },
  onSearchSubmit(event) {
    const value = (event.detail && event.detail.value) || '';
    this.setData(
      {
        searchKeyword: value,
        searchSuggestions: [],
        searchLoading: false,
      },
      () => {
        this.applyFilters();
      }
    );
  },
  onSearchClear() {
    if (!this.data.searchKeyword && !this.data.searchSuggestions.length) {
      return;
    }
    this.setData(
      {
        searchKeyword: '',
        searchSuggestions: [],
        searchLoading: false,
      },
      () => {
        this.applyFilters();
      }
    );
  },
  // 快速筛选器已移除 - 功能已整合至统计卡片(onStatFilterTap)
  onToggleAdvancedFilter() {
    const normalized = normalizeAdvancedFilters(this.data.advancedFilters);
    const count = this.calculatePreviewCount(normalized);
    this.setData({
      filterPanelVisible: true,
      pendingAdvancedFilters: normalized,
      filterPreviewCount: count,
      filterPreviewLoading: false,
    });
  },
  onSortChange(event) {
    const sortIndex = Number(event.detail.value) || 0;
    this.setData({ sortIndex }, () => {
      this.applyFilters();
    });
  },
  // 多选模式开关
  onToggleBatchMode() {
    if (this.data.batchMode) {
      this.exitBatchMode();
    } else {
      this.setData(
        { batchMode: true, fabExpanded: false, batchOperationLoading: false, batchOperationType: '' },
        () => {
        this.applyFilters();
        }
      );
    }

    if (typeof wx.vibrateShort === 'function') {
      wx.vibrateShort({ type: 'light' });
    }
  },
  async onPullDownRefresh() {
    if (typeof wx.showNavigationBarLoading === 'function') {
      wx.showNavigationBarLoading();
    }
    try {
      await this.fetchPatients({ silent: false, page: 0 });
    } catch (error) {
      logger.error('pull down refresh failed', error);
      wx.showToast({ icon: 'none', title: '刷新失败，请稍后重试' });
    } finally {
      if (typeof wx.hideNavigationBarLoading === 'function') {
        wx.hideNavigationBarLoading();
      }
      if (typeof wx.stopPullDownRefresh === 'function') {
        wx.stopPullDownRefresh();
      }
    }
  },
  shrinkFabTemporarily() {
    if (!this.data.fabCompact) {
      this.setData({ fabCompact: true });
    }
    clearFabTimer(this);
    this.fabRestoreTimer = setTimeout(() => {
      this.fabRestoreTimer = null;
      if (this.data.fabCompact) {
        this.setData({ fabCompact: false });
      }
    }, FAB_SCROLL_RESTORE_DELAY);
  },
  async loadMorePatients() {
    const { hasMore, loading, loadingMore } = this.data;
    if (loading || loadingMore || !hasMore) {
      return;
    }
    const nextPage = Number.isFinite(this.data.nextPage)
      ? Number(this.data.nextPage)
      : this.data.page + 1;
    if (!Number.isFinite(nextPage) || nextPage <= this.data.page) {
      return;
    }
    this.setData({ loadingMore: true });
    try {
      await this.fetchPatients({ silent: true, append: true, page: nextPage });
    } catch (error) {
      logger.error('load more patients failed', error);
      wx.showToast({ icon: 'none', title: '加载更多失败，请稍后重试' });
    } finally {
      this.setData({ loadingMore: false });
    }
  },
  onReachBottom() {
    this.loadMorePatients();
  },

  // P1-6: 滚动时智能隐藏/显示FAB
  onPageScroll(e) {
    const scrollTop = e.scrollTop || 0;
    const lastScrollTop = this.data.lastScrollTop || 0;
    const isScrollingDown = scrollTop > lastScrollTop;

    // 向下滚动且超过100rpx时隐藏FAB
    if (isScrollingDown && scrollTop > 100 && this.data.fabVisible) {
      this.setData({ fabVisible: false });
    }
    // 向上滚动时显示FAB
    else if (!isScrollingDown && !this.data.fabVisible) {
      this.setData({ fabVisible: true });
    }

    this.setData({ lastScrollTop: scrollTop });
  },
  onScrollToLower() {
    this.loadMorePatients();
  },
  onListScroll() {
    this.shrinkFabTemporarily();
  },
  navigateToPatient(patientLike) {
    const patient = patientLike || {};
    const profileKey = this.resolvePatientKey(patient);
    const resolvedPatientKey = patient.patientKey || patient.key || patient.recordKey || '';
    if (!profileKey) {
      return;
    }
    let url = `/pages/patient-detail/detail?key=${encodeURIComponent(profileKey)}`;
    if (resolvedPatientKey) {
      url += `&patientId=${encodeURIComponent(resolvedPatientKey)}`;
    }
    wx.navigateTo({ url });
  },
  onAnalysisTap() {
    wx.navigateTo({
      url: '/pages/analysis/index',
      events: {
        'analysis:applyFilter': shortcut => {
          this.applyAnalysisShortcut(shortcut);
        },
      },
    });
  },
  applyAnalysisShortcut(shortcut) {
    if (!shortcut || typeof shortcut !== 'object') {
      return;
    }
    if (shortcut.type === 'statFilter') {
      const filterId = shortcut.value || 'all';
      const statusLabels = {
        all: '全部住户',
        in_care: '在住住户',
        pending: '待入住 / 随访住户',
        discharged: '已离开住户',
      };
      this.setData(
        {
          activeStatFilter: filterId,
        },
        () => {
          this.applyFilters();
          const message = filterId === 'all' ? '已显示全部住户' : `已应用${statusLabels[filterId] || '状态筛选'}`;
          wx.showToast({ title: message, icon: 'none' });
        }
      );
      return;
    }
    if (shortcut.type === 'advancedFilter') {
      const payload = shortcut.value || {};
      const fields = payload.fields;
      if (!fields || typeof fields !== 'object') {
        return;
      }
      const nextFilters = getDefaultAdvancedFilters();
      Object.keys(fields).forEach(key => {
        const value = fields[key];
        if (Array.isArray(value)) {
          nextFilters[key] = value.slice();
        } else if (value && typeof value === 'object') {
          nextFilters[key] = { ...value };
        } else {
          nextFilters[key] = value;
        }
      });
      const keepStatFilter = Boolean(payload.keepStatFilter);
      this.updateFilterActiveState(nextFilters);
      this.setData(
        {
          activeStatFilter: keepStatFilter ? this.data.activeStatFilter : 'all',
          advancedFilters: nextFilters,
          pendingAdvancedFilters: nextFilters,
        },
        () => {
          this.applyFilters();
          this.updateFilterOptions(this.data.patients || []);
          const summary = payload.summary;
          if (summary) {
            wx.showToast({ title: `已应用 ${summary}`, icon: 'none' });
          }
        }
      );
    }
  },
  onCreatePatientTap() {
    if (!this.data.canCreatePatient) {
      wx.showToast({ icon: 'none', title: '暂无新增权限' });
      return;
    }
    if (this.data.batchMode) {
      wx.showToast({ icon: 'none', title: '请先退出多选模式' });
      return;
    }
    const url = '/pages/patient-intake/wizard/wizard?mode=create';
    if (this.data && this.data.testCaptureNavigation) {
      this.setData({ testLastNavigation: url });
      return;
    }
    wx.navigateTo({ url });
  },
  onRetry() {
    this.fetchPatients({ silent: false });
  },
  onPatientTap(event) {
    const detailPatient = (event.detail && event.detail.patient) || null;
    if (detailPatient) {
      if (this.data.batchMode) {
        const key = this.resolvePatientKey(detailPatient);
        if (!key) {
          return;
        }
        const map = { ...this.data.selectedPatientMap };
        if (map[key]) {
          delete map[key];
        } else {
          map[key] = detailPatient;
        }
        this.setBatchState(map, true);
        return;
      }
      this.navigateToPatient(detailPatient);
      return;
    }
    const { key, patientKey, recordKey } =
      (event.currentTarget && event.currentTarget.dataset) || {};
    if (this.data.batchMode) {
      const resolvedKey = this.resolvePatientKey({ key, patientKey, recordKey });
      if (!resolvedKey) {
        return;
      }
      const map = { ...this.data.selectedPatientMap };
      const existing = map[resolvedKey];
      const patient = this.findPatientByKey(resolvedKey) || existing || {
        key: resolvedKey,
        patientKey: patientKey || key || recordKey || resolvedKey,
        recordKey: recordKey || key || patientKey || resolvedKey,
      };
      if (existing) {
        delete map[resolvedKey];
      } else {
        map[resolvedKey] = patient;
      }
      this.setBatchState(map, true);
      return;
    }
    this.navigateToPatient({ key, patientKey, recordKey });
  },
  setBatchState(map, batchMode) {
    const nextMap = map || {};
    const selectedCount = Object.keys(nextMap).length;
    const nextMode = batchMode || selectedCount > 0;
    // 计算是否全选
    const all = this.buildFilteredPatients(this.data.patients || []);
    const allSelected =
      all.length > 0 &&
      all.every(item => {
        const key = this.resolvePatientKey(item);
        return key && nextMap[key];
      });
    this.setData(
      {
        batchMode: nextMode,
        selectedPatientMap: nextMap,
        selectedCount,
        allSelected,
        fabExpanded: nextMode ? false : this.data.fabExpanded,
        batchOperationLoading: false,
        batchOperationType: '',
      },
      () => {
        this.applyFilters();
      }
    );
  },
  enterBatchMode(patient) {
    const key = this.resolvePatientKey(patient);
    if (!key) {
      return;
    }
    const map = { ...this.data.selectedPatientMap };
    map[key] = patient;
    this.setBatchState(map, true);
  },
  exitBatchMode() {
    this.setBatchState({}, false);
  },
  handleBatchSelectAll() {
    const currentMap = this.data.selectedPatientMap || {};
    const all = this.buildFilteredPatients(this.data.patients || []);
    const allSelected =
      all.length > 0 &&
      all.every(item => {
        const key = this.resolvePatientKey(item);
        return key && currentMap[key];
      });
    if (allSelected) {
      // 当前已全选,执行反选
      this.setBatchState({}, false);
    } else {
      // 执行全选
      const map = {};
      all.forEach(item => {
        const key = this.resolvePatientKey(item);
        if (key) {
          map[key] = item;
        }
      });
      this.setBatchState(map, true);
    }
  },
  handleBatchClear() {
    this.setBatchState({}, false);
  },
  getSelectedPatients() {
    return Object.values(this.data.selectedPatientMap || {});
  },
  findPatientByKey(key) {
    const resolvedKey = this.resolvePatientKey(key);
    if (!resolvedKey) {
      return null;
    }
    const selectedMap = this.data.selectedPatientMap || {};
    if (selectedMap[resolvedKey]) {
      return selectedMap[resolvedKey];
    }
    const sources = [];
    if (Array.isArray(this.data.displayPatients)) {
      sources.push(this.data.displayPatients);
    }
    if (Array.isArray(this.data.patients)) {
      sources.push(this.data.patients);
    }
    for (const list of sources) {
      const match = list.find(item => this.resolvePatientKey(item) === resolvedKey);
      if (match) {
        return match;
      }
    }
    return null;
  },
  onBatchToggleSelectAll() {
    this.handleBatchSelectAll();
  },
  async onBatchExportTap() {
    if (this.data.batchOperationLoading) {
      return;
    }
    const patients = this.getSelectedPatients();
    if (!patients.length) {
      wx.showToast({ icon: 'none', title: '请先选择住户' });
      return;
    }
    this.setData({ batchOperationLoading: true, batchOperationType: 'export' });
    try {
      await this.exportPatients(patients);
    } finally {
      this.setData({ batchOperationLoading: false, batchOperationType: '' });
    }
  },
  onBatchStatusTap() {
    if (this.data.batchOperationLoading) {
      return;
    }
    const patients = this.getSelectedPatients();
    if (!patients.length) {
      wx.showToast({ icon: 'none', title: '请先选择住户' });
      return;
    }
    const keys = patients
      .map(item => this.resolvePatientKey(item))
      .filter(key => !!key);
    if (!keys.length) {
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      return;
    }
    this.openStatusDialog(patients[0], {
      batchKeys: keys,
      referencePatient: patients[0],
    });
  },
  async onBatchDeleteTap() {
    if (this.data.batchOperationLoading) {
      return;
    }
    const patients = this.getSelectedPatients();
    if (!patients.length) {
      wx.showToast({ icon: 'none', title: '请先选择住户' });
      return;
    }

    const displayNames = patients
      .slice(0, 3)
      .map(item => safeString(item.patientName || item.name || ''))
      .filter(Boolean)
      .join('、');
    const extraCount = patients.length - 3;
    const confirmText = displayNames
      ? extraCount > 0
        ? `「${displayNames}」等 ${patients.length} 位住户`
        : `「${displayNames}」`
      : `${patients.length} 位住户`;

    try {
      const confirmRes = await wx.showModal({
        title: '确认批量删除',
        content: `删除${confirmText}后将移除档案及附件，且不可恢复，是否继续？`,
        confirmText: '删除',
        cancelText: '取消',
        confirmColor: '#e64340',
      });
      if (!confirmRes.confirm) {
        wx.showToast({ icon: 'none', title: '已取消' });
        return;
      }
    } catch (error) {
      wx.showToast({ icon: 'none', title: '操作已取消' });
      return;
    }

    this.setData({ batchOperationLoading: true, batchOperationType: 'delete' });
    wx.showLoading({ title: '批量删除中…', mask: true });

    const successKeys = [];
    const failedItems = [];

    for (const patient of patients) {
      const patientKey = this.resolvePatientKey(patient);
      if (!patientKey) {
        failedItems.push({ patient, error: new Error('缺少住户标识') });
        continue;
      }
      const recordKey = safeString(patient.recordKey || patient.key || patient.patientKey || '');
      try {
        const res = await wx.cloud.callFunction({
          name: 'patientProfile',
          data: {
            action: 'delete',
            patientKey,
            recordKey,
          },
        });
        const result = (res && res.result) || {};
        if (result.success === false || result.error) {
          const errMsg =
            (result.error && (result.error.message || result.error.errMsg)) || '删除失败';
          throw new Error(errMsg);
        }
        successKeys.push(patientKey);
        this.markPatientDeletedFlag(patientKey);
      } catch (error) {
        logger.error('batch delete failed', patientKey, error);
        failedItems.push({ patient, error });
      }
    }

    wx.hideLoading();
    this.setData({ batchOperationLoading: false, batchOperationType: '' });

    if (successKeys.length) {
      this.removePatientsFromData(successKeys);
    }

    if (successKeys.length && failedItems.length === 0) {
      wx.showToast({ icon: 'success', title: `已删除${successKeys.length}位` });
      this.fetchPatients({ silent: true, forceRefresh: true, page: 0 });
      return;
    }

    if (successKeys.length && failedItems.length) {
      wx.showToast({
        icon: 'none',
        title: `成功${successKeys.length}位，失败${failedItems.length}位`,
      });
      this.fetchPatients({ silent: true, forceRefresh: true, page: 0 });
      return;
    }

    const firstError = failedItems[0] && failedItems[0].error;
    const message = safeString(
      (firstError && (firstError.message || firstError.errMsg)) || '删除失败，请稍后重试'
    );
    const toastMessage = message.length > 14 ? `${message.slice(0, 13)}...` : message;
    wx.showToast({ icon: 'none', title: toastMessage || '删除失败' });
  },
  removePatientsFromData(keys = []) {
    const normalizedKeys = keys
      .map(key => this.resolvePatientKey(key) || safeString(key))
      .filter(Boolean);
    if (!normalizedKeys.length) {
      return;
    }
    const keySet = new Set(normalizedKeys);
    const nextPatients = (this.data.patients || []).filter(
      item => !keySet.has(this.resolvePatientKey(item))
    );
    const selectedMap = { ...(this.data.selectedPatientMap || {}) };
    keySet.forEach(key => {
      if (selectedMap[key]) {
        delete selectedMap[key];
      }
    });
    const selectedCount = Object.keys(selectedMap).length;
    this.setData(
      {
        patients: nextPatients,
        selectedPatientMap: selectedMap,
        selectedCount,
        allSelected: false,
      },
      () => {
        this.applyFilters();
        this.updateFilterOptions(nextPatients);
      }
    );
  },
  onCardAction(event) {
    const { action, patient } = event.detail || {};
    if (!action || !action.id) {
      return;
    }
    if (action.id === 'more') {
      this.showPatientActionSheet(patient);
      return;
    }
    if (action.id === 'view') {
      this.navigateToPatient(patient);
      return;
    }
    this.showPatientActionSheet(patient);
  },
  showPatientActionSheet(patient, options = {}) {
    if (this.data.deletingPatientKey) {
      wx.showToast({ icon: 'none', title: '操作进行中，请稍候' });
      return;
    }
    if (this._patientActionSheetVisible) {
      return;
    }
    this._patientActionSheetVisible = true;
    const releaseActionSheetLock = () => {
      this._patientActionSheetVisible = false;
    };

    const isBatchMode = Boolean(options && options.batch && this.data.batchMode);

    if (isBatchMode) {
      const selectedPatients = this.getSelectedPatients();
      if (!selectedPatients.length) {
        wx.showToast({ icon: 'none', title: '请先选择住户' });
        releaseActionSheetLock();
        return;
      }

      const operations = [
        { id: 'batch-status', label: '批量修改状态' },
        { id: 'batch-export', label: '批量导出报告' },
        { id: 'batch-delete', label: '批量删除住户' },
      ];

      if (this.data && this.data.testCaptureActionSheet) {
        this.setData({ testLastActionSheet: operations.map(item => item.label) });
        releaseActionSheetLock();
        return;
      }

      try {
        wx.showActionSheet({
          itemList: operations.map(item => item.label),
          success: res => {
            const operation = operations[res.tapIndex];
            if (!operation) {
              return;
            }
            switch (operation.id) {
              case 'batch-status':
                this.onBatchStatusTap();
                break;
              case 'batch-export':
                this.onBatchExportTap();
                break;
              case 'batch-delete':
                this.onBatchDeleteTap();
                break;
              default:
                break;
            }
          },
          complete: () => {
            releaseActionSheetLock();
          },
        });
      } catch (error) {
        releaseActionSheetLock();
        throw error;
      }
      return;
    }

    const canCheckIn = patient && patient.careStatus !== 'in_care';
    const canCheckout = patient && patient.careStatus === 'in_care';
    const operations = [];
    if (canCheckIn) {
      operations.push({ id: 'intake', label: '入住' });
    }
    operations.push({ id: 'detail', label: '详情' });
    if (canCheckout) {
      operations.push({ id: 'checkout', label: '离开' });
    }
    operations.push({ id: 'status', label: '修改状态' });
    operations.push({ id: 'export', label: '导出报告' });
    operations.push({ id: 'delete', label: '删除住户' });
    if (!operations.length) {
      releaseActionSheetLock();
      return;
    }
    if (this.data && this.data.testCaptureActionSheet) {
      this.setData({ testLastActionSheet: operations.map(item => item.label) });
      releaseActionSheetLock();
      return;
    }
    try {
      wx.showActionSheet({
        itemList: operations.map(item => item.label),
        success: res => {
          const operation = operations[res.tapIndex];
          if (!operation) {
            return;
          }
          switch (operation.id) {
            case 'intake':
              this.startIntakeForPatient(patient);
              break;
            case 'detail':
              this.navigateToPatient(patient);
              break;
            case 'checkout':
              this.handlePatientCheckout(patient);
              break;
            case 'status':
              this.openStatusDialog(patient);
              break;
            case 'export':
              this.handleExportReport(patient);
              break;
            case 'delete':
              this.handleDeletePatient(patient);
              break;
          }
        },
        complete: () => {
          releaseActionSheetLock();
        },
      });
    } catch (error) {
      releaseActionSheetLock();
      throw error;
    }
  },
  openStatusDialog(patient, options = {}) {
    if (this.data.statusDialogVisible || this.data.statusDialogSubmitting) {
      return;
    }
    const batchKeys = Array.isArray(options.batchKeys)
      ? options.batchKeys.map(key => safeString(key)).filter(Boolean)
      : [];
    const isBatch = batchKeys.length > 0;
    const referencePatient = options.referencePatient || patient || {};

    const nextPatient = {
      patientKey: this.resolvePatientKey(referencePatient),
      patientName: safeString(
        (referencePatient && (referencePatient.patientName || referencePatient.name)) || ''
      ),
      careStatus: safeString(referencePatient && referencePatient.careStatus) || 'pending',
    };

    if (!isBatch && !nextPatient.patientKey) {
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      return;
    }

    const dialogSummary = isBatch
      ? {
          patientName: nextPatient.patientName || '多位住户',
          careStatus: '',
          isBatch: true,
          batchCount: batchKeys.length,
        }
      : nextPatient;

    this.setData({
      statusDialogVisible: true,
      statusDialogSubmitting: false,
      statusDialogPatient: dialogSummary,
      statusDialogBatchKeys: batchKeys,
      statusDialogForm: {
        value: dialogSummary.careStatus,
        note: '',
      },
    });
  },
  onStatusDialogClose() {
    if (this.data.statusDialogSubmitting) {
      return;
    }
    this.resetStatusDialog();
  },
  onStatusOptionSelect(event) {
    if (this.data.statusDialogSubmitting) {
      return;
    }
    const value =
      (event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.value) ||
      '';
    if (!value) {
      return;
    }
    this.setData({ 'statusDialogForm.value': value });
  },
  onStatusNoteInput(event) {
    const value = (event.detail && event.detail.value) || '';
    this.setData({ 'statusDialogForm.note': value });
  },
  onStatusDialogCancel() {
    if (this.data.statusDialogSubmitting) {
      return;
    }
    this.resetStatusDialog();
  },
  async onStatusDialogConfirm() {
    if (this.data.statusDialogSubmitting) {
      return;
    }

    const formValue = safeString(this.data.statusDialogForm && this.data.statusDialogForm.value);
    if (!formValue) {
      wx.showToast({ icon: 'none', title: '请选择状态' });
      return;
    }

    const note = safeString(this.data.statusDialogForm && this.data.statusDialogForm.note);
    const batchKeys = Array.isArray(this.data.statusDialogBatchKeys)
      ? this.data.statusDialogBatchKeys
      : [];
    const isBatch = batchKeys.length > 0;

    let targetKeys = batchKeys;
    if (!isBatch) {
      const patient = this.data.statusDialogPatient || {};
      const patientKey = this.resolvePatientKey(patient);
      if (!patientKey) {
        wx.showToast({ icon: 'none', title: '缺少住户标识' });
        this.resetStatusDialog();
        return;
      }
      targetKeys = [patientKey];
    }

    this.setData({ statusDialogSubmitting: true });
    wx.showLoading({ title: isBatch ? '批量处理中…' : '处理中', mask: true });

    const results = [];

    for (const key of targetKeys) {
      try {
        const payload = await callPatientIntake('updateCareStatus', {
          patientKey: key,
          status: formValue,
          note,
        });
        results.push({ key, payload, success: true });
      } catch (error) {
        logger.error('updateCareStatus failed', error);
        results.push({ key, error, success: false });
      }
    }

    wx.hideLoading();
    this.setData({ statusDialogSubmitting: false });
    this.resetStatusDialog();

    const successItems = results.filter(item => item.success);
    const failedItems = results.filter(item => !item.success);

    successItems.forEach(item => {
      const payload = item.payload || {};
      this.applyStatusChangeResult(item.key, {
        careStatus: formValue,
        note,
        checkoutAt: payload && Number(payload.checkoutAt) ? Number(payload.checkoutAt) : null,
        statusAdjustedAt:
          payload && Number(payload.statusAdjustedAt)
            ? Number(payload.statusAdjustedAt)
            : Date.now(),
      });
    });

    if (successItems.length && failedItems.length === 0) {
      if (isBatch) {
        wx.showToast({ icon: 'success', title: `已更新${successItems.length}位` });
      } else {
        wx.showToast({ icon: 'success', title: '已更新' });
      }
      return;
    }

    if (successItems.length && failedItems.length) {
      wx.showToast({
        icon: 'none',
        title: `成功${successItems.length}位，失败${failedItems.length}位`,
      });
      return;
    }

    const firstError = failedItems[0] && failedItems[0].error;
    const message = safeString(
      (firstError && (firstError.message || firstError.errMsg)) || '更新失败，请稍后重试'
    );
    const toastMessage = message.length > 14 ? `${message.slice(0, 13)}...` : message;
    wx.showToast({ icon: 'none', title: toastMessage || '更新失败' });
  },
  resetStatusDialog() {
    this.setData({
      statusDialogVisible: false,
      statusDialogSubmitting: false,
      statusDialogForm: {
        value: '',
        note: '',
      },
      statusDialogPatient: null,
      statusDialogBatchKeys: [],
    });
  },
  startIntakeForPatient(patient) {
    const key = this.resolvePatientKey(patient);
    if (!key) {
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      return;
    }
    const patientId = patient.patientKey || patient.key || key;
    const recordKey = patient.recordKey || key;
    let url = `/pages/patient-intake/wizard/wizard?patientKey=${encodeURIComponent(patientId)}`;
    if (recordKey && recordKey !== patientId) {
      url += `&recordKey=${encodeURIComponent(recordKey)}`;
    }
    if (this.data && this.data.testCaptureNavigation) {
      this.setData({ testLastNavigation: url });
      return;
    }
    wx.navigateTo({ url });
  },
  handlePatientCheckout(patient) {
    if (this.data.checkoutDialogVisible || this.data.checkoutSubmitting) {
      return;
    }
    const key = this.resolvePatientKey(patient);
    if (!key) {
      if (this.data && this.data.testCaptureToast) {
        this.setData({ testLastToast: '缺少住户标识' });
      }
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      return;
    }
    const targetPatient = {
      patientKey: key,
      patientName: safeString((patient && (patient.patientName || patient.name)) || ''),
      admissionCount: Number((patient && patient.admissionCount) || 0) || 0,
      latestAdmissionTimestamp: Number((patient && patient.latestAdmissionTimestamp) || 0) || 0,
      careStatus: patient && patient.careStatus,
    };
    const now = Date.now();
    const defaultDate = formatDate(now);
    const defaultTime = formatTimeString(now);
    this.setData({
      checkoutDialogVisible: true,
      checkoutPatient: targetPatient,
      checkoutForm: {
        reason: '',
        note: '',
        timestamp: now,
        date: defaultDate,
        time: defaultTime,
        dateTimeDisplay: formatDateTime(now),
      },
      checkoutErrors: {},
    });
  },
  onCheckoutDialogClose() {
    if (this.data.checkoutSubmitting) {
      return;
    }
    this.resetCheckoutDialog();
  },
  onCheckoutDialogCancel() {
    if (this.data.checkoutSubmitting) {
      return;
    }
    this.resetCheckoutDialog();
  },
  onCheckoutConfirmTap() {
    this.submitCheckout();
  },
  updateCheckoutDateTime(changes = {}) {
    const currentForm = this.data.checkoutForm || {};
    const nextDate = changes.date !== undefined ? changes.date : currentForm.date;
    const nextTime = changes.time !== undefined ? changes.time : currentForm.time;
    const combinedTimestamp = buildTimestampFromDateTime(nextDate, nextTime);
    const fallbackTimestamp = Number.isFinite(currentForm.timestamp)
      ? currentForm.timestamp
      : Date.now();
    const finalTimestamp = Number.isFinite(combinedTimestamp)
      ? combinedTimestamp
      : fallbackTimestamp;
    this.setData({
      'checkoutForm.date': nextDate,
      'checkoutForm.time': nextTime,
      'checkoutForm.timestamp': finalTimestamp,
      'checkoutForm.dateTimeDisplay': finalTimestamp ? formatDateTime(finalTimestamp) : '',
    });
  },
  onCheckoutDateChange(event) {
    if (this.data.checkoutSubmitting) {
      return;
    }
    const value = (event && event.detail && event.detail.value) || '';
    this.updateCheckoutDateTime({ date: value });
  },
  onCheckoutTimeChange(event) {
    if (this.data.checkoutSubmitting) {
      return;
    }
    const value = (event && event.detail && event.detail.value) || '';
    this.updateCheckoutDateTime({ time: value });
  },
  onCheckoutReasonInput(event) {
    const value = (event.detail && event.detail.value) || '';
    this.setData({ 'checkoutForm.reason': value });
  },
  onCheckoutNoteInput(event) {
    const value = (event.detail && event.detail.value) || '';
    this.setData({ 'checkoutForm.note': value });
  },
  async submitCheckout() {
    if (this.data.checkoutSubmitting) {
      return;
    }
    const context = this.data.checkoutPatient || {};
    const patientKey = this.resolvePatientKey(context);
    if (!patientKey) {
      if (this.data && this.data.testCaptureToast) {
        this.setData({ testLastToast: '缺少住户标识' });
      }
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      this.resetCheckoutDialog();
      return;
    }
    const reason = safeString((this.data.checkoutForm && this.data.checkoutForm.reason) || '');
    const note = safeString((this.data.checkoutForm && this.data.checkoutForm.note) || '');
    const rawTimestamp = Number(this.data.checkoutForm && this.data.checkoutForm.timestamp);
    const effectiveTimestamp = Number.isFinite(rawTimestamp) ? rawTimestamp : Date.now();
    this.setData({ checkoutSubmitting: true });
    wx.showLoading({ title: '办理中', mask: true });
    let checkoutData = null;
    try {
      checkoutData = await callPatientIntake('checkoutPatient', {
        patientKey,
        checkout: {
          reason,
          note,
          timestamp: effectiveTimestamp,
        },
      });
    } catch (error) {
      wx.hideLoading();
      this.setData({ checkoutSubmitting: false });
      logger.error('checkoutPatient failed', error);
      const message = safeString(
        (error && (error.message || error.errMsg)) || '办理失败，请稍后再试'
      );
      const toastMessage = message.length > 14 ? `${message.slice(0, 13)}...` : message;
      if (this.data && this.data.testCaptureToast) {
        this.setData({ testLastToast: toastMessage || '办理失败' });
      }
      wx.showToast({ icon: 'none', title: toastMessage || '办理失败' });
      return;
    }
    wx.hideLoading();
    this.setData({ checkoutSubmitting: false });
    if (this.data && this.data.testCaptureToast) {
      this.setData({ testLastToast: '已办理' });
    }
    wx.showToast({ icon: 'success', title: '已办理' });
    this.resetCheckoutDialog();
    const checkoutAt =
      checkoutData && Number(checkoutData.checkoutAt)
        ? Number(checkoutData.checkoutAt)
        : Date.now();
    this.applyCheckoutResult(patientKey, {
      reason,
      note,
      checkoutAt,
    });
  },
  resetCheckoutDialog() {
    this.setData({
      checkoutDialogVisible: false,
      checkoutPatient: null,
      checkoutForm: {
        reason: '',
        note: '',
        timestamp: null,
        date: '',
        time: '',
        dateTimeDisplay: '',
      },
      checkoutErrors: {},
    });
  },
  applyCheckoutResult(patientKey, checkoutResult = {}) {
    if (!patientKey) {
      return;
    }
    const reason = safeString(checkoutResult.reason);
    const note = safeString(checkoutResult.note);
    const checkoutAt = Number(checkoutResult.checkoutAt) || Date.now();
    const patients = Array.isArray(this.data.patients) ? this.data.patients.slice() : [];
    if (!patients.length) {
      try {
        wx.removeStorageSync(PATIENT_CACHE_KEY);
      } catch (error) {
        // ignore cache removal failure
      }
      this.fetchPatients({ silent: false, forceRefresh: true, page: 0 });
      return;
    }
    const now = Date.now();
    const updatedPatients = patients.map(item => {
      const key = this.resolvePatientKey(item);
      if (!key || key !== patientKey) {
        return item;
      }
      const latestAdmissionTimestamp = Number(item.latestAdmissionTimestamp || 0) || 0;
      const diffDays =
        latestAdmissionTimestamp > 0
          ? Math.floor((now - latestAdmissionTimestamp) / (24 * 60 * 60 * 1000))
          : null;
      const riskLevel = identifyRiskLevel(diffDays);
      const careStatus = 'discharged';
      const badges = generatePatientBadges({
        careStatus,
        riskLevel,
        admissionCount: item.admissionCount,
      });
      return {
        ...item,
        careStatus,
        cardStatus: deriveCardStatus(careStatus, 'default'),
        badges,
        checkoutAt,
        checkoutReason: reason,
        checkoutNote: note,
      };
    });
    const selectedMap = { ...(this.data.selectedPatientMap || {}) };
    if (!this.data.batchMode && selectedMap[patientKey]) {
      delete selectedMap[patientKey];
    } else if (this.data.batchMode && selectedMap[patientKey]) {
      const updatedPatient = updatedPatients.find(
        item => this.resolvePatientKey(item) === patientKey
      );
      if (updatedPatient) {
        selectedMap[patientKey] = updatedPatient;
      }
    }
    const selectedCount = Object.keys(selectedMap).length;
    this.setData(
      {
        patients: updatedPatients,
        selectedPatientMap: selectedMap,
        selectedCount,
        allSelected: false,
      },
      () => {
        this.applyFilters();
        this.updateFilterOptions(updatedPatients);
      }
    );
    try {
      wx.removeStorageSync(PATIENT_CACHE_KEY);
    } catch (error) {
      // ignore cache removal failure
    }
    try {
      wx.setStorageSync(PATIENT_LIST_DIRTY_KEY, {
        timestamp: Date.now(),
        patientKey,
        updates: {
          careStatus: 'discharged',
          checkoutAt,
          checkoutReason: reason,
          checkoutNote: note,
        },
      });
    } catch (error) {
      // ignore storage failure
    }
    this.fetchPatients({ silent: true, forceRefresh: true, page: 0 });
  },
  applyStatusChangeResult(patientKey, statusResult = {}) {
    if (!patientKey) {
      return;
    }
    const patients = Array.isArray(this.data.patients) ? this.data.patients.slice() : [];
    if (!patients.length) {
      try {
        wx.removeStorageSync(PATIENT_CACHE_KEY);
      } catch (error) {
        // ignore
      }
      this.fetchPatients({ silent: false, forceRefresh: true, page: 0 });
      return;
    }
    const nextCareStatusRaw = normalizeCareStatus(statusResult.careStatus, 'pending');
    const checkoutAt = Number(statusResult.checkoutAt) || null;
    const statusAdjustedAt = Number(statusResult.statusAdjustedAt) || Date.now();
    const note = safeString(statusResult.note);
    const updatedPatients = patients.map(item => {
      const key = this.resolvePatientKey(item);
      if (!key || key !== patientKey) {
        return item;
      }
      const latestAdmissionTimestamp = Number(item.latestAdmissionTimestamp || 0) || 0;
      const derivedStatus = mapPatientStatus(latestAdmissionTimestamp);
      const diffDays = derivedStatus.diffDays;
      const riskLevel = identifyRiskLevel(diffDays);
      const careStatus = nextCareStatusRaw;
      const badges = generatePatientBadges({
        careStatus,
        riskLevel,
        admissionCount: item.admissionCount,
      });
      const nextItem = {
        ...item,
        careStatus,
        cardStatus: deriveCardStatus(careStatus, derivedStatus.cardStatus),
        badges,
        manualStatusUpdatedAt: statusAdjustedAt,
      };
      if (note) {
        nextItem.manualStatusNote = note;
      } else if (nextItem.manualStatusNote) {
        delete nextItem.manualStatusNote;
      }
      if (careStatus === 'discharged') {
        nextItem.checkoutAt = checkoutAt || statusAdjustedAt;
      } else {
        delete nextItem.checkoutAt;
        delete nextItem.checkoutReason;
        delete nextItem.checkoutNote;
      }
      return nextItem;
    });
    const selectedMap = { ...(this.data.selectedPatientMap || {}) };
    if (selectedMap[patientKey]) {
      delete selectedMap[patientKey];
    }
    const selectedCount = Object.keys(selectedMap).length;
    this.setData(
      {
        patients: updatedPatients,
        selectedPatientMap: selectedMap,
        selectedCount,
        allSelected: false,
      },
      () => {
        this.applyFilters();
        this.updateFilterOptions(updatedPatients);
      }
    );
    try {
      wx.removeStorageSync(PATIENT_CACHE_KEY);
    } catch (error) {
      // ignore
    }
    try {
      wx.setStorageSync(PATIENT_LIST_DIRTY_KEY, {
        timestamp: Date.now(),
        patientKey,
        updates: {
          careStatus: nextCareStatusRaw,
          manualStatusNote: note,
          manualStatusUpdatedAt: statusAdjustedAt,
          checkoutAt: nextCareStatusRaw === 'discharged' ? checkoutAt || statusAdjustedAt : null,
        },
      });
    } catch (error) {
      // ignore storage failure
    }
    this.fetchPatients({ silent: true, forceRefresh: true, page: 0 });
  },
  async exportPatients(patients = []) {
    const list = Array.isArray(patients) ? patients : [];
    const normalizedKeys = [];
    const snapshots = [];
    const seen = new Set();

    list.forEach(item => {
      if (!item) {
        return;
      }

      let key = '';
      let source = null;

      if (typeof item === 'string') {
        key = safeString(item);
      } else if (typeof item === 'object') {
        key = safeString(this.resolvePatientKey(item));
        source = item;
      }

      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      normalizedKeys.push(key);

      if (source) {
        const summary = source.lastIntakeNarrative || {};
        snapshots.push({
          key,
          patientKey: safeString(source.patientKey || key),
          recordKey: safeString(source.recordKey || key),
          patientName: safeString(source.patientName || source.name),
          gender: safeString(source.gender),
          genderLabel: safeString(source.genderLabel),
          birthDate: safeString(source.birthDate),
          nativePlace: safeString(source.nativePlace),
          ethnicity: safeString(source.ethnicity),
          idNumber: safeString(source.idNumber),
          latestHospital: safeString(source.latestHospital),
          firstHospital: safeString(source.firstHospital),
          latestDiagnosis: safeString(source.latestDiagnosis),
          firstDiagnosis: safeString(source.firstDiagnosis),
          latestDoctor: safeString(source.latestDoctor),
          summaryCaregivers: safeString(source.summaryCaregivers),
          caregivers: safeString(source.caregivers),
          address: safeString(source.address),
          fatherInfo: safeString(source.fatherInfo),
          motherInfo: safeString(source.motherInfo),
          otherGuardian: safeString(source.otherGuardian),
          familyEconomy: safeString(source.familyEconomy),
          latestAdmissionDate: safeString(
            source.latestAdmissionDateFormatted || source.latestAdmissionDate
          ),
          firstAdmissionDate: safeString(
            source.firstAdmissionDate || source.firstAdmissionDateFormatted
          ),
          symptoms: safeString(summary.symptoms || source.symptoms),
          treatmentProcess: safeString(summary.treatmentProcess || source.treatmentProcess),
          followUpPlan: safeString(summary.followUpPlan || source.followUpPlan),
        });
      }
    });

    const notify = message => {
      if (this.data && this.data.testCaptureToast) {
        this.setData({ testLastToast: message });
      }
      wx.showToast({ icon: 'none', title: message });
    };

    if (!normalizedKeys.length) {
      notify('请选择住户');
      return;
    }

    try {
      wx.showLoading({ title: '导出中…', mask: true });
      logger.info('[exportPatients] keys', normalizedKeys, 'snapshotCount', snapshots.length);
      const res = await wx.cloud.callFunction({
        name: 'patientProfile',
        data: {
          action: 'export',
          patientKeys: normalizedKeys,
          patientSnapshots: snapshots,
        },
      });

      const result = (res && res.result) || {};
      const fileID = result.fileID;
      if (!fileID) {
        throw new Error('缺少文件信息');
      }

      let missingMessage = '';
      if (Array.isArray(result.missingKeys) && result.missingKeys.length) {
        missingMessage = `有 ${result.missingKeys.length} 位住户缺少原始档案`;
      }

      const downloadRes = await wx.cloud.downloadFile({ fileID });
      const tempFilePath = downloadRes && downloadRes.tempFilePath;
      if (!tempFilePath) {
        throw new Error('下载文件失败');
      }

      try {
        await wx.openDocument({
          filePath: tempFilePath,
          fileType: 'xlsx',
          showMenu: true,
        });
      } catch (openError) {
        logger.error('open export document failed', openError);
        notify('已导出，可在“最近文件”查看');
      }

      if (missingMessage) {
        notify(missingMessage);
      }
    } catch (error) {
      logger.error('export patients failed', error);
      notify('导出失败，请稍后重试');
    } finally {
      if (typeof wx.hideLoading === 'function') {
        wx.hideLoading();
      }
    }
  },
  async handleExportReport(patient) {
    if (this.data.batchMode) {
      const selectedPatients = Object.values(this.data.selectedPatientMap || {});
      if (selectedPatients.length) {
        await this.exportPatients(selectedPatients);
        return;
      }
    }

    const key = this.resolvePatientKey(patient);
    if (!key) {
      if (this.data && this.data.testCaptureToast) {
        this.setData({ testLastToast: '缺少住户标识' });
      }
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      return;
    }
    await this.exportPatients([patient]);
  },
  async handleDeletePatient(patient) {
    const patientKey = this.resolvePatientKey(patient);
    if (!patientKey) {
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      return;
    }

    if (this.data.deletingPatientKey && this.data.deletingPatientKey === patientKey) {
      return;
    }

    const patientName = safeString((patient && (patient.patientName || patient.name)) || '');
    const recordKey = safeString((patient && (patient.recordKey || patient.key)) || '');

    try {
      const confirmRes = await wx.showModal({
        title: '确认删除',
        content: patientName
          ? `删除住户「${patientName}」后将移除其档案、入住记录及附件，且不可恢复。继续操作吗？`
          : '删除后将移除该住户的档案、入住记录及附件，且不可恢复。确定继续吗？',
        confirmText: '删除',
        cancelText: '取消',
        confirmColor: '#e64340',
      });
      if (!confirmRes.confirm) {
        return;
      }
    } catch (error) {
      wx.showToast({ icon: 'none', title: '操作已取消' });
      return;
    }

    wx.showLoading({ title: '删除中…', mask: true });
    this.setData({ deletingPatientKey: patientKey });

    try {
      const res = await wx.cloud.callFunction({
        name: 'patientProfile',
        data: {
          action: 'delete',
          patientKey,
          recordKey,
        },
      });

      const result = (res && res.result) || {};
      if (result.success === false || result.error) {
        const err =
          (result.error && (result.error.message || result.error.errMsg)) || '删除失败，请稍后重试';
        throw new Error(err);
      }

      this.markPatientDeletedFlag(patientKey);

      const filterByKey = list =>
        (Array.isArray(list) ? list : []).filter(
          item => this.resolvePatientKey(item) !== patientKey
        );
      const nextPatients = filterByKey(this.data.patients);

      const selectedMap = { ...(this.data.selectedPatientMap || {}) };
      if (selectedMap[patientKey]) {
        delete selectedMap[patientKey];
      }
      const selectedCount = Object.keys(selectedMap).length;

      this.setData(
        {
          patients: nextPatients,
          selectedPatientMap: selectedMap,
          selectedCount,
          allSelected: false,
        },
        () => {
          this.applyFilters();
          this.updateFilterOptions(nextPatients);
        }
      );

      wx.hideLoading();
      wx.showToast({ icon: 'success', title: '已删除' });

      this.fetchPatients({ silent: true, forceRefresh: true, page: 0 });
    } catch (error) {
      wx.hideLoading();
      logger.error('删除住户失败', error);
      const message = safeString(error && error.message) || '删除失败，请稍后重试';
      wx.showToast({ icon: 'none', title: message.slice(0, 20) });
    } finally {
      this.setData({ deletingPatientKey: '' });
    }
  },
  onCardLongPress(event) {
    // P1-5: 长按视觉反馈 - 振动反馈
    wx.vibrateShort({
      type: 'medium', // 中等强度振动
      success: () => {
        logger.debug('长按振动反馈成功');
      },
      fail: () => {
        logger.debug('振动反馈失败,设备可能不支持');
      },
    });

    const detailPatient = (event.detail && event.detail.patient) || null;
    const dataset = (event.currentTarget && event.currentTarget.dataset) || {};
    const patient = detailPatient || {
      key: dataset.key,
      patientKey: dataset.patientKey,
      recordKey: dataset.recordKey,
    };
    // 如果不在批量模式,显示操作菜单
    if (!this.data.batchMode) {
      this.showPatientActionSheet(patient);
      return;
    }
    const key = this.resolvePatientKey(patient);
    const selectedMap = this.data.selectedPatientMap || {};
    if (key && selectedMap[key]) {
      this.showPatientActionSheet(patient, { batch: true });
      return;
    }
    this.enterBatchMode(patient);
  },
  onCardSelectChange(event) {
    const detail = event.detail || {};
    const patient = detail.patient || {};
    const key = this.resolvePatientKey(patient);
    if (!key) {
      return;
    }
    const map = { ...this.data.selectedPatientMap };
    if (detail.selected) {
      map[key] = patient;
    } else {
      delete map[key];
    }
    this.setBatchState(map, this.data.batchMode || detail.selected);
  },
});
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mapGenderLabel,
    resolveAgeBucket,
    getAgeBucketLabelById,
    applyAdvancedFilters,
    AGE_BUCKETS,
  };
}
