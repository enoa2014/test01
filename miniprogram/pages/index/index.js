const logger = require('../../utils/logger');
const { formatDate, formatAge } = require('../../utils/date');

const SORT_OPTIONS = [
  { label: '默认排序', value: 'default' },
  { label: '按入院次数排序', value: 'admissionCountDesc' },
  { label: '按最近入院时间排序', value: 'latestAdmissionDesc' },
];

const PATIENT_CACHE_KEY = 'patient_list_cache';
const PATIENT_LIST_DIRTY_KEY = 'patient_list_dirty';
const PATIENT_CACHE_TTL = 5 * 60 * 1000;
const PATIENT_PAGE_SIZE = 80;
const MAX_SUGGESTIONS = 8;
const MIN_SUGGESTION_LENGTH = 2;
const FAB_SCROLL_RESTORE_DELAY = 260;

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

const QUICK_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'in_care', label: '在住' },
  { id: 'high_risk', label: '高风险' },
  { id: 'followup', label: '待随访' },
];

function createQuickFilters(activeId = 'all') {
  return QUICK_FILTERS.map(filter => ({
    ...filter,
    active: filter.id === activeId,
  }));
}

function safeString(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
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
  const dateRange = ensureDateRangeValue(filters.dateRange);
  const logicMode = filters.logicMode === 'OR' ? 'OR' : 'AND';

  const hasDate = Boolean(dateRange.start || dateRange.end);
  const hasAnyFilter =
    statuses.length || riskLevels.length || hospitals.length || diagnosis.length || hasDate;

  if (!hasAnyFilter) {
    return source;
  }

  const statusSet = new Set(statuses);
  const riskSet = new Set(riskLevels);
  const hospitalSet = new Set(hospitals);
  const diagnosisSet = new Set(diagnosis.map(item => safeString(item).toLowerCase()));
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
      return hospitalSet.has(latest) || hospitalSet.has(first);
    });
  }
  if (diagnosisSet.size) {
    checkers.push(patient => {
      const latest = safeString(patient.latestDiagnosis).toLowerCase();
      const first = safeString(patient.firstDiagnosis).toLowerCase();
      const tags = Array.isArray(patient.tags) ? patient.tags : [];
      if (diagnosisSet.has(latest) || diagnosisSet.has(first)) {
        return true;
      }
      return tags.some(tag => diagnosisSet.has(safeString(tag).toLowerCase()));
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
    parts.push(`医院:${normalized.hospitals.slice(0, 2).join('/')}${normalized.hospitals.length > 2 ? '…' : ''}`);
  }
  if (normalized.diagnosis.length) {
    parts.push(`诊断:${normalized.diagnosis.slice(0, 2).join('/')}${normalized.diagnosis.length > 2 ? '…' : ''}`);
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
  data: {
    patients: [],
    displayPatients: [],
    loading: true,
    error: '',
    searchKeyword: '',
    searchSuggestions: [],
    searchLoading: false,
    quickFilters: createQuickFilters(),
    sortOptions: SORT_OPTIONS,
    sortIndex: 0,
    skeletonPlaceholders: [0, 1, 2, 3],
    cardActions: [
      { id: 'view', label: '查看详情', type: 'primary', ghost: true },
      { id: 'remind', label: '发起提醒', type: 'default', ghost: true },
      { id: 'export', label: '导出档案', type: 'default', ghost: true },
      { id: 'intake', label: '录入入住', type: 'default', ghost: true },
    ],
    cardActionsSimplified: [
      { id: 'more', label: '更多', type: 'default', ghost: true, icon: '···' },
    ],
    batchMode: false,
    selectedPatientMap: {},
    selectedCount: 0,
    allSelected: false,
    page: 0,
    nextPage: 1,
    pageSize: PATIENT_PAGE_SIZE,
    hasMore: true,
    loadingMore: false,
    fabCompact: false,
    pageTransitionClass: 'page-transition-enter',
    filterPanelVisible: false,
    filterStatusOptions: FILTER_STATUS_OPTIONS,
    filterRiskOptions: FILTER_RISK_OPTIONS,
    filterHospitalOptions: [],
    filterDiagnosisOptions: [],
    filterAllDiagnosisOptions: [],
    filterPreviewCount: -1,
    filterPreviewLoading: false,
    filterPreviewLabel: '名患者符合筛选',
    advancedFilters: getDefaultAdvancedFilters(),
    pendingAdvancedFilters: getDefaultAdvancedFilters(),
    batchOperationLoading: false,
    filterSchemes: [],
  },

  onLoad() {
    this.fabRestoreTimer = null;
    this.pageEnterTimer = null;
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
  },

  onShow() {
    this.applyPendingUpdates();
    this.playPageEnterAnimation();
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
        let cardStatus = 'default';
        let diffDays = null;
        let careStatus = 'discharged';
        let riskLevel = 'low';
        const latestAdmissionTimestamp = Number(item.latestAdmissionTimestamp || 0);
        const importOrder = Number(item.importOrder || item.excelImportOrder || 0) || null;
        const importedAtTs = Number(item.importedAt || item._importedAt || 0);
        const importedAtFormatted = importedAtTs ? formatDate(importedAtTs) : '';
        if (latestAdmissionTimestamp > 0) {
          const now = Date.now();
          if (latestAdmissionTimestamp <= now) {
            diffDays = Math.floor((now - latestAdmissionTimestamp) / (24 * 60 * 60 * 1000));
            if (diffDays <= 30) {
              cardStatus = 'success';
              careStatus = 'in_care';
            } else if (diffDays <= 90) {
              cardStatus = 'info';
              careStatus = 'pending';
            } else {
              careStatus = 'discharged';
            }

            if (diffDays <= 7) {
              riskLevel = 'high';
            } else if (diffDays <= 30) {
              riskLevel = 'medium';
            } else {
              riskLevel = 'low';
            }
          } else {
            careStatus = 'pending';
            riskLevel = 'medium';
          }
        }
        const admissionCount = Number(item.admissionCount || 0);
        const badges = [];
        if (careStatus === 'in_care') {
          badges.push({ text: '在院', type: 'success' });
        } else if (careStatus === 'pending') {
          badges.push({ text: '随访', type: 'info' });
        }
        if (riskLevel === 'high') {
          badges.push({ text: '需复查', type: 'danger' });
        } else if (riskLevel === 'medium') {
          badges.push({ text: '定期随访', type: 'warning' });
        }
        if (admissionCount > 0) {
          badges.push({ text: `入住 ${admissionCount} 次`, type: 'default' });
        }
        let latestEvent = '';
        if (latestAdmissionDateFormatted) {
          latestEvent = `${latestAdmissionDateFormatted} · ${latestDiagnosis || '暂无诊断'}`;
        } else if (importOrder) {
          latestEvent = `Excel第${importOrder}行 · ${latestDiagnosis || '暂无诊断'}`;
        } else if (importedAtFormatted) {
          latestEvent = `${importedAtFormatted} 导入 · ${latestDiagnosis || '暂无诊断'}`;
        } else {
          latestEvent = safeString(latestDiagnosis);
        }
        const tags = [];
        if (latestHospital) {
          tags.push(latestHospital);
        }
        if (latestDoctor) {
          tags.push(latestDoctor);
        }
        if (firstDiagnosis && firstDiagnosis !== latestDiagnosis) {
          tags.push(firstDiagnosis);
        }
        if (importOrder) {
          tags.push(`Excel行 ${importOrder}`);
        }
        const key = this.resolvePatientKey(item);
        const selected = Boolean(key && selectedMap[key]);
        return {
          ...item,
          ageText: formatAge(item.birthDate),
          latestAdmissionDateFormatted,
          firstAdmissionDateFormatted,
          firstDiagnosis,
          latestDiagnosis,
          firstHospital,
          latestHospital,
          latestDoctor,
          cardStatus,
          careStatus,
          riskLevel,
          badges,
          latestEvent,
          tags,
          firstAdmissionTimestamp,
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

      const hasMore = typeof result.hasMore === 'boolean'
        ? result.hasMore
        : mappedPatients.length >= resolvedLimit;
      const nextPage = result.nextPage !== undefined ? result.nextPage : (hasMore ? page + 1 : null);

      this.setData(
        {
          patients: mergedPatients,
          loading: false,
          error: '',
          page,
          nextPage,
          pageSize: resolvedLimit,
          hasMore,
          loadingMore: false,
        },
        () => {
          this.applyFilters();
          this.updateFilterOptions(mergedPatients);
        }
      );

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

    const { patientKey, updates } = flag || {};
    if (!patientKey || !updates) {
      this.fetchPatients({ silent: false });
      return;
    }

    const mergeUpdates = (list = []) =>
      list.map(item => {
        const key = item.patientKey || item.key || item.id || item.recordKey;
        if (!key) {
          return item;
        }
        if (key === patientKey) {
          return { ...item, ...updates };
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
    const sortValue = SORT_OPTIONS[sortIndex] ? SORT_OPTIONS[sortIndex].value : 'default';

    let list = Array.isArray(source) ? source.slice() : [];

    const activeFilter = (this.data.quickFilters || []).find(item => item && item.active);
    const activeFilterId = activeFilter ? activeFilter.id : 'all';
    if (activeFilterId === 'in_care') {
      list = list.filter(item => item && item.careStatus === 'in_care');
    } else if (activeFilterId === 'high_risk') {
      list = list.filter(item => item && item.riskLevel === 'high');
    } else if (activeFilterId === 'followup') {
      list = list.filter(item => item && item.riskLevel === 'medium');
    }

    if (keyword) {
      list = list.filter(item => {
        const name = (item.patientName || '').toLowerCase();
        const firstDiagnosis = (item.firstDiagnosis || '').toLowerCase();
        const latestDiagnosis = (item.latestDiagnosis || '').toLowerCase();
        const firstHospital = (item.firstHospital || '').toLowerCase();
        const latestHospital = (item.latestHospital || '').toLowerCase();
        const latestDoctor = (item.latestDoctor || '').toLowerCase();
        return (
          name.includes(keyword) ||
          firstDiagnosis.includes(keyword) ||
          latestDiagnosis.includes(keyword) ||
          firstHospital.includes(keyword) ||
          latestHospital.includes(keyword) ||
          latestDoctor.includes(keyword)
        );
      });
    }

    const advancedFilters = options.advancedFilters || this.data.advancedFilters || getDefaultAdvancedFilters();
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

  applyFilters() {
    const filtered = this.buildFilteredPatients(this.data.patients || []);
    this.setData({
      displayPatients: filtered,
      filterPreviewCount: filtered.length,
      filterPreviewLoading: false,
    });
  },

  calculatePreviewCount(filters) {
    const normalized = normalizeAdvancedFilters(filters);
    const list = this.buildFilteredPatients(this.data.patients || [], {
      advancedFilters: normalized,
      selectedMap: this.data.selectedPatientMap || {},
    });
    return list.length;
  },

  onFilterPreview(event) {
    const value = event && event.detail ? event.detail.value : null;
    const normalized = normalizeAdvancedFilters(value);
    const count = this.calculatePreviewCount(normalized);
    this.setData({
      pendingAdvancedFilters: normalized,
      filterPreviewCount: count,
      filterPreviewLoading: false,
    });
  },

  onFilterApply(event) {
    const value = event && event.detail ? event.detail.value : null;
    const normalized = normalizeAdvancedFilters(value);
    const count = this.calculatePreviewCount(normalized);
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

    this.setData({
      filterHospitalOptions: hospitalOptions,
      filterDiagnosisOptions: diagnosisOptionsAll.slice(0, 12),
      filterAllDiagnosisOptions: diagnosisOptionsAll,
    });
  },

  onFilterSaveScheme() {
    const normalized = canonicalizeSchemeFilters(this.data.pendingAdvancedFilters);
    const fingerprint = schemeFingerprint(normalized);
    const schemes = Array.isArray(this.data.filterSchemes)
      ? this.data.filterSchemes.slice()
      : [];
    if (schemes.some(scheme => scheme.fingerprint === fingerprint)) {
      wx.showToast({ icon: 'none', title: '已保存相同方案' });
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
    const schemes = Array.isArray(this.data.filterSchemes)
      ? this.data.filterSchemes.slice()
      : [];
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
    const schemes = Array.isArray(this.data.filterSchemes)
      ? this.data.filterSchemes.slice()
      : [];
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
    this.setData({ filterSchemes: schemes });
  },

  saveFilterSchemes(schemes) {
    const normalized = (schemes || []).map(item => {
      const filters = canonicalizeSchemeFilters(item.filters);
      return {
        id: item.id,
        name: item.name || `方案 ${item.id.toString().slice(-4)}`,
        summary: item.summary || summarizeFiltersForScheme(filters),
        fingerprint: schemeFingerprint(filters),
        filters,
      };
    }).slice(0, 5);
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
      patientLike.patientKey ||
      patientLike.key ||
      patientLike.recordKey ||
      patientLike.id ||
      ''
    );
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

  async onSearchSuggest(event) {
    const keyword = (event.detail && event.detail.value) || '';
    if (!keyword) {
      this.setData({ searchSuggestions: [], searchLoading: false });
      return;
    }
    this.setData({ searchLoading: true });
    try {
      const suggestions = await this.fetchSearchSuggestions(keyword);
      this.setData({ searchSuggestions: suggestions, searchLoading: false });
    } catch (error) {
      logger.warn('fetchSearchSuggestions failed', error);
      this.setData({ searchSuggestions: [], searchLoading: false });
    }
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

  onFilterTap(event) {
    const filter = (event.detail && event.detail.filter) || {};
    const filterId = filter.id || 'all';
    this.applyQuickFilter(filterId);
  },

  applyQuickFilter(filterId = 'all') {
    const validIds = QUICK_FILTERS.map(filter => filter.id);
    const resolvedId = validIds.includes(filterId) ? filterId : 'all';
    const nextFilters = (this.data.quickFilters || createQuickFilters()).map(filter => ({
      ...filter,
      active: filter.id === resolvedId,
    }));
    this.setData({ quickFilters: nextFilters }, () => {
      this.applyFilters();
    });
  },

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

  onScrollToLower() {
    this.loadMorePatients();
  },

  onListScroll() {
    this.shrinkFabTemporarily();
  },

  navigateToPatient(patientLike) {
    const patient = patientLike || {};
    const profileKey = this.resolvePatientKey(patient);
    const resolvedPatientKey =
      patient.patientKey || patient.key || patient.recordKey || '';

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
    });
  },

  onIntakeTap() {
    wx.navigateTo({
      url: '/pages/patient-intake/select/select',
    });
  },

  onRetry() {
    this.fetchPatients({ silent: false });
  },

  onPatientTap(event) {
    const detailPatient = (event.detail && event.detail.patient) || null;
    if (detailPatient) {
      if (this.data.batchMode) {
        return;
      }
      this.navigateToPatient(detailPatient);
      return;
    }
    if (this.data.batchMode) {
      return;
    }
    const { key, patientKey, recordKey } = (event.currentTarget && event.currentTarget.dataset) || {};
    this.navigateToPatient({ key, patientKey, recordKey });
  },

  setBatchState(map, batchMode) {
    const nextMap = map || {};
    const selectedCount = Object.keys(nextMap).length;
    const nextMode = batchMode || selectedCount > 0;

    // 计算是否全选
    const all = this.buildFilteredPatients(this.data.patients || []);
    const allSelected = all.length > 0 && all.every(item => {
      const key = this.resolvePatientKey(item);
      return key && nextMap[key];
    });

    this.setData(
      {
        batchMode: nextMode,
        selectedPatientMap: nextMap,
        selectedCount,
        allSelected,
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
    const allSelected = all.length > 0 && all.every(item => {
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

  handleBatchRemind() {
    const patients = Object.values(this.data.selectedPatientMap || {});
    if (!patients.length) {
      wx.showToast({ icon: 'none', title: '请先选择患者' });
      return;
    }
    wx.showToast({ icon: 'none', title: `已发送提醒（${patients.length}）` });
  },

  handleBatchExport() {
    const patients = Object.values(this.data.selectedPatientMap || {});
    if (!patients.length) {
      wx.showToast({ icon: 'none', title: '请先选择患者' });
      return;
    }
    wx.showToast({ icon: 'none', title: `已导出档案（${patients.length}）` });
  },

  showBatchActionSheet() {
    const patients = Object.values(this.data.selectedPatientMap || {});
    if (!patients.length) {
      wx.showToast({ icon: 'none', title: '请先选择患者' });
      return;
    }

    wx.showActionSheet({
      itemList: ['批量提醒', '导出档案', '清空选择'],
      success: (res) => {
        switch (res.tapIndex) {
          case 0:
            this.handleBatchRemind();
            break;
          case 1:
            this.handleBatchExport();
            break;
          case 2:
            this.handleBatchClear();
            break;
        }
      },
    });
  },

  onCardAction(event) {
    const { action, patient } = event.detail || {};
    if (!action || !action.id) {
      return;
    }

    // 处理"更多"菜单
    if (action.id === 'more') {
      this.showPatientActionSheet(patient);
      return;
    }

    if (action.id === 'view') {
      this.navigateToPatient(patient);
      return;
    }
    if (action.id === 'remind') {
      wx.showToast({ icon: 'success', title: '已发送提醒' });
      return;
    }
    if (action.id === 'export') {
      wx.showToast({ icon: 'success', title: '导出任务已创建' });
      return;
    }
    if (action.id === 'intake') {
      wx.navigateTo({ url: '/pages/patient-intake/select/select' });
      return;
    }
    wx.showToast({ icon: 'none', title: '功能开发中' });
  },

  showPatientActionSheet(patient) {
    if (this._patientActionSheetVisible) {
      return;
    }

    this._patientActionSheetVisible = true;
    const releaseActionSheetLock = () => {
      this._patientActionSheetVisible = false;
    };

    try {
      wx.showActionSheet({
        itemList: ['查看详情', '发起提醒', '导出档案', '录入入住'],
        success: (res) => {
          switch (res.tapIndex) {
            case 0:
              this.navigateToPatient(patient);
              break;
            case 1:
              wx.showToast({ icon: 'success', title: '已发送提醒' });
              break;
            case 2:
              wx.showToast({ icon: 'success', title: '导出任务已创建' });
              break;
            case 3:
              wx.navigateTo({ url: '/pages/patient-intake/select/select' });
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

  onCardLongPress(event) {
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

    // 如果在批量模式,进入批量选择
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

  toggleBatchMode() {
    if (this.data.batchMode) {
      this.exitBatchMode();
    } else {
      this.setData({ batchMode: true }, () => {
        this.applyFilters();
      });
    }
  },
});
