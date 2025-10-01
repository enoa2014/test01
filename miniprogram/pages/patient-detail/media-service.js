const logger = require('../../utils/logger');

const { MAX_UPLOAD_BATCH, MAX_FILE_SIZE, SIGNED_URL_TTL } = require('./constants.js');

const {
  normalizeString,
  generateUuid,
  formatFileSize,
  sanitizeFileName,
  inferExtension,
  inferMimeType,
  isImageExtension,
  isDocumentExtension,
} = require('./helpers.js');

const { mapMediaRecord } = require('./data-mappers.js');

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
    remainingBytesText: formatFileSize(30 * 1024 * 1024),
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
    remainingBytesText: formatFileSize(remainingBytes),
  };
}

function createMediaService(page) {
  let pageRef = page;

  function getPage() {
    return pageRef;
  }

  function setMediaState(patch) {
    const currentPage = getPage();
    if (!currentPage) {
      return;
    }
    const updates = {};
    Object.keys(patch).forEach(key => {
      updates[`media.${key}`] = patch[key];
    });
    currentPage.setData(updates);
  }

  async function callPatientMedia(action, payload = {}) {
    const currentPage = getPage();
    if (!currentPage) {
      throw new Error('页面已卸载，无法执行操作');
    }
    const data = { ...payload, action, patientKey: currentPage.patientKey };
    try {
      const res = await wx.cloud.callFunction({ name: 'patientMedia', data });
      const result = res && res.result;
      if (!result) {
        throw new Error('服务无响应');
      }
      if (result.success === false) {
        const err = new Error((result.error && result.error.message) || '操作失败');
        err.code = result.error && result.error.code;
        err.details = result.error && result.error.details;
        throw err;
      }
      return result.data || {};
    } catch (error) {
      if (error && error.errMsg) {
        const err = new Error(
          error.errMsg.replace('cloud.callFunction:fail ', '') || '云函数调用失败'
        );
        err.code = error.errCode || error.code;
        throw err;
      }
      throw error;
    }
  }

  async function refreshMediaList() {
    setMediaState({ loading: true, error: '' });
    try {
      const data = await callPatientMedia('list');
      const images = (data.images || [])
        .map(item => {
          const record = mapMediaRecord(item);
          if (record) {
            record.thumbnailUrl = item.thumbnailUrl || record.thumbnailUrl;
            record.thumbnailExpiresAt = Number(
              item.thumbnailExpiresAt || record.thumbnailExpiresAt || 0
            );
            record.textPreviewAvailable = item.textPreviewAvailable || record.textPreviewAvailable;
          }
          return record;
        })
        .filter(Boolean);
      const documents = (data.documents || []).map(mapMediaRecord).filter(Boolean);
      const quota = makeQuotaPayload(data.quota);

      const currentPage = getPage();
      if (!currentPage) {
        return;
      }
      currentPage.setData({
        'media.images': images,
        'media.documents': documents,
        'media.quota': quota,
        'media.loading': false,
        'media.error': '',
        'media.accessChecked': true,
        'media.allowed': true,
      });
    } catch (error) {
      logger.error('加载附件失败', error);
      setMediaState({
        error: normalizeString(error.message) || '加载附件失败，请稍后重试',
        loading: false,
      });
    }
  }

  async function initMediaSection() {
    const currentPage = getPage();
    if (!currentPage || !currentPage.patientKey) {
      return;
    }
    setMediaState({ loading: true, error: '', accessChecked: true, allowed: true });
    try {
      await refreshMediaList();
    } catch (error) {
      setMediaState({
        error: normalizeString(error.message) || '附件加载失败',
        loading: false,
      });
    }
  }

  function updateMediaRecord(category, index, updates) {
    const listKey = category === 'image' ? 'images' : 'documents';
    const currentPage = getPage();
    if (!currentPage) {
      return;
    }
    const mediaState = (currentPage.data && currentPage.data.media) || {};
    const list = mediaState[listKey];
    if (!Array.isArray(list) || index < 0 || index >= list.length) {
      return;
    }
    const updated = { ...list[index], ...updates };
    const newList = list.slice();
    newList[index] = updated;
    currentPage.setData({ [`media.${listKey}`]: newList });
  }

  function removeMediaRecord(category, id) {
    const listKey = category === 'image' ? 'images' : 'documents';
    const currentPage = getPage();
    if (!currentPage) {
      return;
    }
    const mediaState = (currentPage.data && currentPage.data.media) || {};
    const list = mediaState[listKey];
    if (!Array.isArray(list)) {
      return;
    }
    const newList = list.filter(item => item.id !== id);
    currentPage.setData({ [`media.${listKey}`]: newList });
  }

  async function processUploads(files, category) {
    if (!files || !files.length) {
      return;
    }
    const currentPage = getPage();
    if (!currentPage) {
      return;
    }
    const mediaState = (currentPage.data && currentPage.data.media) || {};
    const quota = mediaState.quota || getDefaultQuota();
    let remainingCount = quota.remainingCount || 0;
    let remainingBytes = quota.remainingBytes || 0;

    const valid = [];
    const skipped = [];
    files.forEach(file => {
      const extension = inferExtension(file.name || file.path);
      if (category === 'image' && !isImageExtension(extension)) {
        skipped.push({ file, reason: '类型不支持' });
        return;
      }
      if (category === 'document' && !isDocumentExtension(extension)) {
        skipped.push({ file, reason: '类型不支持' });
        return;
      }
      if (file.size && file.size > MAX_FILE_SIZE) {
        skipped.push({ file, reason: '文件超限' });
        return;
      }
      valid.push({
        ...file,
        extension,
        mimeType: inferMimeType(file.name || file.path, file.mimeType),
      });
    });

    if (!valid.length) {
      wx.showToast({ icon: 'none', title: '没有可上传的文件' });
      return;
    }

    const limited = valid.slice(0, Math.min(valid.length, MAX_UPLOAD_BATCH, remainingCount));
    setMediaState({ uploading: true });

    let successCount = 0;
    try {
      for (const file of limited) {
        if (remainingCount <= 0) {
          wx.showToast({ icon: 'none', title: '数量已满' });
          break;
        }
        if (file.size && file.size > remainingBytes) {
          wx.showToast({ icon: 'none', title: '容量不足' });
          break;
        }
        const fileName =
          sanitizeFileName(file.name) || `${category}-${generateUuid()}.${file.extension}`;
        try {
          const prepare = await callPatientMedia('prepareUpload', {
            fileName,
            sizeBytes: file.size,
            mimeType: file.mimeType,
          });
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: prepare.cloudPath,
            filePath: file.path,
          });
          if (!uploadRes || !uploadRes.fileID) {
            throw new Error('上传失败');
          }
          const complete = await callPatientMedia('completeUpload', {
            fileUuid: prepare.fileUuid,
            storagePath: prepare.storagePath,
            fileID: uploadRes.fileID,
            fileName,
            displayName: fileName,
            mimeType: file.mimeType,
            sizeBytes: file.size,
          });
          const record = mapMediaRecord(complete.media);
          const quotaPayload = makeQuotaPayload(complete.quota);
          if (record) {
            const activePage = getPage();
            if (!activePage) {
              break;
            }
            const mediaState = (activePage.data && activePage.data.media) || {};
            if (category === 'image') {
              const images = [record, ...(mediaState.images || [])];
              activePage.setData({ 'media.images': images });
            } else {
              const documents = [record, ...(mediaState.documents || [])];
              activePage.setData({ 'media.documents': documents });
            }
            activePage.setData({ 'media.quota': quotaPayload });
          }
          const quotaPage = getPage();
          if (quotaPage) {
            quotaPage.setData({ 'media.quota': quotaPayload });
          }
          remainingCount = quotaPayload.remainingCount;
          remainingBytes = quotaPayload.remainingBytes;
          successCount += 1;
        } catch (error) {
          handleMediaError(error, '上传');
        }
      }
    } finally {
      setMediaState({ uploading: false });
    }

    if (successCount > 0) {
      wx.showToast({ icon: 'success', title: `上传成功${successCount}个` });
    }

    if (skipped.length) {
      wx.showToast({ icon: 'none', title: `${skipped.length}个文件已跳过` });
    }
  }

  async function ensureImagePreviewUrls() {
    const currentPage = getPage();
    if (!currentPage) {
      return;
    }
    const mediaState = (currentPage.data && currentPage.data.media) || {};
    const images = mediaState.images || [];
    const now = Date.now();
    const pending = images
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item }) =>
          !item.previewUrl || !item.previewExpiresAt || item.previewExpiresAt <= now + 5000
      );

    for (const { item, index } of pending) {
      try {
        const data = await callPatientMedia('preview', {
          mediaId: item.id,
          variant: 'original',
        });
        if (data && data.url) {
          updateMediaRecord('image', index, {
            previewUrl: data.url,
            previewExpiresAt: data.expiresAt || Date.now() + SIGNED_URL_TTL,
          });
        }
      } catch (error) {
        logger.error('获取原图预览失败', error);
      }
    }
  }

  function downloadMediaFile(record, url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('下载地址无效'));
        return;
      }
      wx.downloadFile({
        url,
        success: res => {
          if (res.statusCode !== 200 || !res.tempFilePath) {
            reject(new Error('下载失败'));
            return;
          }
          if (record.category === 'image') {
            wx.previewImage({
              urls: [res.tempFilePath],
              success: resolve,
              fail: reject,
            });
          } else {
            wx.openDocument({
              filePath: res.tempFilePath,
              showMenu: true,
              success: resolve,
              fail: reject,
            });
          }
        },
        fail: reject,
      });
    });
  }

  function handleMediaError(error, context) {
    const code = error && error.code;
    let message = normalizeString(error && error.message) || `${context}失败`;
    if (code === 'MEDIA_QUOTA_EXCEEDED') {
      message = '配额不足';
    } else if (code === 'MEDIA_DUPLICATE') {
      message = '已存在相同文件';
    } else if (code === 'FILE_TOO_LARGE') {
      message = '文件超过10MB限制';
    } else if (code === 'UNSUPPORTED_FILE_TYPE') {
      message = '文件类型不支持';
    }
    const display = message.length > 14 ? `${message.slice(0, 13)}…` : message;
    wx.showToast({ icon: 'none', title: display || `${context}失败` });
  }

  function dispose() {
    pageRef = null;
  }

  return {
    setMediaState,
    initMediaSection,
    refreshMediaList,
    callPatientMedia,
    processUploads,
    updateMediaRecord,
    removeMediaRecord,
    ensureImagePreviewUrls,
    downloadMediaFile,
    handleMediaError,
    dispose,
  };
}

module.exports = {
  getDefaultQuota,
  makeQuotaPayload,
  createMediaService,
};
