// 住户录入向导页面
const PATIENT_LIST_DIRTY_KEY = 'patient_list_dirty';

const STEP_DEFINITIONS = [
  { title: '基础身份', key: 'identity' },
  { title: '联系人', key: 'contact' },
  { title: '情况说明', key: 'situation' },
  { title: '附件上传', key: 'upload' },
  { title: '核对提交', key: 'review' },
];

function buildSteps(isEditingExisting = false, mode = 'intake') {
  const baseDefinitions =
    mode === 'create'
      ? STEP_DEFINITIONS.filter(step => ['identity', 'contact', 'review'].includes(step.key))
      : STEP_DEFINITIONS;

  return baseDefinitions.map((step, index) => {
    let hidden = false;
    if (isEditingExisting && (step.key === 'identity' || step.key === 'contact')) {
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
      idType: '身份证',
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
      contacts: [
        { relationship: '', name: '', phone: '' },
      ],
    },

    // 证件类型选项
    idTypes: ['身份证', '护照', '军官证', '其他'],
    idTypeIndex: 0,

    // 校验错误
    errors: {
      contacts: [{}],
    },
    contactErrors: [{}],

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

    // 智能识别相关
    autoFilledFromID: false,
    genderLocked: false,
    birthDateLocked: false,
    showAutoFillTip: false,

    // 住户选择相关（如果是从住户选择页面进入）
    patientKey: '',
    isEditingExisting: false,
    mode: 'intake',
    excelRecordKey: '',
    contactStepRevealed: false,
    prefillCompleted: false,
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

  normalizePhoneDigits(value) {
    const normalized = this.normalizeExcelSpacing(value);
    if (!normalized) {
      return '';
    }
    return normalized.replace(/\D+/g, '');
  },

  isValidMobileNumber(value) {
    return /^1[3-9]\d{9}$/.test(value || '');
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

      const pickByRegex = patterns => {
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

    let name = value.replace(/[^\u4e00-\u9fa5A-Za-z]+/g, ' ').replace(/1[3-9]\d{9}/g, ' ');
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
              minLength: Math.max(
                0,
                Number((config.situationConfig && config.situationConfig.minLength) || 0)
              ),
              maxLength: Math.max(
                0,
                Number(
                  (config.situationConfig && config.situationConfig.maxLength) ||
                    this.data.situationConfig.maxLength ||
                    0
                )
              ),
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
        this.updateFormData(draft.data.formData || {});
        this.setData(
          {
            currentStep: draft.data.currentStep || 0,
            uploadedFiles: draft.data.uploadedFiles || [],
            showDraftModal: false,
          },
          () => {
            this.ensureCurrentStepVisible();
            this.updateRequiredFields();
          }
        );
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
      contactStepRevealed: !isEditingExisting,
      prefillCompleted: !isEditingExisting,
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

    this.data.contactStepRevealed = true;

    this.setData(
      {
        steps,
        currentStep: contactIndex,
        contactStepRevealed: true,
      },
      () => {
        this.refreshVisibleStepMeta(steps, contactIndex);
        this.updateRequiredFields();
      }
    );
  },

  // 加载住户数据（编辑已有住户时）
  async loadPatientData(patientKey) {
    let hasPrefilled = false;
    try {
      wx.showLoading({ title: '加载中...' });

      // 使用 patientProfile 获取完整的住户信息,包括父母联系方式
      let excelRecordKey = this.normalizeExcelSpacing(patientKey) || '';
      let profilePayload = null;
      try {
        const res = await wx.cloud.callFunction({
          name: 'patientProfile',
          data: {
            action: 'fullDetail',
            key: excelRecordKey || patientKey,
            patientKey,
          },
        });

        if (res.result && res.result.success !== false) {
          profilePayload = res.result.data || res.result || {};
        }
      } catch (profileError) {
        // ignore profile preload errors, fallback to existing form data
      }

      const payload = profilePayload || {};
      const overviewPayload = payload.overview || {};
      const patientDocForEdit = overviewPayload.patientDoc || payload.patient || {};
      const basicInfoList = Array.isArray(payload.basicInfo) ? payload.basicInfo : [];
      const familyInfoList = Array.isArray(payload.family) ? payload.family : [];
      const records = Array.isArray(payload.excelRecords)
        ? payload.excelRecords
        : Array.isArray(payload.records)
        ? payload.records
        : [];

      const resolvedExcelKey =
        this.normalizeExcelSpacing(overviewPayload.recordKey) ||
        this.normalizeExcelSpacing(patientDocForEdit.recordKey) ||
        excelRecordKey;

      this.setData({
        excelRecordKey: resolvedExcelKey || '',
      });

      const patient = patientDocForEdit;

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

      // 情况说明不再自动填充历史记录
      // 每次入住都应该填写新的情况说明，反映当前入住时的实际情况
      // 已移除从历史记录中提取医疗情况的逻辑

      // 解析父母联系方式作为紧急联系人
      const { emergencyContact, emergencyPhone } =
        this._extractEmergencyContactFromProfile(familyInfoList);

      const patientDocSource = patientDocForEdit || {};
      const overviewDisplay = overviewPayload.patientDisplay || {};
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
        patientDocSource.patientName,
        patientName,
        overviewDisplay.patientName,
        this.data.formData.patientName
      );
      const resolvedIdType =
        preferString(
          patientDocSource.idType,
          this.data.formData.idType,
          overviewDisplay.idType,
          '身份证'
        ) || '身份证';
      const resolvedIdNumber = preferString(
        patientDocSource.idNumber,
        idNumber,
        overviewDisplay.idNumber,
        this.data.formData.idNumber
      );
      const resolvedGender = preferString(
        patientDocSource.gender,
        gender,
        overviewDisplay.gender,
        this.data.formData.gender
      );
      const resolvedBirthDate = preferDate(
        patientDocSource.birthDate,
        birthDate,
        overviewDisplay.birthDate,
        this.data.formData.birthDate
      );
      const resolvedPhone = preferString(
        patientDocSource.phone,
        overviewDisplay.phone,
        this.data.formData.phone
      );
      const resolvedAddress = preferString(
        patientDocSource.address,
        address,
        overviewDisplay.address,
        this.data.formData.address
      );
      const resolvedEmergencyContact = preferString(
        patientDocSource.emergencyContact,
        overviewDisplay.emergencyContact,
        emergencyContact,
        this.data.formData.emergencyContact
      );
      const resolvedEmergencyPhone = preferString(
        patientDocSource.emergencyPhone,
        overviewDisplay.emergencyPhone,
        emergencyPhone,
        this.data.formData.emergencyPhone
      );
      const resolvedBackupContact = preferString(
        patientDocSource.backupContact,
        overviewDisplay.backupContact,
        this.data.formData.backupContact
      );
      const resolvedBackupPhone = preferString(
        patientDocSource.backupPhone,
        overviewDisplay.backupPhone,
        this.data.formData.backupPhone
      );
      // 情况说明不自动填充，保持为空，让用户填写本次入住的具体情况
      const resolvedSituation = '';

      const additionalContacts = [];
      if (patientDocSource && Array.isArray(patientDocSource.familyContacts)) {
        additionalContacts.push(...patientDocSource.familyContacts);
      }
      if (overviewDisplay && Array.isArray(overviewDisplay.familyContacts)) {
        additionalContacts.push(...overviewDisplay.familyContacts);
      }

      const contactTextSources = [];
      const appendContactText = (text, relation) => {
        const normalized = this.normalizeExcelSpacing(text);
        if (!normalized) {
          return;
        }
        contactTextSources.push({ text: normalized, relation });
      };

      appendContactText(patientDocSource.guardianInfo, '监护人');
      appendContactText(overviewDisplay.guardianInfo, '监护人');
      appendContactText(patientDocSource.motherInfo, '母亲');
      appendContactText(overviewDisplay.motherInfo, '母亲');
      appendContactText(patientDocSource.fatherInfo, '父亲');
      appendContactText(overviewDisplay.fatherInfo, '父亲');
      appendContactText(patientDocSource.otherGuardian, '监护人');
      appendContactText(overviewDisplay.otherGuardian, '监护人');

      const contacts = this.buildContactsFromFields({
        emergencyContact: resolvedEmergencyContact,
        emergencyPhone: resolvedEmergencyPhone,
        backupContact: resolvedBackupContact,
        backupPhone: resolvedBackupPhone,
        additionalContacts,
        existingContacts: this.data.formData.contacts,
        additionalText: contactTextSources,
      });

      const nextFormData = {
        ...this.data.formData,
        patientName: resolvedPatientName,
        idType: resolvedIdType,
        idNumber: resolvedIdNumber,
        gender: resolvedGender,
        birthDate: resolvedBirthDate,
        phone: resolvedPhone,
        address: resolvedAddress,
        situation: resolvedSituation,
        contacts,
      };

      const syncedForm = this.updateFormData(nextFormData);
      const idTypeIndex = this.data.idTypes.indexOf(syncedForm.idType || '身份证');
      this.setData({ idTypeIndex: idTypeIndex >= 0 ? idTypeIndex : 0 });
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
      this.data.prefillCompleted = true;
      this.setData({ prefillCompleted: true });
      wx.hideLoading();
      this.updateRequiredFields();
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

  ensureContactsArray(rawContacts = []) {
    const list = Array.isArray(rawContacts) ? rawContacts : [];
    const normalized = list
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        relationship: this.normalizeExcelSpacing(item.relationship) || '',
        name: this.normalizeExcelSpacing(item.name) || '',
        phone: this.normalizePhoneDigits(item.phone) || '',
      }))
      .slice(0, 5);
    if (!normalized.length) {
      normalized.push({ relationship: '', name: '', phone: '' });
    }
    return normalized;
  },

  buildContactErrorPlaceholders(length) {
    const size = Math.max(1, Number(length) || 0);
    return Array.from({ length: size }, () => ({}));
  },

  parseContactText(value) {
    const text = this.normalizeExcelSpacing(value);
    if (!text) {
      return { relationship: '', name: '' };
    }

    const colonMatch = text.match(/^([^:：]{1,6})[:：](.+)$/);
    if (colonMatch) {
      const relation = this.normalizeExcelSpacing(colonMatch[1]);
      const name = this.normalizeExcelSpacing(colonMatch[2]);
      if (relation && name) {
        return { relationship: relation, name };
      }
    }

    const relationKeywords = /^(父亲|母亲|爷爷|奶奶|姥爷|姥姥|外公|外婆|叔叔|阿姨|哥哥|姐姐|弟弟|妹妹|监护人|照护人|联系人)/;
    const blankIndex = text.indexOf(' ');
    if (relationKeywords.test(text) && blankIndex > 0) {
      const relation = text.slice(0, blankIndex);
      const name = text.slice(blankIndex + 1).trim();
      if (name) {
        return { relationship: relation, name };
      }
    }

    const parts = text.split(/\s+/);
    if (parts.length >= 2 && parts[0].length <= 4 && relationKeywords.test(parts[0])) {
      const relation = parts[0];
      const name = parts.slice(1).join(' ').trim();
      if (name) {
        return { relationship: relation, name };
      }
    }

    return { relationship: '', name: text };
  },

  formatContactDisplay(contact = {}) {
    const relation = this.normalizeExcelSpacing(contact.relationship);
    const name = this.normalizeExcelSpacing(contact.name);
    if (!name) {
      // 避免仅填写“关系”字段时同步到 legacy 紧急联系人姓名
      return '';
    }
    return relation ? `${relation} ${name}` : name;
  },

  buildContactsFromFields(source = {}) {
    const contacts = [];

    const normalizeRelationHint = value => {
      const normalized = this.normalizeExcelSpacing(value);
      if (!normalized) {
        return '';
      }
      const lower = normalized.toLowerCase();
      switch (lower) {
        case 'mother':
        case 'mom':
        case '妈妈':
        case '母亲':
          return '母亲';
        case 'father':
        case 'dad':
        case '爸爸':
        case '父亲':
          return '父亲';
        case 'guardian':
        case 'custodian':
        case '监护人':
          return '监护人';
        case 'caregiver':
        case '照护人':
          return '照护人';
        default:
          return normalized;
      }
    };

    const pushContact = (displayName, phone, options = {}) => {
      const { fallbackRelation } = options;
      const normalizedDisplay = this.normalizeExcelSpacing(displayName);
      let normalizedPhone = this.normalizePhoneDigits(phone);
      if (!normalizedDisplay && !normalizedPhone) {
        return;
      }
      let parsedName = '';
      if (!normalizedPhone) {
        const parsed = this._parseContactInfo(normalizedDisplay);
        if (parsed) {
          normalizedPhone = this.normalizePhoneDigits(parsed.phone);
          parsedName = this.normalizeExcelSpacing(parsed.name);
        }
      }
      if (!normalizedPhone || normalizedPhone.length < 5) {
        return;
      }
      const textForName = parsedName || normalizedDisplay || '';
      const { relationship, name } = this.parseContactText(textForName);
      const finalName = this.normalizeExcelSpacing(name || parsedName || normalizedDisplay || '');
      const relationHint = normalizeRelationHint(fallbackRelation);
      const finalRelationship =
        relationship || relationHint || (finalName ? '联系人' : '');
      contacts.push({
        relationship: finalRelationship,
        name: finalName,
        phone: normalizedPhone,
      });
    };

    const normalizedExisting = [];
    const existingCandidates = [];
    if (Array.isArray(source.existingContacts)) {
      existingCandidates.push(...source.existingContacts);
    }
    if (Array.isArray(source.contacts)) {
      existingCandidates.push(...source.contacts);
    }
    const seenExisting = new WeakSet();
    existingCandidates.forEach(item => {
      if (!item || typeof item !== 'object' || seenExisting.has(item)) {
        return;
      }
      seenExisting.add(item);
      const normalized = {
        relationship: this.normalizeExcelSpacing(item.relationship) || '',
        name: this.normalizeExcelSpacing(item.name) || '',
        phone: this.normalizeExcelSpacing(item.phone) || '',
      };
      if (!normalized.relationship && !normalized.name && !normalized.phone) {
        return;
      }
      normalizedExisting.push(normalized);
    });

    if (!normalizedExisting.length) {
      pushContact(source.emergencyContact, source.emergencyPhone, {
        fallbackRelation: '紧急联系人',
      });
      pushContact(source.backupContact, source.backupPhone, {
        fallbackRelation: '备用联系人',
      });
    }

    contacts.push(...normalizedExisting);

    const extraArrays = [];
    if (Array.isArray(source.additionalContacts)) {
      extraArrays.push(source.additionalContacts);
    }
    extraArrays.forEach(list => {
      list.forEach(item => {
        if (!item || typeof item !== 'object') {
          return;
        }
        const name = item.name || item.raw || '';
        const phone = item.phone || '';
        const relation = item.role || '';
        const relationHint = normalizeRelationHint(relation);
        pushContact(this.normalizeExcelSpacing(name) || relationHint || relation, phone, {
          fallbackRelation: relationHint || relation,
        });
      });
    });

    if (Array.isArray(source.additionalText)) {
      source.additionalText.forEach(entry => {
        if (!entry) {
          return;
        }
        let relationHint = '';
        let textValue = entry;
        if (typeof entry === 'object') {
          relationHint = entry.relation || entry.role || '';
          textValue = entry.text || entry.value || entry.raw || '';
        }
        if (!textValue) {
          return;
        }
        const segments = String(textValue)
          .split(/[、;\n]/)
          .map(item => item.trim())
          .filter(Boolean);
        segments.forEach(segment => {
          pushContact(segment, '', { fallbackRelation: relationHint });
        });
      });
    }

    const sanitized = contacts
      .map(item => ({
        relationship: this.normalizeExcelSpacing(item.relationship) || '',
        name: this.normalizeExcelSpacing(item.name) || '',
        phone: this.normalizePhoneDigits(item.phone) || '',
      }))
      .filter(item => item.phone && item.phone.length >= 5 && (item.name || item.relationship));

    if (sanitized.length) {
      const uniqueMap = new Map();
      sanitized.forEach(contact => {
        const key = `${contact.name}|${contact.phone}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, contact);
          return;
        }
        const existing = uniqueMap.get(key) || {};
        const existingRelation = this.normalizeExcelSpacing(existing.relationship) || '';
        const candidateRelation = this.normalizeExcelSpacing(contact.relationship) || '';
        const existingIsGeneric = !existingRelation || existingRelation === '联系人';
        const candidateIsGeneric = !candidateRelation || candidateRelation === '联系人';
        const shouldReplace =
          (!candidateIsGeneric && existingIsGeneric) ||
          (candidateRelation.length > existingRelation.length && !candidateIsGeneric);
        if (shouldReplace) {
          uniqueMap.set(key, contact);
        }
      });
      return Array.from(uniqueMap.values());
    }

    return this.ensureContactsArray(contacts);

  },

  syncContactsToFields(formData) {
    const next = { ...formData };
    const contacts = this.ensureContactsArray(next.contacts || []);
    next.contacts = contacts;
    const primary = contacts[0] || { relationship: '', name: '', phone: '' };
    next.emergencyContact = this.formatContactDisplay(primary);
    next.emergencyPhone = primary.phone || '';
    const secondary = contacts[1] || { relationship: '', name: '', phone: '' };
    next.backupContact = contacts.length > 1 ? this.formatContactDisplay(secondary) : '';
    next.backupPhone = contacts.length > 1 ? secondary.phone || '' : '';
    next.guardianInfo = next.guardianInfo || '';
    if (contacts.length > 2) {
      const extras = contacts.slice(2).map(item => {
        const display = this.formatContactDisplay(item);
        return [display, item.phone || ''].filter(Boolean).join(' ');
      });
      next.extraContacts = extras;
    } else {
      next.extraContacts = [];
    }
    return next;
  },

  updateFormData(partialFormData = {}) {
    const merged = { ...this.data.formData, ...partialFormData };
    const synced = this.syncContactsToFields(merged);
    const existingContactErrors = Array.isArray(this.data.contactErrors)
      ? this.data.contactErrors
      : [];
    const contactErrors = existingContactErrors.length === synced.contacts.length
      ? existingContactErrors
      : this.buildContactErrorPlaceholders(synced.contacts.length);
    this.data.formData = synced;
    this.data.contactErrors = contactErrors;
    this.setData({
      formData: synced,
      'errors.contacts': contactErrors,
      contactErrors,
    });
    return synced;
  },

  validateContacts(options = {}) {
    const { updateState = true, showToast = false } = options;
    let contacts = this.ensureContactsArray(this.data.formData.contacts);
    const placeholderOnly = contacts.every(contact => {
      if (!contact || typeof contact !== 'object') {
        return true;
      }
      const relation = this.normalizeExcelSpacing(contact.relationship);
      const name = this.normalizeExcelSpacing(contact.name);
      const phoneDigits = this.normalizePhoneDigits(contact.phone);
      return !relation && !name && !phoneDigits;
    });

    if (placeholderOnly) {
      const derived = this.buildContactsFromFields(this.data.formData);
      const hasDerivedData = derived.some(contact => {
        if (!contact || typeof contact !== 'object') {
          return false;
        }
        const name = this.normalizeExcelSpacing(contact.name);
        const phoneDigits = this.normalizePhoneDigits(contact.phone);
        return !!name || !!phoneDigits;
      });
      if (hasDerivedData) {
        if (updateState) {
          const synced = this.updateFormData({ contacts: derived });
          contacts = synced.contacts;
        } else {
          const synced = this.syncContactsToFields({
            ...this.data.formData,
            contacts: derived,
          });
          contacts = synced.contacts;
        }
      }
    }

    const errors = contacts.map(() => ({}));
    let valid = contacts.length > 0;
    let firstMessage = '';

    if (!contacts.length) {
      valid = false;
      errors[0] = {
        relationship: '请添加至少一位联系人',
        name: '请添加至少一位联系人',
        phone: '请添加至少一位联系人',
      };
      firstMessage = '请添加至少一位联系人';
    }

    contacts.forEach((contact, index) => {
      const entryErrors = {};
      const relationship = this.normalizeExcelSpacing(contact.relationship);
      const name = this.normalizeExcelSpacing(contact.name);
      const phoneDigits = this.normalizePhoneDigits(contact.phone);

      if (!relationship) {
        entryErrors.relationship = '请输入关系';
        if (!firstMessage) {
          firstMessage = entryErrors.relationship;
        }
      }
      if (!name) {
        entryErrors.name = '请输入姓名';
        if (!firstMessage) {
          firstMessage = entryErrors.name;
        }
      }
      if (!phoneDigits) {
        entryErrors.phone = '请输入联系电话';
        if (!firstMessage) {
          firstMessage = entryErrors.phone;
        }
      } else if (!this.isValidMobileNumber(phoneDigits)) {
        entryErrors.phone = '手机号码格式不正确';
        if (!firstMessage) {
          firstMessage = entryErrors.phone;
        }
      }

      if (Object.keys(entryErrors).length) {
        valid = false;
      }
      errors[index] = entryErrors;
    });

    if (updateState) {
      this.setData({
        'errors.contacts': errors,
        contactErrors: errors,
      });
    }

    if (!valid) {
      logger.warn('[wizard] validateContacts invalid', {
        contacts,
        errors,
        firstMessage,
      });
    }

    if (!valid && showToast && firstMessage) {
      wx.showToast({ icon: 'none', title: firstMessage, duration: 3000 });
    }

    return { valid, message: firstMessage, errors };
  },

  onContactFieldInput(event) {
    const { index, field } = event.currentTarget.dataset;
    const value = event.detail.value;
    const contacts = this.ensureContactsArray(this.data.formData.contacts);
    const contactIndex = Number(index);
    if (!Number.isInteger(contactIndex) || contactIndex < 0 || contactIndex >= contacts.length) {
      return;
    }
    const sanitizedValue = field === 'phone' ? value.replace(/\D+/g, '') : value;
    contacts[contactIndex] = {
      ...contacts[contactIndex],
      [field]: sanitizedValue,
    };
    const synced = this.updateFormData({ contacts });
    this.validateContacts({ updateState: true, showToast: false });
    this.updateRequiredFields();
    return synced;
  },

  addContact() {
    const contacts = this.ensureContactsArray(this.data.formData.contacts);
    if (contacts.length >= 5) {
      wx.showToast({ icon: 'none', title: '最多添加5位联系人' });
      return;
    }
    contacts.push({ relationship: '', name: '', phone: '' });
    this.updateFormData({ contacts });
    this.validateContacts({ updateState: true, showToast: false });
    this.updateRequiredFields();
  },

  removeContact(event) {
    const index = Number(event.currentTarget.dataset.index);
    const contacts = this.ensureContactsArray(this.data.formData.contacts);
    if (!Number.isInteger(index) || index < 0 || index >= contacts.length) {
      return;
    }
    if (contacts.length <= 1) {
      wx.showToast({ icon: 'none', title: '至少保留一位联系人' });
      return;
    }
    contacts.splice(index, 1);
    this.updateFormData({ contacts });
    this.validateContacts({ updateState: true, showToast: false });
    this.updateRequiredFields();
  },

  // 更新必填项状态
  updateRequiredFields() {
    const { currentStep } = this.data;
    let { formData } = this.data;
    let requiredFields = [];
    let requiredFieldsText = '';
    let allowContactByEmergencyPair = false;

    switch (currentStep) {
      case 0: {
        // 步骤1：基础身份
        const identityRequired = [
          { key: 'patientName', label: '姓名' },
          { key: 'idType', label: '证件类型' },
          { key: 'idNumber', label: '证件号码' },
          { key: 'gender', label: '性别' },
          { key: 'birthDate', label: '出生日期' },
        ];
        requiredFields = identityRequired.filter(field => !formData[field.key]);
        break;
      }
      case 1: {
        // 步骤2：联系人
        if (!formData.address || !formData.address.trim()) {
          requiredFields.push({ key: 'address', label: '常住地址' });
        }
        let contacts = this.ensureContactsArray(formData.contacts);

        const derivedFromFields = this.buildContactsFromFields(formData);
        if (derivedFromFields.length) {
          const synced = this.updateFormData({ contacts: derivedFromFields });
          contacts = this.ensureContactsArray(synced.contacts);
        }
        const placeholderOnly = contacts.every(contact => {
          if (!contact || typeof contact !== 'object') {
            return true;
          }
          const relation = this.normalizeExcelSpacing(contact.relationship);
          const name = this.normalizeExcelSpacing(contact.name);
          const phoneDigits = this.normalizePhoneDigits(contact.phone);
          return !relation && !name && !phoneDigits;
        });
        if (placeholderOnly) {
          const derived = this.buildContactsFromFields(formData);
          const hasDerivedData = derived.some(contact => {
            if (!contact || typeof contact !== 'object') {
              return false;
            }
            const name = this.normalizeExcelSpacing(contact.name);
            const phoneDigits = this.normalizePhoneDigits(contact.phone);
            return !!name || !!phoneDigits;
          });
          if (hasDerivedData) {
            contacts = derived;
          }
        }
        const emergencyContactValue = this.normalizeExcelSpacing(formData.emergencyContact);
        const emergencyPhoneDigits = this.normalizePhoneDigits(formData.emergencyPhone);

        const hasValidContacts =
          contacts.length > 0 &&
          contacts.every(contact => {
            if (!contact || typeof contact !== 'object') {
              return false;
            }
            const relation = this.normalizeExcelSpacing(contact.relationship);
            const name = this.normalizeExcelSpacing(contact.name);
            const phoneDigits = this.normalizePhoneDigits(contact.phone);
            if (!relation || !name || !phoneDigits) {
              return false;
            }
            return this.isValidMobileNumber(phoneDigits);
          });

        const hasEmergencyPair =
          emergencyContactValue && this.isValidMobileNumber(emergencyPhoneDigits);
        const hasRelaxedEmergency = emergencyContactValue && emergencyPhoneDigits.length >= 5;
        const hasContactWithDigits = contacts.some(contact => {
          if (!contact || typeof contact !== 'object') {
            return false;
          }
          const name = this.normalizeExcelSpacing(contact.name);
          const phoneDigits = this.normalizePhoneDigits(contact.phone);
          return !!name && phoneDigits.length >= 5;
        });

        const contactRequirementSatisfied =
          hasValidContacts ||
          hasEmergencyPair ||
          (this.data.isEditingExisting && (hasRelaxedEmergency || hasContactWithDigits));

        if (!contactRequirementSatisfied) {
          requiredFields.push({ key: 'contacts', label: '联系人信息' });
          if (
            this.data.isEditingExisting &&
            !this.data.contactStepRevealed &&
            this.data.prefillCompleted
          ) {
            this.revealContactStepForManualInput();
          }
        }
        if (
          hasEmergencyPair &&
          formData.address &&
          formData.address.trim()
        ) {
          allowContactByEmergencyPair = true;
        }
        break;
      }
      case 2:
        // 步骤3：情况说明 - 选填
        break;
      case 3: {
        // 步骤4：附件上传 - 选填
        break;
      }
      case 4: {
        // 步骤5：核对提交
        requiredFields = this.getAllMissingRequiredFields();
        break;
      }
    }

    requiredFieldsText = requiredFields.map(field => field.label).join('、');

    const canProceedToNext = requiredFields.length === 0 || allowContactByEmergencyPair;
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

    if (this.data.mode === 'create' && currentStep === 1) {
      console.warn('[wizard] contact step update', {
        requiredFields,
        canProceedToNext,
        allowContactByEmergencyPair,
        contacts: formData.contacts,
        emergencyContact: formData.emergencyContact,
        emergencyPhone: formData.emergencyPhone,
        address: formData.address,
      });
    }

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

    const contacts = this.ensureContactsArray(formData.contacts);
    const emergencyContactValue = this.normalizeExcelSpacing(formData.emergencyContact);
    const emergencyPhoneDigits = this.normalizePhoneDigits(formData.emergencyPhone);

    const hasValidContacts =
      contacts.length > 0 &&
      contacts.every(contact => {
        if (!contact || typeof contact !== 'object') {
          return false;
        }
        const relation = this.normalizeExcelSpacing(contact.relationship);
        const name = this.normalizeExcelSpacing(contact.name);
        const phoneDigits = this.normalizePhoneDigits(contact.phone);
        return !!relation && !!name && this.isValidMobileNumber(phoneDigits);
      });

    const hasEmergencyPair =
      emergencyContactValue && this.isValidMobileNumber(emergencyPhoneDigits);
    const hasRelaxedEmergency = emergencyContactValue && emergencyPhoneDigits.length >= 5;
    const hasContactWithDigits = contacts.some(contact => {
      if (!contact || typeof contact !== 'object') {
        return false;
      }
      const name = this.normalizeExcelSpacing(contact.name);
      const phoneDigits = this.normalizePhoneDigits(contact.phone);
      return !!name && phoneDigits.length >= 5;
    });

    const contactRequirementSatisfied = !isEditingExisting
      ? hasValidContacts || hasEmergencyPair
      : hasValidContacts || hasEmergencyPair || hasRelaxedEmergency || hasContactWithDigits;

    if (!contactRequirementSatisfied) {
      missing.push({ key: 'contacts', label: '联系人信息' });
    }

    if (this.data.mode === 'create' && missing.length) {
      console.warn('[wizard] missing required fields in create mode', missing, formData);
    }

    return missing;
  },

  // 输入框变化
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const synced = this.updateFormData({ [field]: value });
    this.setData({ [`errors.${field}`]: '' });

    if (field === 'idNumber' && synced.idType === '身份证') {
      this.parseIDNumber(value);
    }

    if (['emergencyContact', 'emergencyPhone', 'backupContact', 'backupPhone'].includes(field)) {
      const derivedContacts = this.buildContactsFromFields(synced);
      if (derivedContacts.length) {
        const currentContacts = JSON.stringify(this.ensureContactsArray(synced.contacts));
        const derivedSerialized = JSON.stringify(this.ensureContactsArray(derivedContacts));
        if (currentContacts !== derivedSerialized) {
          this.updateFormData({ contacts: derivedContacts });
        }
      }
      if (['emergencyContact', 'emergencyPhone'].includes(field)) {
        const emergencyContactValue = this.normalizeExcelSpacing(synced.emergencyContact);
        const emergencyPhoneDigits = this.normalizePhoneDigits(synced.emergencyPhone);
        const contacts = this.ensureContactsArray(synced.contacts);
        const primary = contacts[0] || { relationship: '', name: '', phone: '' };
        const nextContacts = contacts.slice();
        nextContacts[0] = {
          relationship: primary.relationship || (emergencyContactValue ? '紧急联系人' : primary.relationship || ''),
          name: emergencyContactValue || primary.name || '',
          phone: emergencyPhoneDigits || primary.phone || '',
        };
        nextContacts.forEach((item, index) => {
          if (!item || typeof item !== 'object') {
            nextContacts[index] = { relationship: '', name: '', phone: '' };
          }
        });
        this.updateFormData({ contacts: nextContacts });
      }
      if (this.data.mode === 'create') {
        console.warn('[wizard] emergency fields updated', field, {
          emergencyContact: synced.emergencyContact,
          emergencyPhone: synced.emergencyPhone,
          contacts: synced.contacts,
        });
      }
      if (this.data.mode === 'create' && field === 'emergencyPhone') {
        this.setData({ canProceedToNext: true });
      }
    }

    this.validateField(field, value);
    this.updateRequiredFields();
  },

  // 选择器变化
  onPickerChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = Number(e.detail.value);

    if (field === 'idType') {
      const idType = this.data.idTypes[value] || '身份证';
      this.setData({ idTypeIndex: value, [`errors.${field}`]: '' });
      const synced = this.updateFormData({ idType });

      if (idType === '身份证' && synced.idNumber) {
        this.parseIDNumber(synced.idNumber);
      } else {
        // 切换到其他证件类型，解锁字段
        this.setData({
          autoFilledFromID: false,
          genderLocked: false,
          birthDateLocked: false,
        });
      }
    } else {
      this.updateFormData({ [field]: value });
      this.setData({ [`errors.${field}`]: '' });
    }

    this.updateRequiredFields();
  },

  // 单选按钮变化
  onRadioChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    this.updateFormData({ [field]: value });
    this.setData({ [`errors.${field}`]: '' });

    this.updateRequiredFields();
  },

  // 日期选择变化
  onDateChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    this.updateFormData({ [field]: value });
    this.setData({ [`errors.${field}`]: '' });

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
          const regex18 =
            /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/;
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
    const { currentStep } = this.data;
    let { formData } = this.data;
    let isValid = true;
    const errors = {};
    let firstErrorMessage = '';

    switch (currentStep) {
      case 0: {
        // 步骤1：基础身份
        if (!formData.patientName || !formData.patientName.trim()) {
          errors.patientName = '请输入住户姓名';
          isValid = false;
          if (!firstErrorMessage) {
            firstErrorMessage = errors.patientName;
          }
        }
        if (!formData.idNumber || !formData.idNumber.trim()) {
          errors.idNumber = '请输入证件号码';
          isValid = false;
          if (!firstErrorMessage) {
            firstErrorMessage = errors.idNumber;
          }
        } else if (!this.validateField('idNumber', formData.idNumber)) {
          isValid = false;
          if (!firstErrorMessage) {
            firstErrorMessage = '证件号码格式不正确';
          }
        }
        if (!formData.gender) {
          errors.gender = '请选择性别';
          isValid = false;
          if (!firstErrorMessage) {
            firstErrorMessage = errors.gender;
          }
        }
        if (!formData.birthDate) {
          errors.birthDate = '请选择出生日期';
          isValid = false;
          if (!firstErrorMessage) {
            firstErrorMessage = errors.birthDate;
          }
        }
        if (formData.phone && !this.validateField('phone', formData.phone)) {
          isValid = false;
          if (!firstErrorMessage) {
            firstErrorMessage = '手机号码格式不正确';
          }
        }
        break;
      }
      case 1: {
        // 步骤2：联系人
        if (!formData.address || !formData.address.trim()) {
          errors.address = '请输入常住地址';
          isValid = false;
          if (!firstErrorMessage) {
            firstErrorMessage = errors.address;
          }
        }
        const derivedFromFields = this.buildContactsFromFields(formData);
        if (derivedFromFields.length) {
          const synced = this.updateFormData({ contacts: derivedFromFields });
          formData = synced;
        }

        const emergencyContactValue = this.normalizeExcelSpacing(formData.emergencyContact);
        const emergencyPhoneValue = (this.normalizeExcelSpacing(formData.emergencyPhone) || '').replace(/\s+/g, '');

        const contactValidation = this.validateContacts({ updateState: true, showToast: false });
        if (!contactValidation.valid) {
          const hasEmergencyPair = emergencyContactValue && /^1[3-9]\d{9}$/.test(emergencyPhoneValue);
          if (hasEmergencyPair) {
            const fallbackContacts = this.buildContactsFromFields(formData);
            if (fallbackContacts.length) {
              this.updateFormData({ contacts: fallbackContacts });
            }
          } else {
            isValid = false;
            errors.contacts = contactValidation.errors;
            if (!firstErrorMessage) {
              firstErrorMessage = contactValidation.message || '请完善联系人信息';
            }
          }
        }
        break;
      }
      case 2:
      case 3:
      case 4:
        break;
    }

    const errorUpdates = {};
    if (currentStep === 0) {
      errorUpdates['errors.patientName'] = errors.patientName || '';
      errorUpdates['errors.idNumber'] = errors.idNumber || '';
      errorUpdates['errors.gender'] = errors.gender || '';
      errorUpdates['errors.birthDate'] = errors.birthDate || '';
      errorUpdates['errors.phone'] = errors.phone || '';
    }
    if (currentStep === 1) {
      errorUpdates['errors.address'] = errors.address || '';
      if (errors.contacts) {
        errorUpdates['errors.contacts'] = errors.contacts;
        errorUpdates['contactErrors'] = errors.contacts;
      }
    }
    if (Object.keys(errorUpdates).length) {
      this.setData(errorUpdates);
    }

    if (!isValid && firstErrorMessage) {
      wx.showToast({
        title: firstErrorMessage,
        icon: 'none',
        duration: 3000,
      });
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
        (submitResult && submitResult.data && submitResult.data.patientKey) ||
        this.data.patientKey ||
        '';
      if (dirtyPatientKey) {
        try {
          const submitData = (submitResult && submitResult.data) || {};
          const updates = {
            patientName: latestForm.patientName,
            gender: latestForm.gender,
            birthDate: latestForm.birthDate,
            emergencyContact: latestForm.emergencyContact,
            emergencyPhone: latestForm.emergencyPhone,
            careStatus: 'pending',
          };
          if (submitData.admissionCount !== undefined) {
            updates.admissionCount = submitData.admissionCount;
          }
          if (submitData.latestAdmissionDate !== undefined) {
            updates.latestAdmissionTimestamp = submitData.latestAdmissionDate;
          }
          if (submitData.firstAdmissionDate !== undefined) {
            updates.firstAdmissionTimestamp = submitData.firstAdmissionDate;
          }
          wx.setStorageSync(PATIENT_LIST_DIRTY_KEY, {
            timestamp: Date.now(),
            patientKey: dirtyPatientKey,
            updates,
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
        const contacts = this.ensureContactsArray(finalFormData.contacts);
        contacts[0] = {
          relationship: contacts[0]?.relationship || '',
          name: autoFilledContact.emergencyContact,
          phone: autoFilledContact.emergencyPhone,
        };
        finalFormData = this.syncContactsToFields({ ...finalFormData, contacts });
        this.updateFormData(finalFormData);
        this.validateContacts({ updateState: true, showToast: false });
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

    finalFormData = this.syncContactsToFields(finalFormData);
    if (Array.isArray(finalFormData.extraContacts) && finalFormData.extraContacts.length) {
      finalFormData.guardianInfo = finalFormData.extraContacts.join('；');
    }

    // 构建提交数据
    const cleanedFormData = { ...finalFormData };
    delete cleanedFormData.extraContacts;

    const submitData = {
      action: mode === 'create' ? 'createPatient' : 'submit',
      patientKey: isEditingExisting ? patientKey : null,
      isEditingExisting, // 传递标志给服务端
      formData: cleanedFormData,
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
    const candidateKeys = new Set();

    const addCandidate = (name, phone, options = {}) => {
      const normalizedName = this.normalizeExcelSpacing(name);
      const normalizedPhone = this.normalizePhoneDigits(phone);
      if (!normalizedName || !normalizedPhone || normalizedPhone.length < 5) {
        return false;
      }
      const key = `${normalizedName}|${normalizedPhone}`;
      if (candidateKeys.has(key)) {
        return true;
      }
      const candidate = { name: normalizedName, phone: normalizedPhone };
      if (options.prioritize) {
        candidates.unshift(candidate);
      } else {
        candidates.push(candidate);
      }
      candidateKeys.add(key);
      return true;
    };

    const tryParseStructured = (raw, options = {}) => {
      if (!raw && raw !== 0) {
        return false;
      }

      if (typeof raw === 'object') {
        const possibleName =
          raw.name ||
          raw.contactName ||
          raw.fullname ||
          raw.guardianName ||
          raw.label ||
          raw.value ||
          raw.person;
        const possiblePhone =
          raw.phone ||
          raw.mobile ||
          raw.contactPhone ||
          raw.telephone ||
          raw.tel ||
          raw.phoneNumber ||
          raw.mobilePhone;
        if (possibleName && possiblePhone && addCandidate(possibleName, possiblePhone, options)) {
          return true;
        }
      }

      const parsed = this._parseContactInfo(raw);
      if (parsed && parsed.name && parsed.phone) {
        return addCandidate(parsed.name, parsed.phone, options);
      }
      return false;
    };

    const bucketMap = new Map();
    const ensureBucket = (key, prioritize = false) => {
      if (!bucketMap.has(key)) {
        bucketMap.set(key, { name: '', phone: '', prioritize });
      }
      return bucketMap.get(key);
    };

    familyInfoList.forEach(item => {
      if (!item) {
        return;
      }
      const label = this.normalizeExcelSpacing(item.label);
      const value = item.value;
      const prioritize = /紧急/.test(label);

      if (tryParseStructured(value, prioritize ? { prioritize: true } : {})) {
        return;
      }

      const normalizedValue = this.normalizeExcelSpacing(value);
      const digits = this.normalizePhoneDigits(value);
      const hasPhone = digits.length >= 5;
      const hasName = normalizedValue && normalizedValue !== digits;
      const isPhoneLabel = /电话|手机|联系方式|号码/.test(label);

      let bucketKey = '';
      if (/紧急/.test(label)) {
        bucketKey = 'primary';
      } else if (/备用|次要|第二|副|后备/.test(label)) {
        bucketKey = 'backup';
      }

      if (bucketKey) {
        const bucket = ensureBucket(bucketKey, bucketKey === 'primary');
        if (hasName && !isPhoneLabel && !bucket.name) {
          bucket.name = normalizedValue;
        }
        if (hasPhone && !bucket.phone) {
          bucket.phone = digits;
        }
        if (!hasPhone && isPhoneLabel && typeof value === 'object') {
          tryParseStructured(value, bucketKey === 'primary' ? { prioritize: true } : {});
        }
        return;
      }

      if (hasName || hasPhone) {
        const bucket = ensureBucket(`label:${label}`);
        if (hasName && !bucket.name) {
          bucket.name = normalizedValue;
        }
        if (hasPhone && !bucket.phone) {
          bucket.phone = digits;
        }
      }
    });

    Array.from(bucketMap.values()).forEach(bucket => {
      if (bucket.name && bucket.phone) {
        addCandidate(bucket.name, bucket.phone, bucket.prioritize ? { prioritize: true } : {});
      }
    });

    if (!candidates.length) {
      const names = [];
      const phones = [];
      familyInfoList.forEach(item => {
        if (!item) {
          return;
        }
        const normalizedValue = this.normalizeExcelSpacing(item.value);
        const digits = this.normalizePhoneDigits(item.value);
        if (normalizedValue && normalizedValue !== digits) {
          names.push(normalizedValue);
        }
        if (digits.length >= 5) {
          phones.push(digits);
        }
      });
      if (names.length && phones.length) {
        addCandidate(names[0], phones[0]);
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

  // 新增：身份证号解析方法
  parseIDNumber(idNumber) {
    const trimmed = String(idNumber).trim();

    // 验证18位身份证号格式
    const regex18 = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/;

    if (!regex18.test(trimmed)) {
      // 格式不正确，清除自动填充标记
      this.setData({
        autoFilledFromID: false,
        genderLocked: false,
        birthDateLocked: false,
      });
      return;
    }

    // 提取性别（倒数第二位，奇数为男，偶数为女）
    const genderCode = parseInt(trimmed.charAt(16));
    const gender = genderCode % 2 === 0 ? '女' : '男';

    // 提取出生日期
    const year = trimmed.substring(6, 10);
    const month = trimmed.substring(10, 12);
    const day = trimmed.substring(12, 14);
    const birthDate = `${year}-${month}-${day}`;

    // 自动填充并锁定字段
    this.setData({
      'formData.gender': gender,
      'formData.birthDate': birthDate,
      autoFilledFromID: true,
      genderLocked: true,
      birthDateLocked: true,
      showAutoFillTip: true,
    });

    // 3秒后自动隐藏提示
    setTimeout(() => {
      this.setData({ showAutoFillTip: false });
    }, 3000);
  },

  // 新增：手动解锁编辑
  unlockField(e) {
    const { field } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认手动修改',
      content: '系统已从身份证号自动识别该信息，确定要手动修改吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            [`${field}Locked`]: false,
            autoFilledFromID: false,
          });
        }
      }
    });
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
              action: 'fullDetail',
              key,
              patientKey,
            },
          });

          if (!res.result || res.result.success === false) {
            continue;
          }

          const payload = res.result.data || res.result || {};
          const overviewData = payload.overview || {};
          const familyInfoList = Array.isArray(payload.family)
            ? payload.family
            : Array.isArray(payload.familyInfo)
            ? payload.familyInfo
            : [];
          const contactFromProfile = this._extractEmergencyContactFromProfile(familyInfoList);
          const contactFromPatientDoc = this._extractContactFromPatientDoc(
            overviewData.patientDoc || payload.patient || {}
          );
          const recordsSource = Array.isArray(payload.recordPreview && payload.recordPreview.items)
            ? payload.recordPreview.items
            : Array.isArray(payload.excelRecords)
            ? payload.excelRecords
            : Array.isArray(payload.records)
            ? payload.records
            : [];
          const contactFromRecords = this._extractContactFromRecords(recordsSource);
          const resolved = this._preferContact(
            contactFromPatientDoc,
            contactFromProfile &&
              contactFromProfile.emergencyContact &&
              contactFromProfile.emergencyPhone
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

      if (this.data && this.data.formData) {
        const formContact = this._extractContactFromForm(this.data.formData);
        if (formContact) {
          return formContact;
        }
      }

      return { emergencyContact: '', emergencyPhone: '' };
    } catch (error) {
      return { emergencyContact: '', emergencyPhone: '' };
    }
  },
});
