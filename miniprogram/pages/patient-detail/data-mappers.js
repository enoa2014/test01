const {
  normalizeString,
  formatFileSize,
  formatDateTime,
  inferMimeType,
  inferExtension,
  safeTrim,
} = require('./helpers.js');

function mapMediaRecord(record) {
  if (!record) {
    return null;
  }
  const id = record.id || record._id || '';
  const createdAt = Number(record.createdAt || Date.now());
  const displayName = normalizeString(record.displayName || record.filename) || '未命名文件';
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
    typeText: extension ? extension.toUpperCase() : record.category === 'image' ? 'IMAGE' : 'FILE',
    sizeBytes,
    sizeText: formatFileSize(sizeBytes),
    uploadedAt: createdAt,
    uploadedAtText: formatDateTime(createdAt),
    uploaderId: record.uploaderId || '',
    uploaderDisplay: record.uploaderId || '未知',
    thumbnailUrl: record.thumbnailUrl || '',
    thumbnailExpiresAt: Number(record.thumbnailExpiresAt || 0),
    previewUrl: record.previewUrl || '',
    previewExpiresAt: Number(record.previewExpiresAt || 0),
    textPreviewAvailable: !!record.textPreviewAvailable || mimeType === 'text/plain',
    downloadCount: record.downloadCount || 0,
    hasThumbnail: !!(record.thumbnailUrl && record.thumbnailUrl.length),
    downloading: false,
    deleting: false,
    previewLoading: false,
  };
}

function mergeFamilyAddresses(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      label: entry.label || '',
      value: entry.value || '',
    }))
    .filter(entry => entry.label && entry.value);
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
    const matched = candidates.some(candidate => {
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
    record.metadata && record.metadata.intakeTime,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }
  return 0;
}

function toIntakeRecordKey(record = {}) {
  if (!record || typeof record !== 'object') {
    return `empty-${Math.random()}`;
  }

  // 对于Excel导入的原始记录,使用时间+姓名作为去重键
  // 因为同一条记录可能有多个不同的intakeId (imported状态 vs excel后缀)
  const metadata = record.metadata || {};
  const source = safeTrim(metadata.source).toLowerCase();
  const excelFlags = [
    record.status === 'imported',
    (record.intakeId || '').includes('-excel'),
    source === 'excel-import',
    Boolean(metadata.excelRecordId),
  ];
  const isExcelImportedRecord = excelFlags.some(Boolean);

  if (isExcelImportedRecord) {
    const time = extractRecordTimestamp(record);
    if (time) {
      const normalizedTime = Math.round(time / 60000);
      const identifier =
        safeTrim(record.patientKey) ||
        safeTrim(record.patientName) ||
        safeTrim(metadata.excelRecordId) ||
        '';
      const hospital =
        safeTrim(record.hospital) ||
        safeTrim(record.hospitalDisplay) ||
        safeTrim(record.intakeInfo && record.intakeInfo.hospital) ||
        '';
      const diagnosis =
        safeTrim(record.diagnosis) ||
        safeTrim(record.diagnosisDisplay) ||
        safeTrim(record.intakeInfo && record.intakeInfo.visitReason) ||
        '';
      return `excel:${normalizedTime}-${identifier}-${hospital}-${diagnosis}`;
    }
  }

  const candidates = [
    record.intakeId,
    record._id,
    record.id,
    record.metadata && record.metadata.intakeId,
  ].filter(Boolean);

  if (candidates.length) {
    return candidates[0];
  }

  const time = extractRecordTimestamp(record);
  if (time) {
    const normalizedTime = Math.round(time / 60000);
    const identifier = safeTrim(record.patientKey) || safeTrim(record.patientName) || '';
    return `time:${normalizedTime}-${identifier}`;
  }

  const admissionDate = safeTrim(record.displayTime) || safeTrim(record.admissionDate) || '';
  const diagnosis = safeTrim(record.diagnosis) || safeTrim(record.diagnosisDisplay) || '';
  const hospital = safeTrim(record.hospital) || safeTrim(record.hospitalDisplay) || '';

  return `fallback:${admissionDate}-${diagnosis}-${hospital}`;
}

function isActiveStatus(status) {
  if (!status) {
    return false;
  }
  const normalized = String(status).toLowerCase();
  return normalized === 'active';
}

function dedupeIntakeRecords(records = []) {
  if (!Array.isArray(records) || records.length <= 1) {
    return Array.isArray(records) ? records : [];
  }

  const map = new Map();

  records.forEach(record => {
    if (!record) {
      return;
    }
    const key = toIntakeRecordKey(record);
    if (!map.has(key)) {
      map.set(key, record);
      return;
    }

    const existing = map.get(key);
    const existingIsActive = isActiveStatus(existing.status);
    const candidateIsActive = isActiveStatus(record.status);

    if (existingIsActive !== candidateIsActive) {
      if (candidateIsActive) {
        map.set(key, record);
      }
      return;
    }

    if (!existing.updatedAt && record.updatedAt) {
      map.set(key, record);
      return;
    }

    const existingTime = extractRecordTimestamp(existing);
    const candidateTime = extractRecordTimestamp(record);
    if (candidateTime > existingTime) {
      map.set(key, record);
    }
  });

  return Array.from(map.values());
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

module.exports = {
  mapMediaRecord,
  mergeFamilyAddresses,
  findValueByLabels,
  coalesceValue,
  dedupeIntakeRecords,
  sortIntakeRecords,
  pushDisplayItem,
};
