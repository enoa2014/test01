const cloud = require('wx-server-sdk');
const tcb = require('@cloudbase/node-sdk');
const bcrypt = require('bcryptjs');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// Collections
const ADMINS_COLLECTION = 'admins';

function makeError(code, message, details) {
  const err = new Error(message || code);
  err.code = code;
  if (details !== undefined) err.details = details;
  return err;
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

function getEnvId() {
  // Prefer explicit env var; fallback to system-provided
  // `process.env.TCB_ENV` is auto-injected in cloud functions
  const direct =
    process.env.CUSTOM_LOGIN_ENV_ID ||
    process.env.TCB_ENV ||
    process.env.SCF_NAMESPACE ||
    process.env.TENCENTCLOUD_ENV;
  if (direct) return direct;
  // Fallback to WX context (available in云函数运行时)
  try {
    const ctx = typeof cloud.getWXContext === 'function' ? cloud.getWXContext() : null;
    const fromCtx = ctx && (ctx.ENV || ctx.TCB_ENV || ctx.SCF_NAMESPACE);
    if (fromCtx) return fromCtx;
  } catch (_) {
    // ignore
  }
  return '';
}

function getCustomLoginCredentials() {
  const privateKeyId = process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID;
  let privateKey = process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY || '';
  if (privateKey && privateKey.indexOf('\\n') >= 0) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  if (!privateKeyId || !privateKey) {
    throw makeError('MISSING_CUSTOM_LOGIN_KEY', '未配置自定义登录私钥（请在函数环境变量中设置 TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID 与 TCB_CUSTOM_LOGIN_PRIVATE_KEY）');
  }
  return { privateKeyId, privateKey };
}

function createTicket(uid, opts = {}) {
  // Prefer explicit envId; gracefully fall back to current runtime env symbol
  const resolvedEnvId = getEnvId();
  const envOption = resolvedEnvId || (tcb && tcb.SYMBOL_CURRENT_ENV);
  if (!envOption) {
    // As a last resort, surface a clearer error instead of SDK's generic one
    throw makeError(
      'MISSING_ENV_ID',
      '未检测到云环境 ID，请在函数环境变量中配置 CUSTOM_LOGIN_ENV_ID，或在函数设置中启用“当前环境”运行。'
    );
  }
  const { privateKeyId, privateKey } = getCustomLoginCredentials();
  const app = tcb.init({
    env: envOption,
    credentials: { privateKeyId, privateKey },
  });
  // expireIn: seconds until ticket expires; refresh: refresh TTL (seconds)
  const expireIn = Number.isFinite(opts.expireIn) ? opts.expireIn : 2 * 60 * 60; // 2h
  const refresh = Number.isFinite(opts.refresh) ? opts.refresh : 30 * 24 * 60 * 60; // 30d
  return app.auth().createTicket(uid, { expireIn, refresh });
}

async function handleSeedAdmin(event = {}) {
  const seedCode = (event && String(event.code || '').trim()) || '';
  const requiredCode = (process.env.ADMIN_SEED_CODE || '').trim();
  if (!requiredCode || seedCode !== requiredCode) {
    throw makeError('FORBIDDEN', '非法初始化请求');
  }
  const username = String(event.username || '').trim();
  const password = String(event.password || '').trim();
  if (!username || !password) {
    throw makeError('INVALID_INPUT', '缺少用户名或口令');
  }

  await ensureCollectionExists(ADMINS_COLLECTION);
  const { total } = await db.collection(ADMINS_COLLECTION).where({}).count();
  if (total > 0) {
    throw makeError('ALREADY_INITIALIZED', '系统已初始化，禁止重复创建管理员');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = Date.now();
  const res = await db.collection(ADMINS_COLLECTION).add({
    username,
    passwordHash,
    role: 'admin',
    status: 'active',
    createdAt,
  });
  return { success: true, adminId: res._id };
}

async function handleLogin(event = {}) {
  const username = String(event.username || '').trim();
  const password = String(event.password || '').trim();
  if (!username || !password) {
    throw makeError('INVALID_INPUT', '缺少用户名或口令');
  }

  await ensureCollectionExists(ADMINS_COLLECTION);
  let admin = null;
  try {
    const res = await db.collection(ADMINS_COLLECTION).where({ username, status: _.neq('disabled') }).limit(1).get();
    admin = (res && res.data && res.data[0]) || null;
  } catch (error) {
    admin = null;
  }
  if (!admin) {
    throw makeError('USER_NOT_FOUND', '用户名不存在或已禁用');
  }
  const ok = await bcrypt.compare(password, admin.passwordHash || '');
  if (!ok) {
    throw makeError('BAD_PASSWORD', '口令错误');
  }

  // UID 必须满足 CloudBase 自定义登录格式要求（<32 字符，仅字母/数字），直接使用文档 ID。
  const uid = `${admin._id}`;
  const ticket = createTicket(uid, { expireIn: 2 * 60 * 60, refresh: 30 * 24 * 60 * 60 });

  return {
    success: true,
    ticket,
    user: {
      uid,
      id: admin._id,
      username: admin.username,
      role: admin.role || 'admin',
    },
  };
}

exports.main = async (event = {}) => {
  const action = String(event.action || 'login');
  try {
    switch (action) {
      case 'seedAdmin':
        return await handleSeedAdmin(event);
      case 'login':
        return await handleLogin(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `Unsupported action: ${action}`);
    }
  } catch (error) {
    console.error('auth action failed', action, error);
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
