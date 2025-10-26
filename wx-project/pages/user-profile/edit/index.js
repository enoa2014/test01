// pages/user-profile/edit/index.js
const userManager = require('../../../utils/user-manager');
const { FormValidator, Validators } = require('../../../utils/validators');

Page({
  data: {
    profile: {
      avatar: '',
      realName: '',
      gender: '',
      phone: '',
      email: '',
      birthday: '',
      occupation: '',
      organization: '',
      employeeId: '',
      bio: '',
      emergencyContact: {
        name: '',
        phone: '',
        relationship: ''
      }
    },
    occupations: [
      { value: 'social_worker', label: '社工' },
      { value: 'volunteer', label: '志愿者' },
      { value: 'medical_staff', label: '医务人员' },
      { value: 'teacher', label: '教师' },
      { value: 'student', label: '学生' },
      { value: 'other', label: '其他' }
    ],
    occupationIndex: -1,
    relationships: [
      { value: 'spouse', label: '配偶' },
      { value: 'parent', label: '父母' },
      { value: 'child', label: '子女' },
      { value: 'sibling', label: '兄弟姐妹' },
      { value: 'friend', label: '朋友' },
      { value: 'other', label: '其他' }
    ],
    relationshipIndex: -1,
    saving: false,
    canSave: false,
    validator: null,
    errors: {},
    showAvatarPreview: false,
    isLoading: true
  },

  onLoad(options) {
    this.initPage();
  },

  onShow() {
    // 页面显示时重新获取用户信息
    this.loadUserProfile();
  },

  /**
   * 初始化页面
   */
  async initPage() {
    // 初始化表单验证器
    const validator = new FormValidator({
      realName: {
        required: true,
        type: 'name'
      },
      phone: {
        required: true,
        type: 'phone'
      },
      email: {
        required: false,
        type: 'email'
      },
      birthday: {
        required: false,
        type: 'date'
      },
      occupation: {
        required: false,
        type: 'occupation'
      },
      organization: {
        required: false
      },
      employeeId: {
        required: false
      },
      bio: {
        required: false,
        maxLength: 200
      },
      'emergencyContact.name': {
        required: false
      },
      'emergencyContact.phone': {
        required: false,
        type: 'phone'
      },
      'emergencyContact.relationship': {
        required: false
      }
    });

    this.setData({ validator });
    await this.loadUserProfile();
  },

  /**
   * 加载用户资料
   */
  async loadUserProfile() {
    try {
      this.setData({ isLoading: true });

      const user = await userManager.getCurrentUser();

      if (user && user.profile) {
        const profile = user.profile;

        // 设置职业索引
        const occupationIndex = this.data.occupations.findIndex(
          occ => occ.value === profile.occupation
        );

        // 设置关系索引
        const relationshipIndex = profile.emergencyContact?.relationship
          ? this.data.relationships.findIndex(
              rel => rel.value === profile.emergencyContact.relationship
            )
          : -1;

        this.setData({
          profile: {
            avatar: profile.avatar || '',
            realName: profile.realName || '',
            gender: profile.gender || '',
            phone: profile.phone || '',
            email: profile.email || '',
            birthday: profile.birthday || '',
            occupation: profile.occupation || '',
            organization: profile.organization || '',
            employeeId: profile.employeeId || '',
            bio: profile.bio || '',
            emergencyContact: {
              name: profile.emergencyContact?.name || '',
              phone: profile.emergencyContact?.phone || '',
              relationship: profile.emergencyContact?.relationship || ''
            }
          },
          occupationIndex: occupationIndex >= 0 ? occupationIndex : -1,
          relationshipIndex: relationshipIndex >= 0 ? relationshipIndex : -1
        });

        this.validateForm();
      }

      this.setData({ isLoading: false });
    } catch (error) {
      console.error('加载用户资料失败:', error);
      this.setData({ isLoading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    }
  },

  /**
   * 表单输入处理
   */
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    if (field.includes('.')) {
      // 嵌套字段处理
      const [parent, child] = field.split('.');
      this.setData({
        [`profile.${parent}.${child}`]: value
      });
    } else {
      this.setData({
        [`profile.${field}`]: value
      });
    }

    this.validateField(field, value);
  },

  /**
   * 性别选择处理
   */
  onGenderChange(e) {
    const value = e.detail.value;
    this.setData({
      'profile.gender': value
    });
    this.validateField('gender', value);
  },

  /**
   * 职业选择处理
   */
  onOccupationChange(e) {
    const index = e.detail.value;
    const occupation = this.data.occupations[index];

    this.setData({
      occupationIndex: index,
      'profile.occupation': occupation.value
    });

    this.validateField('occupation', occupation.value);
  },

  /**
   * 关系选择处理
   */
  onRelationshipChange(e) {
    const index = e.detail.value;
    const relationship = this.data.relationships[index];

    this.setData({
      relationshipIndex: index,
      'profile.emergencyContact.relationship': relationship.value
    });

    this.validateField('emergencyContact.relationship', relationship.value);
  },

  /**
   * 生日选择处理
   */
  onBirthdayChange(e) {
    const value = e.detail.value;
    this.setData({
      'profile.birthday': value
    });
    this.validateField('birthday', value);
  },

  /**
   * 选择头像
   */
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadAvatar(tempFilePath);
      },
      fail: (error) => {
        console.error('选择图片失败:', error);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 上传头像
   */
  async uploadAvatar(filePath) {
    try {
      wx.showLoading({ title: '上传中...' });

      // 生成文件名
      const fileExt = filePath.split('.').pop();
      const fileName = `avatar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `avatars/${fileName}`,
        filePath: filePath
      });

      if (uploadResult.fileID) {
        this.setData({
          'profile.avatar': uploadResult.fileID,
          showAvatarPreview: true
        });

        // 3秒后隐藏预览
        setTimeout(() => {
          this.setData({ showAvatarPreview: false });
        }, 3000);

        wx.hideLoading();
        wx.showToast({
          title: '头像上传成功',
          icon: 'success'
        });
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '头像上传失败',
        icon: 'error'
      });
      console.error('头像上传失败:', error);
    }
  },

  /**
   * 删除头像
   */
  deleteAvatar() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除当前头像吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            'profile.avatar': '',
            showAvatarPreview: false
          });
        }
      }
    });
  },

  /**
   * 预览头像
   */
  previewAvatar() {
    if (!this.data.profile.avatar) return;

    wx.previewImage({
      urls: [this.data.profile.avatar],
      current: this.data.profile.avatar
    });
  },

  /**
   * 验证单个字段
   */
  validateField(field, value) {
    if (!this.data.validator) return;

    const isValid = this.data.validator.validateField(field, value);
    const errors = this.data.validator.getFieldErrors(field);

    this.setData({
      [`errors.${field}`]: errors
    });

    this.updateCanSave();
  },

  /**
   * 验证整个表单
   */
  validateForm() {
    if (!this.data.validator) return;

    const isValid = this.data.validator.validate(this.data.profile);
    const errors = this.data.validator.getErrors();

    this.setData({
      errors,
      canSave: isValid
    });

    return isValid;
  },

  /**
   * 更新保存按钮状态
   */
  updateCanSave() {
    if (!this.data.validator) return;

    const isValid = this.data.validator.validate(this.data.profile);
    this.setData({ canSave: isValid });
  },

  /**
   * 获取字段错误信息
   */
  getFieldError(field) {
    return this.data.validator.getFirstError(field);
  },

  /**
   * 保存资料
   */
  async handleSave() {
    if (this.data.saving || !this.data.canSave) {
      return;
    }

    // 最后验证一次表单
    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查表单内容',
        icon: 'none'
      });
      return;
    }

    this.setData({ saving: true });

    try {
      const result = await userManager.updateProfile(this.data.profile);

      if (result.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });

        // 延迟返回上一页或跳转到首页
        setTimeout(() => {
          const pages = getCurrentPages();
          if (pages.length > 1) {
            wx.navigateBack();
          } else {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        }, 1500);
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error) {
      console.error('保存资料失败:', error);
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'error'
      });
    } finally {
      this.setData({ saving: false });
    }
  },

  /**
   * 重置表单
   */
  resetForm() {
    wx.showModal({
      title: '确认重置',
      content: '确定要重置所有表单内容吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            profile: {
              avatar: '',
              realName: '',
              gender: '',
              phone: '',
              email: '',
              birthday: '',
              occupation: '',
              organization: '',
              employeeId: '',
              bio: '',
              emergencyContact: {
                name: '',
                phone: '',
                relationship: ''
              }
            },
            occupationIndex: -1,
            relationshipIndex: -1,
            errors: {},
            canSave: false
          });

          this.data.validator.clearErrors();
        }
      }
    });
  },

  /**
   * 查看帮助
   */
  showHelp() {
    wx.showModal({
      title: '填写说明',
      content: '请如实填写您的个人信息，带*号的项目为必填项。所有信息将严格保密，仅用于系统管理和身份验证。',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  /**
   * 页面分享
   */
  onShareAppMessage() {
    return {
      title: '个人资料管理',
      desc: '完善您的个人信息',
      path: '/pages/user-profile/edit'
    };
  }
});