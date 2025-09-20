const SORT_OPTIONS = [
  { label: '默认排序', value: 'default' },
  { label: '按入住次数排序', value: 'admissionCountDesc' },
  { label: '按最近入住时间排序', value: 'latestAdmissionDesc' }
];

function normalizeDateString(value) {
  if (!value) {
    return '';
  }
  return String(value).replace(/[./]/g, '-');
}

function formatDate(value) {
  const normalized = normalizeDateString(value);
  if (!normalized) {
    return '';
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value || '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAge(birthDate) {
  const normalized = normalizeDateString(birthDate);
  if (!normalized) {
    return '';
  }
  const birth = new Date(normalized);
  if (Number.isNaN(birth.getTime())) {
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
    sortIndex: 0
  },

  onLoad() {
    this.fetchPatients();
  },

  async fetchPatients() {
    this.setData({ loading: true, error: '' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'readExcel',
        data: { action: 'list' }
      });
      const sourcePatients = res?.result?.patients || [];
      const patients = sourcePatients.map((item) => {
        const latestAdmissionDateFormatted = formatDate(item.latestAdmissionDate || item.firstAdmissionDate);
        const firstAdmissionDateFormatted = formatDate(item.firstAdmissionDate || item.latestAdmissionDate);
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
          latestDoctor
        };
      });
      this.setData({ patients, loading: false }, () => {
        this.applyFilters();
      });
    } catch (error) {
      console.error('Failed to load patients', error);
      this.setData({
        patients: [],
        displayPatients: [],
        loading: false,
        error: (error && error.errMsg) || '读取患者数据失败，请稍后重试'
      });
    }
  },

  applyFilters() {
    const { patients, searchKeyword, sortIndex } = this.data;
    const keyword = (searchKeyword || '').trim().toLowerCase();
    const sortValue = SORT_OPTIONS[sortIndex]?.value || 'default';

    let list = patients.slice();

    if (keyword) {
      list = list.filter((item) => {
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
        const bDate = new Date(b.latestAdmissionDateFormatted || b.latestAdmissionDate || '').getTime() || 0;
        const aDate = new Date(a.latestAdmissionDateFormatted || a.latestAdmissionDate || '').getTime() || 0;
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
      url: '/pages/analysis/index'
    });
  },

  onRetry() {
    this.fetchPatients();
  },

  onPatientTap(event) {
    const { key } = event.currentTarget.dataset;
    if (!key) {
      return;
    }
    wx.navigateTo({
      url: `/pages/patient-detail/detail?key=${encodeURIComponent(key)}`
    });
  }
});
