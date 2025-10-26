const cloud = require('wx-server-sdk');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// Collections
const USERS_COLLECTION = 'users';
const ROLE_BINDINGS_COLLECTION = 'roleBindings';
const ROLE_REQUESTS_COLLECTION = 'roleRequests';
const INVITES_COLLECTION = 'invites';
const AUDIT_LOGS_COLLECTION = 'auditLogs';
const ADMINS_COLLECTION = 'admins';

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

// 统一角色代码，兼容别名/中划线/大小写/中文
function normalizeRole(value) {
  const raw = normalizeString(value);
  if (!raw) return '';
  const lowered = raw.toLowerCase();
  // 标准化连接符为下划线
  const normalized = lowered.replace(/[\s-]+/g, '_');
  const aliasMap = {
    // 中文别名
    '社工': 'social_worker',
    '志愿者': 'volunteer',
    '家长': 'parent',
    // 英文别名/缩写
    'social_worker': 'social_worker',
    'socialworker': 'social_worker',
    'social-worker': 'social_worker',
    'sw': 'social_worker',
    'volunteer': 'volunteer',
    'parent': 'parent',
    'guardian': 'parent',
  };
  return aliasMap[normalized] || normalized;
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

async function writeAuditLog(actor, action, target, message, changes = null) {
  try {
    await ensureCollectionExists(AUDIT_LOGS_COLLECTION);
    const wxContext = cloud.getWXContext();
    const logEntry = {
      actorUserId: actor.userId || '',
      actorRole: actor.role || '',
      action,
      target: target || null,
      message,
      changes,
      level: 'info',
      ip: wxContext.CLIENTIP || '',
      ua: wxContext.CLIENTUA || '',
      createdAt: Date.now(),
    };
    await db.collection(AUDIT_LOGS_COLLECTION).add({ data: logEntry });
  } catch (error) {
    console.warn('writeAuditLog failed', error);
  }
}

const wechatTokenCache = {
  accessToken: '',
  expiresAt: 0,
};

async function getWeChatAccessToken() {
  const appId =
    process.env.WECHAT_MINIAPP_ID ||
    process.env.WX_APPID ||
    process.env.WX_APP_ID ||
    process.env.MINIAPP_APPID ||
    'wx6fe6343a956db160'; // 备选硬编码值
  const appSecret =
    process.env.WECHAT_MINIAPP_SECRET ||
    process.env.WX_APP_SECRET ||
    process.env.WX_APPSECRET ||
    process.env.MINIAPP_SECRET ||
    'c9371df2d58ad14ed0511fb38b49cc53'; // 备选硬编码值

  if (!appId || !appSecret) {
    throw makeError('CONFIG_MISSING', '未配置小程序 AppID 或 Secret，无法生成二维码');
  }

  const now = Date.now();
  if (wechatTokenCache.accessToken && wechatTokenCache.expiresAt - 60 * 1000 > now) {
    return wechatTokenCache.accessToken;
  }

  try {
    const resp = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: {
        grant_type: 'client_credential',
        appid: appId,
        secret: appSecret,
      },
      timeout: 10000,
    });
    const data = resp && resp.data ? resp.data : {};
    if (!data.access_token) {
      throw makeError(
        'WECHAT_TOKEN_FAILED',
        `获取微信 AccessToken 失败：${data.errmsg || '未知错误'}`,
        data
      );
    }
    const expiresIn = Number(data.expires_in || 7200);
    wechatTokenCache.accessToken = data.access_token;
    wechatTokenCache.expiresAt = now + Math.max(60, expiresIn - 120) * 1000;
    return wechatTokenCache.accessToken;
  } catch (error) {
    throw makeError('WECHAT_TOKEN_ERROR', '请求微信 AccessToken 失败', error);
  }
}

async function generateQrViaWechatApi(payload, allowRetry = true) {
  const token = await getWeChatAccessToken();
  try {
    const resp = await axios.post(
      `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`,
      payload,
      { responseType: 'arraybuffer', timeout: 15000 }
    );

    const contentType = (resp.headers && resp.headers['content-type']) || '';
    // 微信可能返回 JSON 错误，需要识别
    if (contentType.includes('application/json')) {
      const body = JSON.parse(Buffer.from(resp.data).toString('utf8'));
      if ((body.errcode === 40001 || body.errcode === 42001) && allowRetry) {
        wechatTokenCache.accessToken = '';
        wechatTokenCache.expiresAt = 0;
        return generateQrViaWechatApi(payload, false);
      }
      throw makeError('WECHAT_API_ERROR', body.errmsg || '微信接口返回错误', body);
    }

    return {
      buffer: Buffer.from(resp.data),
      contentType: contentType || 'image/png',
    };
  } catch (error) {
    if (error.response) {
      const { response } = error;
      const contentType = (response.headers && response.headers['content-type']) || '';
      if (contentType.includes('application/json')) {
        try {
          const body = JSON.parse(Buffer.from(response.data).toString('utf8'));
          if ((body.errcode === 40001 || body.errcode === 42001) && allowRetry) {
            wechatTokenCache.accessToken = '';
            wechatTokenCache.expiresAt = 0;
            return generateQrViaWechatApi(payload, false);
          }
          throw makeError('WECHAT_API_ERROR', body.errmsg || '微信接口返回错误', body);
        } catch (_) {
          // fall through to generic error
        }
      }
    }
    throw makeError('WECHAT_API_REQUEST_FAILED', '调用微信二维码接口失败', error);
  }
}

