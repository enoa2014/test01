// 住户录入向导页面
const PATIENT_LIST_DIRTY_KEY = 'patient_list_dirty';

const STEP_DEFINITIONS = [
  { title: '基础信息', key: 'basic' },
  { title: '联系人', key: 'contact' },
  { title: '情况说明', key: 'situation' },
  { title: '附件上传', key: 'upload' },
  { title: '核对提交', key: 'review' },
];

function buildSteps(isEditingExisting = false, mode = 'intake') {
  return STEP_DEFINITIONS.map((step, index) => {
    let hidden = false;
    if (isEditingExisting && (step.key === 'basic' || step.key === 'contact')) {
      hidden = true;
    }
    if (mode === 'create' && (step.key === 'situation' || step.key === 'upload')) {
      hidden = true;
    }
    return {
      ...step,
      originalIndex: index,
      hidden,
    };
  });
}

function getVisibleSteps(steps) {
  return steps.filter(step => !step.hidden);
}

const INITIAL_STEPS = buildSteps(false, 'intake');
const INITIAL_VISIBLE_STEPS = getVisibleSteps(INITIAL_STEPS);

const logger = require('../../../utils/logger');

const DRAFT_STORAGE_KEY = 'patient_intake_draft';
const DRAFT_EXPIRE_DAYS = 7;

