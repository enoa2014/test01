const {
  normalizeString,
  formatFileSize,
  formatDateTime,
  inferMimeType,
  inferExtension,
  safeTrim
} = require("./helpers.js");

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
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      label: entry.label || "",
      value: entry.value || ""
    }))
    .filter((entry) => entry.label && entry.value);
}

function findValueByLabels(list, candidates) {
  if (!Array.isArray(list) || !candidates || !candidates.length) {
    return "";
  }
  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const label = safeTrim(item.label);
    const value = safeTrim(item.value);
    if (!label || !value) {
      continue;
    }
    const lowerLabel = label.toLowerCase();
    const matched = candidates.some((candidate) => {
      const normalized = String(candidate || "").toLowerCase();
      return lowerLabel.includes(normalized) || label.includes(candidate);
    });
    if (matched) {
      return value;
    }
  }
  return "";
}

function coalesceValue(...values) {
  for (const value of values) {
    const normalized = safeTrim(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
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

function sortIntakeRecords(records = [], order = "desc") {
  const normalizedOrder = order === "asc" ? "asc" : "desc";
  const sorted = [...records];
  sorted.sort((a, b) => {
    const diff = extractRecordTimestamp(a) - extractRecordTimestamp(b);
    return normalizedOrder === "asc" ? diff : -diff;
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
  sortIntakeRecords,
  pushDisplayItem
};