function resolveAuthContext(event = {}) {
  let wxContext = {};
  try {
    wxContext = typeof cloud.getWXContext === 'function' ? cloud.getWXContext() : {};
  } catch (error) {
    wxContext = {};
  }

  const userInfo = (event && event.userInfo) || (typeof wxContext === 'object' && wxContext.userInfo) || {};

  const openId = normalizeString(
    (userInfo && (userInfo.openId || userInfo.OPENID)) ||
      wxContext.OPENID ||
      wxContext.openId ||
      ''
  );
  const customUserId = normalizeString(
    // 允许从事件透传（Web 自定义登录代理）
    (event && (event.__principalId || event.principalId || event.actorId || event.userId || event.customUserId)) ||
    (userInfo && (userInfo.customUserId || userInfo.customUserID)) ||
      wxContext.CUSTOM_USER_ID ||
      wxContext.customUserId ||
      ''
  );

  // 在 Web 自定义登录场景下，OPENID 可能不存在，此时使用 customUserId 作为主体ID
  const principalId = openId || customUserId || '';

  return { wxContext, openId, customUserId, principalId };
}

async function hasActiveRoleBinding(principalId, roles = []) {
  if (!principalId) return false;
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const where = { userOpenId: principalId, state: 'active' };
  if (Array.isArray(roles) && roles.length) {
    where.role = _.in(roles);
  }
  try {
    const res = await db.collection(ROLE_BINDINGS_COLLECTION).where(where).limit(1).get();
    return !!(res && res.data && res.data.length);
  } catch (_) {
    return false;
  }
}

async function isAdminByAdminsCollection(principalId) {
  if (!principalId) return false;
  await ensureCollectionExists(ADMINS_COLLECTION);
  try {
    // 自定义登录中，我们使用管理员文档 _id 作为 uid（即 customUserId）
    const res = await db.collection(ADMINS_COLLECTION).doc(principalId).get();
    const doc = res && res.data;
    if (!doc) return false;
    if (doc.status && String(doc.status).toLowerCase() === 'disabled') return false;
    // 角色字段缺失时默认按管理员处理
    return (doc.role || 'admin') === 'admin';
  } catch (_) {
    return false;
  }
}

async function requirePermission(allowedRoles = [], event = {}) {
  const { wxContext, principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }
  // 先查角色绑定
  if (await hasActiveRoleBinding(principalId, allowedRoles)) {
    // 返回当前主体及其角色（用于审计）
    return { principalId, role: allowedRoles[0] || 'user', wxContext };
  }
  // 若允许管理员，且在 admins 集合中存在有效记录，则放行
  if (allowedRoles.includes('admin') && (await isAdminByAdminsCollection(principalId))) {
    return { principalId, role: 'admin', wxContext };
  }
  throw makeError('FORBIDDEN', '无权限执行该操作');
}

async function getCurrentUser(event) {
  const { wxContext, principalId, openId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  await ensureCollectionExists(USERS_COLLECTION);
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);

  let user = null;
  try {
    const res = await db
      .collection(USERS_COLLECTION)
      .where({ openid: principalId })
      .limit(1)
      .get();
    user = (res && res.data && res.data[0]) || null;
  } catch (error) {
    user = null;
  }

  if (!user) {
    // 如果用户不存在，创建基本用户记录
    const now = Date.now();
    const createRes = await db.collection(USERS_COLLECTION).add({
      data: {
        openid: openId,
        status: 'active',
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    user = { _id: createRes._id, openid: openId, status: 'active', lastLoginAt: now };
  }

  // 获取用户角色
  let roles = [];
  try {
    const res = await db
      .collection(ROLE_BINDINGS_COLLECTION)
      .where({
        userOpenId: principalId,
        state: 'active',
        expiresAt: _.or(_.exists(false), _.gt(Date.now())),
      })
      .get();
    roles = (res.data || []).map(binding => binding.role);
  } catch (error) {
    roles = [];
  }
  // 自定义登录管理员兜底：若 admins 集合存在有效记录，补充 admin 角色
  if (await isAdminByAdminsCollection(principalId)) {
    if (!roles.includes('admin')) roles.push('admin');
  }

  return {
    success: true,
    data: {
      userId: user._id,
      openid: user.openid,
      roles,
      displayName: user.profile?.realName || '',
      avatar: user.profile?.avatar || '',
      lastLoginAt: user.lastLoginAt,
    },
  };
}

async function listUsers(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限 - 只有admin可以查看用户列表
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  // 允许 admin 或 social_worker
  if (!(await hasActiveRoleBinding(principalId, ['admin']))) {
    const sw = await hasActiveRoleBinding(principalId, ['social_worker']);
    const adminFallback = await isAdminByAdminsCollection(principalId);
    if (!sw && !adminFallback) {
      throw makeError('FORBIDDEN', '无权限查看用户列表');
    }
  }

  await ensureCollectionExists(USERS_COLLECTION);

  const page = Math.max(Number(event.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize) || 20, 1), 100);
  const keyword = normalizeString(event.keyword);
  const roles = Array.isArray(event.roles) ? event.roles : [];
  const status = Array.isArray(event.status) ? event.status : [];
  const timeRange = event.timeRange || null;

  let query = {};

  if (keyword) {
    query = {
      ...query,
      'profile.realName': db.RegExp({
        regexp: keyword,
        options: 'i',
      }),
    };
  }

  if (roles.length > 0) {
    // 需要关联查询roleBindings表
    const userOpenIds = await db.collection(ROLE_BINDINGS_COLLECTION)
      .where({
        role: _.in(roles),
        state: 'active',
      })
      .field({ userOpenId: 1 })
      .get();

    if (userOpenIds.data && userOpenIds.data.length > 0) {
      query.openid = _.in(userOpenIds.data.map(item => item.userOpenId));
    } else {
      // 如果没有匹配的用户，返回空结果
      return { success: true, data: { items: [], total: 0 } };
    }
  }

  if (status.length > 0) {
    query.status = _.in(status);
  }

  if (timeRange && timeRange.length === 2) {
    query.lastLoginAt = _.gte(timeRange[0]).and(_.lte(timeRange[1]));
  }

  try {
    const countRes = await db.collection(USERS_COLLECTION).where(query).count();
    const total = countRes.total;

    const dataRes = await db.collection(USERS_COLLECTION)
      .where(query)
      .orderBy('lastLoginAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const items = (dataRes.data || []).map(user => ({
      id: user._id,
      openid: user.openid,
      displayName: user.profile?.realName || '',
      phone: user.profile?.phone || '',
      avatar: user.profile?.avatar || '',
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }));

    return { success: true, data: { items, total } };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '查询用户列表失败', error);
  }
}

