const {
  PATIENT_FIELD_CONFIG,
  CONTACT_FIELD_CONFIG,
  INTAKE_FIELD_CONFIG
} = require("../../config/patient-detail-fields.js");

const MAX_UPLOAD_BATCH = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 5 * 60 * 1000;

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const DOCUMENT_EXTENSIONS = ["txt", "pdf", "doc", "docx", "xls", "xlsx"];

const FIELD_CONFIG_MAP = {};
[...PATIENT_FIELD_CONFIG, ...CONTACT_FIELD_CONFIG, ...INTAKE_FIELD_CONFIG].forEach((item) => {
  FIELD_CONFIG_MAP[item.key] = item;
});

const FORM_FIELD_KEYS = Array.from(new Set([
  ...PATIENT_FIELD_CONFIG.map((item) => item.key),
  ...CONTACT_FIELD_CONFIG.map((item) => item.key),
  ...INTAKE_FIELD_CONFIG.map((item) => item.key),
  "medicalHistory",
  "attachments"
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

module.exports = {
  MAX_UPLOAD_BATCH,
  MAX_FILE_SIZE,
  SIGNED_URL_TTL,
  IMAGE_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  PATIENT_FIELD_CONFIG,
  CONTACT_FIELD_CONFIG,
  INTAKE_FIELD_CONFIG,
  FIELD_CONFIG_MAP,
  FORM_FIELD_KEYS,
  EXTENSION_MIME_MAP
};
