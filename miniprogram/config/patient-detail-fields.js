const PATIENT_FIELD_CONFIG = [
  { key: 'patientName', label: '姓名', type: 'text', required: true, maxLength: 50 },
  { key: 'idType', label: '证件类型', type: 'picker', options: ['身份证', '护照', '军官证', '其他'], required: true },
  { key: 'idNumber', label: '证件号码', type: 'text', required: true, maxLength: 30 },
  { key: 'gender', label: '性别', type: 'picker', options: ['男', '女', '其他'], required: true },
  { key: 'birthDate', label: '出生日期', type: 'date', required: true },
  { key: 'phone', label: '联系电话', type: 'text', keyboard: 'number' }
];

const CONTACT_FIELD_CONFIG = [
  { key: 'address', label: '常住地址', type: 'textarea', required: true, maxLength: 200 },
  { key: 'emergencyContact', label: '紧急联系人', type: 'text', required: false, maxLength: 30 },
  { key: 'emergencyPhone', label: '紧急联系人电话', type: 'text', required: false, keyboard: 'number', maxLength: 11 },
  { key: 'backupContact', label: '备用联系人', type: 'text', maxLength: 30 },
  { key: 'backupPhone', label: '备用联系人电话', type: 'text', keyboard: 'number', maxLength: 11 }
];

const INTAKE_FIELD_CONFIG = [
  { key: 'intakeTime', label: '入住时间', type: 'date', required: false },
  { key: 'narrative', label: '情况说明', type: 'textarea', required: false, maxLength: 500, autoHeight: true },
  { key: 'followUpPlan', label: '后续计划', type: 'textarea', required: false, maxLength: 300 }
];

module.exports = {
  PATIENT_FIELD_CONFIG,
  CONTACT_FIELD_CONFIG,
  INTAKE_FIELD_CONFIG
};
