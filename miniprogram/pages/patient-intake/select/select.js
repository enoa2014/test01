// 住户选择页面
const logger = require('../../../utils/logger');
const { formatDate, formatAge } = require('../../../utils/date');

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
    allPatients: [],
    filteredPatients: [],
    displayPatients: [],
    searchKeyword: '',
    searchFocus: false,
    loading: true,
    hasMore: false,
    currentPage: 0,
    pageSize: 20,

    // 选择状态
    selectedPatient: null,
    showConfirmModal: false,
  },

  onLoad() {
    // 设置搜索框聚焦
    this.setData({ searchFocus: true });

    // 先从缓存加载
    const cachedPatients = readPatientsCache();
    if (cachedPatients && cachedPatients.length) {
      this.setData(
        {
          patients: cachedPatients,
          allPatients: cachedPatients,
          loading: false,
        },
        () => {
          this.applySearch();
        }
      );
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

  // 获取住户列表
  async fetchPatients(options = {}) {
    const silent = !!(options && options.silent);
    if (!silent) {
      this.setData({ loading: true });
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'patientProfile',
        data: { action: 'list', forceRefresh: true },
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

        return {
          ...item,
          ageText: formatAge(item.birthDate),
          latestAdmissionDateFormatted,
          firstAdmissionDateFormatted,
        };
      });

      this.setData(
        {
          patients,
          allPatients: patients,
          loading: false,
        },
        () => {
          this.applySearch();
        }
      );

      // 更新缓存
      writePatientsCache(patients);
    } catch (error) {
      logger.error('Failed to load residents', error);
      const errorMessage = (error && error.errMsg) || '读取住户数据失败，请稍后重试';

      if (!silent) {
        wx.showToast({
          title: errorMessage,
          icon: 'error',
        });
      }

      this.setData({ loading: false });
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData(
      {
        searchKeyword: keyword,
        currentPage: 0,
      },
      () => {
        this.applySearch();
      }
    );
  },

  // 清除搜索
  onClearSearch() {
    this.setData(
      {
        searchKeyword: '',
        searchFocus: true,
        currentPage: 0,
      },
      () => {
        this.applySearch();
      }
    );
  },

  // 应用搜索过滤
  applySearch() {
    const { allPatients, searchKeyword, pageSize } = this.data;
    const keyword = (searchKeyword || '').trim().toLowerCase();
    const baseList = Array.isArray(allPatients) ? allPatients : [];

    const filtered = keyword
      ? baseList.filter(item => {
          const name = (item.patientName || '').toLowerCase();
          const idNumber = (item.idNumber || '').toLowerCase();
          const phone = (item.phone || '').toLowerCase();

          return name.includes(keyword) || idNumber.includes(keyword) || phone.includes(keyword);
        })
      : baseList.slice();

    const size = Number(pageSize) > 0 ? Number(pageSize) : 0;
    const displayPatients = size > 0 ? filtered.slice(0, size) : filtered.slice();
    const hasMore = size > 0 ? filtered.length > displayPatients.length : false;

    this.setData({
      filteredPatients: filtered,
      displayPatients,
      patients: displayPatients,
      hasMore,
      currentPage: 0,
    });
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) {
      return;
    }

    const { filteredPatients, displayPatients, currentPage, pageSize } = this.data;
    const nextPage = currentPage + 1;
    const startIndex = nextPage * pageSize;
    const endIndex = startIndex + pageSize;

    if (startIndex >= filteredPatients.length) {
      this.setData({ hasMore: false });
      return;
    }

    const newPatients = filteredPatients.slice(startIndex, endIndex);
    const allDisplayPatients = [...displayPatients, ...newPatients];
    const hasMore = endIndex < filteredPatients.length;

    this.setData({
      displayPatients: allDisplayPatients,
      patients: allDisplayPatients,
      currentPage: nextPage,
      hasMore,
    });
  },

  // 选择住户
  onPatientSelect(e) {
    const patient = e.currentTarget.dataset.patient;
    this.setData({
      selectedPatient: patient,
      showConfirmModal: true,
    });
  },

  // 取消选择
  onCancelSelect() {
    this.setData({
      selectedPatient: null,
      showConfirmModal: false,
    });
  },

  // 确认选择
  onConfirmSelect() {
    const { selectedPatient } = this.data;
    if (!selectedPatient) {
      return;
    }

    // 跳转到向导页面，传递住户信息
    const targetKey = selectedPatient.patientKey || selectedPatient.key;
    wx.navigateTo({
      url: `/pages/patient-intake/wizard/wizard?patientKey=${encodeURIComponent(targetKey)}&mode=existing`,
    });
  },

  // 创建新住户
  onCreateNewPatient() {
    // 跳转到向导页面，创建新住户
    wx.navigateTo({
      url: '/pages/patient-intake/wizard/wizard?mode=new',
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.fetchPatients({ silent: false }).finally(() => {
      wx.stopPullDownRefresh();
    });
  },
});
