const MAX_UPLOAD_BATCH = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 5 * 60 * 1000;

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const DOCUMENT_EXTENSIONS = ["txt", "pdf", "doc", "docx", "xls", "xlsx"];

const {
  PATIENT_FIELD_CONFIG,
  CONTACT_FIELD_CONFIG,
  INTAKE_FIELD_CONFIG
} = require("../../config/patient-detail-fields.js");

const FIELD_CONFIG_MAP = {};
[...PATIENT_FIELD_CONFIG, ...CONTACT_FIELD_CONFIG, ...INTAKE_FIELD_CONFIG].forEach((item) => {
  FIELD_CONFIG_MAP[item.key] = item;
});

const FORM_FIELD_KEYS = Array.from(new Set([
  ...PATIENT_FIELD_CONFIG.map((item) => item.key),
  ...CONTACT_FIELD_CONFIG.map((item) => item.key),
  ...INTAKE_FIELD_CONFIG.map((item) => item.key),
  'medicalHistory',
  'attachments'
]));

const EXTENSION_MIME_MAP = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  txt: "text/plain",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

function normalizeString(value) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
}

function generateUuid() {
  const timePart = Date.now().toString(16);
  const randomPart = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0");
  return `${timePart}${randomPart}`;
}

function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}

function formatDateTime(timestamp) {
  const timeValue = Number(timestamp);
  if (!Number.isFinite(timeValue)) {
    return "";
  }
  const date = new Date(timeValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatDateForInput(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return [date.getFullYear(), `${date.getMonth() + 1}`.padStart(2, "0"), `${date.getDate()}`.padStart(2, "0")].join("-");
    }
  }
  if (typeof value === "string" && value.length >= 8) {
    const normalized = value.replace(/[./]/g, "-");
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return [date.getFullYear(), `${date.getMonth() + 1}`.padStart(2, "0"), `${date.getDate()}`.padStart(2, "0")].join("-");
    }
  }
  return "";
}

function toTimestampFromDateInput(value) {
  if (!value) {
    return undefined;
  }
  const normalized = `${value}`.replace(/[./]/g, "-");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.getTime();
}

function buildEditForm(patient = {}, intake = {}, fallbackPatient = {}) {
  const intakeInfo = intake.intakeInfo || {};

  // 优先使用patient数据，如果为空则使用fallbackPatient
  const patientName = patient.patientName || fallbackPatient.patientName || "";
  const gender = patient.gender || fallbackPatient.gender || "";
  const birthDate = patient.birthDate || fallbackPatient.birthDate || "";

  return {
    patientName,
    idType: patient.idType || "身份证",
    idNumber: patient.idNumber || "",
    gender,
    birthDate: formatDateForInput(birthDate),
    phone: patient.phone || "",
    address: patient.address || "",
    emergencyContact: patient.emergencyContact || "",
    emergencyPhone: patient.emergencyPhone || "",
    backupContact: patient.backupContact || "",
    backupPhone: patient.backupPhone || "",
    intakeTime: formatDateForInput(intakeInfo.intakeTime || intake.lastIntakeTime),
    narrative: intakeInfo.situation || intake.narrative || patient.lastIntakeNarrative || "",
    followUpPlan: intakeInfo.followUpPlan || "",
    medicalHistory: Array.isArray(intakeInfo.medicalHistory) ? intakeInfo.medicalHistory : [],
    attachments: Array.isArray(intakeInfo.attachments) ? intakeInfo.attachments : [],
    intakeId: intake.intakeId || intake._id || null,
    intakeUpdatedAt: intake.updatedAt || (intake.metadata && intake.metadata.lastModifiedAt) || null,
    patientUpdatedAt: patient.updatedAt || null
  };
}

function cloneForm(form) {
  return JSON.parse(JSON.stringify(form || {}));
}

function detectFormChanges(current, original) {
  if (!original) {
    return true;
  }
  const keys = Object.keys(current || {});
  for (const key of keys) {
    const currentValue = current[key];
    const originalValue = original[key];
    if (Array.isArray(currentValue) && Array.isArray(originalValue)) {
      if (currentValue.length !== originalValue.length) {
        return true;
      }
      for (let i = 0; i < currentValue.length; i += 1) {
        if (JSON.stringify(currentValue[i]) !== JSON.stringify(originalValue[i])) {
          return true;
        }
      }
    } else if (currentValue !== originalValue) {
      return true;
    }
  }
  return false;
}

function buildPickerIndexMap(form) {
  const map = {};
  [...PATIENT_FIELD_CONFIG, ...CONTACT_FIELD_CONFIG, ...INTAKE_FIELD_CONFIG].forEach((config) => {
    if (config.type === 'picker' && Array.isArray(config.options)) {
      const currentValue = form[config.key];
      const index = config.options.indexOf(currentValue);
      map[config.key] = index >= 0 ? index : 0;
    }
  });
  return map;
}

