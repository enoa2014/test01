// 云函数入口文件
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const tcb = require('@cloudbase/node-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 权限矩阵配置
const PERMISSION_MATRIX = {
  guest: {
    pages: ['dashboard-public', 'statistics-public'],
    actions: ['read', 'search', 'filter'],
    data: {
      patientData: 'masked',
      exportData: false,
      deleteData: false,
      editData: false,
      dataScope: 'public'
    },
    timeRestrictions: {
      allowedHours: [9, 10, 11, 14, 15, 16, 17],
      allowedDays: [1, 2, 3, 4, 5]
    },
    sessionTimeout: 30 * 60 * 1000
  },
  parent: {
    pages: ['dashboard-parent', 'patient-detail-child', 'care-log-child'],
    actions: ['read', 'search', 'filter', 'comment'],
    data: {
      patientData: 'filtered',
      exportData: false,
      deleteData: false,
      editData: false,
      dataScope: 'personal',
      dataFilters: {
        childrenIds: []
      }
    },
    timeRestrictions: {
      allowedHours: [8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20],
      allowedDays: [1, 2, 3, 4, 5, 6, 7]
    },
    sessionTimeout: 2 * 60 * 60 * 1000
  },
  volunteer: {
    pages: ['dashboard-volunteer', 'task-list', 'patient-basic'],
    actions: ['read', 'search', 'filter', 'task-log', 'comment'],
    data: {
      patientData: 'limited',
      exportData: false,
      deleteData: false,
      editData: false,
      dataScope: 'assigned',
      dataFilters: {
        patientIds: [],
        taskIds: []
      }
    },
    timeRestrictions: {
      allowedHours: [8, 9, 10, 11, 14, 15, 16, 17],
      allowedDays: [1, 2, 3, 4, 5, 6]
    },
    sessionTimeout: 4 * 60 * 60 * 1000
  },
  social_worker: {
    pages: ['dashboard-sw', 'patient-list', 'patient-detail', 'care-log', 'analysis'],
    actions: ['read', 'search', 'filter', 'create', 'edit', 'export', 'assign'],
    data: {
      patientData: 'department',
      exportData: true,
      deleteData: false,
      editData: true,
      dataScope: 'department',
      dataFilters: {
        departmentId: '',
        assignedPatients: []
      }
    },
    timeRestrictions: {
      allowedHours: [7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21],
      allowedDays: [1, 2, 3, 4, 5, 6, 7]
    },
    sessionTimeout: 8 * 60 * 60 * 1000
  },
  admin: {
    pages: '*',
    actions: '*',
    data: {
      patientData: 'full',
      exportData: true,
      deleteData: true,
      editData: true,
      dataScope: 'all',
      adminActions: ['user_manage', 'role_assign', 'system_config']
    },
    timeRestrictions: {
      allowedHours: Array.from({length: 24}, (_, i) => i),
      allowedDays: [1, 2, 3, 4, 5, 6, 7]
    },
    sessionTimeout: 24 * 60 * 60 * 1000
  }
}

// 云函数主入口
exports.main = async (event, context) => {
  const { action } = event

  try {
    switch (action) {
      case 'qrInit':
        return await handleQRInit(event)
      case 'qrStatus':
        return await handleQRStatus(event)
      case 'qrApprove':
        return await handleQRApprove(event)
      case 'qrCancel':
        return await handleQRCancel(event)
      case 'parseQR':
        return await handleParseQR(event)
      default:
        return {
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: '无效的操作类型'
          }
        }
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      }
    }
  }
}