async function listRoleBindings(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  if (
    !(await hasActiveRoleBinding(principalId, ['admin', 'social_worker'])) &&
    !(await isAdminByAdminsCollection(principalId))
  ) {
    throw makeError('FORBIDDEN', '无权限查看角色绑定');
  }

  const userOpenId = normalizeString(event.userOpenId);

  let query = { state: 'active' };
  if (userOpenId) {
    query.userOpenId = userOpenId;
  }

  try {
    const res = await db.collection(ROLE_BINDINGS_COLLECTION)
      .where(query)
      .orderBy('createdAt', 'desc')
      .get();

    const items = (res.data || []).map(binding => ({
      id: binding._id,
      userOpenId: binding.userOpenId,
      role: binding.role,
      scopeType: binding.scopeType || 'global',
      state: binding.state,
      expiresAt: binding.expiresAt,
      createdAt: binding.createdAt,
      createdBy: binding.createdBy,
    }));

    return { success: true, data: { items } };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '查询角色绑定失败', error);
  }
}

async function addRoleBinding(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 只有admin可以添加角色绑定
  if (
    !(await hasActiveRoleBinding(principalId, ['admin'])) &&
    !(await isAdminByAdminsCollection(principalId))
  ) {
    throw makeError('FORBIDDEN', '只有管理员可以添加角色绑定');
  }

  const userOpenId = normalizeString(event.userOpenId);
  const role = normalizeRole(event.role);
  const expiresAt = Number.isFinite(event.expiresAt) ? event.expiresAt : null;

  if (!userOpenId || !role) {
    throw makeError('INVALID_INPUT', '缺少用户ID或角色');
  }

  if (!['social_worker', 'volunteer', 'parent'].includes(role)) {
    throw makeError('INVALID_INPUT', '不支持的角色类型');
  }

  // 检查是否已存在相同的绑定
  const existingRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId,
      role,
      state: 'active',
    })
    .limit(1)
    .get();

  if (existingRes.data && existingRes.data.length > 0) {
    throw makeError('ROLE_ALREADY_BOUND', '用户已拥有该角色');
  }

  try {
    const now = Date.now();
    const addRes = await db.collection(ROLE_BINDINGS_COLLECTION).add({
      data: {
        userOpenId,
        role,
        scopeType: 'global',
        state: 'active',
        expiresAt,
        createdAt: now,
        createdBy: principalId,
      },
    });

    // 记录审计日志
    await writeAuditLog(
      { userId: principalId, role: 'admin' },
      'role.add',
      { type: 'user', id: userOpenId },
      `为用户 ${userOpenId} 添加角色 ${role}`,
      { role, expiresAt }
    );

    return { success: true };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '添加角色绑定失败', error);
  }
}

async function removeRoleBinding(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 只有admin可以移除角色绑定
  if (
    !(await hasActiveRoleBinding(principalId, ['admin'])) &&
    !(await isAdminByAdminsCollection(principalId))
  ) {
    throw makeError('FORBIDDEN', '只有管理员可以移除角色绑定');
  }

  const userOpenId = normalizeString(event.userOpenId);
  const role = normalizeRole(event.role);

  if (!userOpenId || !role) {
    throw makeError('INVALID_INPUT', '缺少用户ID或角色');
  }

  if (role === 'admin') {
    throw makeError('ROLE_IMMUTABLE', '不能移除管理员角色');
  }

  // 查找要移除的绑定
  const bindingRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId,
      role,
      state: 'active',
    })
    .limit(1)
    .get();

  if (!bindingRes.data || bindingRes.data.length === 0) {
    throw makeError('NOT_FOUND', '角色绑定不存在');
  }

  try {
    const now = Date.now();
    await db.collection(ROLE_BINDINGS_COLLECTION)
      .doc(bindingRes.data[0]._id)
      .update({
        data: {
          state: 'removed',
          updatedAt: now,
        },
      });

    // 记录审计日志
    await writeAuditLog(
      { userId: principalId, role: 'admin' },
      'role.remove',
      { type: 'user', id: userOpenId },
      `移除用户 ${userOpenId} 的角色 ${role}`,
      { role }
    );

    return { success: true };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '移除角色绑定失败', error);
  }
}