function collectChangedFormKeys(current = {}, original = {}) {
  const changed = [];
  FORM_FIELD_KEYS.forEach((key) => {
    const currentValue = current[key];
    const originalValue = original[key];
    if (Array.isArray(currentValue) || Array.isArray(originalValue)) {
      const currentJson = JSON.stringify(currentValue || []);
      const originalJson = JSON.stringify(originalValue || []);
      if (currentJson !== originalJson) {
        changed.push(key);
      }
    } else {
      const normalizedCurrent = currentValue === undefined || currentValue === null ? '' : currentValue;
      const normalizedOriginal = originalValue === undefined || originalValue === null ? '' : originalValue;
      if (normalizedCurrent !== normalizedOriginal) {
        changed.push(key);
      }
    }
  });
  return changed;
}


function sanitizeFileName(name) {
  const value = normalizeString(name);
  if (!value) {
    return "";
  }
  return value.split(/[\\/]/).pop();
}

function inferExtension(fileName) {
  const sanitized = sanitizeFileName(fileName).toLowerCase();
  const match = sanitized.match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function inferMimeType(fileName, fallback) {
  const ext = inferExtension(fileName);
  if (ext && EXTENSION_MIME_MAP[ext]) {
    return EXTENSION_MIME_MAP[ext];
  }
  const normalizedFallback = normalizeString(fallback).toLowerCase();
  if (normalizedFallback) {
    return normalizedFallback;
  }
  return "";
}

function isImageExtension(ext) {
  return IMAGE_EXTENSIONS.includes(ext);
}

function isDocumentExtension(ext) {
  return DOCUMENT_EXTENSIONS.includes(ext);
}

function getDefaultQuota() {
  return {
    totalCount: 0,
    totalBytes: 0,
    maxCount: 20,
    maxBytes: 30 * 1024 * 1024,
    remainingCount: 20,
    remainingBytes: 30 * 1024 * 1024,
    totalBytesText: formatFileSize(0),
    maxBytesText: formatFileSize(30 * 1024 * 1024),
    remainingBytesText: formatFileSize(30 * 1024 * 1024)
  };
}

function makeQuotaPayload(quota) {
  const normalized = quota || {};
  const totalCount = Number(normalized.totalCount) || 0;
  const totalBytes = Number(normalized.totalBytes) || 0;
  const maxCount = Number(normalized.maxCount) || 20;
  const maxBytes = Number(normalized.maxBytes) || 30 * 1024 * 1024;
  const remainingCount = Number.isFinite(normalized.remainingCount)
    ? normalized.remainingCount
    : Math.max(maxCount - totalCount, 0);
  const remainingBytes = Number.isFinite(normalized.remainingBytes)
    ? normalized.remainingBytes
    : Math.max(maxBytes - totalBytes, 0);
  return {
    totalCount,
    totalBytes,
    maxCount,
    maxBytes,
    remainingCount,
    remainingBytes,
    totalBytesText: formatFileSize(totalBytes),
    maxBytesText: formatFileSize(maxBytes),
    remainingBytesText: formatFileSize(remainingBytes)
  };
}

function mapMediaRecord(record) {
  if (!record) {
    return null;
  }
  const id = record.id || record._id || "";
  const createdAt = Number(record.createdAt || Date.now());
  const displayName = normalizeString(record.displayName || record.filename) || "未命名文件";
  const mimeType = inferMimeType(record.filename || displayName, record.mimeType);
  const extension = inferExtension(record.filename || displayName);
  const sizeBytes = Number(record.sizeBytes) || 0;
  return {
    id,
    patientKey: record.patientKey,
    category: record.category,
    displayName,
    filename: record.filename || displayName,
    mimeType,
    extension,
    typeText: extension ? extension.toUpperCase() : (record.category === "image" ? "IMAGE" : "FILE"),
    sizeBytes,
    sizeText: formatFileSize(sizeBytes),
    uploadedAt: createdAt,
    uploadedAtText: formatDateTime(createdAt),
    uploaderId: record.uploaderId || "",
    uploaderDisplay: record.uploaderId || "未知",
    thumbnailUrl: record.thumbnailUrl || "",
    thumbnailExpiresAt: Number(record.thumbnailExpiresAt || 0),
    previewUrl: record.previewUrl || "",
    previewExpiresAt: Number(record.previewExpiresAt || 0),
    textPreviewAvailable: !!record.textPreviewAvailable || mimeType === "text/plain",
    downloadCount: record.downloadCount || 0,
    hasThumbnail: !!(record.thumbnailUrl && record.thumbnailUrl.length),
    downloading: false,
    deleting: false,
    previewLoading: false
  };
}

function mergeFamilyAddresses(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      label: entry.label || '',
      value: entry.value || ''
    }))
    .filter((entry) => entry.label && entry.value);
}

function safeTrim(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function findValueByLabels(list, candidates) {
  if (!Array.isArray(list) || !candidates || !candidates.length) {
    return '';
  }
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const label = safeTrim(item.label);
    const value = safeTrim(item.value);
    if (!label || !value) {
      continue;
    }
    const lowerLabel = label.toLowerCase();
    const matched = candidates.some((candidate) => {
      const normalized = String(candidate || '').toLowerCase();
      return lowerLabel.includes(normalized) || label.includes(candidate);
    });
    if (matched) {
      return value;
    }
  }
  return '';
}

