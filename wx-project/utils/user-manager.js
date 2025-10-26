// utils/user-manager.js
/**
 * 用户管理器 - 处理用户状态和权限管理
 */
class UserManager {
  constructor() {
    this.currentUser = null;
    this.permissions = [];
    this.listeners = new Set();
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
    this.lastCacheTime = 0;
  }

  /**
   * 监听权限变化
   * @param {Function} callback - 回调函数
   * @returns {Function} - 取消监听的函数
   */
  onPermissionChange(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * 通知权限变化
   */
  notifyPermissionChange() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentUser, this.permissions);
      } catch (error) {
        console.error('权限变化监听器执行失败:', error);
      }
    });
  }

  /**
   * 获取当前用户信息
   * @param {boolean} forceRefresh - 是否强制刷新
   * @returns {Promise<object|null>}
   */
  async getCurrentUser(forceRefresh = false) {
    const now = Date.now();

    // 检查缓存
    if (!forceRefresh &&
        this.currentUser &&
        (now - this.lastCacheTime) < this.cacheExpiry) {
      return this.currentUser;
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'rbac',
        data: { action: 'getCurrentUser' }
      });

      if (res.result && res.result.success) {
        this.currentUser = res.result.data;
        this.permissions = res.result.data.roles || [];
        this.lastCacheTime = now;

        this.notifyPermissionChange();

        // 保存到本地存储
        wx.setStorageSync('user_info', this.currentUser);
        wx.setStorageSync('user_permissions', this.permissions);

        return this.currentUser;
      } else {
        throw new Error(res.result?.error?.message || '获取用户信息失败');
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);

      // 尝试从本地存储恢复
      const cachedUser = wx.getStorageSync('user_info');
      const cachedPermissions = wx.getStorageSync('user_permissions');

      if (cachedUser && cachedPermissions) {
        this.currentUser = cachedUser;
        this.permissions = cachedPermissions;
        return this.currentUser;
      }

      return null;
    }
  }

  /**
   * 检查用户权限
   * @param {string[]} requiredRoles - 所需权限列表
   * @returns {boolean}
   */
  hasPermission(requiredRoles) {
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!this.permissions || this.permissions.length === 0) {
      return false;
    }

    return requiredRoles.some(role => this.permissions.includes(role));
  }

  /**
   * 检查用户权限（异步版本）
   * @param {string[]} requiredRoles - 所需权限列表
   * @returns {Promise<boolean>}
   */
  async hasPermissionAsync(requiredRoles = []) {
    try {
      const user = await this.getCurrentUser();
      if (!requiredRoles || requiredRoles.length === 0) {
        return true;
      }

      if (!user || !user.roles) {
        return false;
      }

      return requiredRoles.some(role => user.roles.includes(role));
    } catch (error) {
      console.error('权限检查失败:', error);
      return false;
    }
  }

  /**
   * 检查是否有任意一个权限
   * @param {string[]} roles - 角色列表
   * @returns {boolean}
   */
  hasAnyRole(roles) {
    return this.hasPermission(roles);
  }

  /**
   * 检查是否有所有权限
   * @param {string[]} roles - 角色列表
   * @returns {boolean}
   */
  hasAllRoles(roles) {
    if (!roles || roles.length === 0) {
      return true;
    }

    return roles.every(role => this.permissions.includes(role));
  }

  /**
   * 检查是否是管理员
   * @returns {boolean}
   */
  isAdmin() {
    return this.hasPermission(['admin']);
  }

  /**
   * 检查是否是社工
   * @returns {boolean}
   */
  isSocialWorker() {
    return this.hasPermission(['social_worker']);
  }

  /**
   * 检查是否是志愿者
   * @returns {boolean}
   */
  isVolunteer() {
    return this.hasPermission(['volunteer']);
  }

  /**
   * 检查是否是家长
   * @returns {boolean}
   */
  isParent() {
    return this.hasPermission(['parent']);
  }

  /**
   * 获取用户显示名称
   * @returns {string}
   */
  getDisplayName() {
    if (!this.currentUser) {
      return '用户';
    }

    return this.currentUser.displayName ||
           this.currentUser.profile?.realName ||
           '未设置姓名';
  }

  /**
   * 获取用户头像
   * @returns {string}
   */
  getAvatar() {
    if (!this.currentUser) {
      return '/assets/default-avatar.png';
    }

    return this.currentUser.avatar ||
           this.currentUser.profile?.avatar ||
           '/assets/default-avatar.png';
  }

  /**
   * 获取用户角色名称
   * @returns {string}
   */
  getRoleName() {
    if (!this.permissions || this.permissions.length === 0) {
      return '访客';
    }

    const roleNames = {
      admin: '管理员',
      social_worker: '社工',
      volunteer: '志愿者',
      parent: '家长'
    };

    // 返回最高权限的角色
    for (const role of ['admin', 'social_worker', 'volunteer', 'parent']) {
      if (this.permissions.includes(role)) {
        return roleNames[role];
      }
    }

    return '访客';
  }

  /**
   * 更新用户资料
   * @param {object} profile - 用户资料
   * @returns {Promise<object>}
   */
  async updateProfile(profile) {
    try {
      wx.showLoading({ title: '保存中...' });

      const res = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'updateProfile',
          profile
        }
      });

      if (res.result && res.result.success) {
        // 强制刷新用户信息
        await this.getCurrentUser(true);

        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });

        return res.result;
      } else {
        throw new Error(res.result?.error?.message || '保存失败');
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'error'
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * 验证邀请码
   * @param {string} code - 邀请码
   * @returns {Promise<object>}
   */
  async validateInviteCode(code) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'validateInviteCode',
          code: code.toUpperCase()
        }
      });

      return res.result;
    } catch (error) {
      console.error('验证邀请码失败:', error);
      return {
        success: false,
        error: '验证失败，请重试'
      };
    }
  }

  /**
   * 使用邀请码
   * @param {string} code - 邀请码
   * @returns {Promise<object>}
   */
  async useInviteCode(code) {
    try {
      wx.showLoading({ title: '激活中...' });

      const res = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'useInviteCode',
          code: code.toUpperCase()
        }
      });

      if (res.result && res.result.success) {
        // 强制刷新权限信息
        await this.getCurrentUser(true);

        wx.hideLoading();

        return res.result;
      } else {
        throw new Error(res.result?.error?.message || '激活失败');
      }
    } catch (error) {
      wx.hideLoading();

      return {
        success: false,
        error: error.message || '激活失败'
      };
    }
  }

  /**
   * 检查是否登录
   * @returns {Promise<boolean>}
   */
  async isLoggedIn() {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取申请历史
   * @returns {Promise<Array>}
   */
  async getApplicationHistory() {
    try {
      const res = await this.getApplicationStatus();
      if (res.success && res.data.applications) {
        return res.data.applications;
      }
      return [];
    } catch (error) {
      console.error('获取申请历史失败:', error);
      return [];
    }
  }

  /**
   * 撤销申请
   * @param {string} applicationId - 申请ID
   * @returns {Promise<object>}
   */
  async cancelApplication(applicationId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'cancelApplication',
          applicationId
        }
      });

      return res.result;
    } catch (error) {
      console.error('撤销申请失败:', error);
      return {
        success: false,
        error: '撤销失败，请重试'
      };
    }
  }

  /**
   * 上传头像
   * @param {string} filePath - 文件路径
   * @returns {Promise<object>}
   */
  async uploadAvatar(filePath) {
    try {
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `avatars/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
        filePath: filePath
      });

      return {
        success: true,
        fileId: uploadResult.fileID,
        url: uploadResult.fileID
      };
    } catch (error) {
      console.error('上传头像失败:', error);
      return {
        success: false,
        error: '上传失败'
      };
    }
  }

  /**
   * 上传文件
   * @param {object} options - 上传选项
   * @returns {Promise<object>}
   */
  async uploadFile(options) {
    try {
      const { filePath, fileName, fileType } = options;

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `${fileType}/${Date.now()}_${fileName}`,
        filePath: filePath
      });

      return {
        success: true,
        fileId: uploadResult.fileID,
        url: uploadResult.fileID
      };
    } catch (error) {
      console.error('上传文件失败:', error);
      return {
        success: false,
        error: '上传失败'
      };
    }
  }

  /**
   * 提交角色申请
   * @param {object} application - 申请信息
   * @returns {Promise<object>}
   */
  async submitRoleApplication(application) {
    try {
      wx.showLoading({ title: '提交中...' });

      const res = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'submitRoleApplication',
          role: application.role,
          reason: application.reason,
          phone: application.phone,
          email: application.email,
          attachments: application.attachments || []
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        wx.showToast({
          title: '提交成功',
          icon: 'success'
        });

        return res.result;
      } else {
        throw new Error(res.result?.error?.message || '提交失败');
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'error'
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取申请状态
   * @returns {Promise<object>}
   */
  async getApplicationStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'getApplicationStatus'
        }
      });

      return res.result;
    } catch (error) {
      console.error('获取申请状态失败:', error);
      return {
        success: false,
        error: '获取状态失败'
      };
    }
  }

  /**
   * 检查是否需要完善资料
   * @returns {boolean}
   */
  needsProfileCompletion() {
    if (!this.currentUser) {
      return true;
    }

    const profile = this.currentUser.profile;
    return !profile || !profile.realName || !profile.phone;
  }

  /**
   * 检查是否首次使用
   * @returns {boolean}
   */
  isFirstTimeUser() {
    if (!this.currentUser) {
      return true;
    }

    return !this.currentUser.profileCompletedAt;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.currentUser = null;
    this.permissions = [];
    this.lastCacheTime = 0;

    wx.removeStorageSync('user_info');
    wx.removeStorageSync('user_permissions');

    this.notifyPermissionChange();
  }

  /**
   * 登出
   */
  async logout() {
    this.clearCache();

    // 清除云开发登录状态
    try {
      await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'logout' }
      });
    } catch (error) {
      console.error('登出失败:', error);
    }

    // 跳转到首页
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }

  // ==================== 管理员功能 ====================

  /**
   * 获取申请统计数据
   * @returns {Promise<object>}
   */
  async getApplicationStats() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'getApplicationStats'
        }
      });

      return result.result || { success: false, data: {} };
    } catch (error) {
      console.error('获取申请统计失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取角色申请列表
   * @param {object} options - 查询选项
   * @returns {Promise<object>}
   */
  async getRoleApplications(options = {}) {
    try {
      const { filter = {}, page = 0, pageSize = 20 } = options;

      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'listRoleRequests',
          filter,
          page,
          pageSize
        }
      });

      return result.result || { success: false, data: {} };
    } catch (error) {
      console.error('获取申请列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批准角色申请
   * @param {string} requestId - 申请ID
   * @param {string} reason - 审核理由
   * @returns {Promise<object>}
   */
  async approveApplication(requestId, reason) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'approveRoleRequest',
          requestId,
          reason
        }
      });

      return result.result || { success: false };
    } catch (error) {
      console.error('批准申请失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 拒绝角色申请
   * @param {string} requestId - 申请ID
   * @param {string} reason - 拒绝理由
   * @returns {Promise<object>}
   */
  async rejectApplication(requestId, reason) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'rejectRoleRequest',
          requestId,
          reason
        }
      });

      return result.result || { success: false };
    } catch (error) {
      console.error('拒绝申请失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取用户列表（管理员功能）
   * @param {object} options - 查询选项
   * @returns {Promise<object>}
   */
  async getUserList(options = {}) {
    try {
      const { filter = {}, page = 0, pageSize = 20 } = options;

      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'listUsers',
          filter,
          page,
          pageSize
        }
      });

      return result.result || { success: false, data: {} };
    } catch (error) {
      console.error('获取用户列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 修改用户角色（管理员功能）
   * @param {string} userId - 用户ID
   * @param {string[]} roles - 新的角色列表
   * @param {string} reason - 修改原因
   * @returns {Promise<object>}
   */
  async modifyUserRoles(userId, roles, reason) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'modifyUserRoles',
          userId,
          roles,
          reason
        }
      });

      return result.result || { success: false };
    } catch (error) {
      console.error('修改用户角色失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建邀请码（管理员功能）
   * @param {object} options - 邀请码选项
   * @returns {Promise<object>}
   */
  async createInviteCode(options) {
    try {
      const { role, uses = 1, description = '', expiresAt = null } = options;

      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'createInvite',
          role,
          uses,
          description,
          expiresAt
        }
      });

      return result.result || { success: false };
    } catch (error) {
      console.error('创建邀请码失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取邀请码列表（管理员功能）
   * @param {object} options - 查询选项
   * @returns {Promise<object>}
   */
  async getInviteList(options = {}) {
    try {
      const { filter = {}, page = 0, pageSize = 20 } = options;

      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'listInvites',
          filter,
          page,
          pageSize
        }
      });

      return result.result || { success: false, data: {} };
    } catch (error) {
      console.error('获取邀请码列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 撤销邀请码（管理员功能）
   * @param {string} inviteId - 邀请码ID
   * @param {string} reason - 撤销原因
   * @returns {Promise<object>}
   */
  async revokeInviteCode(inviteId, reason) {
    try {
      const result = await wx.cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'revokeInvite',
          inviteId,
          reason
        }
      });

      return result.result || { success: false };
    } catch (error) {
      console.error('撤销邀请码失败:', error);
      return { success: false, error: error.message };
    }
  }
}

// 创建单例实例
const userManager = new UserManager();

module.exports = userManager;