async function approveRoleRequest(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  if (
    !(await hasActiveRoleBinding(principalId, ['admin', 'social_worker'])) &&
    !(await isAdminByAdminsCollection(principalId))
  ) {
    throw makeError('FORBIDDEN', '无权限审批角色申请');
  }

  const requestId = normalizeString(event.requestId);
  const reason = normalizeString(event.reason || '');

  if (!requestId) {
    throw makeError('INVALID_INPUT', '缺少申请ID');
  }

  await ensureCollectionExists(ROLE_REQUESTS_COLLECTION);

  // 查找申请记录
  const requestRes = await db.collection(ROLE_REQUESTS_COLLECTION)
    .doc(requestId)
    .get();

  if (!requestRes.data) {
    throw makeError('NOT_FOUND', '申请记录不存在');
  }

  const request = requestRes.data;
  if (request.state !== 'pending') {
    throw makeError('INVALID_STATE', '申请已被处理');
  }

  try {
    const now = Date.now();

    // 更新申请状态
    await db.collection(ROLE_REQUESTS_COLLECTION)
      .doc(requestId)
      .update({
        data: {
          state: 'approved',
          reviewerId: principalId,
          reviewedAt: now,
          updatedAt: now,
        },
      });

    // 如果是角色申请，添加角色绑定
    if (request.type === 'role' && request.role) {
      await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);

      // 检查是否已存在绑定
      const existingRes = await db.collection(ROLE_BINDINGS_COLLECTION)
        .where({
          userOpenId: request.applicantOpenId,
          role: request.role,
          state: 'active',
        })
        .limit(1)
        .get();

      if (!existingRes.data || existingRes.data.length === 0) {
      await db.collection(ROLE_BINDINGS_COLLECTION).add({
        data: {
          userOpenId: request.applicantOpenId,
          role: request.role,
          scopeType: request.scopeType || 'global',
          state: 'active',
          createdAt: now,
          createdBy: principalId,
        },
      });
      }
    }

    // 记录审计日志
    await writeAuditLog(
      { userId: principalId, role: 'admin' },
      'role.approve',
      { type: 'roleRequest', id: requestId },
      `通过角色申请：${request.applicantOpenId} -> ${request.role}`,
      { request, reason }
    );

    return { success: true };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '审批申请失败', error);
  }
}

async function rejectRoleRequest(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  if (
    !(await hasActiveRoleBinding(principalId, ['admin', 'social_worker'])) &&
    !(await isAdminByAdminsCollection(principalId))
  ) {
    throw makeError('FORBIDDEN', '无权限审批角色申请');
  }

  const requestId = normalizeString(event.requestId);
  const reason = normalizeString(event.reason || '');

  if (!requestId) {
    throw makeError('INVALID_INPUT', '缺少申请ID');
  }

  if (!reason) {
    throw makeError('INVALID_INPUT', '驳回申请必须填写理由');
  }

  await ensureCollectionExists(ROLE_REQUESTS_COLLECTION);

  // 查找申请记录
  const requestRes = await db.collection(ROLE_REQUESTS_COLLECTION)
    .doc(requestId)
    .get();

  if (!requestRes.data) {
    throw makeError('NOT_FOUND', '申请记录不存在');
  }

  const request = requestRes.data;
  if (request.state !== 'pending') {
    throw makeError('INVALID_STATE', '申请已被处理');
  }

  try {
    const now = Date.now();

    // 更新申请状态
    await db.collection(ROLE_REQUESTS_COLLECTION)
      .doc(requestId)
      .update({
        data: {
          state: 'rejected',
          reason,
          reviewerId: principalId,
          reviewedAt: now,
          updatedAt: now,
        },
      });

    // 记录审计日志
    await writeAuditLog(
      { userId: principalId, role: 'admin' },
      'role.reject',
      { type: 'roleRequest', id: requestId },
      `驳回角色申请：${request.applicantOpenId} -> ${request.role}`,
      { request, reason }
    );

    return { success: true };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '驳回申请失败', error);
  }
}

async function createInvite(event) {
  const perm = await requirePermission(['admin', 'social_worker'], event);

  const role = normalizeRole(event.role);
  const uses = Number(event.uses);
  const expiresAt = Number.isFinite(event.expiresAt) ? event.expiresAt : null;
  const patientId = normalizeString(event.patientId || '');
  const note = normalizeString(event.note || '');

  // 允许创建的角色类型：支持社工/志愿者/家长
  if (!role || !['social_worker', 'volunteer', 'parent'].includes(role)) {
    throw makeError('INVALID_INPUT', '无效的角色类型');
  }

  // 修复验证逻辑：检查使用次数是否为有效正整数
  if (!Number.isInteger(uses) || uses < 1 || uses > 100) {
    throw makeError('INVALID_INPUT', '使用次数必须是1-100之间的正整数');
  }

  await ensureCollectionExists(INVITES_COLLECTION);

  try {
    const code = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
    const now = Date.now();

    const addRes = await db.collection(INVITES_COLLECTION).add({
      data: {
        code,
        role,
        scopeId: patientId || null,
        usesLeft: uses,
        expiresAt: expiresAt || (now + 7 * 24 * 60 * 60 * 1000), // 默认7天
        state: 'active',
        createdBy: perm.principalId,
        createdAt: now,
      },
    });

    // 记录审计日志
    await writeAuditLog(
      { userId: perm.principalId, role: perm.role },
      'invite.create',
      { type: 'invite', id: addRes._id },
      `创建邀请码：${code} (${role})`,
      { code, role, uses, expiresAt, patientId, note }
    );

    const sharePath = `pages/auth/invite-code/index?code=${code}`;
    return {
      success: true,
      data: { code, inviteId: addRes._id, sharePath },
    };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '创建邀请失败', error);
  }
}