Page({
  data: {
    // 步骤配置
    steps: INITIAL_STEPS,
    visibleSteps: INITIAL_VISIBLE_STEPS,
    totalVisibleSteps: INITIAL_VISIBLE_STEPS.length,
    currentVisibleStepNumber: INITIAL_VISIBLE_STEPS.length ? 1 : 0,
    hasPrevStep: false,
    hasNextStep: INITIAL_VISIBLE_STEPS.length > 1,
    currentStep: INITIAL_VISIBLE_STEPS.length ? INITIAL_VISIBLE_STEPS[0].originalIndex : 0,

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
      situation: '',
    },

    // 证件类型选项
    idTypes: ['身份证', '护照', '军官证', '其他'],
    idTypeIndex: 0,

    // 校验错误
    errors: {},

    // 配置
    situationConfig: {
      minLength: 0,
      maxLength: 500,
      example:
        '住户因脑瘫需要专业护理照顾，主要症状包括运动功能障碍、语言交流困难，需要协助进食、洗漱等日常生活护理，定期进行康复训练。',
    },

    uploadConfig: {
      maxFileSize: 10,
      maxCount: 5,
      allowedTypes: 'JPG、PNG、PDF、Word、Excel等',
    },

    // 上传文件列表
    uploadedFiles: [],

    // UI状态
    submitting: false,
    draftSaved: false,
    showDraftModal: false,
    today: '',

    // 住户选择相关（如果是从住户选择页面进入）
    patientKey: '',
    isEditingExisting: false,
    mode: 'intake',
    excelRecordKey: '',
  },

  onLoad(options) {
    const mode = options && options.mode === 'create' ? 'create' : 'intake';
    const isEditingExisting = Boolean(options.patientKey);

    this.configureSteps(isEditingExisting, mode);

    this.setData({
      today: this.formatDate(new Date()),
      patientKey: options.patientKey || '',
      mode,
    });

    wx.setNavigationBarTitle({
      title: mode === 'create' ? '新建住户档案' : '入住办理',
    });

    // 首先加载配置
    this.loadConfig().then(() => {
      if (isEditingExisting && options.patientKey) {
        this.loadPatientData(options.patientKey);
      } else {
        // 检查是否有草稿
        this.checkForDraft();
      }

      // 初始化必填项状态
      this.ensureCurrentStepVisible();
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

  // 去除 Excel 导入数据中的多余空格/全角空格
  normalizeExcelSpacing(value) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'number') {
      return String(value).trim();
    }

    if (typeof value !== 'string') {
      return String(value || '').trim();
    }

    return value
      .replace(/\u3000/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\r\n|\r/g, '\n')
      .split('\n')
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0)
      .join('\n');
  },

  _parseContactInfo(rawValue) {
    if (!rawValue && rawValue !== 0) {
      return null;
    }

    if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        const parsed = this._parseContactInfo(item);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    }

    if (typeof rawValue === 'object') {
      const keys = Object.keys(rawValue || {});
      if (!keys.length) {
        return null;
      }

      const pickByRegex = (patterns) => {
        for (const key of keys) {
          if (patterns.some(pattern => pattern.test(key))) {
            const value = this.normalizeExcelSpacing(rawValue[key]);
            if (value) {
              return value;
            }
          }
        }
        return '';
      };

      const phone = pickByRegex([/phone/i, /mobile/i, /tel/i, /contactPhone/i]);
      const name = pickByRegex([/name/i, /contact/i, /guardian/i, /relation/i]);

      if (phone && name) {
        return { name, phone };
      }

      const flattened = keys
        .map(key => {
          const value = rawValue[key];
          if (typeof value === 'string' || typeof value === 'number') {
            return value;
          }
          return '';
        })
        .filter(Boolean)
        .join(' ');

      if (flattened) {
        return this._parseContactInfo(flattened);
      }
      return null;
    }

    const value = this.normalizeExcelSpacing(rawValue);
    if (!value) {
      return null;
    }

    const digitsOnly = value.replace(/[^0-9]/g, '');
    const phoneMatch = digitsOnly.match(/1[3-9]\d{9}/);
    if (!phoneMatch) {
      return null;
    }
    const phone = phoneMatch[0];

    let name = value
      .replace(/[^\u4e00-\u9fa5A-Za-z]+/g, ' ')
      .replace(/1[3-9]\d{9}/g, ' ');
    name = name
      .replace(/\d{15,18}[Xx]?/g, ' ')
      .replace(/身份证|证件|电话号码|联系电话|联系方式|手机|手机号/g, ' ')
      .replace(/[\(\)（）:\-]/g, ' ')
      .replace(/[,，、;；]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) {
      return null;
    }
    return { name, phone };
  },

  _preferContact(...candidates) {
    for (const item of candidates) {
      if (item && item.emergencyContact && item.emergencyPhone) {
        return item;
      }
    }
    return null;
  },

  _extractContactFromPatientDoc(patientDoc = {}) {
    const emergencyContact = this.normalizeExcelSpacing(patientDoc.emergencyContact);
    const emergencyPhone = this.normalizeExcelSpacing(patientDoc.emergencyPhone);
    if (emergencyContact && emergencyPhone) {
      return { emergencyContact, emergencyPhone };
    }

    const backupContact = this.normalizeExcelSpacing(patientDoc.backupContact);
    const backupPhone = this.normalizeExcelSpacing(patientDoc.backupPhone);
    if (backupContact && backupPhone) {
      return { emergencyContact: backupContact, emergencyPhone: backupPhone };
    }

    const parsedPrimary = this._parseContactInfo(patientDoc.primaryGuardianInfo);
    if (parsedPrimary) {
      return {
        emergencyContact: parsedPrimary.name,
        emergencyPhone: parsedPrimary.phone,
      };
    }

    const parsedFather = this._parseContactInfo({
      name: patientDoc.fatherContactName,
      phone: patientDoc.fatherContactPhone,
      raw: patientDoc.fatherInfo,
    });
    if (parsedFather) {
      return {
        emergencyContact: parsedFather.name,
        emergencyPhone: parsedFather.phone,
      };
    }

    const parsedMother = this._parseContactInfo({
      name: patientDoc.motherContactName,
      phone: patientDoc.motherContactPhone,
      raw: patientDoc.motherInfo,
    });
    if (parsedMother) {
      return {
        emergencyContact: parsedMother.name,
        emergencyPhone: parsedMother.phone,
      };
    }

    const parsedGuardian = this._parseContactInfo({
      name: patientDoc.guardianContactName,
      phone: patientDoc.guardianContactPhone,
      raw: patientDoc.guardianInfo,
    });
    if (parsedGuardian) {
      return {
        emergencyContact: parsedGuardian.name,
        emergencyPhone: parsedGuardian.phone,
      };
    }

    if (patientDoc.contactInfo) {
      const parsed = this._parseContactInfo(patientDoc.contactInfo);
      if (parsed) {
        return {
          emergencyContact: parsed.name,
          emergencyPhone: parsed.phone,
        };
      }
    }

    return null;
  },

  _extractContactFromRecords(records = []) {
    if (!Array.isArray(records) || !records.length) {
      return null;
    }
    for (const record of records) {
      if (!record) {
        continue;
      }
      if (record.contactInfo) {
        const contactInfoParsed = this._parseContactInfo(record.contactInfo);
        if (contactInfoParsed) {
          return {
            emergencyContact: contactInfoParsed.name,
            emergencyPhone: contactInfoParsed.phone,
          };
        }
      }
      const motherParsed = this._parseContactInfo(record.motherInfo);
      if (motherParsed) {
        return {
          emergencyContact: motherParsed.name,
          emergencyPhone: motherParsed.phone,
        };
      }
      const fatherParsed = this._parseContactInfo(record.fatherInfo);
      if (fatherParsed) {
        return {
          emergencyContact: fatherParsed.name,
          emergencyPhone: fatherParsed.phone,
        };
      }
      const caregiverParsed = this._parseContactInfo(record.caregivers);
      if (caregiverParsed) {
        return {
          emergencyContact: caregiverParsed.name,
          emergencyPhone: caregiverParsed.phone,
        };
      }
    }
    return null;
  },

  // 加载配置
  async loadConfig() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'patientIntake',
        data: { action: 'getConfig' },
      });

      if (res.result && res.result.success) {
        const config = res.result.data;

        // 更新情况说明配置
        if (config.situationConfig) {
          this.setData({
        situationConfig: {
          ...this.data.situationConfig,
          ...config.situationConfig,
          minLength: Math.max(0, Number((config.situationConfig && config.situationConfig.minLength) || 0)),
          maxLength: Math.max(0, Number((config.situationConfig && config.situationConfig.maxLength) || this.data.situationConfig.maxLength || 0)),
        },
          });
        }

        // 更新上传配置
        if (config.uploadConfig) {
          this.setData({
            uploadConfig: config.uploadConfig,
          });
        }
      }
    } catch (error) {
      logger.error('加载配置失败', error);
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
        }
      }
    } catch (error) {
      // 忽略草稿读取异常，避免干扰流程
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
          showDraftModal: false,
        });
        this.ensureCurrentStepVisible();
        this.updateRequiredFields();
        wx.showToast({
          title: '草稿已恢复',
          icon: 'success',
        });
      }
    } catch (error) {
      logger.error('恢复草稿失败', error);
      this.setData({ showDraftModal: false });
    }
  },

  // 丢弃草稿
  discardDraft() {
    try {
      wx.removeStorageSync(DRAFT_STORAGE_KEY);
    } catch (error) {
      // 忽略草稿删除异常
    }
    this.setData({ showDraftModal: false });
  },

  // 保存草稿
  saveDraft() {
    try {
      const draftData = {
        formData: this.data.formData,
        currentStep: this.data.currentStep,
        uploadedFiles: this.data.uploadedFiles,
      };
      wx.setStorageSync(DRAFT_STORAGE_KEY, {
        data: draftData,
        timestamp: Date.now(),
      });
      this.setData({ draftSaved: true });
      setTimeout(() => {
        this.setData({ draftSaved: false });
      }, 2000);
    } catch (error) {
      // 忽略草稿保存异常
    }
  },

  // 自动保存草稿
  startDraftAutoSave() {
    if (this.draftTimer) {
      return;
    }
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

  configureSteps(isEditingExisting, mode = this.data.mode || 'intake') {
    const steps = buildSteps(isEditingExisting, mode);
    const firstVisibleStep = this.getFirstVisibleStepIndex(steps);

    this.setData({
      steps,
      currentStep: firstVisibleStep,
      isEditingExisting,
      mode,
    });

    this.refreshVisibleStepMeta(steps, firstVisibleStep);
  },

  refreshVisibleStepMeta(stepsOverride, currentStepOverride) {
    const steps = stepsOverride || this.data.steps || [];
    const currentStep =
      typeof currentStepOverride === 'number' ? currentStepOverride : this.data.currentStep;
    const visibleSteps = getVisibleSteps(steps).map(step => ({ ...step }));
    const currentVisibleIndex = visibleSteps.findIndex(step => step.originalIndex === currentStep);

    this.setData({
      visibleSteps,
      totalVisibleSteps: visibleSteps.length,
      currentVisibleStepNumber: currentVisibleIndex >= 0 ? currentVisibleIndex + 1 : 0,
      hasPrevStep: currentVisibleIndex > 0,
      hasNextStep: currentVisibleIndex >= 0 && currentVisibleIndex < visibleSteps.length - 1,
    });
  },

  getFirstVisibleStepIndex(steps) {
    const visible = (steps || []).find(step => !step.hidden);
    return visible ? visible.originalIndex : 0;
  },

  getNextVisibleStepIndex(currentStep) {
    const { steps } = this.data;
    if (!steps || !steps.length) {
      return null;
    }
    for (let i = currentStep + 1; i < steps.length; i += 1) {
      if (!steps[i].hidden) {
        return i;
      }
    }
    return null;
  },

  getPrevVisibleStepIndex(currentStep) {
    const { steps } = this.data;
    if (!steps || !steps.length) {
      return null;
    }
    for (let i = currentStep - 1; i >= 0; i -= 1) {
      if (!steps[i].hidden) {
        return i;
      }
    }
    return null;
  },

  isStepVisible(stepIndex) {
    const step = this.data.steps[stepIndex];
    return !!(step && !step.hidden);
  },

  ensureCurrentStepVisible() {
    const { steps, currentStep } = this.data;
    if (!steps || !steps.length) {
      return;
    }

    const step = steps[currentStep];
    if (!step || step.hidden) {
      const firstVisible = this.getFirstVisibleStepIndex(steps);
      this.setData({ currentStep: firstVisible });
      this.refreshVisibleStepMeta(steps, firstVisible);
      return;
    }

    this.refreshVisibleStepMeta(steps, currentStep);
  },

  revealContactStepForManualInput() {
    const currentSteps = Array.isArray(this.data.steps) ? this.data.steps : [];
    if (!currentSteps.length) {
      return;
    }

    const steps = currentSteps.map(step => ({ ...step }));
    const contactIndex = steps.findIndex(step => step.key === 'contact');
    if (contactIndex < 0) {
      return;
    }

    if (steps[contactIndex].hidden) {
      steps[contactIndex] = { ...steps[contactIndex], hidden: false };
    }

    this.setData({ steps, currentStep: contactIndex }, () => {
      this.refreshVisibleStepMeta(steps, contactIndex);
      this.updateRequiredFields();
    });
  },

  // 加载住户数据（编辑已有住户时）
  async loadPatientData(patientKey) {
    let hasPrefilled = false;
    try {
      wx.showLoading({ title: '加载中...' });

      // 方案: 先尝试使用 patientIntake.getPatientDetail (接受 patientKey)
      // 然后使用返回的 patientName 调用 patientProfile.detail 获取父母信息
      // 因为 excel_records 的 key 字段就是 patientName
      let excelRecordKey = null;
      let basicPatientInfo = null;

      try {
        const intakeRes = await wx.cloud.callFunction({
          name: 'patientIntake',
          data: { action: 'getPatientDetail', patientKey },
        });

        if (intakeRes.result && intakeRes.result.success) {
          basicPatientInfo = intakeRes.result.data;
          // excel_records 的 key 字段是 patientName
          const patientName = basicPatientInfo.patient && basicPatientInfo.patient.patientName;
          excelRecordKey = patientName;
        }
      } catch (error) {
        // ignore detail preload errors, fallback to patientKey
      }

      // 如果没有 excelRecordKey,尝试直接用 patientKey 作为 key (可能直接传的就是姓名)
      if (!excelRecordKey) {
        excelRecordKey = patientKey;
      }

      // 使用 patientProfile 获取完整的住户信息,包括父母联系方式
      let profilePayload = null;
      try {
        const res = await wx.cloud.callFunction({
          name: 'patientProfile',
          data: {
            action: 'detail',
            key: excelRecordKey, // 使用 excel_records 的 key
          },
        });

        if (res.result && res.result.success !== false) {
          profilePayload = res.result.data || res.result;
        }
      } catch (profileError) {
        // ignore profile preload errors, fallback to existing form data
      }

      this.setData({
        excelRecordKey: this.normalizeExcelSpacing(excelRecordKey || ''),
      });

      // patientProfile.detail 返回的数据直接在 result 中,而不是 result.data
      const payload = profilePayload || {};

      // 从 patientProfile 返回的数据结构中提取基本信息
      const patient = payload.patient || {};
      const basicInfoList = Array.isArray(payload.basicInfo) ? payload.basicInfo : [];
      const familyInfoList = Array.isArray(payload.familyInfo) ? payload.familyInfo : [];
      const records = Array.isArray(payload.records) ? payload.records : [];

      // 辅助函数:从信息列表中查找值
      const findValue = (list, label) => {
        const item = list.find(i => i && i.label === label);
        return item ? this.normalizeExcelSpacing(item.value) : '';
      };

      // 提取基本信息 (优先从 patient 对象获取,其次从 basicInfo 列表)
      const patientName =
        this.normalizeExcelSpacing(patient.patientName) || findValue(basicInfoList, '姓名');
      const gender = this.normalizeExcelSpacing(patient.gender) || findValue(basicInfoList, '性别');
      const birthDate = this.normalizeDateInput(
        patient.birthDate || findValue(basicInfoList, '出生日期')
      );
      const idNumber =
        this.normalizeExcelSpacing(patient.idNumber) || findValue(basicInfoList, '身份证号');

      // 提取联系信息
      const address = findValue(familyInfoList, '家庭地址');

      // 从最新的入住记录中提取医疗情况作为情况说明
      let situationText = '';
      if (records.length > 0) {
        // 取最新的一条记录
        const latestRecord = records[0];
        const medicalInfo = latestRecord.medicalInfo || {};

        const parts = [];
        if (medicalInfo.diagnosis) parts.push(`诊断: ${medicalInfo.diagnosis}`);
        if (medicalInfo.symptoms) parts.push(`症状: ${medicalInfo.symptoms}`);
        if (medicalInfo.treatmentProcess) parts.push(`治疗过程: ${medicalInfo.treatmentProcess}`);
        if (medicalInfo.followUpPlan) parts.push(`康复计划: ${medicalInfo.followUpPlan}`);

        if (parts.length > 0) {
          situationText = parts.join('。');
        } else if (latestRecord.situation) {
          situationText = this.normalizeExcelSpacing(latestRecord.situation);
        }
      }

      // 解析父母联系方式作为紧急联系人
      const { emergencyContact, emergencyPhone } =
        this._extractEmergencyContactFromProfile(familyInfoList);

      const patientFromIntake = (basicPatientInfo && basicPatientInfo.patient) || {};
      const preferString = (...candidates) => {
        for (const candidate of candidates) {
          const normalized = this.normalizeExcelSpacing(candidate);
          if (normalized) {
            return normalized;
          }
        }
        return '';
      };
      const preferDate = (...candidates) => {
        for (const candidate of candidates) {
          const normalized = this.normalizeDateInput(candidate);
          if (normalized) {
            return normalized;
          }
        }
        return '';
      };

      const resolvedPatientName = preferString(
        patientFromIntake.patientName,
        patientName,
        this.data.formData.patientName
      );
      const resolvedIdType =
        preferString(patientFromIntake.idType, this.data.formData.idType, '身份证') || '身份证';
      const resolvedIdNumber = preferString(
        patientFromIntake.idNumber,
        idNumber,
        this.data.formData.idNumber
      );
      const resolvedGender = preferString(
        patientFromIntake.gender,
        gender,
        this.data.formData.gender
      );
      const resolvedBirthDate = preferDate(
        patientFromIntake.birthDate,
        birthDate,
        this.data.formData.birthDate
      );
      const resolvedPhone = preferString(patientFromIntake.phone, this.data.formData.phone);
      const resolvedAddress = preferString(
        patientFromIntake.address,
        address,
        this.data.formData.address
      );
      const resolvedEmergencyContact = preferString(
        patientFromIntake.emergencyContact,
        emergencyContact,
        this.data.formData.emergencyContact
      );
      const resolvedEmergencyPhone = preferString(
        patientFromIntake.emergencyPhone,
        emergencyPhone,
        this.data.formData.emergencyPhone
      );
      const resolvedBackupContact = preferString(
        patientFromIntake.backupContact,
        this.data.formData.backupContact
      );
      const resolvedBackupPhone = preferString(
        patientFromIntake.backupPhone,
        this.data.formData.backupPhone
      );
      const resolvedSituation = preferString(
        situationText,
        patientFromIntake.lastIntakeNarrative,
        this.data.formData.situation
      );

      const nextFormData = {
        ...this.data.formData,
        patientName: resolvedPatientName,
        idType: resolvedIdType,
        idNumber: resolvedIdNumber,
        gender: resolvedGender,
        birthDate: resolvedBirthDate,
        phone: resolvedPhone,
        address: resolvedAddress,
        emergencyContact: resolvedEmergencyContact,
        emergencyPhone: resolvedEmergencyPhone,
        backupContact: resolvedBackupContact,
        backupPhone: resolvedBackupPhone,
        situation: resolvedSituation,
      };

      const idTypeIndex = this.data.idTypes.indexOf(nextFormData.idType || '身份证');

      this.setData({
        formData: nextFormData,
        idTypeIndex: idTypeIndex >= 0 ? idTypeIndex : 0,
      });
      hasPrefilled = true;

      this.updateRequiredFields();
    } catch (error) {
      logger.error('[预填充] 加载住户数据失败', error);
      if (!hasPrefilled) {
        wx.showToast({
          title: error.message || '加载失败',
          icon: 'error',
        });
      }
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
      case 0: {
        // 基础信息
        const basicRequired = [
          { key: 'patientName', label: '姓名' },
          { key: 'idType', label: '证件类型' },
          { key: 'idNumber', label: '证件号码' },
          { key: 'gender', label: '性别' },
          { key: 'birthDate', label: '出生日期' },
        ];
        requiredFields = basicRequired.filter(field => !formData[field.key]);
        break;
      }
      case 1: {
        // 联系人
        const contactRequired = [
          { key: 'address', label: '常住地址' },
          { key: 'emergencyContact', label: '紧急联系人' },
          { key: 'emergencyPhone', label: '紧急联系人电话' },
        ];
        requiredFields = contactRequired.filter(field => !formData[field.key]);
        break;
      }
      case 2:
        // 情况说明改为选填
        break;
      case 3: {
        // 附件上传 - 选填
        break;
      }
      case 4: {
        // 核对提交
        requiredFields = this.getAllMissingRequiredFields();
        break;
      }
    }

    requiredFieldsText = requiredFields.map(field => field.label).join('、');

    const canProceedToNext = requiredFields.length === 0;
    const allRequiredCompleted = this.getAllMissingRequiredFields().length === 0;

    this.setData({
      currentStepData: {
        ...this.data.steps[currentStep],
        requiredFields,
        requiredFieldsText,
      },
      requiredFieldsCount: requiredFields.length,
      canProceedToNext,
      allRequiredCompleted,
    });

    this.refreshVisibleStepMeta();
  },

  // 获取所有缺失的必填项
  getAllMissingRequiredFields() {
    const { formData, isEditingExisting } = this.data;
    const baseAndContactFields = [
      { key: 'patientName', label: '姓名' },
      { key: 'idNumber', label: '证件号码' },
      { key: 'gender', label: '性别' },
      { key: 'birthDate', label: '出生日期' },
      { key: 'address', label: '常住地址' },
      { key: 'emergencyContact', label: '紧急联系人' },
      { key: 'emergencyPhone', label: '紧急联系人电话' },
    ];

    const missing = [];

    if (!isEditingExisting) {
      baseAndContactFields.forEach(field => {
        if (!formData[field.key]) {
          missing.push(field);
        }
      });
    }

    return missing;
  },

  // 输入框变化
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: '', // 清除错误
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
        [`errors.${field}`]: '',
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
      [`errors.${field}`]: '',
    });

    this.updateRequiredFields();
  },

  // 日期选择变化
  onDateChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    this.setData({
      [`formData.${field}`]: value,
      [`errors.${field}`]: '',
    });

    this.updateRequiredFields();
  },

  // 字段校验
  validateField(field, value) {
    let error = '';

    switch (field) {
      case 'patientName':
        if (!value || !value.trim()) {
          error = '请输入住户姓名';
        }
        break;

      case 'idNumber':
        if (!value || !value.trim()) {
          error = '请输入证件号码';
        } else if (this.data.formData.idType === '身份证') {
          const trimmed = String(value).trim();
          const regex18 = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/;
          const regex15 = /^[1-9]\d{7}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}$/;
          if (!regex18.test(trimmed) && !regex15.test(trimmed)) {
            error = '身份证号码格式不正确';
          }
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
        break;
    }

    if (error) {
      this.setData({
        [`errors.${field}`]: error,
      });
    }

    return !error;
  },

  // 步骤导航点击
  onStepTap(e) {
    const { step } = e.currentTarget.dataset;
    const targetIndex = Number(step);
    if (!this.isStepVisible(targetIndex)) {
      return;
    }
    if (targetIndex <= this.data.currentStep) {
      this.setData({ currentStep: targetIndex });
      this.updateRequiredFields();
    }
  },

  // 上一步
  onPrevStep() {
    const previousStep = this.getPrevVisibleStepIndex(this.data.currentStep);
    if (previousStep !== null) {
      this.setData({ currentStep: previousStep });
      this.updateRequiredFields();
    }
  },

  // 下一步
  onNextStep() {
    if (!this.validateCurrentStep()) {
      return;
    }

    const nextStep = this.getNextVisibleStepIndex(this.data.currentStep);
    if (nextStep !== null) {
      this.setData({ currentStep: nextStep });
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
      case 0: {
        // 基础信息
        if (!formData.patientName || !formData.patientName.trim()) {
          errors.patientName = '请输入住户姓名';
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
      }
      case 1: {
        // 联系人
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
      }
      case 2:
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
          duration: 3000,
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
        logger.error('选择文件失败', error);
        wx.showToast({
          title: '选择文件失败',
          icon: 'error',
        });
      },
    });
  },

  // 上传文件
  async uploadFiles(files) {
    for (const file of files) {
      if (this.data.uploadedFiles.length >= this.data.uploadConfig.maxCount) {
        wx.showToast({
          title: `最多只能上传${this.data.uploadConfig.maxCount}个文件`,
          icon: 'none',
        });
        break;
      }

      try {
        await this.uploadSingleFile(file);
      } catch (error) {
        logger.error('上传文件失败', error);
        wx.showToast({
          title: `上传${file.name}失败`,
          icon: 'error',
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
        category: file.type?.startsWith('image/') ? 'image' : 'document',
      };

      this.setData({
        uploadedFiles: [...this.data.uploadedFiles, uploadedFile],
      });

      wx.showToast({
        title: '上传成功',
        icon: 'success',
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
  previewFile(_e) {
    // 这里应该调用预览接口
    wx.showToast({
      title: '预览功能开发中',
      icon: 'none',
    });
  },

  // 删除文件
  deleteFile(e) {
    const { id } = e.currentTarget.dataset;
    const uploadedFiles = this.data.uploadedFiles.filter(file => file.id !== id);
    this.setData({ uploadedFiles });

    wx.showToast({
      title: '删除成功',
      icon: 'success',
    });
  },

  // 提交表单
  async onSubmit() {
    if (!this.data.allRequiredCompleted) {
      wx.showToast({
        title: '请完成所有必填项',
        icon: 'none',
      });
      return;
    }

    // 提交前停止自动保存，避免离开页面后仍访问已销毁实例
    this.stopDraftAutoSave();

    this.setData({ submitting: true });

    try {
      // 这里应该调用云函数提交数据
      const submitResult = await this.submitIntakeData();

      const latestForm = this.data.formData || {};
      const dirtyPatientKey =
        (submitResult && submitResult.data && submitResult.data.patientKey) || this.data.patientKey || '';
      if (dirtyPatientKey) {
        try {
          wx.setStorageSync(PATIENT_LIST_DIRTY_KEY, {
            timestamp: Date.now(),
            patientKey: dirtyPatientKey,
            updates: {
              patientName: latestForm.patientName,
              gender: latestForm.gender,
              birthDate: latestForm.birthDate,
              emergencyContact: latestForm.emergencyContact,
              emergencyPhone: latestForm.emergencyPhone,
            },
          });
        } catch (storageError) {
          logger.warn('store patient_list_dirty flag failed', storageError);
        }
      }

      // 清除草稿
      try {
        wx.removeStorageSync(DRAFT_STORAGE_KEY);
      } catch (error) {
        // 忽略草稿清除异常
      }

      // 跳转到成功页面
      const query = this._buildSuccessQuery(submitResult && submitResult.data);
      const target = query
        ? `/pages/patient-intake/success/success?${query}`
        : '/pages/patient-intake/success/success';

      wx.redirectTo({
        url: target,
      });
    } catch (error) {
      logger.error('提交失败', error);
      // 失败时恢复自动保存，避免草稿丢失
      this.startDraftAutoSave();
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'error',
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 提交入住数据
  async submitIntakeData() {
    const { formData, uploadedFiles, isEditingExisting, patientKey, mode } = this.data;

    // 提交前最后检查:如果紧急联系人为空,尝试从父母信息自动填充
    let finalFormData = { ...formData };
    if (isEditingExisting && (!formData.emergencyContact || !formData.emergencyPhone)) {
      const autoFilledContact = await this._autoFillEmergencyContactFromParents(patientKey);

      if (autoFilledContact.emergencyContact && autoFilledContact.emergencyPhone) {
        finalFormData = {
          ...finalFormData,
          emergencyContact: autoFilledContact.emergencyContact,
          emergencyPhone: autoFilledContact.emergencyPhone,
        };
        // 同时更新界面显示
        this.setData({
          'formData.emergencyContact': autoFilledContact.emergencyContact,
          'formData.emergencyPhone': autoFilledContact.emergencyPhone,
        });
      } else {
        // 如果自动填充失败,给出明确提示
        logger.error('无法自动填充紧急联系人,住户档案中未找到父母联系方式');
        this.revealContactStepForManualInput();
        wx.showToast({
          icon: 'none',
          title: '请填写紧急联系人信息',
          duration: 3000,
        });
        throw new Error(
          '紧急联系人不能为空。系统无法从住户档案中自动获取父母联系方式,请手动填写紧急联系人信息。'
        );
      }
    }

    // 构建提交数据
    const submitData = {
      action: mode === 'create' ? 'createPatient' : 'submit',
      patientKey: isEditingExisting ? patientKey : null,
      isEditingExisting, // 传递标志给服务端
      formData: finalFormData,
      uploadedFiles: mode === 'create' ? [] : uploadedFiles,
      timestamp: Date.now(),
    };

    if (mode === 'create') {
      submitData.audit = {
        message: '住户档案创建',
      };
    }

    if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
      throw new Error('云函数未初始化，请检查 wx.cloud.init 配置');
    }

    const res = await wx.cloud.callFunction({
      name: 'patientIntake',
      data: submitData,
    });

    const result = res?.result;

    if (!result) {
      throw new Error('云函数返回数据异常');
    }

    if (result.success === false) {
      const errorPayload = result.error || {};
      const detailErrors = errorPayload.details && errorPayload.details.errors;
      let firstMessage = '';
      if (detailErrors && typeof detailErrors === 'object') {
        const messages = Object.values(detailErrors).filter(Boolean);
        if (messages.length) {
          firstMessage = messages[0];
        }
      }
      const message = firstMessage || errorPayload.message || '提交失败';
      const validationError = new Error(message);
      validationError.details = errorPayload.details || null;
      throw validationError;
    }
    if (result.success) {
      const data = result.data || {};
      data.patientName = data.patientName || finalFormData.patientName;
      data.emergencyContact = data.emergencyContact || finalFormData.emergencyContact;
      data.emergencyPhone = data.emergencyPhone || finalFormData.emergencyPhone;
      data.mode = mode;
      if (mode === 'create') {
        data.patientKey = data.patientKey || patientKey || '';
      }
      result.data = data;
    }

    return result;
  },

  _buildSuccessQuery(submitData) {
    const payload = submitData || {};
    const { formData, uploadedFiles, mode } = this.data;
    const params = {
      patientName: formData.patientName || '',
      intakeTime: String(payload.intakeTime || Date.now()),
      emergencyContact: formData.emergencyContact || '',
      emergencyPhone: formData.emergencyPhone || '',
      uploadCount: String((uploadedFiles || []).length || 0),
      situationSummary: formData.situation || '',
      recordId: payload.intakeId || '',
      patientKey: payload.patientKey || this.data.patientKey || '',
      mode: payload.mode || mode || 'intake',
    };

    return Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key] ?? '')}`)
      .join('&');
  },

  // 从 patientProfile 的 familyInfo 列表中提取紧急联系人
  _extractEmergencyContactFromProfile(familyInfoList) {
    if (!Array.isArray(familyInfoList) || familyInfoList.length === 0) {
      return { emergencyContact: '', emergencyPhone: '' };
    }

    const candidates = [];

    const motherInfo = familyInfoList.find(item => item && item.label === '母亲联系方式');
    const fatherInfo = familyInfoList.find(item => item && item.label === '父亲联系方式');
    const emergencyInfo = familyInfoList.find(item => item && item.label === '紧急联系人');

    if (motherInfo && motherInfo.value) {
      const parsed = this._parseContactInfo(motherInfo.value);
      if (parsed) {
        candidates.push(parsed);
      }
    }

    if (fatherInfo && fatherInfo.value) {
      const parsed = this._parseContactInfo(fatherInfo.value);
      if (parsed) {
        candidates.push(parsed);
      }
    }

    if (emergencyInfo && emergencyInfo.value) {
      const parsed = this._parseContactInfo(emergencyInfo.value);
      if (parsed) {
        candidates.push(parsed);
      }
    }

    if (candidates.length > 0) {
      const contact = candidates[0];
      return {
        emergencyContact: contact.name,
        emergencyPhone: contact.phone,
      };
    }

    return { emergencyContact: '', emergencyPhone: '' };
  },

  // 从父母信息自动填充紧急联系人(提交前最后检查)
  async _autoFillEmergencyContactFromParents(patientKey) {
    try {
      if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
        return { emergencyContact: '', emergencyPhone: '' };
      }

      const candidates = [];
      const excelKey = this.normalizeExcelSpacing(this.data && this.data.excelRecordKey);
      if (excelKey) {
        candidates.push(excelKey);
      }
      if (patientKey) {
        candidates.push(this.normalizeExcelSpacing(patientKey));
      }
      if (this.data && this.data.formData && this.data.formData.patientName) {
        candidates.push(this.normalizeExcelSpacing(this.data.formData.patientName));
      }

      const uniqueKeys = Array.from(new Set(candidates.filter(Boolean)));

      for (const key of uniqueKeys) {
        try {
          const res = await wx.cloud.callFunction({
            name: 'patientProfile',
            data: {
              action: 'detail',
              key,
            },
          });

          if (!res.result || res.result.success === false) {
            continue;
          }

          const payload = res.result.data || res.result || {};
          const familyInfoList = Array.isArray(payload.familyInfo) ? payload.familyInfo : [];
          const contactFromProfile = this._extractEmergencyContactFromProfile(familyInfoList);
          const contactFromPatientDoc = this._extractContactFromPatientDoc(payload.patient || {});
          const contactFromRecords = this._extractContactFromRecords(payload.records || []);
          const resolved = this._preferContact(
            contactFromPatientDoc,
            contactFromProfile && contactFromProfile.emergencyContact && contactFromProfile.emergencyPhone
              ? contactFromProfile
              : null,
            contactFromRecords
          );

          if (resolved) {
            return resolved;
          }
        } catch (innerError) {
          // 忽略单次查询失败，尝试下一个候选 key
        }
      }

      if (patientKey) {
        try {
          const detailRes = await wx.cloud.callFunction({
            name: 'patientIntake',
            data: { action: 'getPatientDetail', patientKey },
          });
          if (detailRes.result && detailRes.result.success) {
            const patientDoc = detailRes.result.data && detailRes.result.data.patient;
            const fallbackContact = this._extractContactFromPatientDoc(patientDoc || {});
            if (fallbackContact) {
              return fallbackContact;
            }

            const latestIntake = detailRes.result.data && detailRes.result.data.latestIntake;
            if (latestIntake) {
              const intakeContact = this._extractContactFromPatientDoc(latestIntake.contactInfo || {});
              if (intakeContact) {
                return intakeContact;
              }
              const intakeCaregiver = this._parseContactInfo(latestIntake.intakeInfo && latestIntake.intakeInfo.guardianInfo);
              if (intakeCaregiver) {
                return {
                  emergencyContact: intakeCaregiver.name,
                  emergencyPhone: intakeCaregiver.phone,
                };
              }
            }
          }
        } catch (detailError) {
          // 忽略 detail 查询失败，继续
        }
      }

      return { emergencyContact: '', emergencyPhone: '' };
    } catch (error) {
      return { emergencyContact: '', emergencyPhone: '' };
    }
  },
});
