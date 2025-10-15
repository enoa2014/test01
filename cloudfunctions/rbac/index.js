const cloud = require('wx-server-sdk');
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

async function getCurrentUser(event) {
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  const openid = wxContext.OPENID;

  await ensureCollectionExists(USERS_COLLECTION);
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);

  let user = null;
  try {
    const res = await db.collection(USERS_COLLECTION).where({ openid }).limit(1).get();
    user = (res && res.data && res.data[0]) || null;
  } catch (error) {
    user = null;
  }

  if (!user) {
    // 如果用户不存在，创建基本用户记录
    const now = Date.now();
    const createRes = await db.collection(USERS_COLLECTION).add({
      data: {
        openid,
        status: 'active',
        lastLoginAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    user = { _id: createRes._id, openid, status: 'active', lastLoginAt: now };
  }

  // 获取用户角色
  let roles = [];
  try {
    const res = await db.collection(ROLE_BINDINGS_COLLECTION)
      .where({
        userOpenId: openid,
        state: 'active',
        expiresAt: _.or(_.exists(false), _.gt(Date.now())),
      })
      .get();
    roles = (res.data || []).map(binding => binding.role);
  } catch (error) {
    roles = [];
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
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限 - 只有admin可以查看用户列表
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: 'admin',
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
    // 检查是否为social_worker（只读权限）
    const workerRes = await db.collection(ROLE_BINDINGS_COLLECTION)
      .where({
        userOpenId: wxContext.OPENID,
        state: 'active',
        role: 'social_worker',
      })
      .limit(1)
      .get();

    if (!workerRes.data || workerRes.data.length === 0) {
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
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: _.in(['admin', 'social_worker']),
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
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
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 只有admin可以添加角色绑定
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: 'admin',
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
    throw makeError('FORBIDDEN', '只有管理员可以添加角色绑定');
  }

  const userOpenId = normalizeString(event.userOpenId);
  const role = normalizeString(event.role);
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
        createdBy: wxContext.OPENID,
      },
    });

    // 记录审计日志
    await writeAuditLog(
      { userId: wxContext.OPENID, role: 'admin' },
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
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 只有admin可以移除角色绑定
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: 'admin',
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
    throw makeError('FORBIDDEN', '只有管理员可以移除角色绑定');
  }

  const userOpenId = normalizeString(event.userOpenId);
  const role = normalizeString(event.role);

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
      { userId: wxContext.OPENID, role: 'admin' },
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
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: _.in(['admin', 'social_worker']),
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
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
          reviewerId: wxContext.OPENID,
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
            createdBy: wxContext.OPENID,
          },
        });
      }
    }

    // 记录审计日志
    await writeAuditLog(
      { userId: wxContext.OPENID, role: roleRes.data[0].role },
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
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: _.in(['admin', 'social_worker']),
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
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
          reviewerId: wxContext.OPENID,
          reviewedAt: now,
          updatedAt: now,
        },
      });

    // 记录审计日志
    await writeAuditLog(
      { userId: wxContext.OPENID, role: roleRes.data[0].role },
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
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: _.in(['admin', 'social_worker']),
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
    throw makeError('FORBIDDEN', '无权限创建邀请');
  }

  const role = normalizeString(event.role);
  const uses = Math.max(Number(event.uses) || 1, 1);
  const expiresAt = Number.isFinite(event.expiresAt) ? event.expiresAt : null;
  const patientId = normalizeString(event.patientId || '');
  const note = normalizeString(event.note || '');

  if (!role || !['volunteer', 'parent'].includes(role)) {
    throw makeError('INVALID_INPUT', '无效的角色类型');
  }

  if (uses > 100) {
    throw makeError('INVALID_INPUT', '使用次数不能超过100');
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
        createdBy: wxContext.OPENID,
        createdAt: now,
      },
    });

    // 记录审计日志
    await writeAuditLog(
      { userId: wxContext.OPENID, role: roleRes.data[0].role },
      'invite.create',
      { type: 'invite', id: addRes._id },
      `创建邀请码：${code} (${role})`,
      { code, role, uses, expiresAt, patientId, note }
    );

    return {
      success: true,
      data: { code, inviteId: addRes._id },
    };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '创建邀请失败', error);
  }
}

async function revokeInvite(event) {
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: _.in(['admin', 'social_worker']),
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
    throw makeError('FORBIDDEN', '无权限撤销邀请');
  }

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
      { userId: wxContext.OPENID, role: roleRes.data[0].role },
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
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: _.in(['admin', 'social_worker']),
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
    throw makeError('FORBIDDEN', '无权限查看邀请');
  }

  await ensureCollectionExists(INVITES_COLLECTION);

  const page = Math.max(Number(event.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize) || 20, 1), 100);
  const role = normalizeString(event.role || '');
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

    const items = (dataRes.data || []).map(invite => ({
      id: invite._id,
      code: invite.code,
      role: invite.role,
      scopeId: invite.scopeId,
      usesLeft: invite.usesLeft,
      expiresAt: invite.expiresAt,
      state: invite.state,
      createdBy: invite.createdBy,
      createdAt: invite.createdAt,
    }));

    return { success: true, data: { items, total } };
  } catch (error) {
    throw makeError('DATABASE_ERROR', '查询邀请列表失败', error);
  }
}

async function listRoleRequests(event) {
  const wxContext = cloud.getWXContext();
  if (!wxContext || !wxContext.OPENID) {
    throw makeError('UNAUTHORIZED', '未登录或登录态无效');
  }

  // 检查权限
  await ensureCollectionExists(ROLE_BINDINGS_COLLECTION);
  const roleRes = await db.collection(ROLE_BINDINGS_COLLECTION)
    .where({
      userOpenId: wxContext.OPENID,
      state: 'active',
      role: _.in(['admin', 'social_worker']),
    })
    .limit(1)
    .get();

  if (!roleRes.data || roleRes.data.length === 0) {
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

exports.main = async (event = {}) => {
  const action = String(event.action || '');

  try {
    switch (action) {
      case 'getCurrentUser':
        return await getCurrentUser(event);
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