// 生成二维码会话
async function handleQRInit(event) {
  const { type = 'admin', deviceInfo, metadata, roleFilters } = event
  const now = Date.now()
  const expiresIn = 90 * 1000 // 90秒过期
  const expiresAt = now + expiresIn

  // 生成会话ID和nonce
  const sessionId = generateSessionId()
  const nonce = generateNonce()
  const nonceHash = hashNonce(nonce)

  // 统一登录/授权参数
  const autoBind = Boolean(event && event.autoBind)
  const createdBy = (event && (event.__principalId || event.principalId || event.actorId || '')) || ''
  // 若 type 为具体角色而非 multi，将其作为默认的 requiredRole
  const allowedRoles = ['admin', 'social_worker', 'volunteer', 'parent', 'guest']
  const requiredRole = allowedRoles.includes(String(type)) && type !== 'multi' ? String(type) : ''

  // 构建会话数据
  const sessionData = {
    _id: sessionId,
    type,
    status: 'pending',
    nonceHash,
    usedNonces: [],
    createdAt: now,
    expiresAt,
    meta: {
      ip: cloud.getWXContext().CLIENTIP,
      ua: deviceInfo?.userAgent || '',
      createdFrom: metadata?.source || 'web_admin',
      ...metadata
    },
    ...(roleFilters && { roleFilters }),
    // 新增：统一化自动授权登录参数
    autoBind,
    createdBy, // Web 管理端发起者（用于在 RBAC 中鉴权）
    ...(requiredRole ? { requiredRole } : {})
  }

  // 保存会话到数据库
  await ensureCollectionExists('qrLoginSessions')
  await db.collection('qrLoginSessions').add({
    data: sessionData
  })

  // 生成二维码数据（仅包含sessionId）
  const qrData = JSON.stringify({
    sid: sessionId,
    ts: now,
    sig: generateSignature(sessionId, now)
  })

  // 加密二维码数据
  const encryptedQRData = encryptQRData(qrData)

  return {
    success: true,
    data: {
      sessionId,
      qrData: encryptedQRData,
      // 返回一次性 nonce（与 nonceHash 对应），供前端轮询时携带
      nonce,
      expiresAt,
      expiresIn: Math.floor(expiresIn / 1000),
      pollingInterval: 2000
    }
  }
}

// 检查二维码状态
async function handleQRStatus(event) {
  const { sessionId, nonce } = event

  if (!sessionId) {
    return {
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: '缺少会话ID'
      }
    }
  }

  try {
    // 查询会话信息
    const sessionRecord = await db.collection('qrLoginSessions')
      .doc(sessionId)
      .get()

    if (!sessionRecord.data) {
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: '会话不存在'
        }
      }
    }

    const session = sessionRecord.data

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      await updateSessionStatus(sessionId, 'expired')
      return {
        success: true,
        data: {
          status: 'expired',
          message: '二维码已过期',
          expiredAt: session.expiresAt
        }
      }
    }

    // 验证并轮换 nonce（可选增强）：客户端若携带 nonce，校验当前 nonceHash，校验通过则生成新的 nonce，并更新存库
    let nextNonce = null
    if (nonce) {
      const expectedHash = hashNonce(nonce)
      if (!verifyNonce(nonce, session.nonceHash)) {
        return {
          success: false,
          error: { code: 'INVALID_NONCE', message: '无效的安全令牌' }
        }
      }
      nextNonce = generateNonce()
      // 严格单次消费：仅当当前 nonceHash 匹配时更新，避免并发重放
      const updateRes = await db.collection('qrLoginSessions')
        .where({ _id: sessionId, nonceHash: expectedHash })
        .update({
          data: {
            nonceHash: hashNonce(nextNonce),
            lastNonceRotatedAt: Date.now(),
            usedNonces: _.push(expectedHash)
          }
        })
      if (!updateRes || !updateRes.stats || updateRes.stats.updated < 1) {
        return {
          success: false,
          error: { code: 'INVALID_NONCE', message: '安全令牌已失效或已被使用' }
        }
      }
    }

    // 根据状态返回相应信息
    switch (session.status) {
      case 'pending':
        return {
          success: true,
          data: {
            status: 'pending',
            message: '等待扫码...',
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
            ...(nextNonce ? { nonce: nextNonce } : {})
          }
        }

      case 'approved':
        // 检查是否已经领取过ticket
        if (session.ticket && !session.ticketConsumed) {
          const ticketData = session.ticket
          // 标记ticket为已消费
          await db.collection('qrLoginSessions')
            .doc(sessionId)
            .update({
              data: {
                status: 'consumed',
                ticketConsumed: true,
                consumedAt: Date.now()
              }
            })

          return {
            success: true,
            data: {
              status: 'confirmed',
              message: '登录成功',
              loginTicket: ticketData.ticket,
              userInfo: ticketData.userInfo,
              sessionInfo: {
                sessionId,
                loginMode: ticketData.loginMode,
                expiresAt: session.expiresAt,
                refreshToken: ticketData.refreshToken
              },
              redirectTo: getRedirectUrl(ticketData.userInfo.role),
              confirmedAt: session.approvedAt,
              ...(nextNonce ? { nonce: nextNonce } : {})
            }
          }
        } else {
          return {
            success: true,
            data: {
              status: 'consumed',
              message: '登录凭证已使用',
              ...(nextNonce ? { nonce: nextNonce } : {})
            }
          }
        }

      case 'cancelled':
        return {
          success: true,
          data: {
            status: 'cancelled',
            message: '用户取消登录',
            reason: session.cancelReason || 'user_cancelled',
            cancelledAt: session.cancelledAt,
            ...(nextNonce ? { nonce: nextNonce } : {})
          }
        }

      default:
        return {
          success: true,
          data: {
            status: session.status,
            message: getStatusMessage(session.status),
            ...(nextNonce ? { nonce: nextNonce } : {})
          }
        }
    }
  } catch (error) {
    console.error('检查状态失败:', error)
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '检查状态失败'
      }
    }
  }
}

