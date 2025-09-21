const ONE_PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR42mP8/5+hHgAHggJ/Pqe3RQAAAABJRU5ErkJggg==';
const ONE_PIXEL_PNG = Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64');

const TXT_LIMIT = 1024 * 1024;

jest.mock('wx-server-sdk', () => {
  const state = {
    openId: '',
    collections: new Map(),
    files: new Map(),
    nextId: 1
  };

  const clone = (value) => (value === undefined || value === null ? value : JSON.parse(JSON.stringify(value)));

  const command = {
    or: (...conditions) => ({ __cmd: 'or', conditions }),
    exists: (flag) => ({ __cmd: 'exists', flag }),
    eq: (value) => ({ __cmd: 'eq', value }),
    inc: (value) => ({ __cmd: 'inc', value })
  };

  const ensureCollection = (name) => {
    if (!state.collections.has(name)) {
      state.collections.set(name, new Map());
    }
    return state.collections.get(name);
  };

  const applyUpdateValue = (current, update) => {
    if (update && typeof update === 'object' && update.__cmd === 'inc') {
      const base = Number(current) || 0;
      return base + update.value;
    }
    if (update && typeof update === 'object' && !Array.isArray(update) && !('__cmd' in update)) {
      return clone(update);
    }
    return clone(update);
  };

  const applyUpdate = (existing, patch) => {
    const result = { ...existing };
    Object.keys(patch).forEach((key) => {
      result[key] = applyUpdateValue(result[key], patch[key]);
    });
    return result;
  };

  const matchesCondition = (docValue, condition) => {
    if (condition && typeof condition === 'object' && condition.__cmd) {
      switch (condition.__cmd) {
        case 'exists':
          return condition.flag ? docValue !== undefined && docValue !== null : docValue === undefined || docValue === null;
        case 'eq':
          return docValue === condition.value;
        case 'or':
          return condition.conditions.some((item) => matchesCondition(docValue, item));
        default:
          return false;
      }
    }
    return docValue === condition;
  };

  const matchesQuery = (doc, query) => {
    if (!query) {
      return true;
    }
    return Object.entries(query).every(([key, condition]) => matchesCondition(doc[key], condition));
  };

  const createDocInterface = (name, id) => ({
    async get() {
      const collection = ensureCollection(name);
      const doc = collection.get(id);
      if (!doc) {
        const err = new Error('document not found');
        err.errCode = 'DOCUMENT_NOT_FOUND';
        throw err;
      }
      return { data: clone(doc) };
    },
    async set({ data }) {
      const collection = ensureCollection(name);
      collection.set(id, { ...clone(data), _id: id });
    },
    async update({ data }) {
      const collection = ensureCollection(name);
      const existing = collection.get(id);
      if (!existing) {
        const err = new Error('document not found');
        err.errCode = 'DOCUMENT_NOT_FOUND';
        throw err;
      }
      const updated = applyUpdate(existing, data);
      collection.set(id, { ...updated, _id: id });
    },
    async remove() {
      ensureCollection(name).delete(id);
    }
  });

  const sortDocs = (docs, order) => {
    if (!order) {
      return docs;
    }
    const { field, direction } = order;
    const factor = direction === 'desc' ? -1 : 1;
    return docs.sort((a, b) => {
      const av = a[field] ?? 0;
      const bv = b[field] ?? 0;
      if (av === bv) {
        return 0;
      }
      return av > bv ? factor : -factor;
    });
  };

  const createQueryInterface = (name, filter = null, order = null, limitValue = Infinity) => ({
    where(newFilter) {
      return createQueryInterface(name, newFilter, order, limitValue);
    },
    orderBy(field, direction) {
      return createQueryInterface(name, filter, { field, direction }, limitValue);
    },
    limit(value) {
      return createQueryInterface(name, filter, order, value);
    },
    async get() {
      const collection = ensureCollection(name);
      let docs = Array.from(collection.values()).map((doc) => clone(doc));
      docs = docs.filter((doc) => matchesQuery(doc, filter));
      docs = sortDocs(docs, order);
      if (Number.isFinite(limitValue)) {
        docs = docs.slice(0, limitValue);
      }
      return { data: docs };
    },
    async remove() {
      const collection = ensureCollection(name);
      const toRemove = [];
      collection.forEach((doc, docId) => {
        if (matchesQuery(doc, filter)) {
          toRemove.push(docId);
        }
      });
      toRemove.forEach((docId) => collection.delete(docId));
      return { deleted: toRemove.length };
    }
  });

  const collectionInterface = (name) => {
    const query = createQueryInterface(name);
    return {
      doc: (id) => createDocInterface(name, id),
      add: async ({ data }) => {
        const collection = ensureCollection(name);
        const id = `mock-${state.nextId++}`;
        collection.set(id, { ...clone(data), _id: id });
        return { _id: id, id };
      },
      where: query.where,
      orderBy: query.orderBy,
      limit: query.limit,
      get: query.get,
      remove: query.remove
    };
  };

  const transactionInterface = {
    collection(name) {
      return {
        ...collectionInterface(name),
        doc: (id) => createDocInterface(name, id)
      };
    }
  };

  const db = {
    command,
    collection: (name) => collectionInterface(name),
    async runTransaction(handler) {
      return handler(transactionInterface);
    }
  };

  const cloud = {
    DYNAMIC_CURRENT_ENV: 'mock-env',
    init: jest.fn(),
    database: jest.fn(() => db),
    getWXContext: jest.fn(() => ({ OPENID: state.openId })),
    async getTempFileURL({ fileList }) {
      const list = (fileList || []).map((item) => {
        const fileID = typeof item === 'string' ? item : item.fileID;
        const buffer = state.files.get(fileID);
        if (!buffer) {
          return { fileID, status: -1 };
        }
        return {
          fileID,
          status: 0,
          tempFileURL: `https://mock/${encodeURIComponent(fileID)}`,
          size: buffer.length
        };
      });
      return { fileList: list };
    },
    async downloadFile({ fileID }) {
      if (!state.files.has(fileID)) {
        const err = new Error('file not found');
        err.errCode = 'FILE_NOT_FOUND';
        throw err;
      }
      return { fileContent: Buffer.from(state.files.get(fileID)) };
    },
    async uploadFile({ cloudPath, fileContent }) {
      const buffer = Buffer.isBuffer(fileContent) ? Buffer.from(fileContent) : Buffer.from(fileContent || '');
      const fileID = `mock://${cloudPath || `file-${state.nextId++}`}`;
      state.files.set(fileID, buffer);
      return { fileID };
    },
    async deleteFile({ fileList }) {
      (fileList || []).forEach((fileID) => state.files.delete(fileID));
    },
    __reset() {
      state.collections = new Map();
      state.files = new Map();
      state.openId = '';
      state.nextId = 1;
    },
    __setOpenId(openId) {
      state.openId = openId;
    },
    __setCollectionDoc(collection, id, data) {
      ensureCollection(collection).set(id, { ...clone(data), _id: id });
    },
    __getCollectionDoc(collection, id) {
      const doc = ensureCollection(collection).get(id);
      return doc ? clone(doc) : null;
    },
    __setFile(fileID, buffer) {
      state.files.set(fileID, Buffer.from(buffer));
    }
  };

  return cloud;
}, { virtual: true });

