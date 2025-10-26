// 住户录入向导页面
const themeManager = require('../../../utils/theme');
const INITIAL_THEME_KEY = themeManager.getTheme();
const PATIENT_LIST_DIRTY_KEY = 'patient_list_dirty';

const STEP_DEFINITIONS = [
  { title: '基础身份', key: 'identity' },
  { title: '联系人', key: 'contact' },
  { title: '情况说明', key: 'situation' },
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

Page({
  data: {
    theme: INITIAL_THEME_KEY,
    themeClass: themeManager.resolveThemeClass(INITIAL_THEME_KEY),
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
      fatherInfo: '',
      motherInfo: '',
      guardianInfo: '',
      admissionDate: '',
      situation: '',
      visitHospital: '',
      hospitalDiagnosis: '',
      attendingDoctor: '',
      symptomDetail: '',
      treatmentProcess: '',
      followUpPlan: '',
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

    // UI状态
    submitting: false,
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

    const app = getApp();
    this.themeUnsubscribe = app && typeof app.watchTheme === 'function'
      ? app.watchTheme(theme => this.handleThemeChange(theme), { immediate: true })
      : themeManager.subscribeTheme(theme => this.handleThemeChange(theme));

    const today = this.formatDate(new Date());
    this.setData({
      today,
      patientKey: options.patientKey || '',
      mode,
    });

    this.updateFormData({ admissionDate: today });

    this.patientDataPromise = null;
    this.patientDataPrefetchStarted = false;
    this.patientDataLoaded = !isEditingExisting;
    this.patientDataError = null;
    this.patientDataPrefetchFailed = false;

    wx.setNavigationBarTitle({
      title: mode === 'create' ? '新建住户档案' : '入住办理',
    });

    // 首先加载配置
    this.loadConfig().then(() => {
      // 初始化必填项状态
      this.ensureCurrentStepVisible();
      this.updateRequiredFields();
    });
  },

  onShow() {
    // noop
  },

  onHide() {
    // noop
  },

  onUnload() {
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
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

  handleThemeChange(theme) {
    this.setData({
      theme,
      themeClass: themeManager.resolveThemeClass(theme),
    });
  },

  // 已移除多联系人逻辑

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

    const sanitizedForName = value.replace(/[^\u4e00-\u9fa5A-Za-z]+/g, ' ').replace(/1[3-9]\d{9}(?!\d)/g, ' ');
    const name = sanitizedForName
      .replace(/\d{15,18}[Xx]?/g, ' ')
      .replace(/身份证|证件|电话号码|联系电话|联系方式|手机|手机号/g, ' ')
      .replace(/[()（）:-]/g, ' ')
      .replace(/[,，、;；]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) {
      return null;
    }
    return { name, phone };
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

      }
    } catch (error) {
      logger.error('加载配置失败', error);
      // 使用默认配置
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
  async loadPatientData(patientKey, options = {}) {
    const { showLoading = true } = options;
    let hasPrefilled = false;
    try {
      if (showLoading) {
        wx.showLoading({ title: '加载中...' });
      }

      // 使用 patientProfile 获取完整的住户信息,包括父母联系方式
      const excelRecordKey = this.normalizeExcelSpacing(patientKey) || '';
      let profilePayload = null;
      let intakePatientDoc = null;
      let latestIntakeDetail = null;
      try {
        const res = await wx.cloud.callFunction({
          name: 'patientProfile',
          data: {
            action: 'detail',
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

      try {
        const formPatientName = this.data && this.data.formData ? this.data.formData.patientName : '';
        const intakeRes = await wx.cloud.callFunction({
          name: 'patientIntake',
          data: {
            action: 'getPatientDetail',
            patientKey,
            recordKey: excelRecordKey || patientKey,
            patientName: this.normalizeExcelSpacing(formPatientName),
          },
        });

        if (intakeRes.result && intakeRes.result.success !== false) {
          const detailData = intakeRes.result.data || intakeRes.result || {};
          if (detailData && detailData.patient && typeof detailData.patient === 'object') {
            intakePatientDoc = detailData.patient;
          }
          if (detailData && detailData.latestIntake && typeof detailData.latestIntake === 'object') {
            latestIntakeDetail = detailData.latestIntake;
          }
        }
      } catch (intakeError) {
        // ignore intake detail preload errors
      }

      const payload = profilePayload || {};
      const overviewPayload = payload.overview || {};
      const patientDocForEdit = (() => {
        const sources = [overviewPayload.patientDoc, payload.patient, intakePatientDoc];
        const merged = {};
        sources.forEach(source => {
          if (!source || typeof source !== 'object') {
            return;
          }
          Object.keys(source).forEach(key => {
            const value = source[key];
            if (value !== undefined && value !== null && merged[key] === undefined) {
              merged[key] = value;
            }
          });
        });
        return merged;
      })();
      const overviewDisplay = (() => {
        const sources = [overviewPayload.patientDisplay, payload.patient, intakePatientDoc];
        const merged = {};
        sources.forEach(source => {
          if (!source || typeof source !== 'object') {
            return;
          }
          Object.keys(source).forEach(key => {
            const value = source[key];
            if (value !== undefined && value !== null && merged[key] === undefined) {
              merged[key] = value;
            }
          });
        });
        return merged;
      })();
      const basicInfoList = Array.isArray(payload.basicInfo) ? payload.basicInfo : [];
      const familyInfoList = Array.isArray(payload.family) ? payload.family : [];
      const resolvedExcelKey =
        this.normalizeExcelSpacing(overviewPayload.recordKey) ||
        this.normalizeExcelSpacing(patientDocForEdit.recordKey) ||
        this.normalizeExcelSpacing(intakePatientDoc && intakePatientDoc.recordKey) ||
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

      const patientDocSource = patientDocForEdit || {};
      const latestIntakeRecord = latestIntakeDetail || {};
      const _latestIntakeInfo = (latestIntakeRecord && latestIntakeRecord.intakeInfo) || {};
      const _latestMedicalInfo = (latestIntakeRecord && latestIntakeRecord.medicalInfo) || {};
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
        intakePatientDoc && intakePatientDoc.patientName,
        this.data.formData.patientName
      );
      const resolvedIdType =
        preferString(
          patientDocSource.idType,
          this.data.formData.idType,
          overviewDisplay.idType,
          intakePatientDoc && intakePatientDoc.idType,
          '身份证'
        ) || '身份证';
      const resolvedIdNumber = preferString(
        patientDocSource.idNumber,
        idNumber,
        overviewDisplay.idNumber,
        intakePatientDoc && intakePatientDoc.idNumber,
        this.data.formData.idNumber
      );
      const resolvedGender = preferString(
        patientDocSource.gender,
        gender,
        overviewDisplay.gender,
        intakePatientDoc && intakePatientDoc.gender,
        this.data.formData.gender
      );
      const resolvedBirthDate = preferDate(
        patientDocSource.birthDate,
        birthDate,
        overviewDisplay.birthDate,
        intakePatientDoc && intakePatientDoc.birthDate,
        this.data.formData.birthDate
      );
      const resolvedPhone = preferString(
        patientDocSource.phone,
        overviewDisplay.phone,
        intakePatientDoc && intakePatientDoc.phone,
        this.data.formData.phone
      );
      const resolvedAddress = preferString(
        patientDocSource.address,
        address,
        overviewDisplay.address,
        intakePatientDoc && intakePatientDoc.address,
        this.data.formData.address
      );
      const _resolvedBackupContact = this.data.formData.backupContact || '';
      const _resolvedBackupPhone = this.data.formData.backupPhone || '';
      const resolvedVisitHospital = this.data.formData.visitHospital || '';
      const resolvedHospitalDiagnosis = this.data.formData.hospitalDiagnosis || '';
      const resolvedAttendingDoctor = this.data.formData.attendingDoctor || '';
      const resolvedSymptomDetail = this.data.formData.symptomDetail || '';
      const resolvedTreatmentProcess = this.data.formData.treatmentProcess || '';
      const resolvedFollowUpPlan = this.data.formData.followUpPlan || '';
      // 情况说明不自动填充，保持为空，让用户填写本次入住的具体情况
      const resolvedSituation = this.data.formData.situation || '';
      const resolvedAdmissionDate =
        this.data.formData.admissionDate || this.data.today || this.formatDate(new Date());

      // 联系方式按 Excel 字段预填：父亲联系方式/母亲联系方式/其他监护人

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
      appendContactText(intakePatientDoc && intakePatientDoc.guardianInfo, '监护人');
      appendContactText(patientDocSource.motherInfo, '母亲');
      appendContactText(overviewDisplay.motherInfo, '母亲');
      appendContactText(intakePatientDoc && intakePatientDoc.motherInfo, '母亲');
      appendContactText(patientDocSource.fatherInfo, '父亲');
      appendContactText(overviewDisplay.fatherInfo, '父亲');
      appendContactText(intakePatientDoc && intakePatientDoc.fatherInfo, '父亲');
      appendContactText(patientDocSource.otherGuardian, '监护人');
      appendContactText(overviewDisplay.otherGuardian, '监护人');
      appendContactText(intakePatientDoc && intakePatientDoc.otherGuardian, '监护人');

      const resolvedFatherInfo =
        this.data.formData.fatherInfo ||
        this.normalizeExcelSpacing(patientDocSource.fatherInfo) ||
        this.normalizeExcelSpacing(overviewDisplay.fatherInfo) ||
        this.normalizeExcelSpacing(intakePatientDoc && intakePatientDoc.fatherInfo) ||
        '';
      const resolvedMotherInfo =
        this.data.formData.motherInfo ||
        this.normalizeExcelSpacing(patientDocSource.motherInfo) ||
        this.normalizeExcelSpacing(overviewDisplay.motherInfo) ||
        this.normalizeExcelSpacing(intakePatientDoc && intakePatientDoc.motherInfo) ||
        '';
      const resolvedGuardianInfo =
        this.data.formData.guardianInfo ||
        this.normalizeExcelSpacing(patientDocSource.guardianInfo) ||
        this.normalizeExcelSpacing(overviewDisplay.guardianInfo) ||
        this.normalizeExcelSpacing(intakePatientDoc && intakePatientDoc.guardianInfo) ||
        this.normalizeExcelSpacing(patientDocSource.otherGuardian) ||
        this.normalizeExcelSpacing(overviewDisplay.otherGuardian) ||
        this.normalizeExcelSpacing(intakePatientDoc && intakePatientDoc.otherGuardian) ||
        '';

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
        visitHospital: resolvedVisitHospital,
        hospitalDiagnosis: resolvedHospitalDiagnosis,
        attendingDoctor: resolvedAttendingDoctor,
        symptomDetail: resolvedSymptomDetail,
        treatmentProcess: resolvedTreatmentProcess,
        followUpPlan: resolvedFollowUpPlan,
        admissionDate: resolvedAdmissionDate,
        fatherInfo: resolvedFatherInfo,
        motherInfo: resolvedMotherInfo,
        guardianInfo: resolvedGuardianInfo,
      };

      const syncedForm = this.updateFormData(nextFormData);
      const idTypeIndex = this.data.idTypes.indexOf(syncedForm.idType || '身份证');
      this.setData({ idTypeIndex: idTypeIndex >= 0 ? idTypeIndex : 0 });
      hasPrefilled = true;

      this.updateRequiredFields();
      this.patientDataLoaded = true;
      this.patientDataError = null;
      this.patientDataPrefetchFailed = false;
      return true;
    } catch (error) {
      logger.error('[预填充] 加载住户数据失败', error);
      if (showLoading && !hasPrefilled) {
        wx.showToast({
          title: error.message || '加载失败',
          icon: 'error',
        });
      }
      this.patientDataLoaded = false;
      this.patientDataError = error;
      this.patientDataPrefetchFailed = true;
      throw error;
    } finally {
      this.data.prefillCompleted = true;
      this.setData({ prefillCompleted: true });
      if (showLoading) {
        wx.hideLoading();
      }
      this.updateRequiredFields();
    }
  },

  startPatientDataPrefetch() {
    if (!this.data.patientKey) {
      return null;
    }
    if (this.patientDataPrefetchStarted && this.patientDataPromise) {
      return this.patientDataPromise;
    }

    this.patientDataPrefetchFailed = false;
    this.patientDataPrefetchStarted = true;
    const promise = this.loadPatientData(this.data.patientKey, { showLoading: false })
      .then(result => {
        this.patientDataLoaded = true;
        this.patientDataError = null;
        return result;
      })
      .catch(error => {
        this.patientDataLoaded = false;
        this.patientDataError = error;
        this.patientDataPrefetchFailed = true;
        this.patientDataPrefetchStarted = false;
        this.patientDataPromise = null;
        throw error;
      });

    this.patientDataPromise = promise;
    return this.patientDataPromise;
  },

  async ensurePatientDataReady() {
    if (!this.data.patientKey) {
      return;
    }

    if (!this.patientDataPrefetchStarted || !this.patientDataPromise) {
      this.startPatientDataPrefetch();
    }

    if (this.patientDataLoaded) {
      return;
    }

    if (!this.patientDataPromise) {
      throw new Error('住户信息尚未准备好');
    }

    wx.showLoading({ title: '正在准备住户信息...' });
    try {
      await this.patientDataPromise;
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: (error && error.message) || '住户信息加载失败，请稍后重试',
        icon: 'none',
        duration: 3000,
      });
      throw error;
    }
    wx.hideLoading();
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

  updateFormData(partialFormData = {}) {
    const merged = { ...this.data.formData, ...partialFormData };
    this.data.formData = merged;
    this.setData({ formData: merged });
    return merged;
  },


  // 更新必填项状态
  updateRequiredFields() {
    const { currentStep } = this.data;
    const { formData } = this.data;
    let requiredFields = [];
    let requiredFieldsText = '';

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
        // 步骤2：联系人（仅校验家庭地址；联系人清单已取消）
        if (!formData.address || !formData.address.trim()) {
          requiredFields.push({ key: 'address', label: '家庭地址' });
        }
        break;
      }
      case 2:
        // 步骤3：情况说明 - 选填
        if (!formData.admissionDate) {
          requiredFields.push({ key: 'admissionDate', label: '入住时间' });
        }
        break;
      case 3: {
        // 步骤4：核对提交
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

    const currentStepDef = this.data.steps[currentStep] || {};
    if (
      currentStepDef.key === 'situation' &&
      this.data.patientKey &&
      !this.patientDataPrefetchStarted &&
      !this.patientDataPrefetchFailed
    ) {
      this.startPatientDataPrefetch();
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
    { key: 'address', label: '家庭地址' },
  ];

    const missing = [];

    if (!isEditingExisting) {
      baseAndContactFields.forEach(field => {
        if (!formData[field.key]) {
          missing.push(field);
        }
      });
    }

    if (!formData.admissionDate) {
      missing.push({ key: 'admissionDate', label: '入住时间' });
    }


    if (this.data.mode === 'create' && missing.length) {
      logger.warn('[wizard] missing required fields in create mode', missing, formData);
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
      case 'backupPhone':
        if (value && !/^1[3-9]\d{9}$/.test(value)) {
          error = '手机号码格式不正确';
        }
        break;

      case 'situation':
        break;
      case 'admissionDate':
        if (!value) {
          error = '请选择入住时间';
        }
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
  async onStepTap(e) {
    const { step } = e.currentTarget.dataset;
    const targetIndex = Number(step);
    if (!this.isStepVisible(targetIndex)) {
      return;
    }
    const targetStepDef = this.data.steps[targetIndex] || {};
    if (
      targetStepDef.key === 'review' &&
      targetIndex > this.data.currentStep &&
      this.data.patientKey
    ) {
      try {
        await this.ensurePatientDataReady();
      } catch (error) {
        return;
      }
    }
    if (targetIndex <= this.data.currentStep || targetStepDef) {
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
  async onNextStep() {
    if (!this.validateCurrentStep()) {
      return;
    }

    const nextStep = this.getNextVisibleStepIndex(this.data.currentStep);
    if (nextStep !== null) {
      const nextStepDef = this.data.steps[nextStep] || {};
      if (nextStepDef.key === 'review' && this.data.patientKey) {
        try {
          await this.ensurePatientDataReady();
        } catch (error) {
          return;
        }
      }
      this.setData({ currentStep: nextStep });
      this.updateRequiredFields();
    }
  },

  // 校验当前步骤
  validateCurrentStep() {
    const { currentStep } = this.data;
    const { formData } = this.data;
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
        // 步骤2：联系人（仅校验家庭地址）
        if (!formData.address || !formData.address.trim()) {
          errors.address = '请输入家庭地址';
          isValid = false;
          if (!firstErrorMessage) {
            firstErrorMessage = errors.address;
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

  // 提交表单
  async onSubmit() {
    if (!this.data.allRequiredCompleted) {
      wx.showToast({
        title: '请完成所有必填项',
        icon: 'none',
      });
      return;
    }

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

      // 跳转到成功页面
      const query = this._buildSuccessQuery(submitResult && submitResult.data);
      const target = query
        ? `/pages/patient-intake/success/success?${query}`
        : '/pages/patient-intake/success/success';

      logger.info('[wizard] redirecting to success page', target);
      wx.redirectTo({
        url: target,
        success: () => {
          logger.info('[wizard] redirectTo success', target);
        },
        fail: err => {
          logger.error('[wizard] redirectTo failed', err && err.errMsg ? err.errMsg : err);
        },
      });
    } catch (error) {
      logger.error('提交失败', error);
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
    const { formData, isEditingExisting, patientKey, mode } = this.data;

    const finalFormData = { ...formData };
    const guardianEntries = [];
    const normalizedGuardianInfo = this.normalizeExcelSpacing(finalFormData.guardianInfo);
    if (normalizedGuardianInfo) {
      guardianEntries.push(normalizedGuardianInfo);
    }
    finalFormData.guardianInfo = guardianEntries.join('；');

    // 构建提交数据
    const cleanedFormData = { ...finalFormData };
    // 移除已废弃的扩展联系人映射
    delete cleanedFormData.extraContacts;

    // 规范：将入住日期同步为时间戳写入 formData.intakeTime，便于服务端统一读取
    const selectedAdmissionDate = finalFormData.admissionDate || this.data.today;
    const selectedIntakeTs = selectedAdmissionDate
      ? new Date(selectedAdmissionDate).getTime()
      : Date.now();
    cleanedFormData.intakeTime = selectedIntakeTs;

    const submitData = {
      action: mode === 'create' ? 'createPatient' : 'submit',
      patientKey: isEditingExisting ? patientKey : null,
      isEditingExisting, // 传递标志给服务端
      formData: cleanedFormData,
      uploadedFiles: [],
      admissionDate: selectedAdmissionDate,
      intakeTimestamp: selectedIntakeTs,
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
    const { formData, mode } = this.data;
    const params = {
      patientName: formData.patientName || '',
      intakeTime: String(
        payload.intakeTime ||
          (formData.admissionDate
            ? new Date(formData.admissionDate).getTime()
            : Date.now())
      ),
      admissionDate: formData.admissionDate || '',
      uploadCount: '0',
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
  _extractEmergencyContactFromProfile() {
    return [];
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

  // 解析联系人文本（供测试与历史数据清洗）
  buildContactsFromFields(payload = {}) {
    const list = [];
    const seen = new Set();
    const items = Array.isArray(payload.additionalText) ? payload.additionalText : [];
    const parse = (text, relation) => {
      const normalized = this.normalizeExcelSpacing(text);
      if (!normalized) return null;
      // 粗略解析：中文/英文姓名 + 空格 + 11位手机号
      const m = normalized.match(/[\u4e00-\u9fa5A-Za-z·•\s]+\s+(1[3-9]\d{9})/);
      if (!m) return null;
      const name = this.normalizeExcelSpacing(normalized.replace(m[1], '').trim());
      const phone = this.normalizeExcelSpacing(m[1]);
      const rel = this.normalizeExcelSpacing(relation);
      const key = `${name}|${phone}|${rel}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return { relationship: rel || '', name, phone };
    };
    items.forEach(item => {
      if (!item) return;
      const rel = item.relation || '';
      const text = item.text || '';
      const parsed = parse(text, rel);
      if (parsed) list.push(parsed);
    });
    return list;
  },

  async _autoFillEmergencyContactFromParents() {
    return null;
  },
});