// 确认登录
async function handleQRApprove(event) {
  const { sessionId, userInfo, loginMode, deviceInfo, securityToken, approveNonce } = event
  const wxContext = cloud.getWXContext()

  if (!sessionId || !userInfo) {
    return {
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: '缺少必要参数'
      }
    }
  }

  try {
    // 查询会话
    const sessionRecord = await db.collection('qrLoginSessions')
      .doc(sessionId)
      .get()

    if (!sessionRecord.data) {
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: '会话不存在'
        }
      }
    }

    const session = sessionRecord.data

    // 检查会话状态
    if (session.status !== 'pending') {
      return {
        success: false,
        error: {
          code: 'INVALID_SESSION_STATUS',
          message: '会话状态无效'
        }
      }
    }

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      await updateSessionStatus(sessionId, 'expired')
      return {
        success: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: '会话已过期'
        }
      }
    }

    // 严格校验小程序审批 nonce（来自 parseQR 下发）
    if (!approveNonce || !verifyNonce(approveNonce, session.approveNonceHash)) {
      return {
        success: false,
        error: {
          code: 'INVALID_APPROVE_NONCE',
          message: '审批令牌无效或缺失'
        }
      }
    }

    // 获取用户角色和权限
    let userRoles = await getUserRoles(wxContext.OPENID)

    // 若会话启用了自动绑定，且会话携带目标角色（或小程序端选择了角色），尝试在权限不足时先授予角色
    // 仅对非 admin 角色生效，由 RBAC 云函数校验创建者权限
    let targetRole = (session.requiredRole && String(session.requiredRole)) || (userInfo && userInfo.selectedRole) || ''
    const bindableRoles = ['social_worker', 'volunteer', 'parent']
    if (session.autoBind && targetRole && bindableRoles.includes(targetRole) && !userRoles.includes(targetRole)) {
      try {
        await cloud.callFunction({
          name: 'rbac',
          data: {
            action: 'addRoleBinding',
            userOpenId: wxContext.OPENID,
            role: targetRole,
            __principalId: session.createdBy || ''
          }
        })
        // 绑定成功后刷新角色列表
        userRoles = await getUserRoles(wxContext.OPENID)
      } catch (e) {
        // 忽略自动绑定失败（可能创建者无权限或已绑定），继续按原有逻辑判断权限
      }
    }

    const selectedRole = determineUserRole(userRoles, session.type, loginMode)

    if (!selectedRole) {
      return {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '权限不足，无法执行此操作'
        }
      }
    }

    // 生成CloudBase登录票据
    let ticketData
    try {
      ticketData = await generateCloudBaseTicket({
        openId: wxContext.OPENID,
        unionId: wxContext.UNIONID,
        role: selectedRole,
        loginMode: loginMode || 'full',
        userInfo
      })
    } catch (e) {
      const code = e && e.code
      if (code === 'MISSING_CUSTOM_LOGIN_KEY' || code === 'MISSING_ENV_ID') {
        return {
          success: false,
          error: {
            code,
            message: '云函数自定义登录未正确配置，请检查 TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID/TCB_CUSTOM_LOGIN_PRIVATE_KEY 与环境ID',
            details: null
          }
        }
      }
      throw e
    }

    // 更新会话状态
    await db.collection('qrLoginSessions')
      .doc(sessionId)
      .update({
        data: {
          status: 'approved',
          approvedBy: {
            principalId: wxContext.OPENID,
            role: selectedRole,
            approvedAt: Date.now()
          },
          ticket: ticketData,
          ticketConsumed: false,
          wechatUserInfo: {
            ...userInfo,
            openId: wxContext.OPENID,
            unionId: wxContext.UNIONID,
            roles: userRoles,
            selectedRole
          }
        }
      })

    // 记录审计日志
    await logAuditEvent({
      action: 'qr_approve',
      userId: wxContext.OPENID,
      sessionId,
      role: selectedRole,
      success: true,
      metadata: {
        ip: cloud.getWXContext().CLIENTIP,
        userAgent: deviceInfo?.userAgent
      }
    })

    return {
      success: true,
      data: {
        confirmed: true,
        message: '登录确认成功',
        loginTicket: ticketData.ticket,
        userInfo: {
          uid: ticketData.uid,
          username: userInfo.nickName,
          role: selectedRole,
          permissions: getRolePermissions(selectedRole),
          loginMode: loginMode || 'full'
        },
        sessionInfo: {
          expiresAt: session.expiresAt,
          refreshToken: ticketData.refreshToken
        }
      }
    }
  } catch (error) {
    console.error('确认登录失败:', error)
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '确认登录失败'
      }
    }
  }
}

