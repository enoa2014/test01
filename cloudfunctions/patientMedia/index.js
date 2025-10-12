const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Jimp = require('jimp');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const MEDIA_COLLECTION = 'patient_media';
const QUOTA_COLLECTION = 'patient_media_quota';
const ADMIN_COLLECTION = 'patient_admins';

async function ensureCollectionExists(name) {
  try {
    await db.collection(name).limit(1).get();
    return true;
  } catch (error) {
    const code = error && (error.errCode !== undefined ? error.errCode : error.code);
    const message = error && error.errMsg ? error.errMsg : '';
    const notExists =
      code === -502005 ||
      (message && message.indexOf('DATABASE_COLLECTION_NOT_EXIST') >= 0) ||
      (message && message.indexOf('collection not exists') >= 0);
    if (notExists) {
      try {
        await db.createCollection(name);
        return false;
      } catch (createError) {
        const createCode =
          createError &&
          (createError.errCode !== undefined ? createError.errCode : createError.code);
        const alreadyExists = createCode === -502002;
        if (!alreadyExists) {
          console.warn('createCollection failed', name, createError);
        }
        return false;
      }
    }
    console.warn('ensureCollectionExists unexpected error', name, error);
    return false;
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_COUNT = 20;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;
const TXT_PREVIEW_LIMIT = 1024 * 1024;
const SIGNED_URL_TTL = 300;
const THUMBNAIL_WIDTH = 320;
const THUMBNAIL_HEIGHT = 320;

const EXTENSION_MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const DOCUMENT_EXTENSIONS = new Set(['.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx']);
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set([
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function makeError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  if (details !== undefined) {
    error.details = details;
  }
  return error;
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function sanitizeFileName(name) {
  const normalized = normalizeString(name);
  if (!normalized) {
    return '';
  }
  return normalized.split(/[\\/]+/).pop();
}

function sanitizeDisplayName(name, fallback) {
  const normalized = normalizeString(name) || normalizeString(fallback);
  if (!normalized) {
    return '未命名文件';
  }
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
}

function getExtension(fileName) {
  const ext = path.extname(normalizeString(fileName));
  return ext ? ext.toLowerCase() : '';
}

function determineCategory({ mimeType, extension }) {
  let ext = (extension || '').toLowerCase();
  let mime = (mimeType || '').toLowerCase();

  if (!ext && mime) {
    const matchedExt = Object.keys(EXTENSION_MIME_MAP).find(
      key => EXTENSION_MIME_MAP[key] === mime
    );
    if (matchedExt) {
      ext = matchedExt;
    }
  }
  if (!mime && ext) {
    mime = EXTENSION_MIME_MAP[ext] || '';
  }

  if (IMAGE_EXTENSIONS.has(ext) || IMAGE_MIME_TYPES.has(mime)) {
    if (!mime) {
      mime = EXTENSION_MIME_MAP[ext] || 'image/jpeg';
    }
    if (!ext) {
      ext = '.jpg';
    }
    return { category: 'image', mimeType: mime, extension: ext };
  }

  if (DOCUMENT_EXTENSIONS.has(ext) || DOCUMENT_MIME_TYPES.has(mime)) {
    if (!mime) {
      mime = EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
    }
    if (!ext) {
      const found = Object.keys(EXTENSION_MIME_MAP).find(key => EXTENSION_MIME_MAP[key] === mime);
      if (found) {
        ext = found;
      } else if (mime === 'text/plain') {
        ext = '.txt';
      } else if (mime === 'application/pdf') {
        ext = '.pdf';
      } else if (mime === 'application/msword') {
        ext = '.doc';
      } else if (
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        ext = '.docx';
      } else if (mime === 'application/vnd.ms-excel') {
        ext = '.xls';
      } else if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        ext = '.xlsx';
      }
    }
    return { category: 'document', mimeType: mime, extension: ext };
  }

  throw makeError(
    'UNSUPPORTED_FILE_TYPE',
    '不支持的文件类型，请上传 JPG/PNG/WebP/TXT/PDF/Word/Excel 文件'
  );
}

function ensurePatientKey(patientKey) {
  const key = normalizeString(patientKey);
  if (!key) {
    throw makeError('INVALID_PATIENT_KEY', '缺少患者标识');
  }
  return key;
}

function buildQuotaSummary(totalCount, totalBytes) {
  const count = Number.isFinite(totalCount) ? totalCount : 0;
  const bytes = Number.isFinite(totalBytes) ? totalBytes : 0;
  return {
    totalCount: count,
    totalBytes: bytes,
    maxCount: MAX_TOTAL_COUNT,
    maxBytes: MAX_TOTAL_BYTES,
    remainingCount: Math.max(MAX_TOTAL_COUNT - count, 0),
    remainingBytes: Math.max(MAX_TOTAL_BYTES - bytes, 0),
  };
}

async function fetchQuotaSnapshot(patientKey) {
  try {
    await ensureCollectionExists(QUOTA_COLLECTION);
    const res = await db.collection(QUOTA_COLLECTION).doc(patientKey).get();
    if (!res || !res.data) {
      return buildQuotaSummary(0, 0);
    }
    const data = res.data;
    const totalCount = Number.isFinite(data.totalCount) ? data.totalCount : 0;
    const totalBytes = Number.isFinite(data.totalBytes) ? data.totalBytes : 0;
    return buildQuotaSummary(totalCount, totalBytes);
  } catch (error) {
    return buildQuotaSummary(0, 0);
  }
}

async function assertAuthorized(event) {
  // Permissions disabled: always allow
  const token = normalizeString(event && event.sessionToken);
  return {
    adminId: token || 'public-access',
    mode: 'open-access',
  };
}

function buildContentDisposition(filename) {
  const fallback = 'download';
  const normalized = normalizeString(filename) || fallback;
  const sanitized = normalized.replace(/[\r\n]/g, ' ');
  const asciiName = sanitized.replace(/[^\x20-\x7E]/g, '_');
  const utf8Name = encodeURIComponent(sanitized);
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
}

function appendContentDisposition(url, filename) {
  try {
    const target = new URL(url);
    target.searchParams.set('response-content-disposition', buildContentDisposition(filename));
    return target.toString();
  } catch (error) {
    console.warn('appendContentDisposition failed', error);
    return url;
  }
}

async function safeDeleteFiles(fileIds) {
  const list = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
  if (!list.length) {
    return;
  }
  try {
    await cloud.deleteFile({ fileList: list });
  } catch (error) {
    console.warn('safeDeleteFiles failed', list, error);
  }
}

async function enrichMediaRecords(records) {
  if (!records || !records.length) {
    return [];
  }

  const thumbIds = [];
  const thumbMapKey = new Map();
  records.forEach(record => {
    const targetThumb =
      record.thumbFileId || (record.category === 'image' ? record.storageFileId : '');
    if (targetThumb && !thumbMapKey.has(targetThumb)) {
      thumbIds.push({ fileID: targetThumb, maxAge: SIGNED_URL_TTL });
      thumbMapKey.set(targetThumb, null);
    }
  });

  const thumbUrlMap = new Map();
  if (thumbIds.length) {
    try {
      const res = await cloud.getTempFileURL({ fileList: thumbIds });
      if (res && Array.isArray(res.fileList)) {
        res.fileList.forEach(item => {
          if (item && item.status === 0 && item.fileID && item.tempFileURL) {
            thumbUrlMap.set(item.fileID, item.tempFileURL);
          }
        });
      }
    } catch (error) {
      console.warn('getTempFileURL for thumbnails failed', error);
    }
  }

  const expiresAt = Date.now() + SIGNED_URL_TTL * 1000;
  return records.map(record => {
    const formatted = {
      id: record._id,
      patientKey: record.patientKey,
      category: record.category,
      filename: record.filename,
      displayName: record.displayName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      uploaderId: record.uploaderId,
      createdAt: record.createdAt,
      downloadCount: record.downloadCount || 0,
      quotaSnapshot: record.quotaSnapshot,
      fileUuid: record.fileUuid || '',
      textPreviewAvailable:
        record.mimeType === 'text/plain' && record.sizeBytes <= TXT_PREVIEW_LIMIT,
      thumbnailUrl: '',
      thumbnailExpiresAt: 0,
    };
    const thumbId = record.thumbFileId || (record.category === 'image' ? record.storageFileId : '');
    if (thumbId) {
      const url = thumbUrlMap.get(thumbId) || '';
      if (url) {
        formatted.thumbnailUrl = url;
        formatted.thumbnailExpiresAt = expiresAt;
      }
    }
    return formatted;
  });
}

async function handlePrepareUpload(event) {
  await assertAuthorized(event);
  const patientKey = ensurePatientKey(event.patientKey);
  const fileName = sanitizeFileName(event.fileName || event.filename);
  if (!fileName) {
    throw makeError('INVALID_FILE_NAME', '文件名不能为空');
  }
  const sizeBytesRaw = Number((event && event.sizeBytes) != null ? event.sizeBytes : 0);
  const sizeBytes = Number.isFinite(sizeBytesRaw) ? Math.max(Math.floor(sizeBytesRaw), 0) : 0;
  if (!sizeBytes) {
    throw makeError('INVALID_FILE_SIZE', '文件大小未知');
  }
  if (sizeBytes > MAX_FILE_SIZE) {
    throw makeError('FILE_TOO_LARGE', '单个文件已超过 10MB 限制');
  }

  const { category, mimeType, extension } = determineCategory({
    mimeType: event.mimeType,
    extension: getExtension(fileName),
  });

  const quota = await fetchQuotaSnapshot(patientKey);
  if (quota.remainingCount <= 0) {
    throw makeError('MEDIA_QUOTA_EXCEEDED', '患者附件数量已达上限', { quota });
  }
  if (sizeBytes > quota.remainingBytes) {
    throw makeError('MEDIA_QUOTA_EXCEEDED', '患者附件容量不足', { quota });
  }

  const fileUuid = normalizeString(event.fileUuid) || uuidv4();
  const storagePath = `patient-media/${patientKey}/${fileUuid}${extension}`;
  const thumbPath = category === 'image' ? `patient-media/${patientKey}/thumb/${fileUuid}.jpg` : '';

  return {
    success: true,
    data: {
      uploadId: uuidv4(),
      fileUuid,
      category,
      mimeType,
      cloudPath: storagePath,
      storagePath,
      thumbPath,
      limits: {
        maxFileSize: MAX_FILE_SIZE,
        maxTotalCount: MAX_TOTAL_COUNT,
        maxTotalBytes: MAX_TOTAL_BYTES,
      },
      quota,
    },
  };
}

async function handleCompleteUpload(event) {
  const auth = await assertAuthorized(event);
  const patientKey = ensurePatientKey(event.patientKey);
  const fileUuid = normalizeString(event.fileUuid);
  if (!fileUuid) {
    throw makeError('INVALID_UPLOAD', '缺少文件标识');
  }

  const fileId = normalizeString(event.fileID || event.fileId || event.storageFileId);
  if (!fileId) {
    throw makeError('INVALID_UPLOAD', '缺少文件 ID');
  }

  const rawFileName = sanitizeFileName(event.fileName || event.filename) || `${fileUuid}`;
  const displayName = sanitizeDisplayName(event.displayName, rawFileName);
  const storagePath =
    normalizeString(event.storagePath) ||
    `patient-media/${patientKey}/${fileUuid}${getExtension(rawFileName)}`;
  const intakeCategory = normalizeString(event.category);
  const intakeId = normalizeString(event.intakeId);

  let fileBuffer;
  try {
    const res = await cloud.downloadFile({ fileID: fileId });
    fileBuffer = res && res.fileContent;
  } catch (error) {
    throw makeError('FILE_NOT_FOUND', '未能读取到上传文件，请稍后重试');
  }
  if (!fileBuffer || !fileBuffer.length) {
    await safeDeleteFiles([fileId]);
    throw makeError('EMPTY_FILE', '文件内容为空');
  }

  const actualSize = fileBuffer.length;
  if (actualSize > MAX_FILE_SIZE) {
    await safeDeleteFiles([fileId]);
    throw makeError('FILE_TOO_LARGE', '单个文件已超过 10MB 限制');
  }

  const { category, mimeType, extension } = determineCategory({
    mimeType: event.mimeType,
    extension: getExtension(rawFileName) || getExtension(storagePath),
  });

  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  try {
    const duplicate = await db
      .collection(MEDIA_COLLECTION)
      .where({
        patientKey,
        hash,
        deletedAt: _.or(_.exists(false), _.eq(null)),
      })
      .limit(1)
      .get();
    if (duplicate && duplicate.data && duplicate.data.length) {
      await safeDeleteFiles([fileId]);
      throw makeError('MEDIA_DUPLICATE', '重复上传的文件已存在', {
        existingId: duplicate.data[0]._id,
      });
    }
  } catch (error) {
    if (error.code === 'MEDIA_DUPLICATE') {
      throw error;
    }
    console.warn('检查重复文件失败', error);
  }

  let thumbInfo = { fileID: '', path: '' };
  if (category === 'image') {
    try {
      const image = await Jimp.read(fileBuffer);
      image.cover(
        THUMBNAIL_WIDTH,
        THUMBNAIL_HEIGHT,
        Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE
      );
      image.quality(80);
      const thumbBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
      const thumbPath = `patient-media/${patientKey}/thumb/${fileUuid}.jpg`;
      const uploadRes = await cloud.uploadFile({
        cloudPath: thumbPath,
        fileContent: thumbBuffer,
        contentType: Jimp.MIME_JPEG,
      });
      thumbInfo = { fileID: uploadRes.fileID, path: thumbPath };
    } catch (error) {
      console.warn('生成缩略图失败', error);
    }
  }

  const now = Date.now();
  let insertedRecord = null;
  let quotaAfter = null;

  try {
    await db.runTransaction(async transaction => {
      const quotaRef = transaction.collection(QUOTA_COLLECTION).doc(patientKey);
      let quotaDoc = null;
      try {
        const quotaRes = await quotaRef.get();
        quotaDoc = (quotaRes && quotaRes.data) || null;
      } catch (error) {
        quotaDoc = null;
      }

      const currentCount =
        quotaDoc && Number.isFinite(quotaDoc.totalCount) ? quotaDoc.totalCount : 0;
      const currentBytes =
        quotaDoc && Number.isFinite(quotaDoc.totalBytes) ? quotaDoc.totalBytes : 0;
      const newCount = currentCount + 1;
      const newBytes = currentBytes + actualSize;

      if (newCount > MAX_TOTAL_COUNT || newBytes > MAX_TOTAL_BYTES) {
        const quota = buildQuotaSummary(currentCount, currentBytes);
        throw makeError('MEDIA_QUOTA_EXCEEDED', '患者资料配额不足，无法完成上传', { quota });
      }

      const mediaCollection = transaction.collection(MEDIA_COLLECTION);
      const recordData = {
        patientKey,
        category,
        fileUuid,
        filename: rawFileName,
        displayName,
        mimeType,
        extension,
        sizeBytes: actualSize,
        hash,
        uploaderId: auth.adminId,
        createdAt: now,
        storagePath,
        storageFileId: fileId,
        thumbPath: thumbInfo.path || '',
        thumbFileId: thumbInfo.fileID || '',
        downloadCount: 0,
        deletedAt: null,
        deletedBy: null,
        quotaSnapshot: buildQuotaSummary(newCount, newBytes),
        // 入住相关字段
        intakeCategory: intakeCategory || 'general',
        intakeId: intakeId || null,
      };

      const addRes = await mediaCollection.add({ data: recordData });
      const insertedId = addRes._id || addRes.id;
      insertedRecord = { _id: insertedId, ...recordData };
      quotaAfter = recordData.quotaSnapshot;

      await quotaRef.set({
        data: {
          patientKey,
          totalCount: newCount,
          totalBytes: newBytes,
          updatedAt: now,
        },
      });
    });
  } catch (error) {
    await safeDeleteFiles([fileId, thumbInfo.fileID].filter(Boolean));
    throw error;
  }

  const [formattedRecord] = await enrichMediaRecords([insertedRecord]);

  return {
    success: true,
    data: {
      media: formattedRecord,
      quota: quotaAfter,
    },
  };
}

async function handleListMedia(event) {
  await assertAuthorized(event);
  const patientKey = ensurePatientKey(event.patientKey);
  const activeCondition = _.or(_.exists(false), _.eq(null));

  await ensureCollectionExists(MEDIA_COLLECTION);
  await ensureCollectionExists(QUOTA_COLLECTION);

  let records = [];
  try {
    const res = await db
      .collection(MEDIA_COLLECTION)
      .where({ patientKey, deletedAt: activeCondition })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    records = (res && res.data) || [];
  } catch (error) {
    const code = error && (error.errCode !== undefined ? error.errCode : error.code);
    const message = error && error.errMsg ? error.errMsg : '';
    const notExists =
      code === -502005 ||
      (message && message.indexOf('DATABASE_COLLECTION_NOT_EXIST') >= 0) ||
      (message && message.indexOf('collection not exists') >= 0);
    if (!notExists) {
      console.error('加载附件列表失败', error);
      throw makeError('LIST_FAILED', '加载附件失败，请稍后重试');
    }
    records = [];
  }

  const enriched = await enrichMediaRecords(records);
  const images = enriched.filter(item => item.category === 'image');
  const documents = enriched.filter(item => item.category !== 'image');
  const quota = await fetchQuotaSnapshot(patientKey);

  return {
    success: true,
    data: {
      images,
      documents,
      quota,
    },
  };
}

async function handleDeleteMedia(event) {
  const auth = await assertAuthorized(event);
  const mediaId = normalizeString(event.mediaId || event.id);
  if (!mediaId) {
    throw makeError('INVALID_MEDIA_ID', '缺少附件标识');
  }

  let record;
  try {
    const res = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
    record = res && res.data;
  } catch (error) {
    record = null;
  }

  if (!record || record.deletedAt) {
    throw makeError('NOT_FOUND', '附件不存在或已删除');
  }

  const fileIds = [record.storageFileId, record.thumbFileId].filter(Boolean);
  const sizeBytes = Number(record.sizeBytes) || 0;
  const now = Date.now();
  let quotaAfter = null;

  await db.runTransaction(async transaction => {
    const mediaRef = transaction.collection(MEDIA_COLLECTION).doc(mediaId);
    const doc = await mediaRef.get();
    const data = doc && doc.data;
    if (!data || data.deletedAt) {
      throw makeError('NOT_FOUND', '附件不存在或已删除');
    }

    const quotaRef = transaction.collection(QUOTA_COLLECTION).doc(record.patientKey);
    let quotaDoc = null;
    try {
      const quotaRes = await quotaRef.get();
      quotaDoc = (quotaRes && quotaRes.data) || null;
    } catch (error) {
      quotaDoc = null;
    }

    const currentCount = quotaDoc && Number.isFinite(quotaDoc.totalCount) ? quotaDoc.totalCount : 0;
    const currentBytes = quotaDoc && Number.isFinite(quotaDoc.totalBytes) ? quotaDoc.totalBytes : 0;
    const newCount = Math.max(currentCount - 1, 0);
    const newBytes = Math.max(currentBytes - sizeBytes, 0);

    await mediaRef.update({
      data: {
        deletedAt: now,
        deletedBy: auth.adminId,
        quotaSnapshot: buildQuotaSummary(newCount, newBytes),
      },
    });

    await quotaRef.set({
      data: {
        patientKey: record.patientKey,
        totalCount: newCount,
        totalBytes: newBytes,
        updatedAt: now,
      },
    });

    quotaAfter = buildQuotaSummary(newCount, newBytes);
  });

  await safeDeleteFiles(fileIds);

  return {
    success: true,
    data: {
      quota: quotaAfter,
      deletedAt: now,
    },
  };
}

async function handleDownloadMedia(event) {
  await assertAuthorized(event);
  const mediaId = normalizeString(event.mediaId || event.id);
  if (!mediaId) {
    throw makeError('INVALID_MEDIA_ID', '缺少附件标识');
  }

  let record;
  try {
    const res = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
    record = res && res.data;
  } catch (error) {
    record = null;
  }

  if (!record || record.deletedAt) {
    throw makeError('NOT_FOUND', '附件不存在或已删除');
  }
  if (!record.storageFileId) {
    throw makeError('FILE_NOT_FOUND', '附件文件不存在');
  }

  let fileInfo;
  try {
    const res = await cloud.getTempFileURL({
      fileList: [{ fileID: record.storageFileId, maxAge: SIGNED_URL_TTL }],
    });
    fileInfo = res && res.fileList && res.fileList[0];
  } catch (error) {
    throw makeError('DOWNLOAD_UNAVAILABLE', '生成下载地址失败，请稍后重试');
  }

  if (!fileInfo || fileInfo.status !== 0 || !fileInfo.tempFileURL) {
    throw makeError('DOWNLOAD_UNAVAILABLE', '生成下载地址失败，请稍后重试');
  }

  const url = appendContentDisposition(fileInfo.tempFileURL, record.displayName || record.filename);
  const expiresAt = Date.now() + SIGNED_URL_TTL * 1000;

  try {
    await db
      .collection(MEDIA_COLLECTION)
      .doc(mediaId)
      .update({
        data: { downloadCount: _.inc(1) },
      });
  } catch (error) {
    console.warn('下载次数更新失败', mediaId, error);
  }

  return {
    success: true,
    data: {
      url,
      expiresAt,
    },
  };
}

async function handlePreviewMedia(event) {
  await assertAuthorized(event);
  const mediaId = normalizeString(event.mediaId || event.id);
  const variant = normalizeString(event.variant || 'thumb').toLowerCase();
  if (!mediaId) {
    throw makeError('INVALID_MEDIA_ID', '缺少附件标识');
  }

  let record;
  try {
    const res = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
    record = res && res.data;
  } catch (error) {
    record = null;
  }

  if (!record || record.deletedAt) {
    throw makeError('NOT_FOUND', '附件不存在或已删除');
  }

  let targetFileId = '';
  if (variant === 'thumb') {
    targetFileId = record.thumbFileId || (record.category === 'image' ? record.storageFileId : '');
  } else {
    targetFileId = record.storageFileId;
  }
  if (!targetFileId) {
    throw makeError('PREVIEW_UNAVAILABLE', '预览资源不存在');
  }

  let fileInfo;
  try {
    const res = await cloud.getTempFileURL({
      fileList: [{ fileID: targetFileId, maxAge: SIGNED_URL_TTL }],
    });
    fileInfo = res && res.fileList && res.fileList[0];
  } catch (error) {
    throw makeError('PREVIEW_UNAVAILABLE', '生成预览地址失败，请稍后重试');
  }

  if (!fileInfo || fileInfo.status !== 0 || !fileInfo.tempFileURL) {
    throw makeError('PREVIEW_UNAVAILABLE', '生成预览地址失败，请稍后重试');
  }

  return {
    success: true,
    data: {
      url: fileInfo.tempFileURL,
      expiresAt: Date.now() + SIGNED_URL_TTL * 1000,
      variant,
      mimeType: variant === 'thumb' && record.thumbFileId ? Jimp.MIME_JPEG : record.mimeType,
      sizeBytes: fileInfo.size || record.sizeBytes,
    },
  };
}

async function handlePreviewText(event) {
  await assertAuthorized(event);
  const mediaId = normalizeString(event.mediaId || event.id);
  if (!mediaId) {
    throw makeError('INVALID_MEDIA_ID', '缺少附件标识');
  }

  let record;
  try {
    const res = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
    record = res && res.data;
  } catch (error) {
    record = null;
  }

  if (!record || record.deletedAt) {
    throw makeError('NOT_FOUND', '附件不存在或已删除');
  }
  if (record.mimeType !== 'text/plain') {
    throw makeError('UNSUPPORTED_PREVIEW', '仅支持 TXT 文件在线预览');
  }
  if (!record.storageFileId) {
    throw makeError('FILE_NOT_FOUND', '附件文件不存在');
  }

  let buffer;
  try {
    const res = await cloud.downloadFile({ fileID: record.storageFileId });
    buffer = (res && res.fileContent) || Buffer.alloc(0);
  } catch (error) {
    throw makeError('PREVIEW_UNAVAILABLE', '读取 TXT 文件失败，请稍后重试');
  }

  if (buffer.length > TXT_PREVIEW_LIMIT) {
    throw makeError('TXT_TOO_LARGE', 'TXT 文件超过 1MB，仅支持下载查看');
  }

  const content = buffer.toString('utf8');
  return {
    success: true,
    data: {
      content,
      length: buffer.length,
    },
  };
}

async function handleCheckAccess(event) {
  const auth = await assertAuthorized(event);
  return {
    success: true,
    data: {
      allowed: true,
      adminId: auth.adminId,
    },
  };
}

async function handleCleanupIntakeFiles(event) {
  const auth = await assertAuthorized(event);
  const { intakeId } = event;

  if (!intakeId) {
    throw makeError('INVALID_INTAKE_ID', '缺少入住记录标识');
  }

  // 查找与该入住记录相关的文件
  const res = await db
    .collection(MEDIA_COLLECTION)
    .where({
      intakeId,
      deletedAt: _.or(_.exists(false), _.eq(null)),
    })
    .get();

  const files = res.data || [];
  if (files.length === 0) {
    return {
      success: true,
      data: { deletedCount: 0 },
    };
  }

  const now = Date.now();
  let deletedCount = 0;

  // 批量标记删除文件
  const batch = db.batch();
  const fileIds = [];

  for (const file of files) {
    const fileRef = db.collection(MEDIA_COLLECTION).doc(file._id);
    batch.update(fileRef, {
      deletedAt: now,
      deletedBy: auth.adminId,
    });

    fileIds.push(file.storageFileId);
    if (file.thumbFileId) {
      fileIds.push(file.thumbFileId);
    }
    deletedCount++;
  }

  await batch.commit();

  // 删除云存储文件
  await safeDeleteFiles(fileIds);

  return {
    success: true,
    data: { deletedCount },
  };
}

exports.main = async event => {
  const action = normalizeString(event && event.action);
  try {
    switch (action) {
      case 'summary': {
        const patientKey = ensurePatientKey(event.patientKey);
        await ensureCollectionExists(QUOTA_COLLECTION);
        try {
          const res = await db.collection(QUOTA_COLLECTION).doc(patientKey).get();
          const data = (res && res.data) || {};
          const totalCount = Number.isFinite(data.totalCount) ? data.totalCount : 0;
          const totalBytes = Number.isFinite(data.totalBytes) ? data.totalBytes : 0;
          const updatedAt = Number.isFinite(data.updatedAt) ? data.updatedAt : 0;
          return { success: true, data: { totalCount, totalBytes, updatedAt } };
        } catch (error) {
          return { success: true, data: { totalCount: 0, totalBytes: 0, updatedAt: 0 } };
        }
      }
      case 'prepareUpload':
        return await handlePrepareUpload(event);
      case 'completeUpload':
        return await handleCompleteUpload(event);
      case 'list':
        return await handleListMedia(event);
      case 'delete':
        return await handleDeleteMedia(event);
      case 'download':
        return await handleDownloadMedia(event);
      case 'preview':
        return await handlePreviewMedia(event);
      case 'previewTxt':
        return await handlePreviewText(event);
      case 'checkAccess':
        return await handleCheckAccess(event);
      case 'cleanupIntakeFiles':
        return await handleCleanupIntakeFiles(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `未支持的操作：${action || 'unknown'}`);
    }
  } catch (error) {
    console.error('patientMedia action failed', action, error);
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || '服务内部错误',
        details: error.details || null,
      },
    };
  }
};
