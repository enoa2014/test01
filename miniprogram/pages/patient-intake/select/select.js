// 患者选择页面
const PATIENT_CACHE_KEY = 'patient_list_cache';
const PATIENT_CACHE_TTL = 5 * 60 * 1000;

// 复用 index 页面的工具函数
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
    console.warn('readPatientsCache failed', error);
    return null;
  }
}

function writePatientsCache(patients) {
  try {
    wx.setStorageSync(PATIENT_CACHE_KEY, {
      patients: Array.isArray(patients) ? patients : [],
      updatedAt: Date.now()
    });
  } catch (error) {
    console.warn('writePatientsCache failed', error);
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
    filteredPatients: [],
    searchKeyword: '',
    searchFocus: false,
    loading: true,
    hasMore: true,
    currentPage: 0,
    pageSize: 20,

    // 选择状态
    selectedPatient: null,
    showConfirmModal: false
  },

  onLoad() {
    // 设置搜索框聚焦
    this.setData({ searchFocus: true });

    // 先从缓存加载
    const cachedPatients = readPatientsCache();
    if (cachedPatients && cachedPatients.length) {
      this.setData({
        patients: cachedPatients,
        filteredPatients: cachedPatients.slice(0, this.data.pageSize),
        loading: false
      });
    }

    // 然后获取最新数据
    this.fetchPatients({ silent: !!(cachedPatients && cachedPatients.length) });
  },

  onShow() {
    // 每次显示时更新搜索焦点
    setTimeout(() => {
      this.setData({ searchFocus: true });
    }, 100);
  },

  // 获取患者列表
  async fetchPatients(options = {}) {
    const silent = !!(options && options.silent);
    if (!silent) {
      this.setData({ loading: true });
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'patientProfile',
        data: { action: 'list', forceRefresh: true }
      });

      const result = res && res.result ? res.result : {};
      const sourcePatients = Array.isArray(result.patients) ? result.patients : [];

      const patients = sourcePatients.map((item) => {
        const latestAdmissionDateFormatted = formatDate(item.latestAdmissionDate || item.firstAdmissionDate);
        const firstAdmissionDateFormatted = formatDate(item.firstAdmissionDate || item.latestAdmissionDate);

        return {
          ...item,
          ageText: formatAge(item.birthDate),
          latestAdmissionDateFormatted,
          firstAdmissionDateFormatted
        };
      });

      this.setData({
        patients,
        loading: false
      }, () => {
        this.applySearch();
      });

      // 更新缓存
      writePatientsCache(patients);

    } catch (error) {
      console.error('Failed to load patients', error);
      const errorMessage = (error && error.errMsg) || '读取患者数据失败，请稍后重试';

      if (!silent) {
        wx.showToast({
          title: errorMessage,
          icon: 'error'
        });
      }

      this.setData({ loading: false });
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({
      searchKeyword: keyword,
      currentPage: 0
    }, () => {
      this.applySearch();
    });
  },

  // 清除搜索
  onClearSearch() {
    this.setData({
      searchKeyword: '',
      searchFocus: true,
      currentPage: 0
    }, () => {
      this.applySearch();
    });
  },

  // 应用搜索过滤
  applySearch() {
    const { patients, searchKeyword, pageSize } = this.data;
    const keyword = (searchKeyword || '').trim().toLowerCase();

    let filtered = patients;

    if (keyword) {
      filtered = patients.filter((item) => {
        const name = (item.patientName || '').toLowerCase();
        const idNumber = (item.idNumber || '').toLowerCase();
        const phone = (item.phone || '').toLowerCase();

        return (
          name.includes(keyword) ||
          idNumber.includes(keyword) ||
          phone.includes(keyword)
        );
      });
    }

    // 分页显示
    const displayPatients = filtered.slice(0, pageSize);
    const hasMore = filtered.length > pageSize;

    this.setData({
      filteredPatients: filtered,
      patients: displayPatients,
      hasMore,
      currentPage: 0
    });
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) {
      return;
    }

    const { filteredPatients, patients, currentPage, pageSize } = this.data;
    const nextPage = currentPage + 1;
    const startIndex = nextPage * pageSize;
    const endIndex = startIndex + pageSize;

    if (startIndex >= filteredPatients.length) {
      this.setData({ hasMore: false });
      return;
    }

    const newPatients = filteredPatients.slice(startIndex, endIndex);
    const allPatients = [...patients, ...newPatients];
    const hasMore = endIndex < filteredPatients.length;

    this.setData({
      patients: allPatients,
      currentPage: nextPage,
      hasMore
    });
  },

  // 选择患者
  onPatientSelect(e) {
    const patient = e.currentTarget.dataset.patient;
    this.setData({
      selectedPatient: patient,
      showConfirmModal: true
    });
  },

  // 取消选择
  onCancelSelect() {
    this.setData({
      selectedPatient: null,
      showConfirmModal: false
    });
  },

  // 确认选择
  onConfirmSelect() {
    const { selectedPatient } = this.data;
    if (!selectedPatient) {
      return;
    }

    // 跳转到向导页面，传递患者信息
    const targetKey = selectedPatient.patientKey || selectedPatient.key;
    wx.navigateTo({
      url: `/pages/patient-intake/wizard/wizard?patientKey=${encodeURIComponent(targetKey)}&mode=existing`
    });
  },

  // 创建新患者
  onCreateNewPatient() {
    // 跳转到向导页面，创建新患者
    wx.navigateTo({
      url: '/pages/patient-intake/wizard/wizard?mode=new'
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.fetchPatients({ silent: false }).finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});
