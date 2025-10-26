const logger = require('../../utils/logger');
const themeManager = require('../../utils/theme');

const {
  MAX_UPLOAD_BATCH,
  PATIENT_FIELD_CONFIG,
  CONTACT_FIELD_CONFIG,
  INTAKE_FIELD_CONFIG,
} = require('./constants.js');

const {
  normalizeString,
  formatDateTime,
  toTimestampFromDateInput: _toTimestampFromDateInput,
  sanitizeFileName,
  inferMimeType,
} = require('./helpers.js');

const {
  buildEditForm,
  cloneForm,
  detectFormChanges: _detectFormChanges,
  buildPickerIndexMap,
  collectChangedFormKeys: _collectChangedFormKeys,
  getFieldConfig: _getFieldConfig,
  validateField: _validateField,
  validateAllFields: _validateAllFields,
} = require('./form-utils.js');

const {
  findValueByLabels,
  coalesceValue,
  sortIntakeRecords,
  pushDisplayItem,
} = require('./data-mappers.js');

const { getDefaultQuota, makeQuotaPayload, createMediaService } = require('./media-service.js');

const PATIENT_CACHE_KEY = 'patient_list_cache';
const PATIENT_LIST_DIRTY_KEY = 'patient_list_dirty';
const INITIAL_THEME_KEY = themeManager.getTheme();

const STATUS_ALIAS_CONFIG = [
  {
    className: 'in-care',
    label: '在住',
    aliases: [
      '在住',
      '入住',
      '入住中',
      '已入住',
      '入住家庭',
      '在小家',
      '在院',
      '住院',
      '入院',
      'in care',
      'in_care',
      'in-care',
      'incare',
      'active',
    ],
  },
  {
    className: 'followup',
    label: '随访',
    aliases: ['随访', '随访中', '跟进', '跟进中', '待随访', 'followup', 'follow-up', 'follow_up'],
  },
  {
    className: 'pending',
    label: '待入住',
    aliases: [
      '待入住',
      '待入驻',
      '排队',
      '排队中',
      '排队入住',
      '待安排',
      '待入小家',
      '候补',
      'pending',
      'queue',
      'queued',
      'waiting',
    ],
  },
  {
    className: 'checked-out',
    label: '已离开',
    aliases: [
      '已离开',
      '离开',
      '离开中',
      '已搬离',
      '搬离',
      '退住',
      '退房',
      'checkout',
      'checkedout',
      'checked-out',
      'checked_out',
      'discharged',
      '出院',
      '离院',
      'closed',
      '结案',
      '已结案',
      '去世',
      '过世',
      '逝世',
      'deceased',
    ],
  },
];

