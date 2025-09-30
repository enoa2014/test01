// 家庭档案列表页面逻辑
const logger = require('../../utils/logger');
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 搜索和筛选
    searchKeyword: '',
    showFilterPanel: false,
    activeFilterCount: 0,
    filterOptions: [
      {
        key: 'status',
        title: '在住状态',
        type: 'radio',
        options: [
          { label: '全部', value: '' },
          { label: '在住', value: 'in' },
          { label: '已离院', value: 'out' },
        ],
        value: '',
      },
      {
        key: 'diseaseType',
        title: '疾病类型',
        type: 'checkbox',
        options: [
          { label: '血液肿瘤', value: 'blood_tumor' },
          { label: '实体肿瘤', value: 'solid_tumor' },
          { label: '先天性疾病', value: 'congenital' },
          { label: '其他', value: 'other' },
        ],
        value: [],
      },
      {
        key: 'region',
        title: '来源地区',
        type: 'checkbox',
        options: [
          { label: '华北地区', value: 'north' },
          { label: '华东地区', value: 'east' },
          { label: '华南地区', value: 'south' },
          { label: '西南地区', value: 'southwest' },
          { label: '其他地区', value: 'other' },
        ],
        value: [],
      },
    ],

    // 列表数据
    familyList: [],
    total: 0,
    inCount: 0,
    outCount: 0,

    // 分页
    page: 1,
    pageSize: 10,
    hasMore: true,

    // 加载状态
    loading: false,
    loadingMore: false,

    // Toast 消息
    toast: {
      show: false,
      type: 'info',
      message: '',
    },
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.loadFamilyList();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    // 设置导航栏
    wx.setNavigationBarTitle({
      title: '家庭档案',
    });
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 页面显示时刷新数据
    this.refreshData();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    this.refreshData();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    this.onLoadMore();
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '公益小家 - 家庭档案',
      path: '/pages/families/index',
    };
  },

  /**
   * 搜索处理
   */
  onSearch(e) {
    const keyword = e.detail.keyword;

    this.setData({
      searchKeyword: keyword,
      page: 1,
    });

    this.loadFamilyList(true);
  },

  /**
   * 显示筛选面板
   */
  onShowFilter() {
    this.setData({
      showFilterPanel: true,
    });
  },

  /**
   * 隐藏筛选面板
   */
  onHideFilter() {
    this.setData({
      showFilterPanel: false,
    });
  },

  /**
   * 筛选条件变化
   */
  onFilterChange(e) {
    const filters = e.detail.filters;

    // 计算激活的筛选条件数量
    let activeCount = 0;
    filters.forEach(filter => {
      if (filter.type === 'radio' && filter.value) {
        activeCount++;
      } else if (filter.type === 'checkbox' && filter.value.length > 0) {
        activeCount++;
      }
    });

    this.setData({
      filterOptions: filters,
      activeFilterCount: activeCount,
      showFilterPanel: false,
      page: 1,
    });

    this.loadFamilyList(true);
  },

  /**
   * 家庭卡片点击
   */
  onFamilyTap(e) {
    const family = e.currentTarget.dataset.family;

    wx.navigateTo({
      url: `/pages/families/detail?id=${family.id}`,
    });
  },

  /**
   * 联系监护人
   */
  onCallGuardian(e) {
    const phone = e.detail.phone;

    wx.makePhoneCall({
      phoneNumber: phone,
      fail: err => {
        logger.error('拨打电话失败:', err);
        this.showToast('拨打电话失败', 'error');
      },
    });
  },

  /**
   * 查看详情
   */
  onViewDetail(e) {
    const familyId = e.detail.familyId;

    wx.navigateTo({
      url: `/pages/families/detail?id=${familyId}`,
    });
  },

  /**
   * 添加新家庭
   */
  onAddFamily() {
    wx.navigateTo({
      url: '/pages/families/add',
    });
  },

  /**
   * 加载更多
   */
  onLoadMore() {
    if (this.data.loadingMore || !this.data.hasMore) {
      return;
    }

    this.setData({
      loadingMore: true,
      page: this.data.page + 1,
    });

    this.loadFamilyList(false);
  },

  /**
   * 刷新数据
   */
  refreshData() {
    this.setData({
      page: 1,
    });

    this.loadFamilyList(true);
  },

  /**
   * 加载家庭列表
   */
  async loadFamilyList(reset = false) {
    const { page, pageSize, searchKeyword, filterOptions } = this.data;

    // 设置加载状态
    if (reset) {
      this.setData({ loading: true });
    }

    try {
      // 构建查询参数
      const params = {
        page,
        pageSize,
        keyword: searchKeyword,
      };

      // 添加筛选条件
      filterOptions.forEach(filter => {
        if (filter.type === 'radio' && filter.value) {
          params[filter.key] = filter.value;
        } else if (filter.type === 'checkbox' && filter.value.length > 0) {
          params[filter.key] = filter.value.join(',');
        }
      });

      // 调用云函数
      const result = await wx.cloud.callFunction({
        name: 'getFamilyList',
        data: params,
      });

      const { families, total, statistics } = result.result;

      // 更新数据
      const newFamilyList = reset ? families : [...this.data.familyList, ...families];

      this.setData({
        familyList: newFamilyList,
        total,
        inCount: statistics.inCount,
        outCount: statistics.outCount,
        hasMore: families.length === pageSize,
        loading: false,
        loadingMore: false,
      });

      // 停止下拉刷新
      if (reset) {
        wx.stopPullDownRefresh();
      }
    } catch (error) {
      logger.error('加载家庭列表失败:', error);

      this.setData({
        loading: false,
        loadingMore: false,
      });

      this.showToast('加载失败，请重试', 'error');

      // 停止下拉刷新
      if (reset) {
        wx.stopPullDownRefresh();
      }
    }
  },

  /**
   * 显示 Toast 消息
   */
  showToast(message, type = 'info') {
    this.setData({
      toast: {
        show: true,
        type,
        message,
      },
    });

    // 3秒后自动关闭
    setTimeout(() => {
      this.onToastClose();
    }, 3000);
  },

  /**
   * 关闭 Toast
   */
  onToastClose() {
    this.setData({
      'toast.show': false,
    });
  },
});
