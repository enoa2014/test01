// QR Login Cloud Function - Enhanced Security Version
// 增强安全性的QR登录云函数

const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const tcb = require('@cloudbase/node-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 安全配置
const SECURITY_CONFIG = {
  MAX_SESSION_ATTEMPTS: 3, // 最大会话尝试次数
  MAX_NONCE_REUSE: 1, // 最大nonce重用次数
  SESSION_TIMEOUT: 90 * 1000, // 会话超时时间
  RATE_LIMIT_WINDOW: 60 * 1000, // 限流时间窗口
  MAX_REQUESTS_PER_WINDOW: 10, // 每个窗口最大请求数
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  HASH_ALGORITHM: 'sha256',
  SIGNATURE_ALGORITHM: 'hmac-sha256'
}

// 输入验证白名单
const VALID_ROLES = ['admin', 'social_worker', 'volunteer', 'parent', 'guest', 'multi']
const VALID_ACTIONS = ['qrInit', 'qrStatus', 'qrApprove', 'qrCancel', 'parseQR']
const VALID_STATUSES = ['pending', 'scanned', 'approved', 'consumed', 'cancelled', 'expired']

// 权限矩阵配置（保持原有配置）
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

// 云函数主入口 - 增强版本
exports.main = async (event, context) => {
  const startTime = Date.now()
  const clientIP = cloud.getWXContext()?.CLIENTIP || 'unknown'

  try {
    // 输入验证
    const validationResult = validateInput(event)
    if (!validationResult.isValid) {
      await logSecurityEvent('input_validation_failed', clientIP, {
        errors: validationResult.errors,
        input: sanitizeInputForLogging(event)
      })
      return createErrorResponse('INVALID_INPUT', '输入数据验证失败', validationResult.errors)
    }

    // 速率限制检查
    const rateLimitResult = await checkRateLimit(clientIP)
    if (!rateLimitResult.allowed) {
      await logSecurityEvent('rate_limit_exceeded', clientIP, rateLimitResult)
      return createErrorResponse('RATE_LIMITED', '请求过于频繁，请稍后再试')
    }

    const { action } = event

    if (!VALID_ACTIONS.includes(action)) {
      await logSecurityEvent('invalid_action', clientIP, { action })
      return createErrorResponse('INVALID_ACTION', '无效的操作类型')
    }

    // 执行相应的操作
    let result
    switch (action) {
      case 'qrInit':
        result = await handleQRInitEnhanced(event, clientIP)
        break
      case 'qrStatus':
        result = await handleQRStatusEnhanced(event, clientIP)
        break
      case 'qrApprove':
        result = await handleQRApproveEnhanced(event, clientIP)
        break
      case 'qrCancel':
        result = await handleQRCancelEnhanced(event, clientIP)
        break
      case 'parseQR':
        result = await handleParseQREnhanced(event, clientIP)
        break
      default:
        result = createErrorResponse('INVALID_ACTION', '无效的操作类型')
    }

    // 记录性能指标
    const duration = Date.now() - startTime
    await logPerformanceMetrics(action, duration, result.success)

    return result

  } catch (error) {
    console.error('云函数执行错误:', error)
    await logSecurityEvent('cloud_function_error', clientIP, {
      error: error.message,
      stack: error.stack
    })
    return createErrorResponse('INTERNAL_ERROR', '服务器内部错误')
  }
}

// 增强的输入验证
function validateInput(event) {
  const errors = []

  // 验证必需字段
  if (!event || typeof event !== 'object') {
    errors.push('事件数据格式无效')
    return { isValid: false, errors }
  }

  // 验证action
  if (!event.action || typeof event.action !== 'string') {
    errors.push('缺少有效的action字段')
  } else if (!VALID_ACTIONS.includes(event.action)) {
    errors.push(`无效的action: ${event.action}`)
  }

  // 根据action验证特定字段
  switch (event.action) {
    case 'qrInit':
      if (event.type && !VALID_ROLES.includes(event.type)) {
        errors.push(`无效的角色类型: ${event.type}`)
      }
      if (event.deviceInfo && typeof event.deviceInfo !== 'object') {
        errors.push('deviceInfo必须是对象类型')
      }
      break

    case 'qrStatus':
      if (!event.sessionId || typeof event.sessionId !== 'string') {
        errors.push('缺少有效的sessionId')
      }
      if (event.nonce && typeof event.nonce !== 'string') {
        errors.push('nonce必须是字符串类型')
      }
      break

    case 'qrApprove':
      if (!event.sessionId || typeof event.sessionId !== 'string') {
        errors.push('缺少有效的sessionId')
      }
      if (!event.userInfo || typeof event.userInfo !== 'object') {
        errors.push('缺少有效的userInfo')
      }
      break

    case 'qrCancel':
      if (!event.sessionId || typeof event.sessionId !== 'string') {
        errors.push('缺少有效的sessionId')
      }
      break

    case 'parseQR':
      if (!event.qrData || typeof event.qrData !== 'string') {
        errors.push('缺少有效的qrData')
      }
      break
  }

  // 检查数据大小限制
  const eventSize = JSON.stringify(event).length
  if (eventSize > 1024 * 1024) { // 1MB限制
    errors.push('请求数据过大')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// 速率限制检查
async function checkRateLimit(clientIP) {
  const now = Date.now()
  const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW

  try {
    // 清理过期的限流记录
    await db.collection('rateLimits')
      .where({
        timestamp: _.lt(windowStart)
      })
      .remove()

    // 查询当前窗口内的请求数
    const recentRequests = await db.collection('rateLimits')
      .where({
        clientIP,
        timestamp: _.gte(windowStart)
      })
      .count()

    if (recentRequests.total >= SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW) {
      return {
        allowed: false,
        count: recentRequests.total,
        limit: SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW,
        windowMs: SECURITY_CONFIG.RATE_LIMIT_WINDOW
      }
    }

    // 记录当前请求
    await db.collection('rateLimits').add({
      data: {
        clientIP,
        timestamp: now
      }
    })

    return {
      allowed: true,
      count: recentRequests.total + 1,
      limit: SECURITY_CONFIG.MAX_REQUESTS_PER_WINDOW
    }

  } catch (error) {
    console.error('速率限制检查失败:', error)
    // 在限流检查失败时，为了安全起见，允许请求但记录错误
    return { allowed: true, error: error.message }
  }
}

// 增强的二维码会话生成
async function handleQRInitEnhanced(event, clientIP) {
  const { type = 'admin', deviceInfo, metadata, roleFilters } = event
  const now = Date.now()

  // 验证角色类型
  if (!VALID_ROLES.includes(type)) {
    await logSecurityEvent('invalid_role_init', clientIP, { type })
    return createErrorResponse('INVALID_ROLE', '无效的角色类型')
  }

  // 净化设备信息
  const sanitizedDeviceInfo = sanitizeDeviceInfo(deviceInfo || {})

  const expiresIn = SECURITY_CONFIG.SESSION_TIMEOUT
  const expiresAt = now + expiresIn

  // 生成安全的会话ID和nonce
  const sessionId = generateSecureSessionId()
  const nonce = generateSecureNonce()
  const nonceHash = hashNonce(nonce)

  // 构建增强的会话数据
  const sessionData = {
    _id: sessionId,
    type,
    status: 'pending',
    nonceHash,
    usedNonces: [],
    createdAt: now,
    expiresAt,
    attemptCount: 0,
    lastAccessAt: now,
    clientIP,
    deviceFingerprint: generateDeviceFingerprint(sanitizedDeviceInfo),
    meta: {
      ip: clientIP,
      ua: sanitizedDeviceInfo.userAgent || '',
      createdFrom: sanitizeInput(metadata?.source || 'web_admin'),
      ...sanitizeInput(metadata || {})
    },
    securityFlags: {
      requiresReauth: false,
      suspiciousActivity: false,
      riskScore: calculateRiskScore(clientIP, sanitizedDeviceInfo)
    },
    ...(roleFilters && { roleFilters: sanitizeInput(roleFilters) })
  }

  try {
    // 保存会话到数据库
    await db.collection('qrLoginSessions').add({
      data: sessionData
    })

    // 生成安全的二维码数据
    const qrData = JSON.stringify({
      sid: sessionId,
      ts: now,
      sig: generateSecureSignature(sessionId, now),
      v: 2 // 版本号
    })

    // 加密二维码数据
    const encryptedQRData = encryptQRDataEnhanced(qrData)

    // 记录会话创建事件
    await logSecurityEvent('session_created', clientIP, {
      sessionId,
      type,
      riskScore: sessionData.securityFlags.riskScore
    })

    return {
      success: true,
      data: {
        sessionId,
        qrData: encryptedQRData,
        nonce,
        expiresAt,
        expiresIn: Math.floor(expiresIn / 1000),
        pollingInterval: 2000,
        securityInfo: {
          riskScore: sessionData.securityFlags.riskScore,
          requiresReauth: sessionData.securityFlags.requiresReauth
        }
      }
    }

  } catch (error) {
    console.error('创建会话失败:', error)
    await logSecurityEvent('session_creation_failed', clientIP, {
      error: error.message,
      type
    })
    return createErrorResponse('SESSION_CREATION_FAILED', '创建会话失败')
  }
}

// 增强的状态检查
async function handleQRStatusEnhanced(event, clientIP) {
  const { sessionId, nonce } = event

  if (!sessionId) {
    return createErrorResponse('MISSING_PARAMETER', '缺少会话ID')
  }

  try {
    // 查询会话信息
    const sessionRecord = await db.collection('qrLoginSessions')
      .doc(sessionId)
      .get()

    if (!sessionRecord.data) {
      await logSecurityEvent('invalid_session_access', clientIP, { sessionId })
      return createErrorResponse('SESSION_NOT_FOUND', '会话不存在')
    }

    const session = sessionRecord.data

    // 检查会话是否属于该IP（防止会话劫持）
    if (session.clientIP !== clientIP && !session.securityFlags.suspiciousActivity) {
      await logSecurityEvent('session_hijack_attempt', clientIP, {
        sessionId,
        originalIP: session.clientIP,
        currentIP: clientIP
      })

      // 标记会话为可疑
      await db.collection('qrLoginSessions')
        .doc(sessionId)
        .update({
          data: {
            'securityFlags.suspiciousActivity': true,
            'securityFlags.riskScore': Math.min(session.securityFlags.riskScore + 50, 100)
          }
        })
    }

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

    // 检查尝试次数
    if (session.attemptCount >= SECURITY_CONFIG.MAX_SESSION_ATTEMPTS) {
      await updateSessionStatus(sessionId, 'cancelled', {
        cancelReason: 'too_many_attempts'
      })
      return createErrorResponse('TOO_MANY_ATTEMPTS', '尝试次数过多，会话已取消')
    }

    // 验证并轮换nonce
    let nextNonce = null
    if (nonce) {
      // 防止nonce重放攻击
      if (session.usedNonces && session.usedNonces.includes(hashNonce(nonce))) {
        await logSecurityEvent('nonce_reuse_attempt', clientIP, {
          sessionId,
          nonce: nonce.substring(0, 8) + '...'
        })
        return createErrorResponse('INVALID_NONCE', '安全令牌已被使用')
      }

      const expectedHash = hashNonce(nonce)
      if (!verifyNonce(nonce, session.nonceHash)) {
        // 增加尝试计数
        await db.collection('qrLoginSessions')
          .doc(sessionId)
          .update({
            data: {
              attemptCount: session.attemptCount + 1,
              lastAccessAt: Date.now()
            }
          })

        return createErrorResponse('INVALID_NONCE', '无效的安全令牌')
      }

      nextNonce = generateSecureNonce()

      // 原子性更新nonce和记录使用情况
      const updateRes = await db.collection('qrLoginSessions')
        .where({
          _id: sessionId,
          nonceHash: expectedHash,
          usedNonces: _.nin([expectedHash])
        })
        .update({
          data: {
            nonceHash: hashNonce(nextNonce),
            lastNonceRotatedAt: Date.now(),
            usedNonces: _.push([expectedHash]),
            lastAccessAt: Date.now()
          }
        })

      if (!updateRes || !updateRes.stats || updateRes.stats.updated < 1) {
        return createErrorResponse('INVALID_NONCE', '安全令牌已失效或已被使用')
      }
    }

    // 更新最后访问时间
    await db.collection('qrLoginSessions')
      .doc(sessionId)
      .update({
        data: { lastAccessAt: Date.now() }
      })

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
            ...(nextNonce ? { nonce: nextNonce } : {}),
            securityInfo: {
              riskScore: session.securityFlags.riskScore,
              suspiciousActivity: session.securityFlags.suspiciousActivity
            }
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
    await logSecurityEvent('status_check_failed', clientIP, {
      sessionId,
      error: error.message
    })
    return createErrorResponse('INTERNAL_ERROR', '检查状态失败')
  }
}

// 增强的登录确认
async function handleQRApproveEnhanced(event, clientIP) {
  const { sessionId, userInfo, loginMode, deviceInfo, securityToken, approveNonce } = event
  const wxContext = cloud.getWXContext()

  if (!sessionId || !userInfo) {
    return createErrorResponse('MISSING_PARAMETER', '缺少必要参数')
  }

  try {
    // 查询会话
    const sessionRecord = await db.collection('qrLoginSessions')
      .doc(sessionId)
      .get()

    if (!sessionRecord.data) {
      await logSecurityEvent('approve_invalid_session', clientIP, { sessionId })
      return createErrorResponse('SESSION_NOT_FOUND', '会话不存在')
    }

    const session = sessionRecord.data

    // 检查会话状态
    if (session.status !== 'pending') {
      return createErrorResponse('INVALID_SESSION_STATUS', '会话状态无效')
    }

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      await updateSessionStatus(sessionId, 'expired')
      return createErrorResponse('SESSION_EXPIRED', '会话已过期')
    }

    // 验证设备指纹（如果可用）
    const currentFingerprint = generateDeviceFingerprint(deviceInfo || {})
    if (session.deviceFingerprint &&
        session.deviceFingerprint !== currentFingerprint &&
        !session.securityFlags.suspiciousActivity) {
      await logSecurityEvent('device_mismatch', clientIP, {
        sessionId,
        originalFingerprint: session.deviceFingerprint,
        currentFingerprint
      })
    }

    // 严格校验审批nonce
    if (!approveNonce || !verifyNonce(approveNonce, session.approveNonceHash)) {
      await logSecurityEvent('invalid_approve_nonce', clientIP, { sessionId })
      return createErrorResponse('INVALID_APPROVE_NONCE', '审批令牌无效或缺失')
    }

    // 获取用户角色和权限
    const userRoles = await getUserRoles(wxContext.OPENID)
    const selectedRole = determineUserRole(userRoles, session.type, loginMode)

    if (!selectedRole) {
      await logSecurityEvent('insufficient_permissions', clientIP, {
        sessionId,
        userRoles,
        requestedType: session.type
      })
      return createErrorResponse('INSUFFICIENT_PERMISSIONS', '权限不足，无法执行此操作')
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
        return createErrorResponse(code, '云函数自定义登录未正确配置，请检查配置')
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
            approvedAt: Date.now(),
            clientIP
          },
          ticket: ticketData,
          ticketConsumed: false,
          wechatUserInfo: {
            ...sanitizeInput(userInfo),
            openId: wxContext.OPENID,
            unionId: wxContext.UNIONID,
            roles: userRoles,
            selectedRole
          }
        }
      })

    // 记录安全审计事件
    await logAuditEvent({
      action: 'qr_approve',
      userId: wxContext.OPENID,
      sessionId,
      role: selectedRole,
      success: true,
      metadata: {
        ip: clientIP,
        userAgent: deviceInfo?.userAgent,
        deviceFingerprint: currentFingerprint,
        riskScore: session.securityFlags.riskScore
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
    await logSecurityEvent('approve_failed', clientIP, {
      sessionId,
      error: error.message
    })
    return createErrorResponse('INTERNAL_ERROR', '确认登录失败')
  }
}

// 增强的取消登录
async function handleQRCancelEnhanced(event, clientIP) {
  const { sessionId, reason = 'user_cancelled' } = event

  if (!sessionId) {
    return createErrorResponse('MISSING_PARAMETER', '缺少会话ID')
  }

  try {
    // 验证会话存在且属于该用户
    const sessionRecord = await db.collection('qrLoginSessions')
      .doc(sessionId)
      .get()

    if (!sessionRecord.data) {
      return createErrorResponse('SESSION_NOT_FOUND', '会话不存在')
    }

    if (sessionRecord.data.clientIP !== clientIP && !sessionRecord.data.securityFlags.suspiciousActivity) {
      await logSecurityEvent('unauthorized_cancel_attempt', clientIP, {
        sessionId,
        originalIP: sessionRecord.data.clientIP
      })
      return createErrorResponse('UNAUTHORIZED', '无权限取消此会话')
    }

    await updateSessionStatus(sessionId, 'cancelled', {
      cancelReason: sanitizeInput(reason),
      cancelledAt: Date.now(),
      cancelledByIP: clientIP
    })

    await logSecurityEvent('session_cancelled', clientIP, {
      sessionId,
      reason
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
    return createErrorResponse('INTERNAL_ERROR', '取消登录失败')
  }
}

// 增强的二维码解析
async function handleParseQREnhanced(event, clientIP) {
  const { qrData, deviceInfo } = event

  if (!qrData) {
    return createErrorResponse('MISSING_PARAMETER', '缺少二维码数据')
  }

  try {
    // 解密二维码数据
    const decryptedData = decryptQRDataEnhanced(qrData)
    const qrContent = JSON.parse(decryptedData)

    const { sid: sessionId, ts: timestamp, sig: signature, v: version = 1 } = qrContent

    // 验证版本
    if (version !== 2) {
      await logSecurityEvent('unsupported_qr_version', clientIP, { version })
      return createErrorResponse('UNSUPPORTED_VERSION', '不支持的二维码版本')
    }

    // 验证时间戳（防止重放攻击）
    const now = Date.now()
    const age = now - timestamp
    if (age > SECURITY_CONFIG.SESSION_TIMEOUT || age < -30000) { // 允许30秒时钟偏差
      await logSecurityEvent('qr_timestamp_invalid', clientIP, {
        sessionId,
        timestamp,
        age
      })
      return createErrorResponse('QR_CODE_EXPIRED', '二维码时间戳无效')
    }

    // 验证签名
    if (!verifySecureSignature(sessionId, timestamp, signature)) {
      await logSecurityEvent('qr_signature_invalid', clientIP, { sessionId })
      return createErrorResponse('INVALID_SIGNATURE', '二维码签名无效')
    }

    // 查询会话信息
    const sessionRecord = await db.collection('qrLoginSessions')
      .doc(sessionId)
      .get()

    if (!sessionRecord.data) {
      return createErrorResponse('SESSION_NOT_FOUND', '会话不存在')
    }

    const session = sessionRecord.data

    // 检查是否过期
    if (now > session.expiresAt) {
      return createErrorResponse('QR_CODE_EXPIRED', '二维码已过期', {
        reason: 'expired',
        expiredAt: session.expiresAt
      })
    }

    // 检查设备一致性
    const currentFingerprint = generateDeviceFingerprint(deviceInfo || {})
    if (session.deviceFingerprint && session.deviceFingerprint !== currentFingerprint) {
      await logSecurityEvent('qr_device_mismatch', clientIP, {
        sessionId,
        expectedFingerprint: session.deviceFingerprint,
        actualFingerprint: currentFingerprint
      })

      // 不阻止扫描，但记录为可疑活动
      await db.collection('qrLoginSessions')
        .doc(sessionId)
        .update({
          data: {
            'securityFlags.suspiciousActivity': true,
            'securityFlags.riskScore': Math.min(session.securityFlags.riskScore + 30, 100)
          }
        })
    }

    // 为小程序审批生成一次性approveNonce
    const approveNonce = generateSecureNonce()
    await db.collection('qrLoginSessions')
      .doc(sessionId)
      .update({
        data: {
          approveNonceHash: hashNonce(approveNonce),
          approveNonceIssuedAt: Date.now(),
          scannedAt: Date.now(),
          scanCount: (session.scanCount || 0) + 1
        }
      })

    // 记录扫描事件
    await logSecurityEvent('qr_scanned', clientIP, {
      sessionId,
      deviceFingerprint: currentFingerprint,
      scanCount: (session.scanCount || 0) + 1
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
          riskLevel: session.securityFlags.riskScore < 30 ? 'low' :
                     session.securityFlags.riskScore < 70 ? 'medium' : 'high',
          riskScore: session.securityFlags.riskScore,
          warnings: session.securityFlags.suspiciousActivity ? ['检测到可疑活动'] : []
        }
      }
    }

  } catch (error) {
    console.error('解析二维码失败:', error)
    await logSecurityEvent('qr_parse_failed', clientIP, {
      error: error.message
    })
    return createErrorResponse('INVALID_QR_CODE', '二维码格式无效')
  }
}

// 辅助函数

// 创建标准错误响应
function createErrorResponse(code, message, details = null) {
  const response = {
    success: false,
    error: {
      code,
      message
    }
  }

  if (details) {
    response.error.details = details
  }

  return response
}

// 净化输入数据用于日志记录
function sanitizeInputForLogging(input) {
  if (!input || typeof input !== 'object') return input

  const sanitized = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 100) {
      sanitized[key] = value.substring(0, 100) + '...'
    } else if (key === 'password' || key === 'secret' || key === 'token') {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// 净化输入数据
function sanitizeInput(input) {
  if (!input || typeof input !== 'object') return input

  const sanitized = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      // 移除潜在的XSS和SQL注入字符
      sanitized[key] = value
        .replace(/[<>]/g, '')
        .replace(/['"]/g, '')
        .substring(0, 1000) // 限制长度
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 50) // 限制数组大小
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

// 净化设备信息
function sanitizeDeviceInfo(deviceInfo) {
  if (!deviceInfo || typeof deviceInfo !== 'object') return {}

  return {
    userAgent: (deviceInfo.userAgent || '').substring(0, 500),
    screenResolution: deviceInfo.screenResolution || '',
    timezone: deviceInfo.timezone || '',
    language: deviceInfo.language || '',
    platform: deviceInfo.platform || '',
    colorDepth: deviceInfo.colorDepth || 24
  }
}

// 生成设备指纹
function generateDeviceFingerprint(deviceInfo) {
  const components = [
    deviceInfo.userAgent || '',
    deviceInfo.screenResolution || '',
    deviceInfo.timezone || '',
    deviceInfo.language || '',
    deviceInfo.platform || '',
    deviceInfo.colorDepth || ''
  ]

  return crypto.createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16)
}

// 计算风险评分
function calculateRiskScore(clientIP, deviceInfo) {
  let score = 0

  // 基于IP的风险评分（简单示例）
  if (clientIP === 'unknown' || !clientIP) {
    score += 20
  }

  // 基于设备信息的风险评分
  if (!deviceInfo.userAgent) {
    score += 10
  }

  // 可以添加更多风险评估逻辑

  return Math.min(score, 100)
}

// 生成安全的会话ID
function generateSecureSessionId() {
  const timestamp = Date.now().toString(36)
  const randomBytes = crypto.randomBytes(16).toString('hex')
  return `session_${timestamp}_${randomBytes}`
}

// 生成安全的nonce
function generateSecureNonce() {
  return crypto.randomBytes(32).toString('hex')
}

// 生成安全的签名
function generateSecureSignature(sessionId, timestamp) {
  const secret = process.env.QR_SECRET || 'default-secret-key-enhanced'
  const data = `${sessionId}:${timestamp}:v2`
  return crypto.createHmac('sha256', secret).update(data).digest('hex')
}

// 验证安全签名
function verifySecureSignature(sessionId, timestamp, signature) {
  const expectedSignature = generateSecureSignature(sessionId, timestamp)
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  )
}

// 增强的二维码数据加密
function encryptQRDataEnhanced(data) {
  const secret = process.env.QR_SECRET || 'default-secret-key-enhanced'
  const key = crypto.scryptSync(secret, 'enhanced-salt-v2', 32)
  const iv = crypto.randomBytes(16) // 增加IV长度
  const cipher = crypto.createCipheriv(SECURITY_CONFIG.ENCRYPTION_ALGORITHM, key, iv)

  const aad = Buffer.from('qr-login-data-v2')
  cipher.setAAD(aad)

  let encrypted = cipher.update(data, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const tag = cipher.getAuthTag()

  return JSON.stringify({
    v: 2, // 版本
    c: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ts: Date.now() // 加密时间戳
  })
}

// 增强的二维码数据解密
function decryptQRDataEnhanced(encryptedData) {
  const secret = process.env.QR_SECRET || 'default-secret-key-enhanced'
  const key = crypto.scryptSync(secret, 'enhanced-salt-v2', 32)

  const { v, c, iv, tag, ts } = JSON.parse(encryptedData)

  if (v !== 2) {
    throw new Error('Unsupported encryption version')
  }

  const decipher = crypto.createDecipheriv(SECURITY_CONFIG.ENCRYPTION_ALGORITHM, key, Buffer.from(iv, 'base64'))

  decipher.setAAD(Buffer.from('qr-login-data-v2'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))

  let decrypted = decipher.update(Buffer.from(c, 'base64'))
  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString('utf8')
}

// 记录安全事件
async function logSecurityEvent(eventType, clientIP, details = {}) {
  try {
    await db.collection('securityEvents').add({
      data: {
        eventType,
        clientIP,
        details: sanitizeInputForLogging(details),
        timestamp: Date.now(),
        severity: getSeverityLevel(eventType)
      }
    })
  } catch (error) {
    console.error('记录安全事件失败:', error)
  }
}

// 获取事件严重程度
function getSeverityLevel(eventType) {
  const highSeverity = [
    'rate_limit_exceeded',
    'session_hijack_attempt',
    'nonce_reuse_attempt',
    'device_mismatch',
    'invalid_approve_nonce'
  ]

  const mediumSeverity = [
    'input_validation_failed',
    'invalid_action',
    'invalid_role_init',
    'too_many_attempts',
    'qr_timestamp_invalid'
  ]

  if (highSeverity.includes(eventType)) return 'high'
  if (mediumSeverity.includes(eventType)) return 'medium'
  return 'low'
}

// 记录性能指标
async function logPerformanceMetrics(action, duration, success) {
  try {
    await db.collection('performanceMetrics').add({
      data: {
        action,
        duration,
        success,
        timestamp: Date.now()
      }
    })
  } catch (error) {
    console.error('记录性能指标失败:', error)
  }
}

// 保持原有的辅助函数（为了兼容性）
function hashNonce(nonce) {
  return crypto.createHash(SECURITY_CONFIG.HASH_ALGORITHM).update(nonce).digest('hex')
}

function verifyNonce(nonce, hash) {
  const computedHash = hashNonce(nonce)
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'))
}

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

async function getUserRoles(openId) {
  try {
    const roleBindings = await db.collection('roleBindings')
      .where({
        userId: openId,
        isActive: true
      })
      .get()

    if (roleBindings.data.length === 0) {
      return ['guest']
    }

    return roleBindings.data.map(binding => binding.role)
  } catch (error) {
    console.error('获取用户角色失败:', error)
    return ['guest']
  }
}

function determineUserRole(userRoles, sessionType, loginMode) {
  if (sessionType === 'multi') {
    return userRoles.includes('admin') ? 'admin' : userRoles[0]
  }

  if (userRoles.includes(sessionType)) {
    return sessionType
  }

  if (loginMode === 'guest') {
    return 'guest'
  }

  const roleHierarchy = ['admin', 'social_worker', 'volunteer', 'parent', 'guest']
  for (const role of roleHierarchy) {
    if (userRoles.includes(role)) {
      return role
    }
  }

  return null
}

async function generateCloudBaseTicket({ openId, unionId, role, loginMode, userInfo }) {
  // 保持原有的票据生成逻辑
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
}

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

function getRolePermissions(role) {
  const roleConfig = PERMISSION_MATRIX[role]
  if (!roleConfig) return []

  if (roleConfig.actions === '*') {
    return ['*']
  }

  return roleConfig.actions || []
}

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

function getCancelReasonMessage(reason) {
  const messages = {
    user_cancelled: '用户取消登录',
    timeout: '登录超时',
    security: '安全检查失败',
    too_many_attempts: '尝试次数过多'
  }

  return messages[reason] || '未知原因'
}

async function logAuditEvent({ action, userId, sessionId, role, success, metadata }) {
  try {
    await db.collection('auditLogs').add({
      data: {
        action,
        userId,
        sessionId,
        role,
        success,
        metadata: sanitizeInputForLogging(metadata),
        timestamp: Date.now(),
        source: 'qrLogin'
      }
    })
  } catch (error) {
    console.error('记录审计日志失败:', error)
  }
}