// pages/auth/login/index.js
const userManager = require('../../../utils/user-manager')
const logger = require('../../../utils/logger');

Page({
  data: {
    username: '',
    password: '',
    showPassword: false,
    loading: false,
    error: ''
  },

  onLoad() {
    // 若已登录，直接进入欢迎页/首页
    this.prefetchUser()
  },

  async prefetchUser() {
    try {
      const user = await userManager.getCurrentUser()
      if (user) {
        // 已有登录态
        wx.switchTab({ url: '/pages/index/index' })
      }
    } catch (_) {
      // 忽略预取用户失败的异常，保持登录流程
    }
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value })
  },
  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },
  toggleShowPassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  goWelcome() {
    wx.navigateTo({ url: '/pages/auth/welcome/index' })
  },

  goQRConfirm() {
    wx.navigateTo({ url: '/pages/qr-confirm/qr-confirm' })
  },

  async submitAdminLogin() {
    const { username, password } = this.data
    if (!username || !password) {
      this.setData({ error: '请输入用户名与口令' })
      return
    }
    this.setData({ loading: true, error: '' })
    try {
      // 确保可调用云函数（多数场景无需额外处理）
      // 调用后端云函数获取自定义登录票据
      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'login', username, password }
      })
      if (!res.result || !res.result.success) {
        throw new Error(res.result?.error?.message || '登录失败')
      }

      const { ticket, user } = res.result
      // 持久化票据以便后续排查/刷新（注意不要同步到云端）
      try {
        wx.setStorageSync('ADMIN_LOGIN_TICKET', ticket)
        wx.setStorageSync('ADMIN_LOGIN_USER', user)
        wx.setStorageSync('ADMIN_LOGIN_AT', Date.now())
      } catch (_) {
        // 存储失败不影响后续登录流程
      }

      // 兼容性自定义登录：尝试使用可用 API 完成票据登录
      await this.trySignInWithTicket(ticket)

      wx.showToast({ title: '登录成功', icon: 'success' })
      // 刷新用户信息缓存
      await userManager.getCurrentUser(true)
      // 进入权限管理或首页
      wx.navigateTo({ url: '/pages/auth/permission-management/index' })
    } catch (err) {
      logger.error('管理员登录失败:', err)
      this.setData({ error: err.message || '登录失败，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async trySignInWithTicket(ticket) {
    // 尝试多种 CloudBase 自定义登录方式（不同 SDK 版本差异）
    try {
      const anyCloud = wx.cloud
      if (!anyCloud) return
      // v2 风格：customAuthProvider().signIn / signInWithTicket
      if (typeof anyCloud.customAuthProvider === 'function') {
        const provider = anyCloud.customAuthProvider()
        if (provider && typeof provider.signInWithTicket === 'function') {
          await provider.signInWithTicket(ticket)
          return
        }
        if (provider && typeof provider.signIn === 'function') {
          await provider.signIn(ticket)
          return
        }
      }
      // v3 风格：setCustomSignFunc + signInWithCustomTicket
      if (typeof anyCloud.setCustomSignFunc === 'function') {
        anyCloud.setCustomSignFunc(async () => ticket)
      }
      if (typeof anyCloud.signInWithCustomTicket === 'function') {
        await anyCloud.signInWithCustomTicket()
        return
      }
      // 兜底：匿名登录（保证后续云函数可用），不影响已存在的 openid 登录
      if (typeof anyCloud.signInAnonymously === 'function') {
        await anyCloud.signInAnonymously()
      }
    } catch (e) {
      // 不抛出，让调用方以成功票据为准继续流程
      logger.warn('trySignInWithTicket 警告:', e)
    }
  }
})
