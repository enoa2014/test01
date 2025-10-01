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

function readPatientsCache() {
  try {
    const cache = wx.getStorageSync(PATIENT_CACHE_KEY);
    if (!cache || !cache.updatedAt || !Array.isArray(cache.patients)) {
      return null;
    }
    if (Date.now() - cache.updatedAt > PATIENT_CACHE_TTL) {
      return null;
    }
    return cache.patients;
  } catch (error) {
    return null;
  }
}

function writePatientsCache(patients) {
  try {
    wx.setStorageSync(PATIENT_CACHE_KEY, {
      patients: Array.isArray(patients) ? patients : [],
      updatedAt: Date.now(),
    });
  } catch (error) {
    // ignore cache write errors
  }
}

Page({
  data: {
    patients: [],
    displayPatients: [],
    loading: true,
    error: '',
    searchKeyword: '',
    sortOptions: SORT_OPTIONS,
    sortIndex: 0,
    skeletonPlaceholders: [0, 1, 2, 3],
  },

  onLoad() {
    const cachedPatients = readPatientsCache();
    if (cachedPatients && cachedPatients.length) {
      const filtered = this.buildFilteredPatients(cachedPatients);
      this.setData({ patients: cachedPatients, displayPatients: filtered, loading: false });
    }
    this.fetchPatients({ silent: !!(cachedPatients && cachedPatients.length) });
  },

  onShow() {
    this.applyPendingUpdates();
  },

  async fetchPatients(options = {}) {
    const silent = !!(options && options.silent);
    if (!silent) {
      this.setData({ loading: true, error: '' });
    } else {
      this.setData({ error: '' });
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'patientProfile',
        data: { action: 'list', forceRefresh: !silent, pageSize: 80 },
      });
      const result = res && res.result ? res.result : {};
      const sourcePatients = Array.isArray(result.patients) ? result.patients : [];
      const patients = sourcePatients.map(item => {
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
        let cardStatus = 'default';
        const latestAdmissionTimestamp = Number(item.latestAdmissionTimestamp || 0);
        if (latestAdmissionTimestamp > 0) {
          const now = Date.now();
          if (latestAdmissionTimestamp <= now) {
            const diffDays = Math.floor((now - latestAdmissionTimestamp) / (24 * 60 * 60 * 1000));
            if (diffDays <= 30) {
              cardStatus = 'success';
            } else if (diffDays <= 90) {
              cardStatus = 'info';
            }
          }
        }
        const badgeType = cardStatus === 'success' || cardStatus === 'info' ? cardStatus : 'default';
        const admissionCount = Number(item.admissionCount || 0);
        const admissionBadge = admissionCount > 0 ? `入住 ${admissionCount} 次` : null;
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
          badgeType,
          admissionBadge,
        };
      });
      const filteredPatients = this.buildFilteredPatients(patients);
      this.setData({ patients, displayPatients: filteredPatients, loading: false });
      writePatientsCache(patients);
      try {
        wx.removeStorageSync(PATIENT_LIST_DIRTY_KEY);
      } catch (error) {
        // ignore removal errors
      }
    } catch (error) {
      logger.error('Failed to load patients', error);
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
    const filteredList = this.buildFilteredPatients(mergedPatients);

    this.setData({
      patients: mergedPatients,
      displayPatients: filteredList,
    });

    this.fetchPatients({ silent: false });
  },

  buildFilteredPatients(source = []) {
    const { searchKeyword, sortIndex } = this.data;
    const keyword = (searchKeyword || '').trim().toLowerCase();
    const sortValue = SORT_OPTIONS[sortIndex] ? SORT_OPTIONS[sortIndex].value : 'default';

    let list = Array.isArray(source) ? source.slice() : [];

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

    return list;
  },

  applyFilters() {
    const filtered = this.buildFilteredPatients(this.data.patients || []);
    this.setData({ displayPatients: filtered });
  },

  onSearchInput(event) {
    this.setData({ searchKeyword: event.detail.value || '' }, () => {
      this.applyFilters();
    });
  },

  onSearchClear() {
    if (!this.data.searchKeyword) {
      return;
    }
    this.setData({ searchKeyword: '' }, () => {
      this.applyFilters();
    });
  },

  onSortChange(event) {
    const sortIndex = Number(event.detail.value) || 0;
    this.setData({ sortIndex }, () => {
      this.applyFilters();
    });
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
    const { key, patientKey, recordKey } = event.currentTarget.dataset || {};
    const profileKey = recordKey || key || patientKey;
    const resolvedPatientKey = patientKey || key || recordKey;

    if (!profileKey) {
      return;
    }

    let url = `/pages/patient-detail/detail?key=${encodeURIComponent(profileKey)}`;
    if (resolvedPatientKey) {
      url += `&patientId=${encodeURIComponent(resolvedPatientKey)}`;
    }

    wx.navigateTo({ url });
  },
});
