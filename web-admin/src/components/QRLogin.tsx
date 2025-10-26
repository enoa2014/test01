import React, { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useCloudFunction } from '../hooks/useCloudFunction'
import { useRBAC } from '../contexts/RBACContext'
import { useCloudbase } from '../hooks/useCloudbase'
import QRCode from 'qrcode'

// 类型定义
type LoginRole = 'admin' | 'social_worker' | 'volunteer' | 'parent' | 'guest' | 'multi'

interface QRLoginProps {
  mode?: LoginRole | 'multi'
  onLoginSuccess: (userInfo: UserInfo) => void
  onLoginError: (error: Error) => void
  onStatusChange?: (status: LoginStatus) => void
  availableRoles?: LoginRole[]
  defaultRole?: LoginRole
  className?: string
}

interface LoginStatus {
  status: 'waiting' | 'scanned' | 'confirmed' | 'error' | 'expired' | 'cancelled'
  message: string
  userInfo?: UserInfo
  expiresAt?: number
  createdAt?: number
  selectedRole?: LoginRole
  availableRoles?: LoginRole[]
}

interface UserInfo {
  uid: string
  username: string
  roles: LoginRole[]
  selectedRole: LoginRole
  permissions: string[]
  avatarUrl?: string
  nickName?: string
  departmentId?: string
  assignedPatients?: string[]
  childrenIds?: string[]
  volunteerTasks?: string[]
}

interface RoleInfo {
  role: LoginRole
  name: string
  description: string
  permissions: string[]
  icon?: string
  color?: string
}

// 角色配置
const ROLE_CONFIG: Record<LoginRole, RoleInfo> = {
  admin: {
    role: 'admin',
    name: '系统管理员',
    description: '拥有完整的系统管理权限，可以管理用户、配置系统、查看所有数据',
    permissions: ['read', 'write', 'delete', 'export', 'user_manage', 'system_config'],
    icon: '👑',
    color: 'blue'
  },
  social_worker: {
    role: 'social_worker',
    name: '社工',
    description: '负责患者管理和护理记录，可以查看和管理负责的患者信息',
    permissions: ['read', 'write', 'patient_manage', 'care_log'],
    icon: '👩‍⚕️',
    color: 'green'
  },
  volunteer: {
    role: 'volunteer',
    name: '志愿者',
    description: '参与志愿服务，可以查看基础患者信息和记录服务日志',
    permissions: ['read', 'task_log', 'comment'],
    icon: '🤝',
    color: 'yellow'
  },
  parent: {
    role: 'parent',
    name: '家长',
    description: '查看自己孩子的相关信息，包括护理记录和医疗信息',
    permissions: ['read', 'child_info'],
    icon: '👨‍👩‍👧‍👦',
    color: 'purple'
  },
  guest: {
    role: 'guest',
    name: '游客',
    description: '临时访问权限，可以查看公开的统计信息',
    permissions: ['read', 'public_stats'],
    icon: '👤',
    color: 'gray'
  },
  multi: {
    role: 'multi',
    name: '多角色',
    description: '用户拥有多个角色，可以选择登录身份',
    permissions: [],
    icon: '🔄',
    color: 'indigo'
  }
}

