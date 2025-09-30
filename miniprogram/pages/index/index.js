const logger = require('../../utils/logger');

const SORT_OPTIONS = [
  { label: '默认排序', value: 'default' },
  { label: '按入院次数排序', value: 'admissionCountDesc' },
  { label: '按最近入院时间排序', value: 'latestAdmissionDesc' },
];

const PATIENT_CACHE_KEY = 'patient_list_cache';
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

function formatAge(birthDate) {
  const birth = parseDateValue(birthDate);
  if (!birth) {
    return '';
  }
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? `${age}岁` : '';
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
  },

  onLoad() {
    const cachedPatients = readPatientsCache();
    if (cachedPatients && cachedPatients.length) {
      this.setData({ patients: cachedPatients, loading: false }, () => {
        this.applyFilters();
      });
    }
    this.fetchPatients({ silent: !!(cachedPatients && cachedPatients.length) });
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
        };
      });
      this.setData({ patients, loading: false }, () => {
        this.applyFilters();
      });
      writePatientsCache(patients);
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

  applyFilters() {
    const { patients, searchKeyword, sortIndex } = this.data;
    const keyword = (searchKeyword || '').trim().toLowerCase();
    const sortValue = SORT_OPTIONS[sortIndex] ? SORT_OPTIONS[sortIndex].value : 'default';

    let list = patients.slice();

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

    this.setData({ displayPatients: list });
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