// 取消登录
async function handleQRCancel(event) {
  const { sessionId, reason = 'user_cancelled' } = event

  if (!sessionId) {
    return {
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: '缺少会话ID'
      }
    }
  }

  try {
    await updateSessionStatus(sessionId, 'cancelled', {
      cancelReason: reason,
      cancelledAt: Date.now()
    })

    return {
      success: true,
      data: {
        cancelled: true,
        message: '登录已取消',
        reason: getCancelReasonMessage(reason)
      }
    }
  } catch (error) {
    console.error('取消登录失败:', error)
    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '取消登录失败'
      }
    }
  }
}

// 解析二维码
async function handleParseQR(event) {
  const { qrData, deviceInfo } = event

  if (!qrData) {
    return {
      success: false,
      error: {
        code: 'MISSING_PARAMETER',
        message: '缺少二维码数据'
      }
    }
  }

  try {
    // 解密二维码数据
    const decryptedData = decryptQRData(qrData)
    const qrContent = JSON.parse(decryptedData)

    const { sid: sessionId, ts: timestamp, sig: signature } = qrContent

    // 验证签名
    if (!verifySignature(sessionId, timestamp, signature)) {
      return {
        success: false,
        error: {
          code: 'INVALID_SIGNATURE',
          message: '二维码签名无效'
        }
      }
    }

    // 查询会话信息
    const sessionRecord = await db.collection('qrLoginSessions')
      .doc(sessionId)
      .get()

    if (!sessionRecord.data) {
      return {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: '会话不存在'
        }
      }
    }

    const session = sessionRecord.data

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      return {
        success: false,
        error: {
          code: 'QR_CODE_EXPIRED',
          message: '二维码已过期',
          details: {
            reason: 'expired',
            expiredAt: session.expiresAt
          }
        }
      }
    }

    // 为小程序审批生成一次性 approveNonce，并保存哈希
    const approveNonce = generateNonce()
    await db.collection('qrLoginSessions')
      .doc(sessionId)
      .update({
        data: {
          approveNonceHash: hashNonce(approveNonce),
          approveNonceIssuedAt: Date.now()
        }
      })

    // 返回会话信息
    return {
      success: true,
      data: {
        valid: true,
        sessionInfo: {
          sessionId,
          type: session.type,
          status: session.status,
          webDeviceInfo: {
            ip: session.meta?.ip,
            userAgent: session.meta?.ua,
            screenResolution: deviceInfo?.screenResolution
          },
          createdAt: session.createdAt,
          expiresAt: session.expiresAt
        },
        approveNonce,
        securityInfo: {
          riskLevel: 'low',
          warnings: []
        }
      }
    }
  } catch (error) {
    console.error('解析二维码失败:', error)
    return {
      success: false,
      error: {
        code: 'INVALID_QR_CODE',
        message: '二维码格式无效'
      }
    }
  }
}

// 辅助函数

