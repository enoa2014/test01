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

const setNestedValue = (target, path, value) => {
  if (!path.includes('.')) {
    target[path] = value;
    return;
  }
  const parts = path.split('.');
  const last = parts.pop();
  let cursor = target;
  parts.forEach((part) => {
    if (cursor[part] === undefined || cursor[part] === null || typeof cursor[part] !== 'object') {
      cursor[part] = {};
    }
    cursor = cursor[part];
  });
  cursor[last] = value;
};

const applyUpdate = (existing, patch) => {
  const result = { ...existing };
  Object.keys(patch).forEach((key) => {
    let currentValue;
    if (key.includes('.')) {
      const parts = key.split('.');
      const last = parts.pop();
      let cursor = result;
      parts.forEach((part) => {
        if (cursor && typeof cursor === 'object') {
          cursor = cursor[part];
        } else {
          cursor = undefined;
        }
      });
      currentValue = cursor ? cursor[last] : undefined;
    } else {
      currentValue = result[key];
    }
    const value = applyUpdateValue(currentValue, patch[key]);
    setNestedValue(result, key, value);
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
    if (filter) {
      docs = docs.filter((doc) => matchesQuery(doc, filter));
    }
    docs = sortDocs(docs, order);
    docs = docs.slice(0, limitValue);
    return { data: docs };
  },
  async remove() {
    const collection = ensureCollection(name);
    const targets = [];
    for (const [id, doc] of collection.entries()) {
      if (matchesQuery(doc, filter)) {
        targets.push(id);
      }
    }
    targets.forEach((id) => collection.delete(id));
    return { stats: { removed: targets.length } };
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
  },
  async createCollection(name) {
    ensureCollection(name);
  }
};

const cloud = {
  DYNAMIC_CURRENT_ENV: 'mock-env',
  init: jest.fn(),
  database: jest.fn(() => db),
  getWXContext: jest.fn(() => ({ OPENID: state.openId })),
  callFunction: jest.fn(async () => ({ result: null })),
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
    cloud.callFunction.mockImplementation(async () => ({ result: null }));
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
  __deleteCollectionDoc(collection, id) {
    ensureCollection(collection).delete(id);
  },
  __setFile(fileID, buffer) {
    state.files.set(fileID, Buffer.from(buffer));
  }
};

module.exports = cloud;
