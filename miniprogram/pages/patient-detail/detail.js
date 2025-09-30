const logger = require('../../utils/logger');

const {
  MAX_UPLOAD_BATCH,
  PATIENT_FIELD_CONFIG,
  CONTACT_FIELD_CONFIG,
  INTAKE_FIELD_CONFIG,
} = require('./constants.js');

const {
  normalizeString,
  formatDateTime,
  toTimestampFromDateInput,
  sanitizeFileName,
  inferMimeType,
} = require('./helpers.js');

const {
  buildEditForm,
  cloneForm,
  detectFormChanges,
  buildPickerIndexMap,
  collectChangedFormKeys,
  getFieldConfig: getFieldConfigUtil,
  validateField: validateFieldUtil,
  validateAllFields: validateAllFieldsUtil,
} = require('./form-utils.js');

const {
  findValueByLabels,
  coalesceValue,
  dedupeIntakeRecords,
  sortIntakeRecords,
  pushDisplayItem,
} = require('./data-mappers.js');

const { getDefaultQuota, makeQuotaPayload, createMediaService } = require('./media-service.js');

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
    loading: true,
    error: '',
    patient: null,
    basicInfo: [],
    familyInfo: [],
    economicInfo: [],
    records: [],
    allIntakeRecords: [],
    operationLogs: [],
    recordsSortOrder: 'desc',
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
  },

  onLoad(options) {
    const rawKey = options && options.key ? decodeURIComponent(options.key) : '';
    const rawPatientId = options && options.patientId ? decodeURIComponent(options.patientId) : '';

    this.profileKey = rawKey || rawPatientId || '';
    this.patientKey = rawPatientId || rawKey || '';
    this.mediaInitialized = false;
    this.originalEditForm = null;
    this.allIntakeRecordsSource = [];
    this.mediaService = createMediaService(this);

    if (!this.profileKey && !this.patientKey) {
      this.setData({ loading: false, error: '缺少患者标识' });
      return;
    }

    if (!this.profileKey) {
      this.profileKey = this.patientKey;
    }

    this.fetchPatientDetail();
  },

  onUnload() {
    this.mediaInitialized = false;
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload();
    }
  },

  async fetchPatientDetail() {
    this.setData({ loading: true, error: '' });

    try {
      let profileResult = {
        patient: null,
        basicInfo: [],
        familyInfo: [],
        economicInfo: [],
        records: [],
      };

      if (this.profileKey) {
        try {
          const profileRes = await wx.cloud.callFunction({
            name: 'patientProfile',
            data: { action: 'detail', key: this.profileKey },
          });
          profileResult = (profileRes && profileRes.result) || profileResult;
        } catch (profileError) {
          logger.error('Failed to load profile detail', profileError);
        }
      }

      const resolvedPatientKey =
        (profileResult &&
          (profileResult.patientKey ||
            (profileResult.patient &&
              (profileResult.patient.key || profileResult.patient.patientKey)))) ||
        this.patientKey ||
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

      let patientRes = null;
      let intakeRecordsRes = null;
      const recordKeyForExcel = this.profileKey || '';
      const patientNameForExcel = patientDisplay.patientName || profileResult.patientName || '';

      if (this.patientKey) {
        try {
          [patientRes, intakeRecordsRes] = await Promise.all([
            wx.cloud.callFunction({
              name: 'patientIntake',
              data: {
                action: 'getPatientDetail',
                patientKey: this.patientKey,
                recordKey: recordKeyForExcel,
                patientName: patientNameForExcel,
              },
            }),
            wx.cloud.callFunction({
              name: 'patientIntake',
              data: {
                action: 'getAllIntakeRecords',
                patientKey: this.patientKey,
                recordKey: recordKeyForExcel,
                patientName: patientNameForExcel,
              },
            }),
          ]);
        } catch (intakeError) {
          logger.error('Failed to load intake records from patientIntake', intakeError);
          patientRes = null;
          intakeRecordsRes = null;
        }
      }

      const detailData = (patientRes && patientRes.result && patientRes.result.data) || {};
      const patientForEdit = detailData.patient || {};
      if (patientForEdit.key && patientForEdit.key !== this.patientKey) {
        this.patientKey = patientForEdit.key;
      }

      if (!patientDisplay.patientName && patientForEdit.patientName) {
        patientDisplay.patientName = patientForEdit.patientName;
      }

      const latestIntakeRaw = detailData.latestIntake || null;
      const operationLogs = (detailData.operationLogs || []).map(log => ({
        ...log,
        timeText: formatDateTime(log.createdAt),
      }));

      const intakeRecordsData =
        (intakeRecordsRes && intakeRecordsRes.result && intakeRecordsRes.result.data) || {};
      let allIntakeRecords = (intakeRecordsData.records || []).map(record => {
        const medicalInfo = record.medicalInfo || {};
        const intakeInfo = record.intakeInfo || {};

        const hospitalDisplay = coalesceValue(
          record.hospital,
          medicalInfo.hospital,
          intakeInfo.hospital
        );
        const diagnosisDisplay = coalesceValue(
          record.diagnosis,
          medicalInfo.diagnosis,
          intakeInfo.visitReason
        );
        const doctorDisplay = coalesceValue(
          record.doctor,
          medicalInfo.doctor,
          intakeInfo.doctor
        );
        const symptomDetailDisplay = coalesceValue(
          medicalInfo.symptoms,
          record.symptoms,
          intakeInfo.situation
        );
        const treatmentProcessDisplay = coalesceValue(
          medicalInfo.treatmentProcess,
          record.treatmentProcess
        );
        const followUpPlanDisplay = coalesceValue(
          record.followUpPlan,
          medicalInfo.followUpPlan,
          intakeInfo.followUpPlan
        );

        return {
          ...record,
          displayTime: formatDateTime(record.intakeTime),
          updatedTime: formatDateTime(record.updatedAt),
          hospitalDisplay,
          diagnosisDisplay,
          doctorDisplay,
          symptomDetailDisplay,
          treatmentProcessDisplay,
          followUpPlanDisplay,
          statusDisplay: formatRecordStatus(record.status),
          followUpPlan: followUpPlanDisplay,
        };
      });

      allIntakeRecords = allIntakeRecords.filter(shouldDisplayIntakeRecord);
      allIntakeRecords = dedupeIntakeRecords(allIntakeRecords);

      if (
        !allIntakeRecords.length &&
        Array.isArray(profileResult.records) &&
        profileResult.records.length
      ) {
        allIntakeRecords = profileResult.records.map((record, index) => {
          const medicalInfo = record.medicalInfo || {};
          const intakeInfo = record.intakeInfo || {};
          const intakeTime =
            Number(record.intakeTime || record.admissionTimestamp || intakeInfo.intakeTime) ||
            Date.now();
          const hospitalDisplay = coalesceValue(record.hospital, medicalInfo.hospital);
          const diagnosisDisplay = coalesceValue(
            record.diagnosis,
            medicalInfo.diagnosis,
            intakeInfo.visitReason
          );
          const doctorDisplay = coalesceValue(record.doctor, medicalInfo.doctor);
          const situationDisplay = coalesceValue(
            record.situation,
            intakeInfo.situation,
            medicalInfo.symptoms,
            record.symptoms
          );
          const symptomDetailDisplay = coalesceValue(
            medicalInfo.symptoms,
            record.symptoms,
            situationDisplay
          );
          const treatmentProcessDisplay = coalesceValue(
            medicalInfo.treatmentProcess,
            record.treatmentProcess
          );
          const followUpPlanDisplay = coalesceValue(
            medicalInfo.followUpPlan,
            record.followUpPlan,
            intakeInfo.followUpPlan
          );

          return {
            ...record,
            intakeId: record.intakeId || `excel_${record.patientKey || 'record'}_${index}`,
            status: 'submitted',
            intakeTime,
            displayTime: formatDateTime(intakeTime),
            updatedAt: record.updatedAt || intakeTime,
            updatedTime: formatDateTime(record.updatedAt || intakeTime),
            hospitalDisplay,
            diagnosisDisplay,
            doctorDisplay,
            situation: situationDisplay,
            followUpPlan: followUpPlanDisplay,
            symptomDetailDisplay,
            treatmentProcessDisplay,
            followUpPlanDisplay,
            statusDisplay: formatRecordStatus('submitted'),
          };
        });
      }

      allIntakeRecords = allIntakeRecords.filter(shouldDisplayIntakeRecord);

      allIntakeRecords = dedupeIntakeRecords(allIntakeRecords);

      this.allIntakeRecordsSource = allIntakeRecords;
      const currentOrder = this.data.recordsSortOrder || 'desc';
      const sortedIntakeRecords = sortIntakeRecords(allIntakeRecords, currentOrder);

      const editForm = buildEditForm(patientForEdit, latestIntakeRaw || {}, patientDisplay);

      this.originalEditForm = cloneForm(editForm);

      const profileBasicInfo = Array.isArray(profileResult.basicInfo)
        ? profileResult.basicInfo
        : [];
      const profileFamilyInfo = Array.isArray(profileResult.familyInfo)
        ? profileResult.familyInfo
        : [];
      const profileEconomicInfo = Array.isArray(profileResult.economicInfo)
        ? profileResult.economicInfo
        : [];

      const basicInfoDisplay = [];

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

      pushFamily(
        '紧急联系人',
        coalesceValue(patientForEdit.emergencyContact, patientDisplay.emergencyContact)
      );

      pushFamily(
        '紧急联系电话',
        coalesceValue(patientForEdit.emergencyPhone, patientDisplay.emergencyPhone)
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

      const patientInfoForDisplay = Object.keys(patientDisplay).length ? patientDisplay : null;

      this.setData(
        {
          loading: false,
          patient: patientInfoForDisplay,
          basicInfo: basicInfoDisplay,
          familyInfo: familyInfoDisplay,
          economicInfo: economicInfoDisplay,
          records: profileResult.records || [],
          allIntakeRecords: sortedIntakeRecords,
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
          if (!this.mediaInitialized) {
            this.mediaInitialized = true;
            this.initMediaSection();
          }
        }
      );
    } catch (error) {
      logger.error('Failed to load patient detail', error);
      this.setData({
        loading: false,
        error: (error && (error.errMsg || error.message)) || '加载患者详情失败，请稍后重试',
      });
    }
  },

  onToggleRecordsSort() {
    const source = Array.isArray(this.allIntakeRecordsSource) ? this.allIntakeRecordsSource : [];
    if (!source.length) {
      const nextOrder = this.data.recordsSortOrder === 'desc' ? 'asc' : 'desc';
      this.setData({ recordsSortOrder: nextOrder });
      return;
    }

    const nextOrder = this.data.recordsSortOrder === 'desc' ? 'asc' : 'desc';
    const sorted = sortIntakeRecords(source, nextOrder);
    this.setData({
      recordsSortOrder: nextOrder,
      allIntakeRecords: sorted,
    });
  },

  getFieldConfig(key) {
    return getFieldConfigUtil(key);
  },

  validateField(key, value, form) {
    return validateFieldUtil(key, value, form);
  },

  validateAllFields(form) {
    return validateAllFieldsUtil(form);
  },

  updateEditFormValue(key, value) {
    const newForm = {
      ...this.data.editForm,
      [key]: value,
    };
    const newErrors = { ...this.data.editErrors };
    const message = this.validateField(key, value, newForm);
    if (message) {
      newErrors[key] = message;
    } else {
      delete newErrors[key];
    }
    const dirty = detectFormChanges(newForm, this.originalEditForm);
    const config = this.getFieldConfig(key);
    const pickerIndexUpdates = {};
    if (config && config.type === 'picker' && Array.isArray(config.options)) {
      const index = config.options.indexOf(value);
      pickerIndexUpdates[`editPickerIndex.${key}`] = index >= 0 ? index : 0;
    }
    this.setData({
      editForm: newForm,
      editErrors: newErrors,
      editDirty: dirty,
      editCanSave: dirty && Object.keys(newErrors).length === 0,
      ...pickerIndexUpdates,
    });
  },

  onEditFieldInput(event) {
    const key = event.currentTarget.dataset.key;
    const value = event.detail.value;
    if (!key) {
      return;
    }
    this.updateEditFormValue(key, value);
  },

  onPickerChange(event) {
    const key = event.currentTarget.dataset.key;
    const options = event.currentTarget.dataset.options || [];
    const index = Number(event.detail.value);
    if (!key || !Array.isArray(options)) {
      return;
    }
    const selected = options[index] || options[0] || '';
    this.updateEditFormValue(key, selected);
  },

  onDatePickerChange(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) {
      return;
    }
    const value = event.detail.value;
    this.updateEditFormValue(key, value);
  },

  onNarrativeInput(event) {
    const key = event.currentTarget.dataset.key;
    const value = event.detail.value;
    this.updateEditFormValue(key || 'narrative', value);
  },

  onEditStart() {
    if (this.data.editMode) {
      return;
    }

    // 如果原始editForm为空或缺少关键数据，重新构建
    let form = cloneForm(this.originalEditForm || {});
    if (!form.patientName && this.data.patient) {
      form = buildEditForm({}, {}, this.data.patient);
      this.originalEditForm = cloneForm(form);
    }

    this.mediaInitialized = false;
    if (wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({ message: '当前编辑内容尚未保存，确定离开吗？' });
    }
    this.setData({
      editMode: true,
      editForm: form,
      editErrors: {},
      editDirty: false,
      editCanSave: false,
      editPickerIndex: buildPickerIndexMap(form),
    });
  },

  resetEditState() {
    const form = cloneForm(this.originalEditForm || {});
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload();
    }
    this.setData({
      editMode: false,
      saving: false,
      editForm: form,
      editErrors: {},
      editDirty: false,
      editCanSave: false,
      editPickerIndex: buildPickerIndexMap(form),
    });
  },

  async onEditCancel() {
    if (!this.data.editMode) {
      return;
    }
    if (this.data.editDirty) {
      const res = await wx.showModal({
        title: '放弃修改',
        content: '当前修改尚未保存，确认要放弃吗？',
        confirmText: '放弃',
        cancelText: '继续编辑',
      });
      if (!res.confirm) {
        return;
      }
    }
    this.resetEditState();
  },

  async onSaveTap() {
    if (this.data.saving) {
      return;
    }
    if (!this.data.editCanSave) {
      return;
    }
    const form = this.data.editForm || {};
    const errors = this.validateAllFields(form);
    if (Object.keys(errors).length > 0) {
      this.setData({ editErrors: errors, editDirty: true });
      this.setData({ editCanSave: false });
      wx.showToast({ icon: 'none', title: '请修正校验错误后再保存' });
      return;
    }
    if (!this.data.editDirty) {
      wx.showToast({ icon: 'none', title: '没有需要保存的修改' });
      return;
    }

    this.setData({ saving: true });

    try {
      const changedFields = collectChangedFormKeys(form, this.originalEditForm || {});
      const payload = {
        action: 'updatePatient',
        patientKey: this.patientKey,
        patientUpdates: {
          patientName: form.patientName,
          idType: form.idType,
          idNumber: form.idNumber,
          gender: form.gender,
          birthDate: form.birthDate,
          phone: form.phone,
          address: form.address,
          emergencyContact: form.emergencyContact,
          emergencyPhone: form.emergencyPhone,
          backupContact: form.backupContact,
          backupPhone: form.backupPhone,
          lastIntakeNarrative: form.narrative,
          expectedUpdatedAt: this.data.editMetadata.patientUpdatedAt,
        },
        audit: {
          message: '患者详情页内联编辑',
          changes: changedFields,
        },
      };

      if (form.intakeId) {
        payload.intakeUpdates = {
          intakeId: form.intakeId,
          expectedUpdatedAt: this.data.editMetadata.intakeUpdatedAt,
          basicInfo: {
            patientName: form.patientName,
            idType: form.idType,
            idNumber: form.idNumber,
            gender: form.gender,
            birthDate: form.birthDate,
            phone: form.phone,
          },
          contactInfo: {
            address: form.address,
            emergencyContact: form.emergencyContact,
            emergencyPhone: form.emergencyPhone,
            backupContact: form.backupContact,
            backupPhone: form.backupPhone,
          },
          intakeInfo: {
            intakeTime: toTimestampFromDateInput(form.intakeTime) || undefined,
            followUpPlan: form.followUpPlan,
            situation: form.narrative,
          },
          medicalHistory: Array.isArray(form.medicalHistory) ? form.medicalHistory : undefined,
          attachments: Array.isArray(form.attachments) ? form.attachments : undefined,
        };
      }

      const res = await wx.cloud.callFunction({
        name: 'patientIntake',
        data: payload,
      });

      const result = (res && res.result) || {};
      if (!result.success) {
        const error = result.error || {};
        if (error.code === 'VERSION_CONFLICT' || error.code === 'INTAKE_VERSION_CONFLICT') {
          wx.showModal({
            title: '数据已更新',
            content: '当前资料已被其他人更新，请刷新后重试。',
            showCancel: false,
          });
        } else if (error.code === 'NO_CHANGES') {
          wx.showToast({ icon: 'none', title: '没有检测到变更' });
        } else {
          wx.showToast({ icon: 'none', title: error.message || '保存失败' });
        }
        this.setData({ saving: false });
        return;
      }

      wx.showToast({ icon: 'success', title: '保存成功' });
      this.resetEditState();
      await this.fetchPatientDetail();
    } catch (error) {
      logger.error('update patient failed', error);
      wx.showToast({ icon: 'none', title: (error && error.message) || '保存失败，请稍后再试' });
      this.setData({ saving: false });
    }
  },

  setMediaState(patch) {
    this.mediaService.setMediaState(patch);
  },

  async initMediaSection() {
    return this.mediaService.initMediaSection();
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
    this.refreshMediaList();
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