describe('patientMedia cloud function service tests', () => {
  let patientMedia;
  let cloud;

  const loadModule = () => {
    patientMedia = require('../../cloudfunctions/patientMedia/index.js');
  };

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__reset();
    process.env.PATIENT_MEDIA_ALLOW_DEV_BYPASS = 'true';
    process.env.PATIENT_MEDIA_ADMIN_TOKEN = '';
    process.env.PATIENT_MEDIA_ADMIN_OPENIDS = '';
    loadModule();
  });

  afterAll(() => {
    delete process.env.PATIENT_MEDIA_ALLOW_DEV_BYPASS;
    delete process.env.PATIENT_MEDIA_ADMIN_TOKEN;
    delete process.env.PATIENT_MEDIA_ADMIN_OPENIDS;
  });

  test('prepareUpload rejects unsupported file type', async () => {
    const result = await patientMedia.main({
      action: 'prepareUpload',
      patientKey: 'p-unsupported',
      fileName: 'malware.exe',
      sizeBytes: 1024
    });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  test('prepareUpload rejects files exceeding size limit', async () => {
    const result = await patientMedia.main({
      action: 'prepareUpload',
      patientKey: 'p-large',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 11 * 1024 * 1024
    });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('FILE_TOO_LARGE');
  });

  test('prepareUpload enforces remaining quota before upload', async () => {
    const patientKey = 'p-quota';
    cloud.__setCollectionDoc('patient_media_quota', patientKey, {
      patientKey,
      totalCount: 20,
      totalBytes: 30 * 1024 * 1024,
      updatedAt: Date.now()
    });

    const result = await patientMedia.main({
      action: 'prepareUpload',
      patientKey,
      fileName: 'note.txt',
      mimeType: 'text/plain',
      sizeBytes: 1024
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('MEDIA_QUOTA_EXCEEDED');
  });

  test('successful upload updates quota and second upload exceeds limit', async () => {
    const patientKey = 'p-concurrency';
    const largeQuotaBytes = 29 * 1024 * 1024;

    cloud.__setCollectionDoc('patient_media_quota', patientKey, {
      patientKey,
      totalCount: 19,
      totalBytes: largeQuotaBytes,
      updatedAt: Date.now()
    });

    const prepare = await patientMedia.main({
      action: 'prepareUpload',
      patientKey,
      fileName: 'image.png',
      mimeType: 'image/png',
      sizeBytes: ONE_PIXEL_PNG.length
    });

    expect(prepare.success).toBe(true);

    const fileId = 'mock://upload/image.png';
    cloud.__setFile(fileId, ONE_PIXEL_PNG);

    const complete = await patientMedia.main({
      action: 'completeUpload',
      patientKey,
      fileUuid: prepare.data.fileUuid,
      storagePath: prepare.data.storagePath,
      fileID: fileId,
      fileName: 'image.png',
      displayName: 'image.png',
      mimeType: 'image/png',
      sizeBytes: ONE_PIXEL_PNG.length
    });

    expect(complete.success).toBe(true);
    const quotaAfter = cloud.__getCollectionDoc('patient_media_quota', patientKey);
    expect(quotaAfter.totalCount).toBe(20);

    const secondPrepare = await patientMedia.main({
      action: 'prepareUpload',
      patientKey,
      fileName: 'another.png',
      mimeType: 'image/png',
      sizeBytes: ONE_PIXEL_PNG.length
    });

    expect(secondPrepare.success).toBe(false);
    expect(secondPrepare.error.code).toBe('MEDIA_QUOTA_EXCEEDED');
  });

  test('unauthorized access is rejected when dev bypass disabled', async () => {
    process.env.PATIENT_MEDIA_ALLOW_DEV_BYPASS = 'false';
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__reset();
    patientMedia = require('../../cloudfunctions/patientMedia/index.js');

    const result = await patientMedia.main({
      action: 'list',
      patientKey: 'p-auth'
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('PERMISSION_DENIED');
  });

  test('previewTxt rejects files exceeding preview size limit', async () => {
    const patientKey = 'p-text';
    const prepare = await patientMedia.main({
      action: 'prepareUpload',
      patientKey,
      fileName: 'big.txt',
      mimeType: 'text/plain',
      sizeBytes: TXT_LIMIT + 1
    });

    expect(prepare.success).toBe(true);

    const fileId = 'mock://upload/big.txt';
    cloud.__setFile(fileId, Buffer.alloc(TXT_LIMIT + 1, 65));

    const complete = await patientMedia.main({
      action: 'completeUpload',
      patientKey,
      fileUuid: prepare.data.fileUuid,
      storagePath: prepare.data.storagePath,
      fileID: fileId,
      fileName: 'big.txt',
      displayName: 'big.txt',
      mimeType: 'text/plain',
      sizeBytes: TXT_LIMIT + 1
    });

    expect(complete.success).toBe(true);
    const mediaId = complete.data.media.id;

    const preview = await patientMedia.main({
      action: 'previewTxt',
      mediaId
    });

    expect(preview.success).toBe(false);
    expect(preview.error.code).toBe('TXT_TOO_LARGE');
  });
});