async function revokeInvite(event) {
  const perm = await requirePermission(['admin', 'social_worker'], event);

  const inviteId = normalizeString(event.inviteId);

  if (!inviteId) {
    throw makeError('INVALID_INPUT', '缺少邀请ID');
  }

  await ensureCollectionExists(INVITES_COLLECTION);

  // 查找邀请记录
  const inviteRes = await db.collection(INVITES_COLLECTION)
    .doc(inviteId)
    .get();

  if (!inviteRes.data) {
    throw makeError('NOT_FOUND', '邀请记录不存在');
  }

  const invite = inviteRes.data;
  if (invite.state !== 'active') {
    throw makeError('INVALID_STATE', '邀请已被撤销或已过期');
  }

  try {
    const now = Date.now();

    await db.collection(INVITES_COLLECTION)
      .doc(inviteId)
      .update({
        data: {
          state: 'revoked',
          updatedAt: now,
        },
      });

    // 记录审计日志
    await writeAuditLog(
      { userId: perm.principalId, role: perm.role },
      'invite.revoke',
      { type: 'invite', id: inviteId },
      `撤销邀请码：${invite.code}`,
      { code: invite.code }
    );

    return { success: true };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '撤销邀请失败', error);
  }
}

async function listInvites(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }
  if (
    !(await hasActiveRoleBinding(principalId, ['admin', 'social_worker'])) &&
    !(await isAdminByAdminsCollection(principalId))
  ) {
    throw makeError('FORBIDDEN', '无权限查看邀请');
  }

  await ensureCollectionExists(INVITES_COLLECTION);

  const page = Math.max(Number(event.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize) || 20, 1), 100);
  const role = normalizeRole(event.role || '');
  const state = normalizeString(event.state || '');

  let query = {};
  if (role) {
    query.role = role;
  }
  if (state) {
    query.state = state;
  }

  try {
    const countRes = await db.collection(INVITES_COLLECTION).where(query).count();
    const total = countRes.total;

    const dataRes = await db.collection(INVITES_COLLECTION)
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const docs = dataRes.data || [];
    const items = docs.map(invite => ({
      id: invite._id,
      code: invite.code,
      role: invite.role,
      scopeId: invite.scopeId,
      usesLeft: invite.usesLeft,
      expiresAt: invite.expiresAt,
      state: invite.state,
      createdBy: invite.createdBy,
      createdAt: invite.createdAt,
      qrFileId: invite.qrFileId || '',
      qrUpdatedAt: invite.qrUpdatedAt || null,
      sharePath: `pages/auth/invite-code/index?code=${(invite.code || '').toUpperCase()}`,
    }));

    // 为已有二维码的邀请生成临时 URL，便于管理端直接显示缩略图
    const fileIdMap = new Map();
    items.forEach(it => { if (it.qrFileId) fileIdMap.set(it.qrFileId, null); });
    if (fileIdMap.size > 0) {
      try {
        const tmp = await cloud.getTempFileURL({ fileList: Array.from(fileIdMap.keys()) });
        const list = (tmp && tmp.fileList) || [];
        list.forEach(entry => {
          if (entry && entry.fileID) {
            fileIdMap.set(entry.fileID, entry.tempFileURL || '');
          }
        });
        items.forEach(it => {
          if (it.qrFileId) {
            it.qrUrl = fileIdMap.get(it.qrFileId) || '';
          }
        });
      } catch (e) {
        // 不阻塞列表返回
      }
    }

    return { success: true, data: { items, total } };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '查询邀请列表失败', error);
  }
}

// 生成邀请二维码（小程序码）：仅管理员/社工可用
async function generateInviteQr(event) {
  const perm = await requirePermission(['admin', 'social_worker'], event);
  const { wxContext } = perm || {};

  const inviteId = normalizeString(event.inviteId);
  if (!inviteId) {
    throw makeError('INVALID_INPUT', '缺少邀请ID');
  }

  await ensureCollectionExists(INVITES_COLLECTION);
  // 读取邀请
  const docRes = await db.collection(INVITES_COLLECTION).doc(inviteId).get();
  const invite = docRes && docRes.data;
  if (!invite) {
    throw makeError('NOT_FOUND', '邀请记录不存在');
  }
  if (invite.state !== 'active') {
    throw makeError('INVALID_STATE', '仅支持为有效邀请生成二维码');
  }

  const code = String(invite.code || '').toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    throw makeError('INVALID_INVITE_CODE', '邀请码格式不正确');
  }

  // 生成小程序码
  try {
    const scene = `i:${code}`; // 仅携带邀请码
    const page = 'pages/auth/invite-code/index';
    const requestPayload = {
      scene,
      page,
      check_path: false,
      env_version: 'develop',
      width: 430,
      is_hyaline: true,
      auto_color: false,
      line_color: { r: 0, g: 0, b: 0 },
    };

    let qrBuffer = null;
    let qrContentType = 'image/png';

    if (wxContext && wxContext.wxCloudApiToken) {
      cloud.updateConfig({ wxCloudApiToken: wxContext.wxCloudApiToken });
      const qr = await cloud.openapi.wxacode.getUnlimited(requestPayload);
      qrBuffer = qr && (qr.buffer || qr.fileContent || qr.Body);
      qrContentType = qr && qr.contentType ? qr.contentType : qrContentType;
    } else {
      const qr = await generateQrViaWechatApi(requestPayload);
      qrBuffer = qr.buffer;
      qrContentType = qr.contentType || qrContentType;
    }

    if (!qrBuffer || !qrBuffer.length) {
      throw makeError('QR_GENERATE_FAILED', '二维码数据为空');
    }

    const now = Date.now();
    const cloudPath = `invite-qrcode/${inviteId}.png`;
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: Buffer.from(qrBuffer),
    });

    const fileId = uploadRes && uploadRes.fileID;
    if (!fileId) {
      throw makeError('UPLOAD_FAILED', '二维码上传失败');
    }

    // 写回邀请记录
    await db.collection(INVITES_COLLECTION).doc(inviteId).update({
      data: { qrFileId: fileId, qrUpdatedAt: now },
    });

    // 取临时链接
    let url = '';
    try {
      const tmp = await cloud.getTempFileURL({ fileList: [fileId] });
      const list = tmp && tmp.fileList;
      if (Array.isArray(list) && list.length && list[0].tempFileURL) {
        url = list[0].tempFileURL;
      }
    } catch (_) {}

    // 审计
    await writeAuditLog(
      { userId: perm.principalId, role: perm.role },
      'invite.qr',
      { type: 'invite', id: inviteId },
      `生成邀请码二维码：${code}`,
      { fileId }
    );

    return { success: true, data: { fileId, url } };
  } catch (error) {
    throw makeError('QR_GENERATE_FAILED', '生成二维码失败', error);
  }
}

