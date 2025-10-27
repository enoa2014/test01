// pages/qr-confirm/qr-confirm.js
const logger = require('../../utils/logger');
const app = getApp()

Page({
  data: {
    sessionInfo: null,
    userInfo: null,
    loginMode: 'full',
    loading: false,
    error: '',
    timeRemaining: 0,
    selectedRole: null,
    availableRoles: [],
    roleConfig: {
      admin: {
        name: '系统管理员',
        description: '拥有完整的系统管理权限',
        icon: '👑',
        color: '#3B82F6'
      },
      social_worker: {
        name: '社工',
        description: '负责患者管理和护理记录',
        icon: '👩‍⚕️',
        color: '#10B981'
      },
      volunteer: {
        name: '志愿者',
        description: '参与志愿服务，记录服务日志',
        icon: '🤝',
        color: '#F59E0B'
      },
      parent: {
        name: '家长',
        description: '查看自己孩子的相关信息',
        icon: '👨‍👩‍👧‍👦',
        color: '#8B5CF6'
      },
      guest: {
        name: '游客',
        description: '临时访问，查看公开信息',
        icon: '👤',
        color: '#6B7280'
      }
    }
  },

  onLoad(options) {
    // 如果从扫码结果进入，options.qrData包含二维码数据
    if (options.qrData) {
      this.handleScanResult(decodeURIComponent(options.qrData))
    }
  },

  onShow() {
    // 获取当前用户信息
    this.getCurrentUserInfo()
  },

  // 扫描二维码
  scanQRCode() {
    wx.scanCode({
      onlyFromCamera: false,
      scanType: ['qrCode'],
      success: (res) => {
        logger.info('扫码结果:', res.result)
        this.handleScanResult(res.result)
      },
      fail: (err) => {
        logger.error('扫码失败:', err)
        this.setError('扫码失败，请重试')
        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        })
      }
    })
  },

  // 从相册选择二维码
  chooseFromAlbum() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]

        // 使用小程序码识别接口
        wx.getQRCode({
          filePath: tempFilePath,
          success: (qrRes) => {
            logger.info('识别结果:', qrRes.result)
            this.handleScanResult(qrRes.result)
          },
          fail: (err) => {
            logger.error('二维码识别失败:', err)
            this.setError('无法识别二维码，请重试')
            wx.showToast({
              title: '二维码识别失败',
              icon: 'none'
            })
          }
        })
      },
      fail: (err) => {
        logger.error('选择图片失败:', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  // 处理扫码结果
  async handleScanResult(qrData) {
    this.setData({ loading: true, error: '' })

    try {
      // 解析二维码
      const parseResult = await this.parseQRCode(qrData)

      if (parseResult.success) {
        this.setData({
          sessionInfo: parseResult.data.sessionInfo
        })

        // 开始倒计时
        this.startCountdown(parseResult.data.sessionInfo.expiresAt)

        // 获取当前用户信息
        const userInfo = await this.getCurrentUserInfo()

        // 确定用户角色
        this.determineUserRoles(userInfo)

      } else {
        this.setError(parseResult.error.message || '二维码无效')
      }
    } catch (error) {
      logger.error('处理扫码结果失败:', error)
      this.setError('处理失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 解析二维码
  async parseQRCode(qrData) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'qrLogin',
        data: {
          action: 'parseQR',
          qrData,
          deviceInfo: this.getDeviceInfo()
        }
      }).then(res => {
        if (res.result && res.result.success) {
          // 保存 approveNonce 供后续确认使用
          this.setData({ approveNonce: res.result.data.approveNonce })
          resolve(res.result)
        } else {
          reject(new Error(res.result?.error?.message || '解析失败'))
        }
      }).catch(err => {
        reject(err)
      })
    })
  },

  // 获取当前用户信息
  async getCurrentUserInfo() {
    return new Promise((resolve, _reject) => {
      // 从app全局获取用户信息
      const userInfo = app.globalData.userInfo

      if (userInfo) {
        this.setData({ userInfo })
        resolve(userInfo)
      } else {
        // 尝试获取用户信息
        wx.getUserProfile({
          desc: '用于登录确认',
          success: (res) => {
            const userInfo = res.userInfo
            this.setData({ userInfo })
            app.globalData.userInfo = userInfo
            resolve(userInfo)
          },
          fail: (err) => {
            logger.error('获取用户信息失败:', err)
            // 如果获取失败，使用基础信息
            const basicInfo = {
              nickName: '用户',
              avatarUrl: '/images/default-avatar.png'
            }
            this.setData({ userInfo: basicInfo })
            resolve(basicInfo)
          }
        })
      }
    })
  },

  // 确定用户角色
  determineUserRoles(_userInfo) {
    const userManager = app.getUserManager()
    const userRoles = userManager.getUserRoles() || ['guest']

    // 获取可用角色列表
    const availableRoles = userRoles.filter(role => {
      return ['admin', 'social_worker', 'volunteer', 'parent', 'guest'].includes(role)
    })

    // 默认选择最高权限角色
    const roleHierarchy = ['admin', 'social_worker', 'volunteer', 'parent', 'guest']
    let selectedRole = 'guest'

    for (const role of roleHierarchy) {
      if (availableRoles.includes(role)) {
        selectedRole = role
        break
      }
    }

    this.setData({
      availableRoles,
      selectedRole
    })

    // 根据角色确定登录模式
    const loginMode = selectedRole === 'admin' ? 'full' : 'guest'
    this.setData({ loginMode })
  },

  // 选择角色
  selectRole(e) {
    const role = e.currentTarget.dataset.role
    this.setData({ selectedRole: role })

    // 根据角色调整登录模式
    const loginMode = role === 'admin' ? 'full' : 'guest'
    this.setData({ loginMode })
  },

  // 切换登录模式
  switchLoginMode() {
    const { loginMode } = this.data
    const newMode = loginMode === 'full' ? 'guest' : 'full'
    this.setData({ loginMode: newMode })
  },

  // 确认登录
  async confirmLogin() {
    const { sessionInfo, userInfo, loginMode, selectedRole } = this.data

    if (!sessionInfo) {
      wx.showToast({
        title: '请先扫码',
        icon: 'none'
      })
      return
    }

    this.setData({ loading: true })

    try {
      const result = await this.confirmQRLogin(
        sessionInfo.sessionId,
        loginMode,
        selectedRole,
        userInfo
      )

      if (result.success) {
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        })

        // 延迟返回
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)

      } else {
        this.setError(result.error.message || '确认失败')
      }
    } catch (error) {
      logger.error('确认登录失败:', error)
      this.setError('确认失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 确认二维码登录
  async confirmQRLogin(sessionId, loginMode, selectedRole, userInfo) {
    const location = await this.getCurrentLocation()
    const res = await wx.cloud.callFunction({
      name: 'qrLogin',
      data: {
        action: 'qrApprove',
        sessionId,
        userInfo: { ...userInfo, selectedRole },
        loginMode,
        deviceInfo: this.getDeviceInfo(),
        securityToken: this.generateSecurityToken(),
        location,
        approveNonce: this.data.approveNonce
      }
    })
    if (res.result && res.result.success) {
      return res.result
    }
    throw new Error(res.result?.error?.message || '确认失败')
  },

  // 取消登录
  async cancelLogin() {
    const { sessionInfo } = this.data

    if (sessionInfo) {
      try {
        await wx.cloud.callFunction({
          name: 'qrLogin',
          data: {
            action: 'qrCancel',
            sessionId: sessionInfo.sessionId,
            reason: 'user_cancelled'
          }
        })
      } catch (error) {
        logger.error('取消登录失败:', error)
      }
    }

    wx.navigateBack()
  },

  // 获取设备信息
  getDeviceInfo() {
    const systemInfo = wx.getSystemInfoSync()
    return {
      platform: systemInfo.platform,
      system: systemInfo.system,
      model: systemInfo.model,
      brand: systemInfo.brand,
      version: systemInfo.version,
      SDKVersion: systemInfo.SDKVersion,
      screenWidth: systemInfo.screenWidth,
      screenHeight: systemInfo.screenHeight,
      windowWidth: systemInfo.windowWidth,
      windowHeight: systemInfo.windowHeight
    }
  },

  // 生成安全令牌
  generateSecurityToken() {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },

  // 获取当前位置
  async getCurrentLocation() {
    return new Promise((resolve) => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          resolve({
            latitude: res.latitude,
            longitude: res.longitude,
            accuracy: res.accuracy
          })
        },
        fail: () => {
          resolve(null)
        }
      })
    })
  },

  // 开始倒计时
  startCountdown(expiresAt) {
    const updateTime = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))

      this.setData({ timeRemaining: remaining })

      if (remaining > 0) {
        setTimeout(updateTime, 1000)
      } else {
        // 过期处理
        this.setData({
          error: '二维码已过期',
          sessionInfo: null
        })
      }
    }

    updateTime()
  },

  // 格式化时间
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  },

  // 设置错误信息
  setError(message) {
    this.setData({ error: message })
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    })
  },

  // 清除错误信息
  clearError() {
    this.setData({ error: '' })
  }
})
