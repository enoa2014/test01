const state = {
  openId: '',
  collections: new Map(),
  files: new Map(),
  nextId: 1,
};

const clone = value =>
  value === undefined || value === null ? value : JSON.parse(JSON.stringify(value));

const normalizeConditionList = args => (Array.isArray(args[0]) ? args[0] : Array.from(args));

const command = {
  or: (...conditions) => ({ __cmd: 'or', conditions: normalizeConditionList(conditions) }),
  and: (...conditions) => ({ __cmd: 'and', conditions: normalizeConditionList(conditions) }),
  in: values => ({ __cmd: 'in', value: Array.isArray(values) ? values : [values] }),
  exists: flag => ({ __cmd: 'exists', flag }),
  eq: value => ({ __cmd: 'eq', value }),
  inc: value => ({ __cmd: 'inc', value }),
};

const ensureCollection = name => {
  if (!state.collections.has(name)) {
    state.collections.set(name, new Map());
  }
  return state.collections.get(name);
};

const createRegExpCondition = ({ regexp, options }) => ({
  __cmd: 'regex',
  regexp: typeof regexp === 'string' ? regexp : '',
  options: options || '',
});

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
  parts.forEach(part => {
    if (cursor[part] === undefined || cursor[part] === null || typeof cursor[part] !== 'object') {
      cursor[part] = {};
    }
    cursor = cursor[part];
  });
  cursor[last] = value;
};