async function listRoleRequests(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  if (
    !(await hasActiveRoleBinding(principalId, ['admin', 'social_worker'])) &&
    !(await isAdminByAdminsCollection(principalId))
  ) {
    throw makeError('FORBIDDEN', '无权限查看角色申请');
  }

  await ensureCollectionExists(ROLE_REQUESTS_COLLECTION);

  const state = normalizeString(event.state) || '';
  const page = Math.max(Number(event.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize) || 20, 1), 100);

  let query = {};
  if (state) {
    query.state = state;
  }

  try {
    const countRes = await db.collection(ROLE_REQUESTS_COLLECTION).where(query).count();
    const total = countRes.total;

    const dataRes = await db.collection(ROLE_REQUESTS_COLLECTION)
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const items = (dataRes.data || []).map(request => ({
      id: request._id,
      applicantOpenId: request.applicantOpenId,
      type: request.type,
      role: request.role,
      scopeType: request.scopeType,
      scopeId: request.scopeId,
      state: request.state,
      attachments: request.attachments || [],
      reason: request.reason || '',
      reviewerId: request.reviewerId || '',
      reviewedAt: request.reviewedAt || null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    }));

    return { success: true, data: { items, total } };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '查询角色申请失败', error);
  }
}

// 用户资料更新
async function updateProfile(event) {
  const { principalId } = resolveAuthContext(event);
  const { profile } = event;

  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 验证必填字段
  if (!profile || !profile.realName || !profile.phone) {
    throw makeError('INVALID_INPUT', '缺少必填字段');
  }

  // 手机号格式验证
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(profile.phone)) {
    throw makeError('INVALID_INPUT', '手机号格式不正确');
  }

  // 姓名格式验证
  if (profile.realName.length < 2 || profile.realName.length > 20) {
    throw makeError('INVALID_INPUT', '姓名长度应在2-20个字符之间');
  }

  await ensureCollectionExists(USERS_COLLECTION);

  try {
    const now = Date.now();
    const updateData = {
      profile: { ...profile },
      updatedAt: now
    };

    // 如果是首次完善资料，记录完善时间
    const userRes = await db.collection(USERS_COLLECTION)
      .where({ openid: principalId })
      .get();

    if (userRes.data && userRes.data.length > 0) {
      const user = userRes.data[0];
      if (!user.profile || !user.profile.realName) {
        updateData.profileCompletedAt = now;
      }
    }

    await db.collection(USERS_COLLECTION)
      .where({ openid: principalId })
      .update({ data: updateData });

    // 记录审计日志
    await writeAuditLog(
      { userId: principalId, role: 'user' },
      'profile.update',
      { type: 'user', id: principalId },
      '更新个人资料',
      { profile }
    );

    return { success: true };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '更新资料失败', error);
  }
}

// 邀请码验证
async function validateInviteCode(event) {
  const { principalId } = resolveAuthContext(event);
  const { code } = event;

  if (!code || code.length !== 8) {
    throw makeError('INVALID_INPUT', '邀请码格式不正确');
  }

  await ensureCollectionExists(INVITES_COLLECTION);

  try {
    // 查询邀请码
    const inviteRes = await db.collection(INVITES_COLLECTION)
      .where({
        code: code.toUpperCase(),
        state: 'active'
      })
      .limit(1)
      .get();

    if (!inviteRes.data || inviteRes.data.length === 0) {
      return {
        success: true,
        data: {
          valid: false,
          reason: 'not_found'
        }
      };
    }

    const invite = inviteRes.data[0];

    // 检查是否已过期
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      return {
        success: true,
        data: {
          valid: false,
          reason: 'expired'
        }
      };
    }

    // 检查使用次数
    if (invite.usesLeft <= 0) {
      return {
        success: true,
        data: {
          valid: false,
          reason: 'exhausted'
        }
      };
    }

    // 检查用户是否已经使用过此邀请码
    await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
    const existingBinding = await db.collection(ROLE_BINDINGS_COLLECTION)
      .where({
        userOpenId: principalId,
        inviteId: invite._id,
        state: 'active'
      })
      .limit(1)
      .get();

    if (existingBinding.data && existingBinding.data.length > 0) {
      return {
        success: true,
        data: {
          valid: false,
          reason: 'already_used'
        }
      };
    }

    return {
      success: true,
      data: {
        valid: true,
        role: invite.role,
        inviteId: invite._id
      }
    };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '验证邀请码失败', error);
  }
}