// 生成会话ID
function generateSessionId() {
  return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

// 生成nonce
function generateNonce() {
  return crypto.randomBytes(16).toString('hex')
}

// 哈希nonce
function hashNonce(nonce) {
  return crypto.createHash('sha256').update(nonce).digest('hex')
}

// 验证nonce
function verifyNonce(nonce, hash) {
  const computedHash = hashNonce(nonce)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'))
}

// 生成签名
function generateSignature(sessionId, timestamp) {
  const secret = process.env.QR_SECRET || 'default-secret'
  const data = `${sessionId}:${timestamp}`
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

// 验证签名
function verifySignature(sessionId, timestamp, signature) {
  const expectedSignature = generateSignature(sessionId, timestamp)
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))
}

// 加密二维码数据
function encryptQRData(data) {
  const secret = process.env.QR_SECRET || 'default-secret'
  const key = crypto.scryptSync(secret, 'salt', 32)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const aad = Buffer.from('qr-login-data')
  cipher.setAAD(aad)

  let encrypted = cipher.update(data, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const tag = cipher.getAuthTag()

  return JSON.stringify({
    c: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  })
}

// 解密二维码数据
function decryptQRData(encryptedData) {
  const secret = process.env.QR_SECRET || 'default-secret'
  const key = crypto.scryptSync(secret, 'salt', 32)

  const { c, iv, tag } = JSON.parse(encryptedData)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))

  decipher.setAAD(Buffer.from('qr-login-data'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  let decrypted = decipher.update(Buffer.from(c, 'base64'))
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

// 更新会话状态
async function updateSessionStatus(sessionId, status, updateData = {}) {
  await db.collection('qrLoginSessions')
    .doc(sessionId)
    .update({
      data: {
        status,
        ...updateData,
        updatedAt: Date.now()
      }
    })
}

// 获取用户角色
async function getUserRoles(openId) {
  try {
    // 查询用户角色绑定
    const roleBindings = await db.collection('roleBindings')
      .where({
        userId: openId,
        isActive: true
      })
      .get()

    if (roleBindings.data.length === 0) {
      // 默认游客角色
      return ['guest']
    }

    return roleBindings.data.map(binding => binding.role)
  } catch (error) {
    console.error('获取用户角色失败:', error)
    return ['guest']
  }
}

// 确定用户角色
function determineUserRole(userRoles, sessionType, loginMode) {
  // 如果是多角色会话，用户可以选择角色
  if (sessionType === 'multi') {
    return userRoles.includes('admin') ? 'admin' : userRoles[0]
  }

  // 检查用户是否有请求的角色权限
  if (userRoles.includes(sessionType)) {
    return sessionType
  }

  // 游客模式任何角色都可以访问
  if (loginMode === 'guest') {
    return 'guest'
  }

  // 返回用户最高权限角色
  const roleHierarchy = ['admin', 'social_worker', 'volunteer', 'parent', 'guest']
  for (const role of roleHierarchy) {
    if (userRoles.includes(role)) {
      return role
    }
  }

  return null
}

// 生成CloudBase票据
async function generateCloudBaseTicket({ openId, unionId, role, loginMode, userInfo }) {
  try {
    const ticket = createTicket(openId, { expireIn: 2 * 60 * 60, refresh: 30 * 24 * 60 * 60 })
    const refreshToken = crypto.randomBytes(32).toString('hex')

    return {
      uid: openId,
      ticket,
      refreshToken,
      userInfo: {
        uid: openId,
        openId,
        unionId,
        username: userInfo.nickName,
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        role,
        loginMode,
        permissions: getRolePermissions(role)
      }
    }
  } catch (error) {
    console.error('生成CloudBase票据失败:', error)
    // 透传清晰错误码
    if (error && (error.code === 'MISSING_CUSTOM_LOGIN_KEY' || error.code === 'MISSING_ENV_ID')) {
      const err = new Error(error.message || '自定义登录配置缺失')
      err.code = error.code
      throw err
    }
    throw error
  }
}

// 自定义登录票据签发（复用 auth 云函数的签发逻辑）
function getEnvId() {
  const direct = process.env.CUSTOM_LOGIN_ENV_ID || process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.TENCENTCLOUD_ENV
  if (direct) return direct
  try {
    const ctx = typeof cloud.getWXContext === 'function' ? cloud.getWXContext() : null
    const fromCtx = ctx && (ctx.ENV || ctx.TCB_ENV || ctx.SCF_NAMESPACE)
    if (fromCtx) return fromCtx
  } catch (_) {}
  return ''
}

function getCustomLoginCredentials() {
  const fromEnvId = process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID || ''
  let keyRaw = process.env.TCB_CUSTOM_LOGIN_PRIVATE_KEY || ''

  let private_key_id = ''
  let private_key = ''
  let env_id = ''

  const raw = (keyRaw || '').trim()
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const obj = JSON.parse(raw)
      private_key_id = obj.private_key_id || obj.privateKeyId || ''
      private_key = obj.private_key || obj.privateKey || ''
      env_id = obj.env_id || obj.envId || ''
    } catch (_) {}
  }

  if (!private_key) {
    if (keyRaw && keyRaw.indexOf('\\n') >= 0) {
      keyRaw = keyRaw.replace(/\\n/g, '\n')
    }
    private_key = keyRaw
  }

  if (!private_key_id) private_key_id = fromEnvId
  if (!env_id) env_id = process.env.CUSTOM_LOGIN_ENV_ID || getEnvId() || ''

  if (!private_key_id || !private_key) {
    const err = new Error('未配置自定义登录私钥')
    err.code = 'MISSING_CUSTOM_LOGIN_KEY'
    throw err
  }
  return { private_key_id, private_key, env_id }
}