const applyUpdate = (existing, patch) => {
  const result = { ...existing };
  Object.keys(patch).forEach(key => {
    let currentValue;
    if (key.includes('.')) {
      const parts = key.split('.');
      const last = parts.pop();
      let cursor = result;
      parts.forEach(part => {
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

const getNestedValue = (doc, path) => {
  if (!path) {
    return undefined;
  }
  const parts = path.split('.');
  let cursor = doc;
  for (let i = 0; i < parts.length; i += 1) {
    if (cursor && typeof cursor === 'object' && parts[i] in cursor) {
      cursor = cursor[parts[i]];
    } else {
      return undefined;
    }
  }
  return cursor;
};

const matchesQuery = (doc, query) => {
  if (!query) {
    return true;
  }

  const evaluateCondition = (condition, keyPath) => {
    if (!condition) {
      return true;
    }
    if (condition && typeof condition === 'object' && condition.__cmd) {
      switch (condition.__cmd) {
        case 'or':
          return condition.conditions.some(item => matchesQuery(doc, item));
        case 'and':
          return condition.conditions.every(item => matchesQuery(doc, item));
        case 'in': {
          const value = getNestedValue(doc, keyPath);
          return condition.value.includes(value);
        }
        case 'exists': {
          const value = getNestedValue(doc, keyPath);
          return condition.flag
            ? value !== undefined && value !== null
            : value === undefined || value === null;
        }
        case 'eq': {
          const value = getNestedValue(doc, keyPath);
          return value === condition.value;
        }
        case 'regex': {
          const value = getNestedValue(doc, keyPath);
          if (typeof value !== 'string') {
            return false;
          }
          try {
            const regex = new RegExp(condition.regexp || '', condition.options || '');
            return regex.test(value);
          } catch (error) {
            return false;
          }
        }
        default:
          return true;
      }
    }
    if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
      return matchesQuery(doc, condition);
    }
    const value = getNestedValue(doc, keyPath);
    return value === condition;
  };

  if (query && typeof query === 'object' && query.__cmd) {
    return evaluateCondition(query);
  }

  return Object.entries(query).every(([key, condition]) => evaluateCondition(condition, key));
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
  },
});

const sortDocs = (docs, orders) => {
  if (!orders || (Array.isArray(orders) && orders.length === 0)) {
    return docs;
  }
  const list = Array.isArray(orders) ? orders : [orders];
  return docs.sort((a, b) => {
    for (let i = 0; i < list.length; i += 1) {
      const { field, direction } = list[i];
      const factor = direction === 'desc' ? -1 : 1;
      const av = getNestedValue(a, field) ?? 0;
      const bv = getNestedValue(b, field) ?? 0;
      if (av === bv) {
        continue;
      }
      return av > bv ? factor : -factor;
    }
    return 0;
  });
};

const createQueryInterface = (
  name,
  {
    filter = null,
    order = [],
    limitValue = Infinity,
    skipValue = 0,
    fieldProjection = null,
  } = {}
) => ({
  where(newFilter) {
    return createQueryInterface(name, {
      filter: newFilter,
      order,
      limitValue,
      skipValue,
      fieldProjection,
    });
  },
  orderBy(field, direction) {
    const nextOrder = Array.isArray(order) ? [...order, { field, direction }] : [{ field, direction }];
    return createQueryInterface(name, {
      filter,
      order: nextOrder,
      limitValue,
      skipValue,
      fieldProjection,
    });
  },
  limit(value) {
    return createQueryInterface(name, {
      filter,
      order,
      limitValue: value,
      skipValue,
      fieldProjection,
    });
  },
  skip(value) {
    return createQueryInterface(name, {
      filter,
      order,
      limitValue,
      skipValue: value || 0,
      fieldProjection,
    });
  },
  field(projection) {
    return createQueryInterface(name, {
      filter,
      order,
      limitValue,
      skipValue,
      fieldProjection: projection,
    });
  },
  async get() {
    const collection = ensureCollection(name);
    let docs = Array.from(collection.values()).map(doc => clone(doc));
    if (filter) {
      docs = docs.filter(doc => matchesQuery(doc, filter));
    }
    docs = sortDocs(docs, order);
    if (skipValue) {
      docs = docs.slice(skipValue);
    }
    docs = docs.slice(0, limitValue);
    return { data: docs };
  },
  async count() {
    const collection = ensureCollection(name);
    let docs = Array.from(collection.values()).map(doc => clone(doc));
    if (filter) {
      docs = docs.filter(doc => matchesQuery(doc, filter));
    }
    return { total: docs.length };
  },
  async remove() {
    const collection = ensureCollection(name);
    const targets = [];
    for (const [id, doc] of collection.entries()) {
      if (matchesQuery(doc, filter)) {
        targets.push(id);
      }
    }
    targets.forEach(id => collection.delete(id));
    return { stats: { removed: targets.length } };
  },
});

const collectionInterface = name => {
  const query = createQueryInterface(name);
  return {
    doc: id => createDocInterface(name, id),
    add: async ({ data }) => {
      const collection = ensureCollection(name);
      const id = `mock-${state.nextId++}`;
      collection.set(id, { ...clone(data), _id: id });
      return { _id: id, id };
    },
    where: query.where,
    orderBy: query.orderBy,
    limit: query.limit,
     skip: query.skip,
     field: query.field,
    get: query.get,
     count: query.count,
    remove: query.remove,
  };
};

const transactionInterface = {
  collection(name) {
    return {
      ...collectionInterface(name),
      doc: id => createDocInterface(name, id),
    };
  },
};

const db = {
  command,
  RegExp: createRegExpCondition,
  collection: name => collectionInterface(name),
  async runTransaction(handler) {
    return handler(transactionInterface);
  },
  async createCollection(name) {
    ensureCollection(name);
  },
};

const cloud = {
  DYNAMIC_CURRENT_ENV: 'mock-env',
  init: jest.fn(),
  database: jest.fn(() => db),
  getWXContext: jest.fn(() => ({ OPENID: state.openId })),
  callFunction: jest.fn(async () => ({ result: null })),
  async getTempFileURL({ fileList }) {
    const list = (fileList || []).map(item => {
      const fileID = typeof item === 'string' ? item : item.fileID;
      const buffer = state.files.get(fileID);
      if (!buffer) {
        return { fileID, status: -1 };
      }
      return {
        fileID,
        status: 0,
        tempFileURL: `https://mock/${encodeURIComponent(fileID)}`,
        size: buffer.length,
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
    const buffer = Buffer.isBuffer(fileContent)
      ? Buffer.from(fileContent)
      : Buffer.from(fileContent || '');
    const fileID = `mock://${cloudPath || `file-${state.nextId++}`}`;
    state.files.set(fileID, buffer);
    return { fileID };
  },
  async deleteFile({ fileList }) {
    (fileList || []).forEach(fileID => state.files.delete(fileID));
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
  },
};

module.exports = cloud;