// 使用邀请码
async function useInviteCode(event) {
  const { principalId } = resolveAuthContext(event);
  const { code } = event;

  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  await ensureCollectionExists(INVITES_COLLECTION);
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);

  // 使用事务以避免并发超发
  try {
    const txResult = await db.runTransaction(async transaction => {
      const now = Date.now();
      const upper = String(code || '').toUpperCase();

      // 读取并校验邀请码
      const inviteQuery = await transaction
        .collection(INVITES_COLLECTION)
        .where({ code: upper, state: 'active' })
        .limit(1)
        .get();
      if (!inviteQuery.data || inviteQuery.data.length === 0) {
        throw makeError('INVALID_INVITE_CODE', '邀请码不存在或未激活');
      }
      const invite = inviteQuery.data[0];

      if (invite.expiresAt && invite.expiresAt < now) {
        throw makeError('INVALID_INVITE_CODE', '邀请码已过期');
      }
      if (!Number.isFinite(invite.usesLeft) || invite.usesLeft <= 0) {
        throw makeError('INVALID_INVITE_CODE', '邀请码使用次数已用完');
      }

      // 防止重复使用同一邀请码
      const existBind = await transaction
        .collection(ROLE_BINDINGS_COLLECTION)
        .where({ userOpenId: principalId, inviteId: invite._id, state: 'active' })
        .limit(1)
        .get();
      if (existBind.data && existBind.data.length > 0) {
        throw makeError('INVALID_INVITE_CODE', '该邀请码已被当前用户使用');
      }

      // 创建角色绑定
      await transaction.collection(ROLE_BINDINGS_COLLECTION).add({
        data: {
          userOpenId: principalId,
          role: invite.role,
          scopeType: 'global',
          state: 'active',
          inviteId: invite._id,
          createdAt: now,
          createdBy: 'invite_code',
        },
      });

      // 扣减次数
      await transaction.collection(INVITES_COLLECTION).doc(invite._id).update({
        data: {
          usesLeft: _.inc(-1),
          updatedAt: now,
        },
      });

      return { role: invite.role, inviteId: invite._id };
    });

    // 审计日志（事务外记录）
    await writeAuditLog(
      { userId: principalId, role: 'user' },
      'role.activate',
      { type: 'user', id: principalId },
      `通过邀请码激活角色：${txResult.role}`,
      { code, role: txResult.role, inviteId: txResult.inviteId }
    );

    return { success: true, role: txResult.role, data: { role: txResult.role } };
  } catch (error) {
    // 标准化错误输出
    if (error && error.code && String(error.code).startsWith('INVALID_INVITE_CODE')) {
      throw error;
    }
    throw makeError('DATABASE_ERROR', '激活邀请码失败', error);
  }
}

// 提交角色申请
async function submitRoleApplication(event) {
  const { principalId } = resolveAuthContext(event);
  const { role, reason, attachments } = event;

  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  if (!role || !reason) {
    throw makeError('INVALID_INPUT', '缺少申请角色或申请理由');
  }

  if (!['social_worker', 'volunteer', 'parent'].includes(role)) {
    throw makeError('INVALID_INPUT', '不支持的角色类型');
  }

  if (reason.length < 10 || reason.length > 500) {
    throw makeError('INVALID_INPUT', '申请理由长度应在10-500个字符之间');
  }

  await ensureCollectionExists(ROLE_REQUESTS_COLLECTION);
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);

  // 检查是否已有相同角色的激活绑定
  const existingBinding = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: principalId,
      role,
      state: 'active'
    })
    .limit(1)
    .get();

  if (existingBinding.data && existingBinding.data.length > 0) {
    throw makeError('ALREADY_HAS_ROLE', '您已拥有该角色');
  }

  // 检查是否已有待审核的申请
  const existingRequest = await db.collection(ROLE_REQUESTS_COLLECTION)
    .where({
      applicantOpenId: principalId,
      role,
      state: 'pending'
    })
    .limit(1)
    .get();

  if (existingRequest.data && existingRequest.data.length > 0) {
    throw makeError('PENDING_APPLICATION', '您已有该角色的待审核申请');
  }

  try {
    const now = Date.now();

    // 创建申请记录
    const addRes = await db.collection(ROLE_REQUESTS_COLLECTION).add({
      data: {
        applicantOpenId: principalId,
        type: 'role',
        role,
        reason,
        attachments: attachments || [],
        state: 'pending',
        createdAt: now,
        updatedAt: now
      }
    });

    // 记录审计日志
    await writeAuditLog(
      { userId: principalId, role: 'user' },
      'role.apply',
      { type: 'roleRequest', id: addRes._id },
      `提交角色申请：${role}`,
      { role, reason, attachments }
    );

    return {
      success: true,
      applicationId: addRes._id
    };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '提交申请失败', error);
  }
}

// 获取申请状态
async function getApplicationStatus(event) {
  const { principalId } = resolveAuthContext(event);

  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  await ensureCollectionExists(ROLE_REQUESTS_COLLECTION);

  try {
    const res = await db.collection(ROLE_REQUESTS_COLLECTION)
      .where({
        applicantOpenId: principalId
      })
      .orderBy('createdAt', 'desc')
      .get();

    const applications = (res.data || []).map(app => ({
      id: app._id,
      role: app.role,
      reason: app.reason,
      state: app.state,
      reviewMessage: app.reviewMessage || '',
      reviewedAt: app.reviewedAt || null,
      createdAt: app.createdAt
    }));

    return {
      success: true,
      data: { applications }
    };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '获取申请状态失败', error);
  }
}

