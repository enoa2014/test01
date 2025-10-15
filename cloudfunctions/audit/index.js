const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// Collections
const AUDIT_LOGS_COLLECTION = 'auditLogs';
const ROLE_BINDINGS_COLLECTION = 'roleBindings';

function makeError(code, message, details) {
  const err = new Error(message || code);
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
}

function normalizeString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

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

async function checkAuditPermission(openid) {
  // 检查是否有审计权限 - admin和social_worker可以查看审计日志
  try {
    await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
    const res = await db.collection(ROLE_BINDINGS_COLLECTION)
      .where({
        userOpenId: openid,
        state: 'active',
        role: _.in(['admin', 'social_worker']),
      })
      .limit(1)
      .get();

    return res.data && res.data.length > 0;
  } catch (error) {
    return false;
  }
}

async function listLogs(event) {
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查审计权限
  const hasPermission = await checkAuditPermission(wxContext.OPENID);
  if (!hasPermission) {
    throw makeError('FORBIDDEN', '无权限查看审计日志');
  }

  await ensureCollectionExists(AUDIT_LOGS_COLLECTION);

  const page = Math.max(Number(event.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize) || 20, 1), 100);
  const filters = event.filters || {};

  const actor = normalizeString(filters.actor || '');
  const action = normalizeString(filters.action || '');
  const targetType = normalizeString(filters.targetType || '');
  const from = Number.isFinite(filters.from) ? filters.from : null;
  const to = Number.isFinite(filters.to) ? filters.to : null;

  let query = {};

  if (actor) {
    query.actorUserId = actor;
  }

  if (action) {
    query.action = db.RegExp({
      regexp: action,
      options: 'i',
    });
  }

  if (targetType) {
    query = {
      ...query,
      'target.type': targetType,
    };
  }

  if (from && to) {
    query.createdAt = _.gte(from).and(_.lte(to));
  } else if (from) {
    query.createdAt = _.gte(from);
  } else if (to) {
    query.createdAt = _.lte(to);
  }

  try {
    const countRes = await db.collection(AUDIT_LOGS_COLLECTION).where(query).count();
    const total = countRes.total;

    const dataRes = await db.collection(AUDIT_LOGS_COLLECTION)
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const items = (dataRes.data || []).map(log => ({
      id: log._id,
      actorUserId: log.actorUserId,
      actorRole: log.actorRole || '',
      action: log.action,
      target: log.target || null,
      message: log.message || '',
      changes: log.changes || null,
      level: log.level || 'info',
      ip: log.ip || '',
      ua: log.ua || '',
      createdAt: log.createdAt,
    }));

    return { success: true, data: { items, total } };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '查询审计日志失败', error);
  }
}

async function getLog(event) {
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查审计权限
  const hasPermission = await checkAuditPermission(wxContext.OPENID);
  if (!hasPermission) {
    throw makeError('FORBIDDEN', '无权限查看审计日志');
  }

  const id = normalizeString(event.id);

  if (!id) {
    throw makeError('INVALID_INPUT', '缺少日志ID');
  }

  await ensureCollectionExists(AUDIT_LOGS_COLLECTION);

  try {
    const res = await db.collection(AUDIT_LOGS_COLLECTION).doc(id).get();

    if (!res.data) {
      throw makeError('NOT_FOUND', '审计日志不存在');
    }

    const log = res.data;
    return {
      success: true,
      data: {
        id: log._id,
        actorUserId: log.actorUserId,
        actorRole: log.actorRole || '',
        action: log.action,
        target: log.target || null,
        message: log.message || '',
        changes: log.changes || null,
        level: log.level || 'info',
        ip: log.ip || '',
        ua: log.ua || '',
        createdAt: log.createdAt,
      },
    };
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      throw error;
    }
    throw makeError('DATABASE_ERROR', '获取审计日志失败', error);
  }
}

async function writeLog(event) {
  // 这是一个内部接口，用于其他云函数写入审计日志
  const wxContext = cloud.getWXContext();

  const actor = event.actor || {};
  const action = normalizeString(event.action || '');
  const target = event.target || null;
  const message = normalizeString(event.message || '');
  const changes = event.changes || null;
  const level = normalizeString(event.level || 'info');

  if (!action) {
    throw makeError('INVALID_INPUT', '缺少操作类型');
  }

  await ensureCollectionExists(AUDIT_LOGS_COLLECTION);

  try {
    const logEntry = {
      actorUserId: actor.userId || wxContext?.OPENID || '',
      actorRole: actor.role || '',
      action,
      target,
      message,
      changes,
      level,
      ip: wxContext?.CLIENTIP || '',
      ua: wxContext?.CLIENTUA || '',
      createdAt: Date.now(),
    };

    await db.collection(AUDIT_LOGS_COLLECTION).add({ data: logEntry });
    return { success: true };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '写入审计日志失败', error);
  }
}

exports.main = async (event = {}) => {
  const action = String(event.action || '');

  try {
    switch (action) {
      case 'listLogs':
        return await listLogs(event);
      case 'getLog':
        return await getLog(event);
      case 'writeLog':
        return await writeLog(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `Unsupported action: ${action}`);
    }
  } catch (error) {
    console.error('audit action failed', action, error);
    return {
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Internal service error',
        details: error.details || null,
      },
    };
  }
};