function normalizeStatusKey(value) {
  const text = normalizeString(value);
  if (!text) {
    return '';
  }
  const base = text.split(/[（(]/)[0];
  return base.toLowerCase().replace(/[-_\s]+/g, '');
}

const STATUS_CLASS_MAP = {};
const STATUS_LABEL_MAP = {};

STATUS_ALIAS_CONFIG.forEach(({ aliases = [], className, label }) => {
  if (!className || !Array.isArray(aliases)) {
    return;
  }
  aliases.forEach(alias => {
    const key = normalizeStatusKey(alias);
    if (!key) {
      return;
    }
    STATUS_CLASS_MAP[key] = className;
    if (label) {
      STATUS_LABEL_MAP[key] = label;
    }
  });
});

function resolveStatusClass(status) {
  const key = normalizeStatusKey(status);
  if (!key) {
    return 'unknown';
  }
  const mapped = STATUS_CLASS_MAP[key];
  if (mapped) {
    return mapped;
  }
  const fallback = normalizeString(status)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return fallback || 'unknown';
}

function formatCareStatusLabel(status) {
  const text = normalizeString(status);
  if (!text) {
    return '';
  }
  const key = normalizeStatusKey(text);
  if (key && STATUS_LABEL_MAP[key]) {
    return STATUS_LABEL_MAP[key];
  }
  return text;
}

function formatRecordStatus(status) {
  if (!status) {
    return '';
  }

  const normalized = String(status).toLowerCase();

  if (normalized.includes('import')) {
    return '系统导入';
  }
  if (normalized === 'draft') {
    return '草稿';
  }
  if (normalized === 'submitted') {
    return '已提交';
  }

  return status;
}

function mapIntakeRecordForDisplay(record) {
  if (!record) {
    return null;
  }

  const medicalInfo = record.medicalInfo || {};
  const intakeInfo = record.intakeInfo || {};
  const metadata = record.metadata || {};
  const intakeTime = Number(
    record.intakeTime || intakeInfo.intakeTime || metadata.intakeTime || metadata.lastModifiedAt
  );
  const resolvedIntakeTime = Number.isFinite(intakeTime) ? intakeTime : Date.now();
  const checkoutRaw = record.checkoutAt || intakeInfo.checkoutAt || metadata.checkoutAt;
  const checkoutTs = Number(checkoutRaw);
  const checkoutDisplay = Number.isFinite(checkoutTs) ? formatDateTime(checkoutTs) : '未离开';

  const hospitalDisplay = coalesceValue(
    record.hospital,
    medicalInfo.hospital,
    intakeInfo.hospital
  );
  const diagnosisDisplay = coalesceValue(
    record.diagnosis,
    medicalInfo.diagnosis,
    intakeInfo.diagnosis,
    intakeInfo.visitReason
  );
  const doctorDisplay = coalesceValue(record.doctor, medicalInfo.doctor, intakeInfo.doctor);
  const symptomDetailDisplay = coalesceValue(
    medicalInfo.symptoms,
    record.symptoms,
    intakeInfo.symptoms,
    intakeInfo.situation
  );
  const treatmentProcessDisplay = coalesceValue(
    medicalInfo.treatmentProcess,
    record.treatmentProcess,
    intakeInfo.treatmentProcess
  );
  const followUpPlanDisplay = coalesceValue(
    record.followUpPlan,
    medicalInfo.followUpPlan,
    intakeInfo.followUpPlan
  );
  const durationDisplay = coalesceValue(
    intakeInfo.durationText,
    record.durationText
  );

  const normalized = {
    ...record,
  };

  normalized.intakeId = record.intakeId || record._id || `${resolvedIntakeTime}_${Math.random()}`;
  normalized.intakeTime = resolvedIntakeTime;
  normalized.displayTime = formatDateTime(resolvedIntakeTime);
  normalized.checkoutTime = Number.isFinite(checkoutTs) ? checkoutTs : null;
  normalized.checkoutDisplay = checkoutDisplay;
  // 若后端未提供durationText，但存在离开时间，则在前端计算一个简短时长
  if (!durationDisplay && Number.isFinite(checkoutTs) && checkoutTs > resolvedIntakeTime) {
    const DAY = 24 * 60 * 60 * 1000;
    const HOUR = 60 * 60 * 1000;
    const diff = checkoutTs - resolvedIntakeTime;
    if (diff >= DAY) {
      const days = Math.floor(diff / DAY);
      normalized.durationDisplay = `${days}天`;
    } else {
      const hours = Math.max(1, Math.ceil(diff / HOUR));
      normalized.durationDisplay = `${hours}小时`;
    }
  } else if (durationDisplay) {
    normalized.durationDisplay = durationDisplay;
  }
  normalized.updatedTime = formatDateTime(
    record.updatedAt || metadata.lastModifiedAt || metadata.submittedAt || resolvedIntakeTime
  );
  normalized.hospitalDisplay = hospitalDisplay;
  normalized.diagnosisDisplay = diagnosisDisplay;
  normalized.doctorDisplay = doctorDisplay;
  normalized.symptomDetailDisplay = symptomDetailDisplay;
  normalized.treatmentProcessDisplay = treatmentProcessDisplay;
  normalized.followUpPlanDisplay = followUpPlanDisplay;
  normalized.statusDisplay = formatRecordStatus(record.status);
  normalized.followUpPlan = followUpPlanDisplay;
  if (durationDisplay) {
    normalized.durationDisplay = durationDisplay;
  }

  return normalized;
}

function mapProfileRecordForDisplay(record, index) {
  if (!record) {
    return null;
  }
  const medicalInfo = record.medicalInfo || {};
  const intakeInfo = record.intakeInfo || {};

  const rawIntakeTime = Number(
    record.intakeTime || record.admissionTimestamp || intakeInfo.intakeTime
  );
  const resolvedIntakeTime = Number.isFinite(rawIntakeTime) && rawIntakeTime > 0 ? rawIntakeTime : Date.now();

  const hospitalDisplay = coalesceValue(record.hospital, medicalInfo.hospital, intakeInfo.hospital);
  const diagnosisDisplay = coalesceValue(
    record.diagnosis,
    medicalInfo.diagnosis,
    intakeInfo.diagnosis,
    intakeInfo.visitReason
  );
  const doctorDisplay = coalesceValue(record.doctor, medicalInfo.doctor, intakeInfo.doctor);
  const situationDisplay = coalesceValue(
    record.situation,
    intakeInfo.situation,
    medicalInfo.symptoms,
    record.symptoms
  );
  const symptomDetailDisplay = coalesceValue(
    medicalInfo.symptoms,
    record.symptoms,
    intakeInfo.symptoms,
    situationDisplay
  );
  const treatmentProcessDisplay = coalesceValue(
    medicalInfo.treatmentProcess,
    record.treatmentProcess,
    intakeInfo.treatmentProcess
  );
  const followUpPlanDisplay = coalesceValue(
    medicalInfo.followUpPlan,
    record.followUpPlan,
    intakeInfo.followUpPlan
  );

  return {
    ...record,
    intakeId: record.intakeId || record._id || `profile_${index}`,
    intakeTime: resolvedIntakeTime,
    displayTime: formatDateTime(resolvedIntakeTime),
    updatedAt: record.updatedAt || resolvedIntakeTime,
    updatedTime: formatDateTime(record.updatedAt || resolvedIntakeTime),
    hospitalDisplay,
    diagnosisDisplay,
    doctorDisplay,
    symptomDetailDisplay,
    treatmentProcessDisplay,
    followUpPlanDisplay,
    status: record.status || 'submitted',
    statusDisplay: formatRecordStatus(record.status || 'submitted'),
    followUpPlan: followUpPlanDisplay,
  };
}

function shouldDisplayIntakeRecord(record) {
  if (!record) {
    return false;
  }
  const status = (record.status || '').toLowerCase();
  // 只过滤掉 draft 状态的记录,其他状态都显示
  if (status === 'draft') {
    return false;
  }
  return true;
}

Page({
  data: {
    theme: INITIAL_THEME_KEY,
    themeClass: themeManager.resolveThemeClass(INITIAL_THEME_KEY),
    loading: true,
    error: '',
    patient: null,
    basicInfo: [],
    familyInfo: [],
    economicInfo: [],
    records: [],
    allIntakeRecords: [],
    operationLogs: [],
    operationLogsCollapsed: true,
    visibleIntakeRecords: [],
    intakeRecordCount: 0,
    intakeSummaryVersion: null,
    recordsSortOrder: 'desc',
    recordsExpanded: {},
    editMode: false,
    saving: false,
    editForm: {},
    editErrors: {},
    editDirty: false,
    editCanSave: false,
    editMetadata: {
      patientUpdatedAt: null,
      intakeUpdatedAt: null,
    },
    editPickerIndex: {},
    patientFieldConfig: PATIENT_FIELD_CONFIG,
    contactFieldConfig: CONTACT_FIELD_CONFIG,
    intakeFieldConfig: INTAKE_FIELD_CONFIG,
    media: {
      accessChecked: false,
      allowed: false,
      loading: false,
      error: '',
      tab: 'images',
      uploading: false,
      images: [],
      documents: [],
      quota: getDefaultQuota(),
    },
    textPreview: {
      visible: false,
      title: '',
      content: '',
    },
    lastSaveError: null,
    mediaInitialized: false,
    // 入住条目编辑
    recordEditDialogVisible: false,
    recordEditSubmitting: false,
    recordEditForm: {
      id: '',
      intakeDate: '',
      intakeTime: '',
      checkoutDate: '',
      checkoutTime: '',
      hospital: '',
      diagnosis: '',
      doctor: '',
      symptoms: '',
      treatmentProcess: '',
      followUpPlan: '',
    },

    // 状态调整对话框
    statusDialogVisible: false,
    statusDialogSubmitting: false,
    statusDialogOptions: [
      { id: 'in_care', label: '在住' },
      { id: 'pending', label: '待入住' },
      { id: 'discharged', label: '已离开' },
    ],
    statusDialogForm: {
      value: '',
      note: '',
    },
    statusDialogPatient: null,

    // 分模块弹窗编辑
    moduleEditDialogVisible: false,
    moduleEditBlock: '', // 'basic' | 'contact' | 'economic'
    blockEditForm: {},
    blockEditErrors: {},
    // 轻提示条
    inlineToastVisible: false,
    inlineToastText: '',
    inlineToastType: 'success', // success | error
  },
  

  handleThemeChange(theme) {
    this.setData({
      theme,
      themeClass: themeManager.resolveThemeClass(theme),
    });
  },
  onToggleOperationLogs() {
    const current = !!this.data.operationLogsCollapsed;
    this.setData({ operationLogsCollapsed: !current });
  },

  // 长按状态卡片，打开状态调整
  onStatusLongPress() {
    const patient = this.data && this.data.patient ? this.data.patient : null;
    if (!patient || !this.patientKey) {
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      return;
    }
    const currentStatusText = normalizeStatusKey(
      patient.careStatus || patient.status || patient.statusDisplay
    );
    let currentValue = 'pending';
    if (currentStatusText.includes('incare') || currentStatusText === 'active') {
      currentValue = 'in_care';
    } else if (
      currentStatusText.includes('discharged') ||
      currentStatusText.includes('checkout') ||
      currentStatusText.includes('checkedout') ||
      currentStatusText.includes('checkedout') ||
      currentStatusText.includes('checkedout') ||
      currentStatusText.includes('checkedout') ||
      currentStatusText.includes('离开')
    ) {
      currentValue = 'discharged';
    } else if (
      currentStatusText.includes('pending') ||
      currentStatusText.includes('待') ||
      currentStatusText.includes('随访')
    ) {
      currentValue = 'pending';
    }
    this.setData({
      statusDialogVisible: true,
      statusDialogSubmitting: false,
      statusDialogPatient: {
        patientName: patient.patientName || '',
        careStatus: currentValue,
      },
      statusDialogForm: {
        value: currentValue,
        note: '',
      },
    });
  },

  // 信息卡片编辑入口（弹窗编辑该模块）/ 资料编辑入口（无参调用）
  onEditStart(e) {
    const block = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.block) || '';
    // 若未传入模块，进入整体资料编辑模式（用于单元测试与早期交互）
    if (!block) {
      const original = this.originalEditForm || {};
      this.setData({
        editMode: true,
        editForm: { ...original },
        editErrors: {},
        editDirty: false,
        editCanSave: false,
      });
      return;
    }
    const patient = this.data.patient || {};
    const safe = v => (v === undefined || v === null ? '' : String(v));
    let form = {};
    if (block === 'basic') {
      form = {
        patientName: safe(patient.patientName),
        gender: safe(patient.gender),
        birthDate: safe(patient.birthDate),
        idType: safe(patient.idType || '身份证'),
        idNumber: safe(patient.idNumber),
        phone: safe(patient.phone),
        nativePlace: safe(patient.nativePlace),
        ethnicity: safe(patient.ethnicity),
      };
    } else if (block === 'contact') {
      form = {
        address: safe(patient.address),
        fatherInfo: safe(patient.fatherInfo),
        motherInfo: safe(patient.motherInfo),
        guardianInfo: safe(patient.guardianInfo),
      };
    } else if (block === 'economic') {
      form = { familyEconomy: safe(patient.familyEconomy) };
    }
    this.setData({ moduleEditDialogVisible: true, moduleEditBlock: block, blockEditForm: form });
  },
  // 简化的资料编辑：字段更新 + 校验（用于单元测试）
  updateEditFormValue(field, value) {
    const nextForm = { ...(this.data.editForm || {}) };
    nextForm[field] = value;
    const errors = { ...(this.data.editErrors || {}) };
    if (field === 'phone') {
      const v = String(value || '').trim();
      if (v && !/^1[3-9]\d{9}$/.test(v)) {
        errors.phone = '手机号格式不正确';
      } else {
        delete errors.phone;
      }
    }
    const canSave = Object.keys(errors).length === 0;
    this.setData({ editForm: nextForm, editErrors: errors, editDirty: true, editCanSave: canSave });
  },
  async onSaveTap() {
    const form = this.data.editForm || {};
    const required = ['patientName', 'idType', 'idNumber', 'gender', 'birthDate', 'address'];
    const hasMissing = required.some(k => !String(form[k] || '').trim());
    if (hasMissing || (this.data.editErrors && Object.keys(this.data.editErrors).length > 0)) {
      wx.showToast({ icon: 'none', title: '请修正校验错误后再保存' });
      return;
    }
    // 若未变更则直接退出
    const original = this.originalEditForm || {};
    const changedKeys = Object.keys(form).filter(k => String(form[k] || '') !== String(original[k] || ''));
    if (changedKeys.length === 0) {
      this.setData({ editMode: false });
      return;
    }
    try {
      const updates = {};
      ['patientName', 'gender', 'birthDate', 'idType', 'idNumber', 'phone', 'nativePlace', 'ethnicity', 'address']
        .forEach(k => { if (form[k] !== undefined) updates[k] = form[k]; });
      const res = await wx.cloud.callFunction({
        name: 'patientIntake',
        data: { action: 'updatePatient', patientKey: this.patientKey, patientUpdates: updates, audit: { message: '编辑资料' } },
      });
      const result = res && res.result;
      if (!result || result.success === false) {
        const err = (result && result.error) || {};
        throw new Error(err.message || '保存失败');
      }
      wx.showToast({ icon: 'success', title: '保存成功' });
      if (typeof this.markPatientListDirty === 'function') {
        this.markPatientListDirty(form);
      }
      if (typeof this.updateDetailSummary === 'function') {
        this.updateDetailSummary(form);
      }
      if (typeof this.fetchPatientDetail === 'function') {
        await this.fetchPatientDetail();
      }
      this.setData({ editMode: false });
    } catch (error) {
      wx.showToast({ icon: 'none', title: (error && error.message) || '保存失败' });
    }
  },
  onModuleLongPress(e) {
    this.onEditStart(e);
  },

  onBlockFieldInput(e) {
    const field = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.field;
    const value = (e.detail && e.detail.value) || '';
    if (!field) return;
    const errors = { ...(this.data.blockEditErrors || {}) };
    if (errors[field]) {
      delete errors[field];
      this.setData({ blockEditErrors: errors });
    }
    this.setData({ [`blockEditForm.${field}`]: value });
  },
  onBlockGenderChange(e) {
    const value = (e.detail && e.detail.value) || '';
    const errors = { ...(this.data.blockEditErrors || {}) };
    if (errors.gender) { delete errors.gender; this.setData({ blockEditErrors: errors }); }
    this.setData({ 'blockEditForm.gender': value });
  },
  onBlockBirthDateChange(e) {
    const value = (e.detail && e.detail.value) || '';
    const errors = { ...(this.data.blockEditErrors || {}) };
    if (errors.birthDate) { delete errors.birthDate; this.setData({ blockEditErrors: errors }); }
    this.setData({ 'blockEditForm.birthDate': value });
  },
  onBlockCancel() {
    this.setData({ moduleEditDialogVisible: false, moduleEditBlock: '', blockEditForm: {}, blockEditErrors: {} });
  },
  async onBlockSave() {
    if (!this.patientKey) {
      wx.showToast({ icon: 'none', title: '缺少住户标识' });
      return;
    }
    const block = this.data.moduleEditBlock;
    if (!block) return;
    const f = this.data.blockEditForm || {};
    let updates = {};
    const validate = this._validateBlockForm(block, f);
    if (!validate.valid) {
      this.setData({ blockEditErrors: validate.errors || {} });
      const first = validate.message || '请完善必填项';
      wx.showToast({ icon: 'none', title: first });
      return;
    }
    if (block === 'basic') {
      if (!f.patientName) { wx.showToast({ icon: 'none', title: '请输入姓名' }); return; }
      if (!f.idNumber) { wx.showToast({ icon: 'none', title: '请输入证件号码' }); return; }
      updates = {
        patientName: f.patientName,
        gender: f.gender,
        birthDate: f.birthDate,
        idType: f.idType,
        idNumber: f.idNumber,
        phone: f.phone,
        nativePlace: f.nativePlace,
        ethnicity: f.ethnicity,
      };
    } else if (block === 'contact') {
      if (!f.address) { wx.showToast({ icon: 'none', title: '请输入家庭地址' }); return; }
      updates = {
        address: f.address,
        fatherInfo: f.fatherInfo,
        motherInfo: f.motherInfo,
        guardianInfo: f.guardianInfo,
      };
    } else if (block === 'economic') {
      updates = { familyEconomy: f.familyEconomy };
    }
    wx.showLoading({ title: '保存中', mask: true });
    try {
      const res = await wx.cloud.callFunction({ name: 'patientIntake', data: { action: 'updatePatient', patientKey: this.patientKey, patientUpdates: updates, audit: { message: `就地编辑: ${block}` } } });
      const result = res && res.result;
      if (!result || result.success === false) {
        const err = (result && result.error) || {};
        throw new Error(err.message || '保存失败');
      }
      // 局部更新 patient 与对应显示块，避免整页刷新
      const current = this.data.patient || {};
      const nextPatient = { ...current, ...updates };
      const patch = { patient: nextPatient, moduleEditDialogVisible: false, moduleEditBlock: '', blockEditForm: {} };
      if (block === 'basic') {
        patch.basicInfo = this._rebuildBasicInfoDisplay(nextPatient, this.data.basicInfo);
      } else if (block === 'contact') {
        patch.familyInfo = this._rebuildContactInfoDisplay(nextPatient, this.data.familyInfo);
      } else if (block === 'economic') {
        patch.economicInfo = this._rebuildEconomicInfoDisplay(nextPatient, this.data.economicInfo);
      }
      this.setData(patch);
      this._showInlineToast('已保存', 'success');
    } catch (error) {
      this._showInlineToast((error && error.message) || '保存失败', 'error');
    } finally {
      wx.hideLoading();
    }
  },
  _validateBlockForm(block, f = {}) {
    const errors = {};
    let first = '';
    const setErr = (k, msg) => { errors[k] = msg; if (!first) first = msg; };
    const isMobile = v => /^1[3-9]\d{9}$/.test(v || '');
    const isIdCard = v => /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/.test((v||'').trim());
    if (block === 'basic') {
      if (!f.patientName || !String(f.patientName).trim()) setErr('patientName', '请输入姓名');
      if (!f.gender) setErr('gender', '请选择性别');
      if (!f.birthDate) setErr('birthDate', '请选择出生日期');
      if (!f.idNumber || !String(f.idNumber).trim()) setErr('idNumber', '请输入证件号码');
      if ((!f.idType || f.idType === '身份证') && f.idNumber && !isIdCard(f.idNumber)) setErr('idNumber', '身份证号码格式不正确');
      if (f.phone && !isMobile(f.phone)) setErr('phone', '手机号码格式不正确');
      // 出生日期不能晚于今天
      if (f.birthDate) {
        const d = new Date(f.birthDate); const now = new Date();
        if (Number.isNaN(d.getTime()) || d > now) setErr('birthDate', '出生日期不合法');
      }
    } else if (block === 'contact') {
      if (!f.address || !String(f.address).trim()) setErr('address', '请输入家庭地址');
    } else if (block === 'economic') {
      // 经济情况可为空
    }
    return { valid: Object.keys(errors).length === 0, errors, message: first };
  },
  _showInlineToast(text, type = 'success') {
    try { if (this._inlineToastTimer) { clearTimeout(this._inlineToastTimer); this._inlineToastTimer = null; } }
    catch (e) { /* noop */ }
    this.setData({ inlineToastVisible: true, inlineToastText: String(text || ''), inlineToastType: type });
    this._inlineToastTimer = setTimeout(() => {
      this.setData({ inlineToastVisible: false });
      this._inlineToastTimer = null;
    }, 1800);
  },
  _rebuildBasicInfoDisplay(patient, prev = []) {
    const map = new Map(prev.map(it => [it && it.label, it]));
    const setVal = (label, value) => {
      const v = (value === undefined || value === null) ? '' : String(value);
      map.set(label, { label, value: v });
    };
    setVal('姓名', patient.patientName || '');
    setVal('性别', patient.gender || '');
    setVal('出生日期', patient.birthDate || '');
    setVal('身份证号', patient.idNumber || '');
    setVal('籍贯', patient.nativePlace || '');
    setVal('民族', patient.ethnicity || '');
    // 主要照护人保持原有（如存在）
    return Array.from(map.values()).filter(Boolean);
  },
  _rebuildContactInfoDisplay(patient, _prev = []) {
    // 与 XLSX 原始字段对齐：仅保留 家庭地址/父亲联系方式/母亲联系方式/其他监护人
    const list = [];
    const push = (label, value) => list.push({ label, value: value == null ? '' : String(value) });
    push('家庭地址', patient.address || '');
    push('父亲联系方式', patient.fatherInfo || '');
    push('母亲联系方式', patient.motherInfo || '');
    push('其他监护人', patient.guardianInfo || '');
    return list;
  },
  _rebuildEconomicInfoDisplay(patient, prev = []) {
    const map = new Map(prev.map(it => [it && it.label, it]));
    const setVal = (label, value) => {
      const v = (value === undefined || value === null) ? '' : String(value);
      map.set(label, { label, value: v });
    };
    setVal('家庭经济情况', patient.familyEconomy || '');
    return Array.from(map.values()).filter(Boolean);
  },

  // 入住记录 — 添加
  onAddIntakeRecord() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    this.setData({
      recordEditDialogVisible: true,
      recordEditSubmitting: false,
      recordEditForm: {
        id: '',
        intakeDate: `${y}-${m}-${d}`,
        intakeTime: `${hh}:${mm}`,
        checkoutDate: '',
        checkoutTime: '',
        hospital: '',
        diagnosis: '',
        doctor: '',
        symptoms: '',
        treatmentProcess: '',
        followUpPlan: '',
      },
    });
  },

  // 入住记录 — 编辑
  onEditIntakeRecord(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '';
    if (!id) return;
    const record = (this.data.visibleIntakeRecords || []).find(r => r.intakeId === id);
    if (!record) return;
    const intakeTs = Number(record.intakeTime || (record.intakeInfo && record.intakeInfo.intakeTime) || 0) || 0;
    const checkoutTs = Number(record.checkoutAt || (record.intakeInfo && record.intakeInfo.checkoutAt) || 0) || 0;
    const toDate = ts => {
      const d = new Date(ts);
      if (!Number.isFinite(d.getTime())) return '';
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };
    const toTime = ts => {
      const d = new Date(ts);
      if (!Number.isFinite(d.getTime())) return '';
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    };
    this.setData({
      recordEditDialogVisible: true,
      recordEditSubmitting: false,
      recordEditForm: {
        id,
        intakeDate: intakeTs ? toDate(intakeTs) : '',
        intakeTime: intakeTs ? toTime(intakeTs) : '',
        checkoutDate: checkoutTs ? toDate(checkoutTs) : '',
        checkoutTime: checkoutTs ? toTime(checkoutTs) : '',
        hospital: record.hospital || (record.intakeInfo && record.intakeInfo.hospital) || '',
        diagnosis: record.diagnosis || (record.intakeInfo && record.intakeInfo.diagnosis) || '',
        doctor: record.doctor || (record.intakeInfo && record.intakeInfo.doctor) || '',
        symptoms: record.symptomDetailDisplay || (record.intakeInfo && record.intakeInfo.symptoms) || '',
        treatmentProcess: record.treatmentProcessDisplay || (record.intakeInfo && record.intakeInfo.treatmentProcess) || '',
        followUpPlan: record.followUpPlan || (record.intakeInfo && record.intakeInfo.followUpPlan) || '',
      },
    });
  },
  onRecordEditCancel() { if (!this.data.recordEditSubmitting) this.setData({ recordEditDialogVisible: false }); },
  onRecordIntakeDateChange(e) { this.setData({ 'recordEditForm.intakeDate': (e.detail && e.detail.value) || '' }); },
  onRecordIntakeTimeChange(e) { this.setData({ 'recordEditForm.intakeTime': (e.detail && e.detail.value) || '' }); },
  onRecordCheckoutDateChange(e) { this.setData({ 'recordEditForm.checkoutDate': (e.detail && e.detail.value) || '' }); },
  onRecordCheckoutTimeChange(e) { this.setData({ 'recordEditForm.checkoutTime': (e.detail && e.detail.value) || '' }); },
  onRecordFieldInput(e) {
    const field = e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.field;
    const value = (e.detail && e.detail.value) || '';
    if (!field) return;
    this.setData({ [`recordEditForm.${field}`]: value });
  },
  async onRecordEditConfirm() {
    if (this.data.recordEditSubmitting) return;
    const form = this.data.recordEditForm || {};
    const toTs = (dateStr, timeStr) => {
      if (!dateStr) return null;
      const t = `${dateStr}T${(timeStr || '00:00')}:00`;
      const ts = Date.parse(t);
      return Number.isFinite(ts) ? ts : null;
    };
    const intakeTs = toTs(form.intakeDate, form.intakeTime);
    const checkoutTs = toTs(form.checkoutDate, form.checkoutTime);
    if (!intakeTs) {
      wx.showToast({ icon: 'none', title: '请完善入住时间' });
      return;
    }
    if (checkoutTs && checkoutTs < intakeTs) {
      wx.showToast({ icon: 'none', title: '离开时间不能早于入住时间' });
      return;
    }
    this.setData({ recordEditSubmitting: true });
    try {
      const payload = {
        action: 'updateIntakeRecord',
        patientKey: this.patientKey,
        intakeId: form.id || undefined,
        intakeTime: intakeTs,
        checkoutAt: checkoutTs || undefined,
        hospital: form.hospital,
        diagnosis: form.diagnosis,
        doctor: form.doctor,
        symptoms: form.symptoms,
        treatmentProcess: form.treatmentProcess,
        followUpPlan: form.followUpPlan,
      };
      const res = await wx.cloud.callFunction({ name: 'patientIntake', data: payload });
      if (res && res.result && res.result.success === false) {
        const err = res.result.error || {};
        throw new Error(err.message || '保存失败');
      }
      const data = (res && res.result && res.result.data) || {};
      const nextPatient = { ...(this.data.patient || {}) };
      if (data && typeof data.admissionCount === 'number') {
        nextPatient.admissionCount = data.admissionCount;
      }
      // 关闭对话框并局部刷新记录列表
      this.setData({ recordEditDialogVisible: false, recordEditSubmitting: false, patient: nextPatient });
      await this.refreshIntakeRecordsPartial();
      wx.showToast({ icon: 'success', title: '已保存' });
    } catch (error) {
      this.setData({ recordEditSubmitting: false });
      wx.showToast({ icon: 'none', title: (error && error.message) || '保存失败' });
    }
  },
  async onDeleteIntakeRecord(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '';
    if (!id) return;
    const res = await wx.showModal({ title: '确认删除', content: '删除后不可恢复，是否继续？', confirmText: '删除', cancelText: '取消' });
    if (!res.confirm) return;
    try {
      const resp = await wx.cloud.callFunction({ name: 'patientIntake', data: { action: 'deleteIntakeRecord', patientKey: this.patientKey, intakeId: id } });
      if (resp && resp.result && resp.result.success === false) {
        const err = resp.result.error || {};
        throw new Error(err.message || '删除失败');
      }
      const data = (resp && resp.result && resp.result.data) || {};
      const nextPatient = { ...(this.data.patient || {}) };
      if (data && typeof data.admissionCount === 'number') {
        nextPatient.admissionCount = data.admissionCount;
      }
      this.setData({ patient: nextPatient });
      await this.refreshIntakeRecordsPartial();
      wx.showToast({ icon: 'success', title: '已删除' });
    } catch (error) {
      wx.showToast({ icon: 'none', title: (error && error.message) || '删除失败' });
    }
  },
  async refreshIntakeRecordsPartial() {
    try {
      const res = await wx.cloud.callFunction({ name: 'patientIntake', data: { action: 'listIntakeRecords', patientKey: this.patientKey, limit: 50 } });
      const data = (res && res.result && res.result.data) || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const serverRecords = items.map(mapIntakeRecordForDisplay).filter(Boolean).filter(shouldDisplayIntakeRecord);
      const currentOrder = this.data.recordsSortOrder || 'desc';
      const sorted = sortIntakeRecords(serverRecords, currentOrder);
      this.allIntakeRecordsSource = serverRecords;
      this.setData({
        visibleIntakeRecords: sorted,
        intakeRecordCount: data.count !== undefined ? Number(data.count) : sorted.length,
      });
    } catch (error) {
      // 如果拉取失败，不影响主流程
    }
  },

  onStatusDialogClose() {
    if (this.data.statusDialogSubmitting) return;
    this.resetStatusDialog();
  },
  onStatusOptionSelect(event) {
    if (this.data.statusDialogSubmitting) return;
    const value = (event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.value) || '';
    if (!value) return;
    this.setData({ 'statusDialogForm.value': value });
  },
  onStatusNoteInput(event) {
    const value = (event.detail && event.detail.value) || '';
    this.setData({ 'statusDialogForm.note': value });
  },
  onStatusDialogCancel() {
    if (this.data.statusDialogSubmitting) return;
    this.resetStatusDialog();
  },
  async onStatusDialogConfirm() {
    if (this.data.statusDialogSubmitting) return;
    const value = normalizeString(this.data.statusDialogForm && this.data.statusDialogForm.value);
    if (!value) {
      wx.showToast({ icon: 'none', title: '请选择状态' });
      return;
    }
    const note = normalizeString(this.data.statusDialogForm && this.data.statusDialogForm.note);
    this.setData({ statusDialogSubmitting: true });
    wx.showLoading({ title: '处理中', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'patientIntake',
        data: { action: 'updateCareStatus', patientKey: this.patientKey, status: value, note },
      });
      const payload = (res && res.result && res.result.data) || {};
      this.applyStatusChangeResult({
        careStatus: value,
        note,
        statusAdjustedAt: Number(payload.statusAdjustedAt) || Date.now(),
        checkoutAt: Number(payload.checkoutAt) || null,
      });
      wx.showToast({ icon: 'success', title: '已更新' });
    } catch (error) {
      logger.error('detail updateCareStatus failed', error);
      const message = normalizeString((error && (error.message || error.errMsg)) || '更新失败');
      wx.showToast({ icon: 'none', title: message.length > 14 ? `${message.slice(0, 13)}...` : message });
    } finally {
      wx.hideLoading();
      this.setData({ statusDialogSubmitting: false });
      this.resetStatusDialog();
    }
  },
  resetStatusDialog() {
    this.setData({
      statusDialogVisible: false,
      statusDialogSubmitting: false,
      statusDialogPatient: null,
      statusDialogForm: { value: '', note: '' },
    });
  },

  applyStatusChangeResult({ careStatus, note, statusAdjustedAt, checkoutAt }) {
    const current = this.data.patient || {};
    const nextStatus = normalizeString(careStatus) || 'pending';
    const display = formatCareStatusLabel(nextStatus) || current.statusDisplay || '';
    const statusClass = resolveStatusClass(nextStatus || display);
    const nextPatient = {
      ...current,
      careStatus: nextStatus,
      status: nextStatus,
      statusDisplay: display,
      statusClass,
      manualStatusUpdatedAt: statusAdjustedAt,
    };
    if (nextStatus === 'discharged') {
      nextPatient.checkoutAt = checkoutAt || statusAdjustedAt;
    } else {
      if (nextPatient.checkoutAt) delete nextPatient.checkoutAt;
      if (nextPatient.checkoutReason) delete nextPatient.checkoutReason;
      if (nextPatient.checkoutNote) delete nextPatient.checkoutNote;
    }
    if (note) {
      nextPatient.manualStatusNote = note;
    } else if (nextPatient.manualStatusNote) {
      delete nextPatient.manualStatusNote;
    }
    this.setData({ patient: nextPatient });
    // 通知列表页刷新
    try {
      wx.setStorageSync(PATIENT_LIST_DIRTY_KEY, {
        timestamp: Date.now(),
        patientKey: this.patientKey,
        updates: {
          careStatus: nextStatus,
          manualStatusNote: note,
          manualStatusUpdatedAt: statusAdjustedAt,
          checkoutAt: nextStatus === 'discharged' ? (checkoutAt || statusAdjustedAt) : null,
        },
      });
    } catch (e) {
      // ignore
    }
  },

  onLoad(options) {
    const rawKey = options && options.key ? decodeURIComponent(options.key) : '';
    const rawPatientId = options && options.patientId ? decodeURIComponent(options.patientId) : '';

    this.profileKey = rawKey || rawPatientId || '';
    this.patientKey = rawPatientId || rawKey || '';
    this.familyInfoSource = [];
    this.patientForEditSource = {};
    this.patientDisplaySource = {};
    this.mediaInitialized = false;
    this.originalEditForm = null;
    this.allIntakeRecordsSource = [];
    this.mediaService = createMediaService(this);

    const app = getApp();
    this.themeUnsubscribe = app && typeof app.watchTheme === 'function'
      ? app.watchTheme(theme => this.handleThemeChange(theme), { immediate: true })
      : themeManager.subscribeTheme(theme => this.handleThemeChange(theme));

    if (!this.profileKey && !this.patientKey) {
      this.setData({ loading: false, error: '缺少住户标识' });
      return;
    }

    if (!this.profileKey) {
      this.profileKey = this.patientKey;
    }

    this.fetchPatientDetail();
  },

  onUnload() {
    if (this.mediaService && typeof this.mediaService.dispose === 'function') {
      this.mediaService.dispose();
    }
    this.mediaService = null;
    this.profileKey = '';
    this.patientKey = '';
    this.familyInfoSource = [];
    this.patientForEditSource = {};
    this.patientDisplaySource = {};
    this.originalEditForm = null;
    this.allIntakeRecordsSource = [];
    this.mediaInitialized = false;
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload();
    }
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
  },

  async fetchPatientDetail() {
    this.setData({ loading: true, error: '' });

    try {
      const existingPatientName = (this.data && this.data.patient && this.data.patient.patientName) || '';
      const profileKeySnapshot = this.profileKey || '';

      let profileResult = {
        patient: null,
        basicInfo: [],
        familyInfo: [],
        economicInfo: [],
        records: [],
      };

      const hasPatientKey = Boolean(this.patientKey);
      const needProfile = Boolean(this.profileKey);

      const profilePromise = needProfile
        ? wx.cloud
            .callFunction({ name: 'patientProfile', data: { action: 'detail', key: this.profileKey } })
            .catch(error => {
              logger.error('Failed to load profile detail', error);
              return null;
            })
        : Promise.resolve(null);

      let patientRes = null;
      let intakeRecordsRes = null;

      if (hasPatientKey) {
        const [profileRes, patientDetailRes, intakeRes] = await Promise.all([
          profilePromise,
          wx.cloud.callFunction({
            name: 'patientIntake',
            data: {
              action: 'getPatientDetail',
              patientKey: this.patientKey,
              recordKey: profileKeySnapshot,
              patientName: existingPatientName,
            },
          }),
          wx.cloud.callFunction({
            name: 'patientIntake',
            data: {
              action: 'getAllIntakeRecords',
              patientKey: this.patientKey,
              recordKey: profileKeySnapshot,
              patientName: existingPatientName,
            },
          }),
        ]);
        profileResult = (profileRes && profileRes.result) || profileResult;
        patientRes = patientDetailRes;
        intakeRecordsRes = intakeRes;
      } else {
        try {
          const profileRes = await profilePromise;
          if (profileRes && profileRes.result) {
            profileResult = profileRes.result;
          }
        } catch (profileError) {
          logger.error('Failed to load profile detail', profileError);
        }

        const resolvedPatientKeyFromProfile =
          (profileResult &&
            (profileResult.patientKey ||
              (profileResult.patient &&
                (profileResult.patient.key || profileResult.patient.patientKey)))) ||
          '';

        if (resolvedPatientKeyFromProfile) {
          this.patientKey = resolvedPatientKeyFromProfile;
        }

        if (this.patientKey) {
          try {
            [patientRes, intakeRecordsRes] = await Promise.all([
              wx.cloud.callFunction({
                name: 'patientIntake',
                data: {
              action: 'getPatientDetail',
              patientKey: this.patientKey,
              recordKey: profileKeySnapshot,
              patientName: profileResult.patientName || '',
            },
          }),
          wx.cloud.callFunction({
            name: 'patientIntake',
            data: {
              action: 'getAllIntakeRecords',
              patientKey: this.patientKey,
              recordKey: profileKeySnapshot,
              patientName: profileResult.patientName || '',
            },
          }),
        ]);
          } catch (intakeError) {
            logger.error('Failed to load intake records from patientIntake', intakeError);
            patientRes = null;
            intakeRecordsRes = null;
          }
        }
      }

      const resolvedPatientKey =
        this.patientKey ||
        (profileResult &&
          (profileResult.patientKey ||
            (profileResult.patient &&
              (profileResult.patient.key || profileResult.patient.patientKey)))) ||
        '';

      if (resolvedPatientKey) {
        this.patientKey = resolvedPatientKey;
      }

      if (profileResult && profileResult.recordKey) {
        this.profileKey = profileResult.recordKey;
      }

      const patientDisplay = profileResult.patient ? { ...profileResult.patient } : {};
      if (this.patientKey && !patientDisplay.key) {
        patientDisplay.key = this.patientKey;
      }
      if (this.profileKey && !patientDisplay.recordKey) {
        patientDisplay.recordKey = this.profileKey;
      }

      const detailData = (patientRes && patientRes.result && patientRes.result.data) || {};
      const patientForEdit = detailData.patient || {};
      if (patientForEdit.key && patientForEdit.key !== this.patientKey) {
        this.patientKey = patientForEdit.key;
      }
      if (patientForEdit.patientName) {
        patientDisplay.patientName = patientForEdit.patientName;
      }
      if (patientForEdit.gender) {
        patientDisplay.gender = patientForEdit.gender;
      }
      if (patientForEdit.birthDate) {
        patientDisplay.birthDate = patientForEdit.birthDate;
      }
      if (patientForEdit.idNumber) {
        patientDisplay.idNumber = patientForEdit.idNumber;
      }
      if (patientForEdit.phone) {
        patientDisplay.phone = patientForEdit.phone;
      }
      if (patientForEdit.address) {
        patientDisplay.address = patientForEdit.address;
      }
      if (patientForEdit.lastIntakeNarrative) {
        patientDisplay.lastIntakeNarrative = patientForEdit.lastIntakeNarrative;
      }
      const resolvedCareStatus =
        [
          patientForEdit.careStatus,
          patientForEdit.data && patientForEdit.data.careStatus,
          patientDisplay.careStatus,
          profileResult && profileResult.careStatus,
        ].find(item => Boolean(normalizeString(item))) || '';
      if (resolvedCareStatus) {
        patientDisplay.careStatus = resolvedCareStatus;
        patientForEdit.careStatus = resolvedCareStatus;
      }
      if (patientForEdit.checkoutAt !== undefined) {
        patientDisplay.checkoutAt = patientForEdit.checkoutAt;
      }
      if (patientForEdit.checkoutReason) {
        patientDisplay.checkoutReason = patientForEdit.checkoutReason;
      }
      if (patientForEdit.checkoutNote) {
        patientDisplay.checkoutNote = patientForEdit.checkoutNote;
      }

      const latestIntakeRaw = detailData.latestIntake || null;
      const operationLogs = (detailData.operationLogs || []).map(log => ({
        timeText: formatDateTime(log.createdAt),
        operatorName: normalizeString(log.operatorName) || normalizeString(log.operatorId) || '',
        message: normalizeString(log.message) || '操作',
      }));

      const currentOrder = this.data.recordsSortOrder || 'desc';

      const intakeRecordsData =
        (intakeRecordsRes && intakeRecordsRes.result && intakeRecordsRes.result.data) || {};
      const serverRecords = (intakeRecordsData.records || [])
        .map(mapIntakeRecordForDisplay)
        .filter(Boolean);
      const filteredServerRecords = serverRecords.filter(shouldDisplayIntakeRecord);

      let aggregatedRecords = filteredServerRecords;
      if (!aggregatedRecords.length && Array.isArray(profileResult.records)) {
        const profileRecordsForDisplay = profileResult.records
          .map((record, index) => mapProfileRecordForDisplay(record, index))
          .filter(Boolean)
          .filter(shouldDisplayIntakeRecord);
        aggregatedRecords = profileRecordsForDisplay;
      }
      const aggregatedSortedRecords = sortIntakeRecords(aggregatedRecords, currentOrder);

      this.allIntakeRecordsSource = aggregatedRecords;

      const serverCountRaw =
        intakeRecordsData.count !== undefined
          ? intakeRecordsData.count
          : intakeRecordsData.totalCount !== undefined
            ? intakeRecordsData.totalCount
            : aggregatedSortedRecords.length;
      const serverCount = Number(serverCountRaw);

      if (Number.isFinite(serverCount)) {
        patientDisplay.admissionCount = serverCount;
        patientForEdit.admissionCount = serverCount;
      } else {
        patientDisplay.admissionCount = aggregatedSortedRecords.length;
        patientForEdit.admissionCount = aggregatedSortedRecords.length;
      }

      const editForm = buildEditForm(patientForEdit, latestIntakeRaw || {}, patientDisplay);

      this.originalEditForm = cloneForm(editForm);

      const profileBasicInfo = Array.isArray(profileResult.basicInfo)
        ? profileResult.basicInfo
        : [];
      const profileFamilyInfo = Array.isArray(profileResult.familyInfo)
        ? profileResult.familyInfo
        : [];
      this.familyInfoSource = profileFamilyInfo.map(item => ({
        label: item && item.label ? item.label : '',
        value: item && item.value ? item.value : '',
      }));
      this.patientForEditSource = { ...patientForEdit };
      this.patientDisplaySource = { ...patientDisplay };
      const profileEconomicInfo = Array.isArray(profileResult.economicInfo)
        ? profileResult.economicInfo
        : [];

      const basicInfoDisplay = [];

      pushDisplayItem(
        basicInfoDisplay,
        '姓名',
        coalesceValue(
          patientForEdit.patientName,
          patientDisplay.patientName,
          profileResult.patientName,
          patientDisplay.name
        )
      );

      pushDisplayItem(
        basicInfoDisplay,
        '性别',
        coalesceValue(
          patientForEdit.gender,
          patientDisplay.gender,
          findValueByLabels(profileBasicInfo, ['gender', '性别'])
        )
      );

      pushDisplayItem(
        basicInfoDisplay,
        '出生日期',
        coalesceValue(
          patientForEdit.birthDate,
          patientDisplay.birthDate,
          findValueByLabels(profileBasicInfo, ['birth date', '出生', 'birthday'])
        )
      );

      pushDisplayItem(
        basicInfoDisplay,
        '身份证号',
        coalesceValue(
          patientForEdit.idNumber,
          patientDisplay.idNumber,
          findValueByLabels(profileBasicInfo, ['id number', '证件', '身份证'])
        )
      );

      pushDisplayItem(
        basicInfoDisplay,
        '籍贯',
        coalesceValue(
          patientForEdit.nativePlace,
          patientDisplay.nativePlace,
          findValueByLabels(profileBasicInfo, ['native place', '籍贯'])
        )
      );

      pushDisplayItem(
        basicInfoDisplay,
        '民族',
        coalesceValue(
          patientForEdit.ethnicity,
          patientDisplay.ethnicity,
          findValueByLabels(profileBasicInfo, ['ethnicity', '民族'])
        )
      );

      pushDisplayItem(
        basicInfoDisplay,
        '主要照护人',
        coalesceValue(
          patientDisplay.summaryCaregivers,
          findValueByLabels(profileBasicInfo, ['caregivers', '照护', '监护'])
        )
      );

      const familyInfoDisplay = [];
      const pushFamily = (label, value) => pushDisplayItem(familyInfoDisplay, label, value);

      pushFamily(
        '家庭地址',
        coalesceValue(
          patientForEdit.address,
          patientDisplay.address,
          findValueByLabels(profileFamilyInfo, ['address', '家庭地址'])
        )
      );

      pushFamily(
        '父亲联系方式',
        coalesceValue(
          patientForEdit.fatherInfo,
          patientDisplay.fatherInfo,
          findValueByLabels(profileFamilyInfo, ['father', '父亲'])
        )
      );
      pushFamily(
        '母亲联系方式',
        coalesceValue(
          patientForEdit.motherInfo,
          patientDisplay.motherInfo,
          findValueByLabels(profileFamilyInfo, ['mother', '母亲'])
        )
      );
      pushFamily(
        '其他监护人',
        coalesceValue(
          patientForEdit.otherGuardian,
          patientDisplay.otherGuardian,
          findValueByLabels(profileFamilyInfo, [
            'other guardian',
            '其他监护',
            '祖母',
            '祖父',
            'guardian',
          ])
        )
      );

      const economicInfoDisplay = [];
      pushDisplayItem(
        economicInfoDisplay,
        '家庭经济情况',
        coalesceValue(findValueByLabels(profileEconomicInfo, ['economic', '经济']))
      );

      if (patientForEdit.patientName) {
        wx.setNavigationBarTitle({ title: patientForEdit.patientName });
      } else if (patientDisplay && patientDisplay.patientName) {
        wx.setNavigationBarTitle({ title: patientDisplay.patientName });
      }

      if (Object.keys(patientDisplay).length) {
        const statusValue =
          [
            patientDisplay.careStatus,
            patientDisplay.status,
            profileResult && profileResult.careStatus,
            patientDisplay.statusDisplay,
          ].find(item => Boolean(normalizeString(item))) || '';
        if (statusValue) {
          patientDisplay.status = statusValue;
        }
        const statusDisplay =
          formatCareStatusLabel(statusValue) || formatCareStatusLabel(patientDisplay.statusDisplay);
        if (statusDisplay) {
          patientDisplay.statusDisplay = statusDisplay;
        }
        patientDisplay.statusClass = resolveStatusClass(statusValue || statusDisplay);
      }

      const patientInfoForDisplay = Object.keys(patientDisplay).length ? patientDisplay : null;

      const resolvedCount = Number.isFinite(serverCount)
        ? serverCount
        : aggregatedSortedRecords.length;

      this.setData(
        {
          loading: false,
          patient: patientInfoForDisplay,
          basicInfo: basicInfoDisplay,
          familyInfo: familyInfoDisplay,
          economicInfo: economicInfoDisplay,
          visibleIntakeRecords: aggregatedSortedRecords,
          intakeRecordCount: resolvedCount,
          intakeSummaryVersion:
            typeof intakeRecordsData.summaryVersion === 'number'
              ? intakeRecordsData.summaryVersion
              : this.data.intakeSummaryVersion,
          operationLogs,
          editForm,
          editErrors: {},
          editDirty: false,
          editCanSave: false,
          editMetadata: {
            patientUpdatedAt: patientForEdit.updatedAt || null,
            intakeUpdatedAt:
              (latestIntakeRaw && latestIntakeRaw.updatedAt) ||
              (latestIntakeRaw &&
                latestIntakeRaw.metadata &&
                latestIntakeRaw.metadata.lastModifiedAt) ||
              null,
          },
          editPickerIndex: buildPickerIndexMap(editForm),
        },
        () => {
          // 附件改为按需加载，首屏不再默认请求
        }
      );
    } catch (error) {
      logger.error('Failed to load patient detail', error);
      this.setData({
        loading: false,
        error: (error && (error.errMsg || error.message)) || '加载住户详情失败，请稍后重试',
      });
    }
  },

  onToggleRecordsSort() {
    const nextOrder = this.data.recordsSortOrder === 'desc' ? 'asc' : 'desc';
    const source = this.allIntakeRecordsSource;
    const list = Array.isArray(source) ? source : [];

    if (!list.length) {
      this.setData({ recordsSortOrder: nextOrder });
      return;
    }

    const sorted = sortIntakeRecords(list, nextOrder);
    this.setData({
      recordsSortOrder: nextOrder,
      visibleIntakeRecords: sorted,
    });
  },

  onToggleRecordExpand(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      return;
    }
    const currentState = this.data.recordsExpanded[id] || false;
    this.setData({
      [`recordsExpanded.${id}`]: !currentState,
    });
  },


  markPatientListDirty(form) {
    const flag = {
      timestamp: Date.now(),
      patientKey:
        this.patientKey ||
        form.patientKey ||
        (this.data.patient && (this.data.patient.key || this.data.patient.patientKey)) ||
        '',
      updates: {
        patientName: form.patientName,
        phone: form.phone,
        address: form.address,
        gender: form.gender,
      },
    };

    try {
      wx.setStorageSync(PATIENT_LIST_DIRTY_KEY, flag);
    } catch (error) {
      // ignore storage failure
    }

    try {
      wx.removeStorageSync(PATIENT_CACHE_KEY);
    } catch (error) {
      // ignore cache removal failure
    }
  },

  updateDetailSummary(form) {
    const currentPatient = this.data.patient || {};
    const nextPatient = {
      ...currentPatient,
      patientName: form.patientName,
      phone: form.phone,
      address: form.address,
    };

    const nextBasicInfo = (this.data.basicInfo || []).map(item => {
      if (!item || typeof item !== 'object') {
        return item;
      }
      if (item.label === '姓名') {
        return { ...item, value: form.patientName || item.value };
      }
      if (item.label === '性别') {
        return { ...item, value: form.gender || item.value };
      }
      if (item.label === '出生日期') {
        return { ...item, value: form.birthDate || item.value };
      }
      if (item.label === '身份证号') {
        return { ...item, value: form.idNumber || item.value };
      }
      return item;
    });

    if (!nextBasicInfo.some(item => item && item.label === '姓名')) {
      nextBasicInfo.unshift({ label: '姓名', value: form.patientName || '' });
    }

    const nextFamilyInfo = (this.data.familyInfo || []).map(item => {
      if (!item || typeof item !== 'object') {
        return item;
      }
      if (item.label === '家庭地址') {
        return { ...item, value: form.address || item.value };
      }
      return item;
    }).filter(item => !item || (item.label !== '紧急联系人' && item.label !== '紧急联系电话'));

    this.setData({
      patient: nextPatient,
      basicInfo: nextBasicInfo,
      familyInfo: nextFamilyInfo,
    });

    if (form.patientName) {
      wx.setNavigationBarTitle({ title: form.patientName });
    }

    this.patientForEditSource = {
      ...(this.patientForEditSource || {}),
      patientName: form.patientName,
      gender: form.gender,
      birthDate: form.birthDate,
      phone: form.phone,
      address: form.address,
    };

    this.patientDisplaySource = {
      ...(this.patientDisplaySource || {}),
      patientName: form.patientName,
      gender: form.gender,
      birthDate: form.birthDate,
      phone: form.phone,
      address: form.address,
    };

    this.originalEditForm = {
      ...(this.originalEditForm || {}),
      patientName: form.patientName,
      gender: form.gender,
      birthDate: form.birthDate,
      phone: form.phone,
      address: form.address,
    };
  },

  setMediaState(patch) {
    this.mediaService.setMediaState(patch);
  },

  async initMediaSection() {
    this.ensureMediaInitialized();
    return this.mediaService.initMediaSection();
  },

  ensureMediaInitialized() {
    if (this.mediaInitialized) {
      return;
    }
    this.mediaInitialized = true;
    this.setData({ mediaInitialized: true });
  },

  async refreshMediaList() {
    return this.mediaService.refreshMediaList();
  },

  async callPatientMedia(action, payload = {}) {
    return this.mediaService.callPatientMedia(action, payload);
  },

  onMediaRetry() {
    if (this.data.media.loading) {
      return;
    }
    if (!this.mediaInitialized) {
      this.initMediaSection();
      return;
    }
    this.refreshMediaList();
  },

  onMediaLoadTap() {
    if (this.data.media.loading) {
      return;
    }
    this.initMediaSection();
  },

  onMediaTabChange(event) {
    const tab = normalizeString(event.currentTarget.dataset.tab);
    if (!tab || tab === this.data.media.tab) {
      return;
    }
    if (tab !== 'images' && tab !== 'documents') {
      return;
    }
    this.setMediaState({ tab });
  },

  async onUploadImagesTap() {
    if (!this.data.media.allowed || this.data.media.uploading) {
      return;
    }
    const quota = this.data.media.quota || getDefaultQuota();
    const remainingCount = quota.remainingCount || 0;
    if (remainingCount <= 0) {
      wx.showToast({ icon: 'none', title: '数量已达上限' });
      return;
    }
    const count = Math.min(MAX_UPLOAD_BATCH, remainingCount);
    try {
      const res = await wx.chooseImage({
        count,
        sizeType: ['compressed', 'original'],
        sourceType: ['album', 'camera'],
      });
      const rawFiles = (res && res.tempFiles) || [];
      const fallbackPaths = (res && res.tempFilePaths) || [];
      const files = rawFiles.length
        ? rawFiles.map(item => ({
            name: sanitizeFileName(item.path),
            size: item.size,
            path: item.path,
            mimeType: inferMimeType(item.path, item.type),
          }))
        : fallbackPaths.map(path => ({
            name: sanitizeFileName(path),
            size: 0,
            path,
            mimeType: inferMimeType(path),
          }));
      await this.mediaService.processUploads(files, 'image');
    } catch (error) {
      if (error && /cancel/.test(error.errMsg || '')) {
        return;
      }
      this.handleMediaError(error, '上传');
    }
  },

  async onUploadDocumentsTap() {
    if (!this.data.media.allowed || this.data.media.uploading) {
      return;
    }
    const quota = this.data.media.quota || getDefaultQuota();
    const remainingCount = quota.remainingCount || 0;
    if (remainingCount <= 0) {
      wx.showToast({ icon: 'none', title: '数量已达上限' });
      return;
    }
    const count = Math.min(MAX_UPLOAD_BATCH, remainingCount);
    try {
      const res = await wx.chooseMessageFile({ count, type: 'file' });
      const filesSource = (res && res.tempFiles) || (res && res.files) || [];
      const files = filesSource.map(item => ({
        name: sanitizeFileName(item.name || item.path),
        size: item.size,
        path: item.path,
        mimeType: inferMimeType(item.name || item.path, item.type),
      }));
      await this.mediaService.processUploads(files, 'document');
    } catch (error) {
      if (error && /cancel/.test(error.errMsg || '')) {
        return;
      }
      this.handleMediaError(error, '上传');
    }
  },

  updateMediaRecord(category, index, updates) {
    this.mediaService.updateMediaRecord(category, index, updates);
  },

  removeMediaRecord(category, id) {
    this.mediaService.removeMediaRecord(category, id);
  },

  async ensureImagePreviewUrls() {
    return this.mediaService.ensureImagePreviewUrls();
  },

  async onImagePreviewTap(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isFinite(index) || index < 0) {
      return;
    }
    const images = this.data.media.images || [];
    if (!images.length || !images[index]) {
      return;
    }
    wx.showLoading({ title: '加载中…', mask: true });
    try {
      await this.ensureImagePreviewUrls();
      const refreshed = this.data.media.images || [];
      const urls = refreshed.map(item => item.previewUrl || item.thumbnailUrl).filter(Boolean);
      if (!urls.length) {
        wx.showToast({ icon: 'none', title: '暂无可预览图片' });
        return;
      }
      const currentUrl = refreshed[index].previewUrl || refreshed[index].thumbnailUrl;
      wx.previewImage({
        current: currentUrl,
        urls,
      });
    } catch (error) {
      this.handleMediaError(error, '预览');
    } finally {
      wx.hideLoading();
    }
  },

  async onImageDownloadTap(event) {
    const index = Number(event.currentTarget.dataset.index);
    const id = normalizeString(event.currentTarget.dataset.id);
    if (!Number.isFinite(index) || !id) {
      return;
    }
    const record = this.data.media.images && this.data.media.images[index];
    if (!record) {
      return;
    }
    this.updateMediaRecord('image', index, { downloading: true });
    try {
      const data = await this.callPatientMedia('download', { mediaId: id });
      await this.downloadMediaFile(record, data.url);
      wx.showToast({ icon: 'success', title: '已下载' });
    } catch (error) {
      this.handleMediaError(error, '下载');
    } finally {
      this.updateMediaRecord('image', index, { downloading: false });
    }
  },

  async onDocumentDownloadTap(event) {
    const index = Number(event.currentTarget.dataset.index);
    const id = normalizeString(event.currentTarget.dataset.id);
    if (!Number.isFinite(index) || !id) {
      return;
    }
    const record = this.data.media.documents && this.data.media.documents[index];
    if (!record) {
      return;
    }
    this.updateMediaRecord('document', index, { downloading: true });
    try {
      const data = await this.callPatientMedia('download', { mediaId: id });
      await this.downloadMediaFile(record, data.url);
    } catch (error) {
      this.handleMediaError(error, '下载');
    } finally {
      this.updateMediaRecord('document', index, { downloading: false });
    }
  },

  downloadMediaFile(record, url) {
    return this.mediaService.downloadMediaFile(record, url);
  },

  async onDeleteMediaTap(event) {
    const id = normalizeString(event.currentTarget.dataset.id);
    const category = normalizeString(event.currentTarget.dataset.category);
    const index = Number(event.currentTarget.dataset.index);
    if (!id || (category !== 'image' && category !== 'document')) {
      return;
    }
    const confirmRes = await wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#e64340',
    });
    if (!confirmRes.confirm) {
      return;
    }
    this.updateMediaRecord(category, index, { deleting: true });
    try {
      const data = await this.callPatientMedia('delete', { mediaId: id });
      this.removeMediaRecord(category, id);
      if (data && data.quota) {
        this.setData({ 'media.quota': makeQuotaPayload(data.quota) });
      }
      wx.showToast({ icon: 'success', title: '已删除' });
    } catch (error) {
      this.handleMediaError(error, '删除');
      this.updateMediaRecord(category, index, { deleting: false });
    }
  },

  async onDocumentNameTap(event) {
    const index = Number(event.currentTarget.dataset.index);
    const id = normalizeString(event.currentTarget.dataset.id);
    if (!Number.isFinite(index) || !id) {
      return;
    }
    const record = this.data.media.documents && this.data.media.documents[index];
    if (!record || !record.textPreviewAvailable) {
      return;
    }
    this.updateMediaRecord('document', index, { previewLoading: true });
    try {
      const data = await this.callPatientMedia('previewTxt', { mediaId: id });
      this.setData({
        textPreview: {
          visible: true,
          title: record.displayName,
          content: (data && data.content) || '',
        },
      });
    } catch (error) {
      this.handleMediaError(error, '预览');
    } finally {
      this.updateMediaRecord('document', index, { previewLoading: false });
    }
  },

  onTextPreviewClose() {
    if (!this.data.textPreview.visible) {
      return;
    }
    this.setData({ 'textPreview.visible': false });
  },

  handleMediaError(error, context) {
    this.mediaService.handleMediaError(error, context);
  },

  noop() {},
});