function coalesceValue(...values) {
  for (const value of values) {
    const normalized = safeTrim(value);
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function extractRecordTimestamp(record = {}) {
  const candidates = [
    record.intakeTime,
    record.admissionTimestamp,
    record.updatedAt,
    record.createdAt,
    record.displayTime ? Date.parse(record.displayTime) : null,
    record.metadata && record.metadata.intakeTime
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return 0;
}

function sortIntakeRecords(records = [], order = 'desc') {
  const normalizedOrder = order === 'asc' ? 'asc' : 'desc';
  const sorted = [...records];
  sorted.sort((a, b) => {
    const diff = extractRecordTimestamp(a) - extractRecordTimestamp(b);
    return normalizedOrder === 'asc' ? diff : -diff;
  });
  return sorted;
}

function pushDisplayItem(target = [], label, value) {
  const normalized = safeTrim(value);
  if (normalized) {
    target.push({ label, value: normalized });
  }
}

Page({
  data: {
    loading: true,
    error: "",
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
      intakeUpdatedAt: null
    },
    editPickerIndex: {},
    patientFieldConfig: PATIENT_FIELD_CONFIG,
    contactFieldConfig: CONTACT_FIELD_CONFIG,
    intakeFieldConfig: INTAKE_FIELD_CONFIG,
    media: {
      accessChecked: false,
      allowed: false,
      loading: false,
      error: "",
      tab: "images",
      uploading: false,
      images: [],
      documents: [],
      quota: getDefaultQuota()
    },
    textPreview: {
      visible: false,
      title: "",
      content: ""
    }
  },

  onLoad(options) {
    const rawKey = (options && options.key) ? decodeURIComponent(options.key) : "";
    const rawPatientId = (options && options.patientId) ? decodeURIComponent(options.patientId) : "";

    this.profileKey = rawKey || rawPatientId || "";
    this.patientKey = rawPatientId || rawKey || "";
    this.mediaInitialized = false;
    this.originalEditForm = null;
    this.allIntakeRecordsSource = [];

    if (!this.profileKey && !this.patientKey) {
      this.setData({ loading: false, error: "缺少患者标识" });
      return;
    }

    if (!this.profileKey) {
      this.profileKey = this.patientKey;
    }

    this.fetchPatientDetail();
  },

  onUnload() {
    if (wx.disableAlertBeforeUnload) {
      wx.disableAlertBeforeUnload();
    }
  },

  async fetchPatientDetail() {
    this.setData({ loading: true, error: "" });

    try {
      let profileResult = {
        patient: null,
        basicInfo: [],
        familyInfo: [],
        economicInfo: [],
        records: []
      };

      if (this.profileKey) {
        try {
          const profileRes = await wx.cloud.callFunction({
            name: "patientProfile",
            data: { action: "detail", key: this.profileKey }
          });
          profileResult = (profileRes && profileRes.result) || profileResult;
        } catch (profileError) {
          console.warn("Failed to load profile detail", profileError);
        }
      }

      const resolvedPatientKey =
        (profileResult && (
          profileResult.patientKey ||
          (profileResult.patient && (profileResult.patient.key || profileResult.patient.patientKey))
        )) ||
        this.patientKey ||
        "";

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

      const basicInfo = (profileResult.basicInfo || []).map((item) =>
        item && typeof item === "object" ? { ...item } : { label: "", value: item || "" }
      );

      let patientRes = null;
      let intakeRecordsRes = null;
      const recordKeyForExcel = this.profileKey || '';
      const patientNameForExcel = patientDisplay.patientName || profileResult.patientName || '';

      if (this.patientKey) {
        try {
          [patientRes, intakeRecordsRes] = await Promise.all([
            wx.cloud.callFunction({
              name: "patientIntake",
              data: {
                action: "getPatientDetail",
                patientKey: this.patientKey,
                recordKey: recordKeyForExcel,
                patientName: patientNameForExcel
              }
            }),
            wx.cloud.callFunction({
              name: "patientIntake",
              data: {
                action: "getAllIntakeRecords",
                patientKey: this.patientKey,
                recordKey: recordKeyForExcel,
                patientName: patientNameForExcel
              }
            })
          ]);
        } catch (intakeError) {
          console.warn("Failed to load intake records from patientIntake", intakeError);
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
      const operationLogs = (detailData.operationLogs || []).map((log) => ({
        ...log,
        timeText: formatDateTime(log.createdAt)
      }));

      const intakeRecordsData = (intakeRecordsRes && intakeRecordsRes.result && intakeRecordsRes.result.data) || {};
      let allIntakeRecords = (intakeRecordsData.records || []).map((record) => {
        const medicalInfo = record.medicalInfo || {};
        const intakeInfo = record.intakeInfo || {};

        // 查找匹配的 profileResult 记录来补充医生信息
        let profileRecord = null;
        if (Array.isArray(profileResult.records)) {
          profileRecord = profileResult.records.find(pr =>
            pr.diagnosis === record.diagnosis ||
            pr.hospital === record.hospital ||
            (pr.intakeTime && record.intakeTime && Math.abs(pr.intakeTime - record.intakeTime) < 86400000) // 同一天
          );

          // 如果没有找到精确匹配，使用第一个有医生信息的记录作为fallback
          if (!profileRecord || !profileRecord.doctor) {
            profileRecord = profileResult.records.find(pr => pr.doctor) || profileResult.records[0];
          }
        }

        const hospitalDisplay = coalesceValue(
          record.hospital,
          medicalInfo.hospital,
          profileRecord?.hospital
        );
        const diagnosisDisplay = coalesceValue(
          record.diagnosis,
          medicalInfo.diagnosis,
          intakeInfo.visitReason,
          profileRecord?.diagnosis
        );
        const doctorDisplay = coalesceValue(
          record.doctor,
          medicalInfo.doctor,
          profileRecord?.doctor  // 从 profileResult 补充医生信息
        );
        const symptomDetailDisplay = coalesceValue(
          medicalInfo.symptoms,
          record.symptoms,
          intakeInfo.situation,
          profileRecord?.symptoms
        );
        const treatmentProcessDisplay = coalesceValue(
          medicalInfo.treatmentProcess,
          record.treatmentProcess,
          profileRecord?.treatmentProcess
        );
        const followUpPlanDisplay = coalesceValue(
          medicalInfo.followUpPlan,
          record.followUpPlan,
          intakeInfo.followUpPlan,
          profileRecord?.followUpPlan
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
          followUpPlan: followUpPlanDisplay
        };
      });

      if (!allIntakeRecords.length && Array.isArray(profileResult.records) && profileResult.records.length) {
        allIntakeRecords = profileResult.records.map((record, index) => {
          const medicalInfo = record.medicalInfo || {};
          const intakeInfo = record.intakeInfo || {};
          const intakeTime = Number(record.intakeTime || record.admissionTimestamp || intakeInfo.intakeTime) || Date.now();
          const hospitalDisplay = coalesceValue(record.hospital, medicalInfo.hospital);
          const diagnosisDisplay = coalesceValue(record.diagnosis, medicalInfo.diagnosis, intakeInfo.visitReason);
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
            status: record.status || 'excel-import',
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
            followUpPlanDisplay
          };
        });
      }

      this.allIntakeRecordsSource = allIntakeRecords;
      const currentOrder = this.data.recordsSortOrder || 'desc';
      const sortedIntakeRecords = sortIntakeRecords(allIntakeRecords, currentOrder);

      const editForm = buildEditForm(patientForEdit, latestIntakeRaw || {}, patientDisplay);

      this.originalEditForm = cloneForm(editForm);

      const profileBasicInfo = Array.isArray(profileResult.basicInfo) ? profileResult.basicInfo : [];
      const profileFamilyInfo = Array.isArray(profileResult.familyInfo) ? profileResult.familyInfo : [];
      const profileEconomicInfo = Array.isArray(profileResult.economicInfo) ? profileResult.economicInfo : [];

      const basicInfoDisplay = [];

      pushDisplayItem(basicInfoDisplay, '性别', coalesceValue(
        patientForEdit.gender,
        patientDisplay.gender,
        findValueByLabels(profileBasicInfo, ['gender', '性别'])
      ));

      pushDisplayItem(basicInfoDisplay, '出生日期', coalesceValue(
        patientForEdit.birthDate,
        patientDisplay.birthDate,
        findValueByLabels(profileBasicInfo, ['birth date', '出生', 'birthday'])
      ));

      pushDisplayItem(basicInfoDisplay, '身份证号', coalesceValue(
        patientForEdit.idNumber,
        patientDisplay.idNumber,
        findValueByLabels(profileBasicInfo, ['id number', '证件', '身份证'])
      ));

      pushDisplayItem(basicInfoDisplay, '籍贯', coalesceValue(
        patientForEdit.nativePlace,
        patientDisplay.nativePlace,
        findValueByLabels(profileBasicInfo, ['native place', '籍贯'])
      ));

      pushDisplayItem(basicInfoDisplay, '民族', coalesceValue(
        patientForEdit.ethnicity,
        patientDisplay.ethnicity,
        findValueByLabels(profileBasicInfo, ['ethnicity', '民族'])
      ));

      pushDisplayItem(basicInfoDisplay, '主要照护人', coalesceValue(
        patientDisplay.summaryCaregivers,
        findValueByLabels(profileBasicInfo, ['caregivers', '照护', '监护'])
      ));

      const familyInfoDisplay = [];
      const pushFamily = (label, value) => pushDisplayItem(familyInfoDisplay, label, value);

      pushFamily('家庭地址', coalesceValue(
        patientForEdit.address,
        patientDisplay.address,
        findValueByLabels(profileFamilyInfo, ['address', '家庭地址'])
      ));

      pushFamily('父亲联系方式', coalesceValue(
        patientForEdit.fatherInfo,
        patientDisplay.fatherInfo,
        findValueByLabels(profileFamilyInfo, ['father', '父亲'])
      ));
      pushFamily('母亲联系方式', coalesceValue(
        patientForEdit.motherInfo,
        patientDisplay.motherInfo,
        findValueByLabels(profileFamilyInfo, ['mother', '母亲'])
      ));
      pushFamily('其他监护人', coalesceValue(
        patientForEdit.otherGuardian,
        patientDisplay.otherGuardian,
        findValueByLabels(profileFamilyInfo, ['other guardian', '其他监护', '祖母', '祖父', 'guardian'])
      ));

      pushFamily('紧急联系人', coalesceValue(
        patientForEdit.emergencyContact,
        patientDisplay.emergencyContact
      ));

      pushFamily('紧急联系电话', coalesceValue(
        patientForEdit.emergencyPhone,
        patientDisplay.emergencyPhone
      ));

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
              (latestIntakeRaw && latestIntakeRaw.metadata && latestIntakeRaw.metadata.lastModifiedAt) ||
              null
          },
          editPickerIndex: buildPickerIndexMap(editForm)
        },
        () => {
          if (!this.mediaInitialized) {
            this.mediaInitialized = true;
            this.initMediaSection();
          }
        }
      );
    } catch (error) {
      console.error("Failed to load patient detail", error);
      this.setData({
        loading: false,
        error: (error && (error.errMsg || error.message)) || "加载患者详情失败，请稍后重试"
      });
    }
  },

  onToggleRecordsSort() {
    const source = Array.isArray(this.allIntakeRecordsSource)
      ? this.allIntakeRecordsSource
      : [];
    if (!source.length) {
      const nextOrder = this.data.recordsSortOrder === 'desc' ? 'asc' : 'desc';
      this.setData({ recordsSortOrder: nextOrder });
      return;
    }

    const nextOrder = this.data.recordsSortOrder === 'desc' ? 'asc' : 'desc';
    const sorted = sortIntakeRecords(source, nextOrder);
    this.setData({
      recordsSortOrder: nextOrder,
      allIntakeRecords: sorted
    });
  },

  getFieldConfig(key) {
    return FIELD_CONFIG_MAP[key] || null;
  },

  validateField(key, value, form) {
    const config = this.getFieldConfig(key);
    if (!config) {
      return "";
    }
    let currentValue = value;
    if (config.type === "textarea" || config.type === "text") {
      currentValue = normalizeString(value);
    }

    if (config.required && !currentValue) {
      return `${config.label}不能为空`;
    }

    if (config.maxLength && currentValue && currentValue.length > config.maxLength) {
      return `${config.label}不能超过${config.maxLength}个字符`;
    }

    if (key === "idNumber" && form.idType === "身份证" && currentValue) {
      if (!/^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/.test(currentValue)) {
        return "身份证号码格式不正确";
      }
    }

    if ((key === "phone" || key === "emergencyPhone" || key === "backupPhone") && currentValue) {
      if (!/^1[3-9]\d{9}$/.test(currentValue)) {
        return "手机号格式不正确";
      }
    }

    if (key === "birthDate" && currentValue) {
      const ts = toTimestampFromDateInput(currentValue);
      if (ts === undefined) {
        return "出生日期格式不正确";
      }
      if (ts > Date.now()) {
        return "出生日期不能晚于今天";
      }
    }

    if (key === "intakeTime" && currentValue) {
      if (toTimestampFromDateInput(currentValue) === undefined) {
        return "入住时间格式不正确";
      }
    }

    if (key === "narrative") {
      const text = normalizeString(value);
      if (!text) {
        return "情况说明不能为空";
      }
      if (text.length < 30) {
        return "情况说明至少需要 30 个字符";
      }
      if (text.length > 500) {
        return "情况说明不能超过 500 个字符";
      }
    }

    return "";
  },

  validateAllFields(form) {
    const errors = {};
    [...PATIENT_FIELD_CONFIG, ...CONTACT_FIELD_CONFIG, ...INTAKE_FIELD_CONFIG].forEach((field) => {
      const message = this.validateField(field.key, form[field.key], form);
      if (message) {
        errors[field.key] = message;
      }
    });
    return errors;
  },

  updateEditFormValue(key, value) {
    const newForm = {
      ...this.data.editForm,
      [key]: value
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
      ...pickerIndexUpdates
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
    const selected = options[index] || options[0] || "";
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
    this.updateEditFormValue(key || "narrative", value);
  },

  onEditStart() {
    if (this.data.editMode) {
      return;
    }

    // 如果原始editForm为空或缺少关键数据，重新构建
    let form = cloneForm(this.originalEditForm || {});
    if (!form.patientName && this.data.patient) {
      console.log('重新构建编辑表单，使用患者显示数据');
      form = buildEditForm({}, {}, this.data.patient);
      this.originalEditForm = cloneForm(form);
    }

    if (wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({ message: "当前编辑内容尚未保存，确定离开吗？" });
    }
    this.setData({
      editMode: true,
      editForm: form,
      editErrors: {},
      editDirty: false,
      editCanSave: false,
      editPickerIndex: buildPickerIndexMap(form)
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
      editPickerIndex: buildPickerIndexMap(form)
    });
  },

  async onEditCancel() {
    if (!this.data.editMode) {
      return;
    }
    if (this.data.editDirty) {
      const res = await wx.showModal({
        title: "放弃修改",
        content: "当前修改尚未保存，确认要放弃吗？",
        confirmText: "放弃",
        cancelText: "继续编辑"
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
      wx.showToast({ icon: "none", title: "请修正校验错误后再保存" });
      return;
    }
    if (!this.data.editDirty) {
      wx.showToast({ icon: "none", title: "没有需要保存的修改" });
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
          expectedUpdatedAt: this.data.editMetadata.patientUpdatedAt
        },
        audit: {
          message: '患者详情页内联编辑',
          changes: changedFields
        }
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
            phone: form.phone
          },
          contactInfo: {
            address: form.address,
            emergencyContact: form.emergencyContact,
            emergencyPhone: form.emergencyPhone,
            backupContact: form.backupContact,
            backupPhone: form.backupPhone
          },
          intakeInfo: {
            intakeTime: toTimestampFromDateInput(form.intakeTime) || undefined,
            followUpPlan: form.followUpPlan,
            situation: form.narrative
          },
          medicalHistory: Array.isArray(form.medicalHistory) ? form.medicalHistory : undefined,
          attachments: Array.isArray(form.attachments) ? form.attachments : undefined
        };
      }

      const res = await wx.cloud.callFunction({
        name: 'patientIntake',
        data: payload
      });

      const result = (res && res.result) || {};
      if (!result.success) {
        const error = result.error || {};
        if (error.code === 'VERSION_CONFLICT' || error.code === 'INTAKE_VERSION_CONFLICT') {
          wx.showModal({
            title: '数据已更新',
            content: '当前资料已被其他人更新，请刷新后重试。',
            showCancel: false
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
      console.error('update patient failed', error);
      wx.showToast({ icon: 'none', title: (error && error.message) || '保存失败，请稍后再试' });
      this.setData({ saving: false });
    }
  },

  setMediaState(patch) {
    const updates = {};
    Object.keys(patch).forEach((key) => {
      updates[`media.${key}`] = patch[key];
    });
    this.setData(updates);
  },

  async initMediaSection() {
    if (!this.patientKey) {
      return;
    }
    this.setMediaState({ loading: true, error: '', accessChecked: true, allowed: true });
    try {
      await this.refreshMediaList();
    } catch (error) {
      this.setMediaState({
        error: normalizeString(error.message) || '????????????',
        loading: false
      });
    }
  },

  async refreshMediaList() {
    this.setMediaState({ loading: true, error: "" });
    try {
      const data = await this.callPatientMedia("list");
      const images = (data.images || [])
        .map((item) => {
          const record = mapMediaRecord(item);
          if (record) {
            record.thumbnailUrl = item.thumbnailUrl || record.thumbnailUrl;
            record.thumbnailExpiresAt = Number(item.thumbnailExpiresAt || record.thumbnailExpiresAt || 0);
            record.textPreviewAvailable = item.textPreviewAvailable || record.textPreviewAvailable;
          }
          return record;
        })
        .filter(Boolean);
      const documents = (data.documents || []).map(mapMediaRecord).filter(Boolean);
      const quota = makeQuotaPayload(data.quota);

      this.setData({
        "media.images": images,
        "media.documents": documents,
        "media.quota": quota,
        "media.loading": false,
        "media.error": "",
        "media.accessChecked": true,
        "media.allowed": true
      });
    } catch (error) {
      console.error("加载附件失败", error);
      this.setMediaState({
        error: normalizeString(error.message) || "加载附件失败，请稍后重试",
        loading: false
      });
    }
  },

  async callPatientMedia(action, payload = {}) {
    const data = { ...payload, action, patientKey: this.patientKey };
    try {
      const res = await wx.cloud.callFunction({ name: "patientMedia", data });
      const result = res && res.result;
      if (!result) {
        throw new Error("服务无响应");
      }
      if (result.success === false) {
        const err = new Error((result.error && result.error.message) || "操作失败");
        err.code = result.error && result.error.code;
        err.details = result.error && result.error.details;
        throw err;
      }
      return result.data || {};
    } catch (error) {
      if (error && error.errMsg) {
        const err = new Error(error.errMsg.replace("cloud.callFunction:fail ", "") || "云函数调用失败");
        err.code = error.errCode || error.code;
        throw err;
      }
      throw error;
    }
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
    if (tab !== "images" && tab !== "documents") {
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
      wx.showToast({ icon: "none", title: "数量已达上限" });
      return;
    }
    const count = Math.min(MAX_UPLOAD_BATCH, remainingCount);
    try {
      const res = await wx.chooseImage({
        count,
        sizeType: ["compressed", "original"],
        sourceType: ["album", "camera"]
      });
      const rawFiles = (res && res.tempFiles) || [];
      const fallbackPaths = (res && res.tempFilePaths) || [];
      const files = rawFiles.length
        ? rawFiles.map((item) => ({
            name: sanitizeFileName(item.path),
            size: item.size,
            path: item.path,
            mimeType: inferMimeType(item.path, item.type)
          }))
        : fallbackPaths.map((path) => ({
            name: sanitizeFileName(path),
            size: 0,
            path,
            mimeType: inferMimeType(path)
          }));
      await this.processUploads(files, "image");
    } catch (error) {
      if (error && /cancel/.test(error.errMsg || "")) {
        return;
      }
      this.handleMediaError(error, "上传");
    }
  },

  async onUploadDocumentsTap() {
    if (!this.data.media.allowed || this.data.media.uploading) {
      return;
    }
    const quota = this.data.media.quota || getDefaultQuota();
    const remainingCount = quota.remainingCount || 0;
    if (remainingCount <= 0) {
      wx.showToast({ icon: "none", title: "数量已达上限" });
      return;
    }
    const count = Math.min(MAX_UPLOAD_BATCH, remainingCount);
    try {
      const res = await wx.chooseMessageFile({ count, type: "file" });
      const filesSource = (res && res.tempFiles) || (res && res.files) || [];
      const files = filesSource.map((item) => ({
        name: sanitizeFileName(item.name || item.path),
        size: item.size,
        path: item.path,
        mimeType: inferMimeType(item.name || item.path, item.type)
      }));
      await this.processUploads(files, "document");
    } catch (error) {
      if (error && /cancel/.test(error.errMsg || "")) {
        return;
      }
      this.handleMediaError(error, "上传");
    }
  },

  async processUploads(files, category) {
    if (!files || !files.length) {
      return;
    }
    const quota = this.data.media.quota || getDefaultQuota();
    let remainingCount = quota.remainingCount || 0;
    let remainingBytes = quota.remainingBytes || 0;

    const valid = [];
    const skipped = [];
    files.forEach((file) => {
      const extension = inferExtension(file.name || file.path);
      if (category === "image" && !isImageExtension(extension)) {
        skipped.push({ file, reason: "类型不支持" });
        return;
      }
      if (category === "document" && !isDocumentExtension(extension)) {
        skipped.push({ file, reason: "类型不支持" });
        return;
      }
      if (file.size && file.size > MAX_FILE_SIZE) {
        skipped.push({ file, reason: "文件超限" });
        return;
      }
      valid.push({
        ...file,
        extension,
        mimeType: inferMimeType(file.name || file.path, file.mimeType)
      });
    });

    if (!valid.length) {
      wx.showToast({ icon: "none", title: "没有可上传的文件" });
      return;
    }

    const limited = valid.slice(0, Math.min(valid.length, MAX_UPLOAD_BATCH, remainingCount));
    this.setMediaState({ uploading: true });

    let successCount = 0;
    try {
      for (const file of limited) {
        if (remainingCount <= 0) {
          wx.showToast({ icon: "none", title: "数量已满" });
          break;
        }
        if (file.size && file.size > remainingBytes) {
          wx.showToast({ icon: "none", title: "容量不足" });
          break;
        }
        const fileName = sanitizeFileName(file.name) || `${category}-${generateUuid()}.${file.extension}`;
        try {
          const prepare = await this.callPatientMedia("prepareUpload", {
            fileName,
            sizeBytes: file.size,
            mimeType: file.mimeType
          });
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: prepare.cloudPath,
            filePath: file.path
          });
          if (!uploadRes || !uploadRes.fileID) {
            throw new Error("上传失败");
          }
          const complete = await this.callPatientMedia("completeUpload", {
            fileUuid: prepare.fileUuid,
            storagePath: prepare.storagePath,
            fileID: uploadRes.fileID,
            fileName,
            displayName: fileName,
            mimeType: file.mimeType,
            sizeBytes: file.size
          });
          const record = mapMediaRecord(complete.media);
          const quotaPayload = makeQuotaPayload(complete.quota);
          if (record) {
            if (category === "image") {
              const images = [record, ...this.data.media.images];
              this.setData({ "media.images": images });
            } else {
              const documents = [record, ...this.data.media.documents];
              this.setData({ "media.documents": documents });
            }
          }
          this.setData({ "media.quota": quotaPayload });
          remainingCount = quotaPayload.remainingCount;
          remainingBytes = quotaPayload.remainingBytes;
          successCount += 1;
        } catch (error) {
          this.handleMediaError(error, "上传");
        }
      }
    } finally {
      this.setMediaState({ uploading: false });
    }

    if (successCount > 0) {
      wx.showToast({ icon: "success", title: `上传成功${successCount}个` });
    }

    if (skipped.length) {
      wx.showToast({ icon: "none", title: `${skipped.length}个文件已跳过` });
    }
  },

  updateMediaRecord(category, index, updates) {
    const listKey = category === "image" ? "images" : "documents";
    const list = this.data.media[listKey];
    if (!Array.isArray(list) || index < 0 || index >= list.length) {
      return;
    }
    const updated = { ...list[index], ...updates };
    const newList = list.slice();
    newList[index] = updated;
    const dataKey = `media.${listKey}`;
    this.setData({ [dataKey]: newList });
  },

  removeMediaRecord(category, id) {
    const listKey = category === "image" ? "images" : "documents";
    const list = this.data.media[listKey];
    if (!Array.isArray(list)) {
      return;
    }
    const newList = list.filter((item) => item.id !== id);
    const dataKey = `media.${listKey}`;
    this.setData({ [dataKey]: newList });
  },

  async ensureImagePreviewUrls() {
    const images = this.data.media.images || [];
    const now = Date.now();
    const pending = images
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          !item.previewUrl ||
          !item.previewExpiresAt ||
          item.previewExpiresAt <= now + 5000
      );

    for (const { item, index } of pending) {
      try {
        const data = await this.callPatientMedia("preview", {
          mediaId: item.id,
          variant: "original"
        });
        if (data && data.url) {
          this.updateMediaRecord("image", index, {
            previewUrl: data.url,
            previewExpiresAt: data.expiresAt || Date.now() + SIGNED_URL_TTL
          });
        }
      } catch (error) {
        console.warn("获取原图预览失败", error);
      }
    }
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
    wx.showLoading({ title: "加载中…", mask: true });
    try {
      await this.ensureImagePreviewUrls();
      const refreshed = this.data.media.images || [];
      const urls = refreshed.map((item) => item.previewUrl || item.thumbnailUrl).filter(Boolean);
      if (!urls.length) {
        wx.showToast({ icon: "none", title: "暂无可预览图片" });
        return;
      }
      const currentUrl = refreshed[index].previewUrl || refreshed[index].thumbnailUrl;
      wx.previewImage({
        current: currentUrl,
        urls
      });
    } catch (error) {
      this.handleMediaError(error, "预览");
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
    this.updateMediaRecord("image", index, { downloading: true });
    try {
      const data = await this.callPatientMedia("download", { mediaId: id });
      await this.downloadMediaFile(record, data.url);
      wx.showToast({ icon: "success", title: "已下载" });
    } catch (error) {
      this.handleMediaError(error, "下载");
    } finally {
      this.updateMediaRecord("image", index, { downloading: false });
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
    this.updateMediaRecord("document", index, { downloading: true });
    try {
      const data = await this.callPatientMedia("download", { mediaId: id });
      await this.downloadMediaFile(record, data.url);
    } catch (error) {
      this.handleMediaError(error, "下载");
    } finally {
      this.updateMediaRecord("document", index, { downloading: false });
    }
  },

  downloadMediaFile(record, url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error("下载地址无效"));
        return;
      }
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode !== 200 || !res.tempFilePath) {
            reject(new Error("下载失败"));
            return;
          }
          if (record.category === "image") {
            wx.previewImage({
              urls: [res.tempFilePath],
              success: resolve,
              fail: reject
            });
          } else {
            wx.openDocument({
              filePath: res.tempFilePath,
              showMenu: true,
              success: resolve,
              fail: reject
            });
          }
        },
        fail: reject
      });
    });
  },

  async onDeleteMediaTap(event) {
    const id = normalizeString(event.currentTarget.dataset.id);
    const category = normalizeString(event.currentTarget.dataset.category);
    const index = Number(event.currentTarget.dataset.index);
    if (!id || (category !== "image" && category !== "document")) {
      return;
    }
    const confirmRes = await wx.showModal({
      title: "确认删除",
      content: "删除后不可恢复，是否继续？",
      confirmText: "删除",
      cancelText: "取消",
      confirmColor: "#e64340"
    });
    if (!confirmRes.confirm) {
      return;
    }
    this.updateMediaRecord(category, index, { deleting: true });
    try {
      const data = await this.callPatientMedia("delete", { mediaId: id });
      this.removeMediaRecord(category, id);
      if (data && data.quota) {
        this.setData({ "media.quota": makeQuotaPayload(data.quota) });
      }
      wx.showToast({ icon: "success", title: "已删除" });
    } catch (error) {
      this.handleMediaError(error, "删除");
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
    this.updateMediaRecord("document", index, { previewLoading: true });
    try {
      const data = await this.callPatientMedia("previewTxt", { mediaId: id });
      this.setData({
        textPreview: {
          visible: true,
          title: record.displayName,
          content: (data && data.content) || ""
        }
      });
    } catch (error) {
      this.handleMediaError(error, "预览");
    } finally {
      this.updateMediaRecord("document", index, { previewLoading: false });
    }
  },

  onTextPreviewClose() {
    if (!this.data.textPreview.visible) {
      return;
    }
    this.setData({ "textPreview.visible": false });
  },

  handleMediaError(error, context) {
    const code = error && error.code;
    let message = normalizeString((error && error.message)) || `${context}失败`;
    if (code === "MEDIA_QUOTA_EXCEEDED") {
      message = "配额不足";
    } else if (code === "MEDIA_DUPLICATE") {
      message = "已存在相同文件";
    } else if (code === "FILE_TOO_LARGE") {
      message = "文件超过10MB限制";
    } else if (code === "UNSUPPORTED_FILE_TYPE") {
      message = "文件类型不支持";
    }
    const display = message.length > 14 ? `${message.slice(0, 13)}…` : message;
    wx.showToast({ icon: "none", title: display || `${context}失败` });
  },

  noop() {}
});