const QRLoginComponent = forwardRef<any, QRLoginProps>(({
  mode = 'multi',
  onLoginSuccess,
  onLoginError,
  onStatusChange,
  availableRoles = ['admin', 'social_worker', 'volunteer', 'parent', 'guest'],
  defaultRole = 'admin',
  className = ''
}, ref) => {
  const { callFunction } = useCloudFunction()
  const { switchRole } = useRBAC()
  const { auth, refreshLoginState } = useCloudbase()

  // 状态管理
  const [sessionId, setSessionId] = useState<string | null>(null)
  // 原始二维码载荷（加密字符串），与后端一致
  const [qrData, setQrData] = useState<string | null>(null)
  // 生成的二维码图片 DataURL
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<LoginStatus>({
    status: 'waiting',
    message: '请选择登录角色'
  })
  const [selectedRole, setSelectedRole] = useState<LoginRole>(defaultRole)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState<number>(90)
  const [sessionNonce, setSessionNonce] = useState<string | null>(null)

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const maxRefreshCount = 3

  // 清理轮询
  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // 获取设备信息
  const getDeviceInfo = useCallback(() => {
    return {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      colorDepth: screen.colorDepth
    }
  }, [])

  // 生成二维码
  const generateQRCode = useCallback(async (role: LoginRole) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await callFunction('qrLogin', {
        action: 'qrInit',
        type: role,
        deviceInfo: getDeviceInfo(),
        metadata: {
          source: 'web_admin',
          version: '1.0.0'
        },
        // 统一优化：允许扫码自动绑定缺失的目标角色（由创建者权限控制）
        autoBind: true
      })

      if (response.success) {
        const { sessionId: newSessionId, qrData: newQrData, expiresAt, nonce } = response.data

        setSessionId(newSessionId)
        setQrData(newQrData)
        setSessionNonce(nonce || null)
        setSelectedRole(role)
        setRefreshCount(0)

        const timeRemaining = Math.floor((expiresAt - Date.now()) / 1000)
        setTimeRemaining(timeRemaining)

        // 生成二维码图片（前端生成PNG DataURL）
        try {
          const dataUrl = await QRCode.toDataURL(String(newQrData || ''))
          setQrImageUrl(dataUrl)
        } catch (e) {
          console.warn('生成二维码图片失败，将显示占位图', e)
          setQrImageUrl(null)
        }

        setStatus({
          status: 'waiting',
          message: '请使用微信小程序扫码',
          expiresAt,
          createdAt: Date.now()
        })

        // 开始轮询
        startPolling()
      } else {
        throw new Error(response.error?.message || '生成二维码失败')
      }
    } catch (err) {
      const error = err as Error
      setError(error.message)
      setStatus({
        status: 'error',
        message: error.message
      })
      onLoginError(error)
    } finally {
      setIsLoading(false)
    }
  }, [callFunction, getDeviceInfo, onLoginError])

  // 开始状态轮询
  const startPolling = useCallback(() => {
    clearPolling()

    pollingIntervalRef.current = setInterval(async () => {
      if (!sessionId) return

      try {
        const response = await callFunction('qrLogin', {
          action: 'qrStatus',
          sessionId,
          // 使用服务端返回的 nonce（与 nonceHash 匹配）
          ...(sessionNonce ? { nonce: sessionNonce } : {})
        })

        if (response.success) {
          handleStatusUpdate(response.data)
        }
      } catch (err) {
        console.error('状态检查失败:', err)
      }
    }, 2000)
  }, [sessionId, sessionNonce, callFunction, clearPolling])

  // 处理状态更新
  const handleStatusUpdate = useCallback((data: any) => {
    if (data?.nonce) {
      setSessionNonce(data.nonce)
    }
    const newStatus: LoginStatus = {
      status: data.status,
      message: data.message,
      userInfo: data.userInfo,
      expiresAt: data.expiresAt,
      createdAt: data.createdAt
    }

    setStatus(newStatus)
    onStatusChange?.(newStatus)

    switch (data.status) {
      case 'confirmed':
        clearPolling()
        handleLoginSuccess(data)
        break

      case 'cancelled':
      case 'expired':
        clearPolling()
        if (refreshCount < maxRefreshCount) {
          // 自动刷新
          setTimeout(() => {
            generateQRCode(selectedRole)
          }, 1000)
          setRefreshCount(prev => prev + 1)
        }
        break
    }
  }, [clearPolling, refreshCount, selectedRole, generateQRCode, onStatusChange])

  // 处理登录成功
  const handleLoginSuccess = useCallback(async (data: any) => {
    try {
      const { loginTicket, userInfo } = data

      // 保存用户角色信息到本地存储
      try {
        localStorage.setItem('USER_ROLES', JSON.stringify(userInfo.roles || [userInfo.selectedRole]))
        if (userInfo.selectedRole) {
          localStorage.setItem('SELECTED_ROLE', JSON.stringify(userInfo.selectedRole))
        }
      } catch (error) {
        console.warn('Failed to save user roles to localStorage:', error)
      }

      // 切换到选中的角色
      if (userInfo.selectedRole) {
        await switchRole(userInfo.selectedRole)
      }

      // 使用 CloudBase 自定义登录票据完成登录
      if (loginTicket && auth) {
        const anyAuth: any = auth as any
        try {
          if (typeof anyAuth.customAuthProvider === 'function') {
            const provider = anyAuth.customAuthProvider()
            if (provider?.signInWithTicket) {
              await provider.signInWithTicket(loginTicket)
            } else if (provider?.signIn) {
              await provider.signIn(loginTicket)
            } else if (anyAuth.setCustomSignFunc && anyAuth.signInWithCustomTicket) {
              anyAuth.setCustomSignFunc(async () => loginTicket)
              await anyAuth.signInWithCustomTicket()
            } else {
              console.warn('当前 CloudBase SDK 不支持自定义登录票据方式')
            }
          } else if (anyAuth.setCustomSignFunc && anyAuth.signInWithCustomTicket) {
            anyAuth.setCustomSignFunc(async () => loginTicket)
            await anyAuth.signInWithCustomTicket()
          }
          await refreshLoginState?.()
        } catch (e) {
          console.error('使用票据登录失败:', e)
          throw e
        }
      }

      setStatus(prev => ({
        ...prev,
        status: 'confirmed',
        userInfo
      }))

      onLoginSuccess(userInfo)
    } catch (err) {
      const error = err as Error
      setError(error.message)
      setStatus({
        status: 'error',
        message: error.message
      })
      onLoginError(error)
    }
  }, [switchRole, auth, refreshLoginState, onLoginSuccess, onLoginError])

  // 刷新二维码
  const refreshQRCode = useCallback(() => {
    if (refreshCount < maxRefreshCount) {
      generateQRCode(selectedRole)
    }
  }, [generateQRCode, selectedRole, refreshCount])

  // 取消登录
  const cancelLogin = useCallback(async () => {
    clearPolling()

    if (sessionId) {
      try {
        await callFunction('qrLogin', {
          action: 'qrCancel',
          sessionId,
          reason: 'user_cancelled'
        })
      } catch (err) {
        console.error('取消登录失败:', err)
      }
    }

    setStatus({
      status: 'cancelled',
      message: '已取消登录'
    })
  }, [sessionId, callFunction, clearPolling])

  // 已由服务端生成 nonce 并在初始化返回，无需前端生成

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 倒计时效果
  useEffect(() => {
    if (timeRemaining <= 0) return

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearPolling()
    }
  }, [clearPolling])

  // 添加角色选择处理方法（供外部调用）
  const selectRole = useCallback((role: LoginRole) => {
    setSelectedRole(role)
    generateQRCode(role)
  }, [generateQRCode])

  // 暴露角色选择方法给父组件
  useImperativeHandle(ref, () => ({
    selectRole
  }), [selectRole])

  // 获取角色颜色样式
  const getRoleColorStyles = (role: LoginRole) => {
    const colors = {
      admin: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', light: 'purple' },
      social_worker: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', light: 'blue' },
      volunteer: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', light: 'amber' },
      parent: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', light: 'green' },
      guest: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', light: 'gray' },
      multi: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', light: 'indigo' }
    }
    return colors[role] || colors.guest
  }

  // 主渲染
  return (
    <div className={className}>
      {/* 单角色模式：显示角色信息 */}
      {mode !== 'multi' && (
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className={
              "inline-flex items-center gap-4 p-4 rounded-2xl " +
              getRoleColorStyles(selectedRole).bg + " " +
              getRoleColorStyles(selectedRole).border + " border"
            }>
              <span className="text-4xl">{ROLE_CONFIG[selectedRole].icon}</span>
              <div className="text-left">
                <div className={"font-bold text-lg " + getRoleColorStyles(selectedRole).text}>
                  {ROLE_CONFIG[selectedRole].name}
                </div>
                <div className={"text-sm " + getRoleColorStyles(selectedRole).text + " opacity-80"}>
                  {ROLE_CONFIG[selectedRole].description}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 二维码显示区域 */}
      <div className="relative">
        {qrImageUrl ? (
          <div className="relative inline-block">
            <div className="w-72 h-72 bg-white p-6 rounded-2xl shadow-2xl border-2 border-gray-100">
              <img
                src={qrImageUrl}
                alt="登录二维码"
                className="w-full h-full object-contain"
              />
            </div>

            {/* 状态指示器 */}
            <div className={
                "absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 " +
                (status.status === 'waiting' ? 'bg-yellow-400 animate-pulse' :
                status.status === 'scanned' ? 'bg-blue-500' :
                status.status === 'confirmed' ? 'bg-green-500' :
                'bg-gray-400')
              }>
              {status.status === 'waiting' && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
              )}
              {status.status === 'scanned' && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {status.status === 'confirmed' && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {/* 倒计时显示 */}
            {timeRemaining > 0 && (
              <div className={
                "absolute -bottom-3 -right-3 px-3 py-1 rounded-full text-sm font-bold text-white shadow-lg transition-all duration-300 " +
                (timeRemaining <= 10 ? 'bg-red-500 animate-pulse' : 'bg-gray-700')
              }>
                {formatTime(timeRemaining)}
              </div>
            )}

            {/* 紧急过期警告 */}
            {timeRemaining <= 10 && timeRemaining > 0 && (
              <div className="absolute inset-0 bg-red-500 bg-opacity-90 rounded-2xl flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="text-4xl font-bold mb-2 animate-pulse">{formatTime(timeRemaining)}</div>
                  <div className="text-lg font-semibold">二维码即将过期</div>
                  <div className="text-sm opacity-80 mt-1">请立即扫描</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-72 h-72 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl shadow-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl mb-4 opacity-50">📱</div>
              <div className="text-xl font-semibold text-gray-600 mb-2">准备扫码登录</div>
              <div className="text-sm text-gray-500">
                {mode === 'multi' ? '请先选择登录角色' : '正在生成二维码...'}
              </div>
              {isLoading && (
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto"></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 状态信息 */}
      <div className="mt-8 text-center">
        <div className={
          "text-lg font-semibold mb-3 transition-all duration-300 " +
          (status.status === 'waiting' ? 'text-gray-900' :
          status.status === 'scanned' ? 'text-blue-600' :
          status.status === 'confirmed' ? 'text-green-600' :
          status.status === 'error' ? 'text-red-600' :
          'text-gray-600')
        }>
          {status.message}
        </div>

        {/* 用户信息显示 */}
        {status.userInfo && (
          <div className="flex items-center justify-center gap-4 mb-4 p-4 bg-green-50 rounded-xl border border-green-200">
            <img
              src={status.userInfo.avatarUrl || '/default-avatar.png'}
              alt="用户头像"
              className="w-12 h-12 rounded-full border-2 border-green-300"
            />
            <div className="text-left">
              <div className="font-semibold text-green-900">{status.userInfo.nickName || status.userInfo.username}</div>
              <div className="text-sm text-green-700">{ROLE_CONFIG[status.userInfo.selectedRole]?.name}</div>
            </div>
            <div className="text-2xl">✅</div>
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 text-red-700 mb-4">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* 操作提示 */}
        <div className="space-y-2">
          {status.status === 'waiting' && qrImageUrl && (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span className="font-medium">请使用微信小程序扫描上方二维码</span>
            </div>
          )}

          {status.status === 'scanned' && (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="font-medium">正在确认登录，请在小程序中确认...</span>
            </div>
          )}

          {status.status === 'confirmed' && (
            <div className="flex items-center justify-center gap-2 text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">登录成功，正在跳转...</span>
            </div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      {qrData && (
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={refreshQRCode}
            disabled={refreshCount >= maxRefreshCount || isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 rounded-xl transition-all duration-200 font-medium text-gray-700 disabled:cursor-not-allowed hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新 ({maxRefreshCount - refreshCount})
          </button>

          <button
            onClick={cancelLogin}
            className="flex items-center gap-2 px-6 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-all duration-200 font-medium hover:shadow-md"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            取消登录
          </button>
        </div>
      )}
    </div>
  )
})

export const QRLogin = QRLoginComponent
export default QRLogin
