// components/skeleton-screen/index.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 是否显示骨架屏
    show: {
      type: Boolean,
      value: false
    },
    // 骨架屏类型
    type: {
      type: String,
      value: 'all' // all, page, stats, search, filters, list, table, grid, chart, form
    },
    // 列表行数
    rows: {
      type: Number,
      value: 5
    },
    // 表格列数
    columns: {
      type: Number,
      value: 4
    },
    // 自定义样式
    customClass: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    // 内部状态
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 显示骨架屏
     */
    showSkeleton() {
      this.setData({
        show: true
      });
    },

    /**
     * 隐藏骨架屏
     */
    hideSkeleton() {
      this.setData({
        show: false
      });
    },

    /**
     * 切换骨架屏显示状态
     */
    toggleSkeleton() {
      this.setData({
        show: !this.data.show
      });
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    /**
     * 组件实例进入页面节点树时执行
     */
    attached() {
      // 初始化组件
    },

    /**
     * 组件实例被从页面节点树移除时执行
     */
    detached() {
      // 清理资源
    }
  },

  /**
   * 组件所在页面的生命周期
   */
  pageLifetimes: {
    /**
     * 页面显示
     */
    show() {
      // 页面显示时的处理
    },

    /**
     * 页面隐藏
     */
    hide() {
      // 页面隐藏时的处理
    }
  }
});