function createTicket(uid, opts = {}) {
  const creds = getCustomLoginCredentials()
  const resolvedEnvId = creds.env_id || getEnvId()
  const envOption = resolvedEnvId || (tcb && tcb.SYMBOL_CURRENT_ENV)
  if (!envOption) {
    const err = new Error('未检测到云环境 ID')
    err.code = 'MISSING_ENV_ID'
    throw err
  }
  const app = tcb.init({ env: envOption, credentials: creds })
  const expireIn = Number.isFinite(opts.expireIn) ? opts.expireIn : 2 * 60 * 60
  const refresh = Number.isFinite(opts.refresh) ? opts.refresh : 30 * 24 * 60 * 60
  return app.auth().createTicket(uid, { expireIn, refresh })
}

// 获取角色权限
function getRolePermissions(role) {
  const roleConfig = PERMISSION_MATRIX[role]
  if (!roleConfig) return []

  if (roleConfig.actions === '*') {
    return ['*']
  }

  return roleConfig.actions || []
}

// 获取重定向URL
function getRedirectUrl(role) {
  const redirectMap = {
    admin: '/dashboard',
    social_worker: '/patients',
    volunteer: '/tasks',
    parent: '/children',
    guest: '/public'
  }

  return redirectMap[role] || '/dashboard'
}

// 获取状态消息
function getStatusMessage(status) {
  const messages = {
    pending: '等待扫码...',
    scanned: '已扫描，等待确认',
    approved: '已确认，等待登录',
    consumed: '已登录',
    cancelled: '已取消',
    expired: '已过期'
  }

  return messages[status] || '未知状态'
}

// 获取取消原因消息
function getCancelReasonMessage(reason) {
  const messages = {
    user_cancelled: '用户取消登录',
    timeout: '登录超时',
    security: '安全检查失败'
  }

  return messages[reason] || '未知原因'
}

// 记录审计日志
async function logAuditEvent({ action, userId, sessionId, role, success, metadata }) {
  try {
    await ensureCollectionExists('auditLogs')
    await db.collection('auditLogs').add({
      data: {
        action,
        userId,
        sessionId,
        role,
        success,
        metadata,
        timestamp: Date.now(),
        source: 'qrLogin'
      }
    })
  } catch (error) {
    console.error('记录审计日志失败:', error)
  }
}

// 集合存在性校验/创建
async function ensureCollectionExists(name) {
  try {
    await db.collection(name).limit(1).get()
    return true
  } catch (error) {
    const code = error && (error.errCode !== undefined ? error.errCode : error.code)
    const message = error && error.errMsg ? error.errMsg : ''
    const notExists =
      code === -502005 ||
      (message && message.indexOf('DATABASE_COLLECTION_NOT_EXIST') >= 0) ||
      (message && message.indexOf('collection not exists') >= 0)
    if (notExists) {
      try {
        await db.createCollection(name)
        return false
      } catch (createError) {
        const createCode = createError && (createError.errCode !== undefined ? createError.errCode : createError.code)
        const alreadyExists = createCode === -502002
        if (!alreadyExists) {
          console.warn('createCollection failed', name, createError)
        }
        return false
      }
    }
    console.warn('ensureCollectionExists unexpected error', name, error)
    return false
  }
}