// 撤销角色申请（申请人自助）
async function cancelApplication(event) {
  const { principalId } = resolveAuthContext(event);

  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  const applicationId = normalizeString(event.applicationId);
  if (!applicationId) {
    throw makeError('INVALID_INPUT', '缺少申请ID');
  }

  await ensureCollectionExists(ROLE_REQUESTS_COLLECTION);

  // 读取申请记录
  const reqRes = await db.collection(ROLE_REQUESTS_COLLECTION).doc(applicationId).get();
  if (!reqRes.data) {
    throw makeError('NOT_FOUND', '申请记录不存在');
  }
  const request = reqRes.data;

  if (request.applicantOpenId !== principalId) {
    throw makeError('FORBIDDEN', '无权撤销他人申请');
  }
  if (request.state !== 'pending') {
    throw makeError('INVALID_STATE', '申请已处理，无法撤销');
  }

  try {
    const now = Date.now();
    await db.collection(ROLE_REQUESTS_COLLECTION).doc(applicationId).update({
      data: { state: 'cancelled', cancelledAt: now, updatedAt: now },
    });

    await writeAuditLog(
      { userId: principalId, role: 'user' },
      'role.cancel',
      { type: 'roleRequest', id: applicationId },
      `撤销角色申请：${request.role}`,
      { request }
    );

    return { success: true };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '撤销申请失败', error);
  }
}

// 管理员修改用户角色（覆盖式）
async function modifyUserRoles(event) {
  const { principalId } = resolveAuthContext(event);
  if (!principalId) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }
  // 仅管理员可修改
  if (!(await hasActiveRoleBinding(principalId, ['admin'])) && !(await isAdminByAdminsCollection(principalId))) {
    throw makeError('FORBIDDEN', '只有管理员可以修改用户角色');
  }

  const userId = normalizeString(event.userId);
  let roles = Array.isArray(event.roles) ? event.roles : [];
  const reason = normalizeString(event.reason || '');

  if (!userId) {
    throw makeError('INVALID_INPUT', '缺少用户ID');
  }

  // 允许分配的角色（与申请/邀请码一致）
  const ALLOWED_ROLES = ['social_worker', 'volunteer', 'parent'];
  roles = roles.filter(r => ALLOWED_ROLES.includes(String(r)));

  await ensureCollectionExists(USERS_COLLECTION);
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);

  // 解析用户 openid（优先以 _id 查询，不存在则按 openid 处理）
  let openid = '';
  try {
    const byId = await db.collection(USERS_COLLECTION).doc(userId).get();
    if (byId && byId.data) {
      openid = byId.data.openid || '';
    }
  } catch (_) {}
  if (!openid) {
    const byOpen = await db.collection(USERS_COLLECTION).where({ openid: userId }).limit(1).get();
    if (byOpen.data && byOpen.data.length > 0) {
      openid = byOpen.data[0].openid || '';
    }
  }
  if (!openid) {
    throw makeError('USER_NOT_FOUND', '未找到目标用户');
  }

  // 当前有效角色
  const now = Date.now();
  const currentRes = await db
    .collection(ROLE_BINDINGS_COLLECTION)
    .where({ userOpenId: openid, state: 'active', expiresAt: _.or(_.exists(false), _.gt(now)) })
    .get();
  const current = new Set((currentRes.data || []).map(b => b.role));
  const desired = new Set(roles);

  const toAdd = [...desired].filter(r => !current.has(r));
  const toRemove = [...current].filter(r => !desired.has(r));

  try {
    // 添加
    for (const role of toAdd) {
      await db.collection(ROLE_BINDINGS_COLLECTION).add({
        data: {
          userOpenId: openid,
          role,
          scopeType: 'global',
          state: 'active',
          createdAt: now,
          createdBy: principalId,
        },
      });
    }

    // 移除
    for (const role of toRemove) {
      const bind = await db
        .collection(ROLE_BINDINGS_COLLECTION)
        .where({ userOpenId: openid, role, state: 'active' })
        .limit(1)
        .get();
      if (bind.data && bind.data.length > 0) {
        await db.collection(ROLE_BINDINGS_COLLECTION).doc(bind.data[0]._id).update({
          data: { state: 'removed', updatedAt: now },
        });
      }
    }

    await writeAuditLog(
      { userId: principalId, role: 'admin' },
      'role.modify',
      { type: 'user', id: openid },
      `修改用户角色：${openid}`,
      { added: toAdd, removed: toRemove, reason }
    );

    return { success: true, data: { added: toAdd, removed: toRemove } };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '修改用户角色失败', error);
  }
}

exports.main = async (event = {}) => {
  const action = String(event.action || '');

  try {
    switch (action) {
      case 'getCurrentUser':
        return await getCurrentUser(event);
      case 'updateProfile':
        return await updateProfile(event);
      case 'validateInviteCode':
        return await validateInviteCode(event);
      case 'useInviteCode':
        return await useInviteCode(event);
      case 'submitRoleApplication':
        return await submitRoleApplication(event);
      case 'getApplicationStatus':
        return await getApplicationStatus(event);
      case 'listUsers':
        return await listUsers(event);
      case 'listRoleBindings':
        return await listRoleBindings(event);
      case 'addRoleBinding':
        return await addRoleBinding(event);
      case 'removeRoleBinding':
        return await removeRoleBinding(event);
      case 'listRoleRequests':
        return await listRoleRequests(event);
      case 'approveRoleRequest':
        return await approveRoleRequest(event);
      case 'rejectRoleRequest':
        return await rejectRoleRequest(event);
      case 'createInvite':
        return await createInvite(event);
      case 'revokeInvite':
        return await revokeInvite(event);
      case 'listInvites':
        return await listInvites(event);
      case 'generateInviteQr':
        return await generateInviteQr(event);
      case 'cancelApplication':
        return await cancelApplication(event);
      case 'modifyUserRoles':
        return await modifyUserRoles(event);
      default:
        throw makeError('UNSUPPORTED_ACTION', `Unsupported action: ${action}`);
    }
  } catch (error) {
    console.error('rbac action failed', action, error);
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
