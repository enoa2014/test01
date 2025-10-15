const { IMAGE_EXTENSIONS, DOCUMENT_EXTENSIONS, EXTENSION_MIME_MAP } = require('./constants.js');

function normalizeString(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function generateUuid() {
  const timePart = Date.now().toString(16);
  const randomPart = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
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
    return '';
  }
  const date = new Date(timeValue);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatDateForInput(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return [
        date.getFullYear(),
        `${date.getMonth() + 1}`.padStart(2, '0'),
        `${date.getDate()}`.padStart(2, '0'),
      ].join('-');
    }
  }
  if (typeof value === 'string' && value.length >= 8) {
    const normalized = value.replace(/[./]/g, '-');
    const date = new Date(normalized);
    if (!Number.isNaN(date.getTime())) {
      return [
        date.getFullYear(),
        `${date.getMonth() + 1}`.padStart(2, '0'),
        `${date.getDate()}`.padStart(2, '0'),
      ].join('-');
    }
  }
  return '';
}

function toTimestampFromDateInput(value) {
  if (!value) {
    return undefined;
  }
  const normalized = `${value}`.replace(/[./]/g, '-');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.getTime();
}

function sanitizeFileName(name) {
  const value = normalizeString(name);
  if (!value) {
    return '';
  }
  return value.split(/[\\/]/).pop();
}

function inferExtension(fileName) {
  const sanitized = sanitizeFileName(fileName).toLowerCase();
  const match = sanitized.match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
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
  return '';
}

function isImageExtension(ext) {
  return IMAGE_EXTENSIONS.includes(ext);
}

function isDocumentExtension(ext) {
  return DOCUMENT_EXTENSIONS.includes(ext);
}

function safeTrim(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

module.exports = {
  normalizeString,
  generateUuid,
  formatFileSize,
  formatDateTime,
  formatDateForInput,
  toTimestampFromDateInput,
  sanitizeFileName,
  inferExtension,
  inferMimeType,
  isImageExtension,
  isDocumentExtension,
  safeTrim,
};
