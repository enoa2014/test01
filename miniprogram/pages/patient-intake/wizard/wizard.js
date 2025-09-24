// 患者录入向导页面
const DRAFT_STORAGE_KEY = 'patient_intake_draft';
const DRAFT_EXPIRE_DAYS = 7;

Page({
  data: {
    // 步骤配置
    steps: [
      { title: '基础信息', key: 'basic' },
      { title: '联系人', key: 'contact' },
      { title: '情况说明', key: 'situation' },
      { title: '附件上传', key: 'upload' },
      { title: '核对提交', key: 'review' }
    ],
    currentStep: 0,

    // 表单数据
    formData: {
      patientName: '',
      idType: '',
      idNumber: '',
      gender: '',
      birthDate: '',
      phone: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      backupContact: '',
      backupPhone: '',
      situation: ''
    },

    // 证件类型选项
    idTypes: ['身份证', '护照', '军官证', '其他'],
    idTypeIndex: 0,

    // 校验错误
    errors: {},

    // 配置
    situationConfig: {
      minLength: 30,
      maxLength: 500,
      example: '患者因脑瘫需要专业护理照顾，主要症状包括运动功能障碍、语言交流困难，需要协助进食、洗漱等日常生活护理，定期进行康复训练。'
    },

    uploadConfig: {
      maxFileSize: 10,
      maxCount: 5,
      allowedTypes: 'JPG、PNG、PDF、Word、Excel等'
    },

    // 上传文件列表
    uploadedFiles: [],

    // UI状态
    submitting: false,
    draftSaved: false,
    showDraftModal: false,
    today: '',

    // 患者选择相关（如果是从患者选择页面进入）
    patientKey: '',
    isEditingExisting: false
  },

  onLoad(options) {
    this.setData({
      today: this.formatDate(new Date())
    });

    // 首先加载配置
    this.loadConfig().then(() => {
      // 检查是否是编辑已有患者
      if (options.patientKey) {
        this.setData({
          patientKey: options.patientKey,
          isEditingExisting: true
        });
        this.loadPatientData(options.patientKey);
      } else {
        // 检查是否有草稿
        this.checkForDraft();
      }

      // 初始化必填项状态
      this.updateRequiredFields();
    });
  },

  onShow() {
    // 定期保存草稿
    this.startDraftAutoSave();
  },

  onHide() {
    this.stopDraftAutoSave();
  },

  onUnload() {
    this.stopDraftAutoSave();
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 加载配置
  async loadConfig() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'patientIntake',
        data: { action: 'getConfig' }
      });

      if (res.result && res.result.success) {
        const config = res.result.data;

        // 更新情况说明配置
        if (config.situationConfig) {
          this.setData({
            situationConfig: config.situationConfig
          });
        }

        // 更新上传配置
        if (config.uploadConfig) {
          this.setData({
            uploadConfig: config.uploadConfig
          });
        }
      }
    } catch (error) {
      console.error('加载配置失败', error);
      // 使用默认配置
    }
  },

  // 检查草稿
  checkForDraft() {
    try {
      const draft = wx.getStorageSync(DRAFT_STORAGE_KEY);
      if (draft && draft.data && draft.timestamp) {
        const now = Date.now();
        const expireTime = DRAFT_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
        if (now - draft.timestamp < expireTime) {
          this.setData({ showDraftModal: true });
          return;
        }
      }
    } catch (error) {
      console.warn('检查草稿失败', error);
    }
  },

  // 恢复草稿
  restoreDraft() {
    try {
      const draft = wx.getStorageSync(DRAFT_STORAGE_KEY);
      if (draft && draft.data) {
        this.setData({
          formData: { ...this.data.formData, ...draft.data.formData },
          currentStep: draft.data.currentStep || 0,
          uploadedFiles: draft.data.uploadedFiles || [],
          showDraftModal: false
        });
        this.updateRequiredFields();
        wx.showToast({
          title: '草稿已恢复',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('恢复草稿失败', error);
      this.setData({ showDraftModal: false });
    }
  },

  // 丢弃草稿
  discardDraft() {
    try {
      wx.removeStorageSync(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn('删除草稿失败', error);
    }
    this.setData({ showDraftModal: false });
  },

  // 保存草稿
  saveDraft() {
    try {
      const draftData = {
        formData: this.data.formData,
        currentStep: this.data.currentStep,
        uploadedFiles: this.data.uploadedFiles
      };
      wx.setStorageSync(DRAFT_STORAGE_KEY, {
        data: draftData,
        timestamp: Date.now()
      });
      this.setData({ draftSaved: true });
      setTimeout(() => {
        this.setData({ draftSaved: false });
      }, 2000);
    } catch (error) {
      console.warn('保存草稿失败', error);
    }
  },

  // 自动保存草稿
  startDraftAutoSave() {
    this.draftTimer = setInterval(() => {
      this.saveDraft();
    }, 30000); // 30秒保存一次
  },

  stopDraftAutoSave() {
    if (this.draftTimer) {
      clearInterval(this.draftTimer);
      this.draftTimer = null;
    }
  },

  // 加载患者数据（编辑已有患者时）
  async loadPatientData(patientKey) {
    try {
      wx.showLoading({ title: '加载中...' });

      const res = await wx.cloud.callFunction({
        name: 'patientIntake',
        data: { action: 'getPatientDetail', patientKey }
      });

      if (!res.result || res.result.success === false) {
        const errorMessage = (res.result && res.result.error && res.result.error.message) || '加载患者资料失败';
        throw new Error(errorMessage);
      }

      const payload = res.result.data || {};
      const patient = payload.patient || {};
      const latestIntake = payload.latestIntake || {};
      const intakeInfo = latestIntake.intakeInfo || {};

      const normalizedBirthDate = this.normalizeDateInput(patient.birthDate);
      const situationText = intakeInfo.situation || patient.lastIntakeNarrative || '';

      const nextFormData = {
        ...this.data.formData,
        patientName: patient.patientName || '',
        idType: patient.idType || '身份证',
        idNumber: patient.idNumber || '',
        gender: patient.gender || '',
        birthDate: normalizedBirthDate,
        phone: patient.phone || '',
        address: patient.address || '',
        emergencyContact: patient.emergencyContact || '',
        emergencyPhone: patient.emergencyPhone || '',
        backupContact: patient.backupContact || '',
        backupPhone: patient.backupPhone || '',
        situation: situationText
      };

      const idTypeIndex = this.data.idTypes.indexOf(nextFormData.idType || '身份证');

      this.setData({
        formData: nextFormData,
        idTypeIndex: idTypeIndex >= 0 ? idTypeIndex : 0
      });

      this.updateRequiredFields();

    } catch (error) {
      console.error('加载患者数据失败', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
    }
  },

  normalizeDateInput(value) {
    if (!value) {
      return '';
    }
    if (typeof value === 'number') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return this.formatDate(date);
      }
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
      }
      const normalized = value.replace(/[./]/g, '-');
      const date = new Date(normalized);
      if (!isNaN(date.getTime())) {
        return this.formatDate(date);
      }
    }
    return '';
  },

  // 更新必填项状态
  updateRequiredFields() {
    const { currentStep, formData } = this.data;
    let requiredFields = [];
    let requiredFieldsText = '';

    switch (currentStep) {
      case 0: // 基础信息
        const basicRequired = [
          { key: 'patientName', label: '姓名' },
          { key: 'idType', label: '证件类型' },
          { key: 'idNumber', label: '证件号码' },
          { key: 'gender', label: '性别' },
          { key: 'birthDate', label: '出生日期' }
        ];
        requiredFields = basicRequired.filter(field => !formData[field.key]);
        break;

      case 1: // 联系人
        const contactRequired = [
          { key: 'address', label: '常住地址' },
          { key: 'emergencyContact', label: '紧急联系人' },
          { key: 'emergencyPhone', label: '紧急联系人电话' }
        ];
        requiredFields = contactRequired.filter(field => !formData[field.key]);
        break;

      case 2: // 情况说明
        if (!formData.situation || formData.situation.length < this.data.situationConfig.minLength) {
          requiredFields.push({ key: 'situation', label: '情况说明' });
        }
        break;

      case 3: // 附件上传 - 选填
        break;

      case 4: // 核对提交
        requiredFields = this.getAllMissingRequiredFields();
        break;
    }

    requiredFieldsText = requiredFields.map(field => field.label).join('、');

    const canProceedToNext = requiredFields.length === 0;
    const allRequiredCompleted = this.getAllMissingRequiredFields().length === 0;

    this.setData({
      currentStepData: {
        ...this.data.steps[currentStep],
        requiredFields,
        requiredFieldsText
      },
      requiredFieldsCount: requiredFields.length,
      canProceedToNext,
      allRequiredCompleted
    });
  },

  // 获取所有缺失的必填项
  getAllMissingRequiredFields() {
    const { formData, situationConfig } = this.data;
    const allRequired = [
      { key: 'patientName', label: '姓名' },
      { key: 'idNumber', label: '证件号码' },
      { key: 'gender', label: '性别' },
      { key: 'birthDate', label: '出生日期' },
      { key: 'address', label: '常住地址' },
      { key: 'emergencyContact', label: '紧急联系人' },
      { key: 'emergencyPhone', label: '紧急联系人电话' }
    ];

    let missing = allRequired.filter(field => !formData[field.key]);

    // 检查情况说明
    if (!formData.situation || formData.situation.length < situationConfig.minLength) {
      missing.push({ key: 'situation', label: '情况说明' });
    }

    return missing;
  },

  // 输入框变化
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: '' // 清除错误
    });

    // 实时校验
    this.validateField(field, value);
    this.updateRequiredFields();
  },

  // 选择器变化
  onPickerChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    if (field === 'idType') {
      this.setData({
        idTypeIndex: value,
        [`formData.${field}`]: this.data.idTypes[value],
        [`errors.${field}`]: ''
      });
    }

    this.updateRequiredFields();
  },

  // 单选按钮变化
  onRadioChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: ''
    });

    this.updateRequiredFields();
  },

  // 日期选择变化
  onDateChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: ''
    });

    this.updateRequiredFields();
  },

  // 字段校验
  validateField(field, value) {
    let error = '';

    switch (field) {
      case 'patientName':
        if (!value || !value.trim()) {
          error = '请输入患者姓名';
        }
        break;

      case 'idNumber':
        if (!value || !value.trim()) {
          error = '请输入证件号码';
        } else if (this.data.formData.idType === '身份证' && !/^[1-9]\d{17}$/.test(value)) {
          error = '身份证号码格式不正确';
        }
        break;

      case 'phone':
      case 'emergencyPhone':
      case 'backupPhone':
        if (value && !/^1[3-9]\d{9}$/.test(value)) {
          error = '手机号码格式不正确';
        }
        break;

      case 'situation':
        if (value.length < this.data.situationConfig.minLength) {
          error = `情况说明至少需要${this.data.situationConfig.minLength}字`;
        } else if (!this.checkSituationKeywords(value)) {
          error = '情况说明应包含护理需求或症状相关信息';
        }
        break;
    }

    if (error) {
      this.setData({
        [`errors.${field}`]: error
      });
    }

    return !error;
  },

  // 检查情况说明关键词
  checkSituationKeywords(text) {
    const keywords = ['护理', '症状', '康复', '治疗', '病情', '照顾', '功能', '障碍', '需要', '协助'];
    return keywords.some(keyword => text.includes(keyword));
  },

  // 步骤导航点击
  onStepTap(e) {
    const { step } = e.currentTarget.dataset;
    if (step <= this.data.currentStep) {
      this.setData({ currentStep: step });
      this.updateRequiredFields();
    }
  },

  // 上一步
  onPrevStep() {
    if (this.data.currentStep > 0) {
      this.setData({
        currentStep: this.data.currentStep - 1
      });
      this.updateRequiredFields();
    }
  },

  // 下一步
  onNextStep() {
    if (this.validateCurrentStep()) {
      this.setData({
        currentStep: this.data.currentStep + 1
      });
      this.updateRequiredFields();
      this.saveDraft(); // 完成步骤后保存草稿
    }
  },

  // 校验当前步骤
  validateCurrentStep() {
    const { currentStep, formData } = this.data;
    let isValid = true;
    const errors = {};

    switch (currentStep) {
      case 0: // 基础信息
        if (!formData.patientName || !formData.patientName.trim()) {
          errors.patientName = '请输入患者姓名';
          isValid = false;
        }
        if (!formData.idNumber || !formData.idNumber.trim()) {
          errors.idNumber = '请输入证件号码';
          isValid = false;
        } else if (!this.validateField('idNumber', formData.idNumber)) {
          isValid = false;
        }
        if (!formData.gender) {
          errors.gender = '请选择性别';
          isValid = false;
        }
        if (!formData.birthDate) {
          errors.birthDate = '请选择出生日期';
          isValid = false;
        }
        if (formData.phone && !this.validateField('phone', formData.phone)) {
          isValid = false;
        }
        break;

      case 1: // 联系人
        if (!formData.address || !formData.address.trim()) {
          errors.address = '请输入常住地址';
          isValid = false;
        }
        if (!formData.emergencyContact || !formData.emergencyContact.trim()) {
          errors.emergencyContact = '请输入紧急联系人';
          isValid = false;
        }
        if (!formData.emergencyPhone || !formData.emergencyPhone.trim()) {
          errors.emergencyPhone = '请输入紧急联系人电话';
          isValid = false;
        } else if (!this.validateField('emergencyPhone', formData.emergencyPhone)) {
          isValid = false;
        }
        if (formData.backupPhone && !this.validateField('backupPhone', formData.backupPhone)) {
          isValid = false;
        }
        break;

      case 2: // 情况说明
        if (!formData.situation || formData.situation.length < this.data.situationConfig.minLength) {
          errors.situation = `情况说明至少需要${this.data.situationConfig.minLength}字`;
          isValid = false;
        } else if (!this.checkSituationKeywords(formData.situation)) {
          errors.situation = '情况说明应包含护理需求或症状相关信息';
          isValid = false;
        }
        break;
    }

    if (!isValid) {
      this.setData({ errors });
      // 聚焦到第一个错误字段
      const firstError = Object.keys(errors)[0];
      if (firstError) {
        wx.showToast({
          title: errors[firstError],
          icon: 'none',
          duration: 3000
        });
      }
    }

    return isValid;
  },

  // 选择文件
  chooseFile() {
    const that = this;
    wx.chooseMessageFile({
      count: this.data.uploadConfig.maxCount - this.data.uploadedFiles.length,
      type: 'all',
      success(res) {
        that.uploadFiles(res.tempFiles);
      },
      fail(error) {
        console.error('选择文件失败', error);
        wx.showToast({
          title: '选择文件失败',
          icon: 'error'
        });
      }
    });
  },

  // 上传文件
  async uploadFiles(files) {
    for (const file of files) {
      if (this.data.uploadedFiles.length >= this.data.uploadConfig.maxCount) {
        wx.showToast({
          title: `最多只能上传${this.data.uploadConfig.maxCount}个文件`,
          icon: 'none'
        });
        break;
      }

      try {
        await this.uploadSingleFile(file);
      } catch (error) {
        console.error('上传文件失败', error);
        wx.showToast({
          title: `上传${file.name}失败`,
          icon: 'error'
        });
      }
    }
  },

  // 上传单个文件
  async uploadSingleFile(file) {
    // 检查文件大小
    if (file.size > this.data.uploadConfig.maxFileSize * 1024 * 1024) {
      throw new Error(`文件超过${this.data.uploadConfig.maxFileSize}MB限制`);
    }

    wx.showLoading({ title: '上传中...' });

    try {
      // 这里应该调用 patientMedia 云函数
      // 暂时模拟上传成功
      const uploadedFile = {
        id: Date.now().toString(),
        displayName: file.name,
        sizeText: this.formatFileSize(file.size),
        category: file.type?.startsWith('image/') ? 'image' : 'document'
      };

      this.setData({
        uploadedFiles: [...this.data.uploadedFiles, uploadedFile]
      });

      wx.showToast({
        title: '上传成功',
        icon: 'success'
      });

    } finally {
      wx.hideLoading();
    }
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  },

  // 预览文件
  previewFile(e) {
    const { id } = e.currentTarget.dataset;
    // 这里应该调用预览接口
    wx.showToast({
      title: '预览功能开发中',
      icon: 'none'
    });
  },

  // 删除文件
  deleteFile(e) {
    const { id } = e.currentTarget.dataset;
    const uploadedFiles = this.data.uploadedFiles.filter(file => file.id !== id);
    this.setData({ uploadedFiles });

    wx.showToast({
      title: '删除成功',
      icon: 'success'
    });
  },

  // 提交表单
  async onSubmit() {
    if (!this.data.allRequiredCompleted) {
      wx.showToast({
        title: '请完成所有必填项',
        icon: 'none'
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      // 这里应该调用云函数提交数据
      await this.submitIntakeData();

      // 清除草稿
      try {
        wx.removeStorageSync(DRAFT_STORAGE_KEY);
      } catch (error) {
        console.warn('清除草稿失败', error);
      }

      // 跳转到成功页面
      wx.redirectTo({
        url: '/pages/patient-intake/success/success'
      });

    } catch (error) {
      console.error('提交失败', error);
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error'
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 提交入住数据
  async submitIntakeData() {
    const { formData, uploadedFiles, isEditingExisting, patientKey } = this.data;

    // 构建提交数据
    const submitData = {
      action: 'submit',
      patientKey: isEditingExisting ? patientKey : null,
      formData,
      uploadedFiles,
      timestamp: Date.now()
    };

    // 调用云函数
    const res = await wx.cloud.callFunction({
      name: 'patientIntake',
      data: submitData
    });

    if (!res.result || !res.result.success) {
      throw new Error(res.result?.error?.message || '提交失败');
    }

    return res.result;
  }
});
