/**
 * QRLogin Component Tests - Fixed Version
 * 正确处理异步操作和轮询机制
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QRLogin from '../QRLogin'

// Mock qrcode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-image-data')
  }
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock navigator and screen
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Test Agent',
    language: 'zh-CN'
  },
  writable: true
})

Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080,
    colorDepth: 24
  },
  writable: true
})

// Mock Intl.DateTimeFormat
Object.defineProperty(global, 'Intl', {
  value: {
    DateTimeFormat: () => ({
      resolvedOptions: () => ({ timeZone: 'Asia/Shanghai' })
    })
  },
  writable: true
})

// Mock hooks
const mockCallFunction = vi.fn()
const mockSwitchRole = vi.fn().mockResolvedValue(undefined)
const mockAuth = {
  customAuthProvider: vi.fn(() => ({
    signInWithTicket: vi.fn().mockResolvedValue({ user: { uid: 'test-user' } })
  }))
}
const mockRefreshLoginState = vi.fn().mockResolvedValue(undefined)

vi.mock('../hooks/useCloudFunction', () => ({
  useCloudFunction: () => ({ callFunction: mockCallFunction })
}))

vi.mock('../contexts/RBACContext', () => ({
  useRBAC: () => ({ switchRole: mockSwitchRole })
}))

vi.mock('../hooks/useCloudbase', () => ({
  useCloudbase: () => ({
    auth: mockAuth,
    refreshLoginState: mockRefreshLoginState
  })
}))

describe('QRLogin Component Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    // Reset localStorage
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockClear()

    // Default successful responses
    mockCallFunction.mockImplementation(async (fnName, data) => {
      if (fnName === 'qrLogin') {
        if (data.action === 'qrInit') {
          return {
            success: true,
            data: {
              sessionId: 'test-session-123',
              qrData: 'test-qr-payload',
              expiresAt: Date.now() + 90000,
              nonce: 'test-nonce-123'
            }
          }
        }
        if (data.action === 'qrStatus') {
          return {
            success: true,
            data: {
              status: 'pending',
              message: '等待扫码...',
              nonce: 'test-nonce-456'
            }
          }
        }
        if (data.action === 'qrCancel') {
          return {
            success: true,
            data: { status: 'cancelled' }
          }
        }
      }
      return { success: false, error: { code: 'UNKNOWN', message: '未知错误' } }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders correctly in multi mode', () => {
    const onLoginSuccess = vi.fn()
    const onLoginError = vi.fn()

    render(
      <QRLogin
        mode="multi"
        onLoginSuccess={onLoginSuccess}
        onLoginError={onLoginError}
      />
    )

    expect(screen.getByText('扫码登录')).toBeInTheDocument()
    expect(screen.getByText('选择您的角色，使用微信小程序扫码快速登录')).toBeInTheDocument()

    // Check all role buttons
    expect(screen.getByText('系统管理员')).toBeInTheDocument()
    expect(screen.getByText('社工')).toBeInTheDocument()
    expect(screen.getByText('志愿者')).toBeInTheDocument()
    expect(screen.getByText('家长')).toBeInTheDocument()
    expect(screen.getByText('游客')).toBeInTheDocument()
  })

  it('renders correctly in single role mode', () => {
    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    expect(screen.getByText('系统管理员')).toBeInTheDocument()
    expect(screen.getByText('拥有完整的系统管理权限，可以管理用户、配置系统、查看所有数据')).toBeInTheDocument()
  })

  it('generates QR code when role is selected', async () => {
    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="multi"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    const adminButton = screen.getByText('系统管理员')
    fireEvent.click(adminButton)

    // Wait for QR code generation
    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledWith('qrLogin', expect.objectContaining({
        action: 'qrInit',
        type: 'admin',
        deviceInfo: expect.objectContaining({
          userAgent: 'Test Agent',
          screenResolution: '1920x1080',
          timezone: 'Asia/Shanghai',
          language: 'zh-CN',
          platform: 'Test Agent',
          colorDepth: 24
        }),
        metadata: {
          source: 'web_admin',
          version: '1.0.0'
        }
      }))
    })

    // Check QR code image appears
    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    // Check status message
    expect(screen.getByText('请使用微信小程序扫码')).toBeInTheDocument()
  })

  it('handles login success flow', async () => {
    // Setup successful login flow
    mockCallFunction.mockImplementation(async (fnName, data) => {
      if (fnName === 'qrLogin' && data.action === 'qrInit') {
        return {
          success: true,
          data: {
            sessionId: 'test-session-123',
            qrData: 'test-qr-payload',
            expiresAt: Date.now() + 90000,
            nonce: 'test-nonce-123'
          }
        }
      }
      if (fnName === 'qrLogin' && data.action === 'qrStatus') {
        return {
          success: true,
          data: {
            status: 'confirmed',
            message: '登录成功',
            loginTicket: 'test-ticket-123',
            userInfo: {
              uid: 'test-user-123',
              selectedRole: 'admin',
              roles: ['admin'],
              nickName: '测试管理员'
            }
          }
        }
      }
      return { success: false }
    })

    const onLoginSuccess = vi.fn()
    const onLoginError = vi.fn()

    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={onLoginError}
      />
    )

    // QR code should be generated automatically for single role mode
    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    // Simulate polling by advancing timers
    vi.advanceTimersByTime(2000)

    // Wait for async operations
    await waitFor(() => {
      expect(mockAuth.customAuthProvider).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockSwitchRole).toHaveBeenCalledWith('admin')
    })

    await waitFor(() => {
      expect(mockRefreshLoginState).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalledWith({
        uid: 'test-user-123',
        selectedRole: 'admin',
        roles: ['admin'],
        nickName: '测试管理员'
      })
    })

    // Check success message
    expect(screen.getByText('登录成功，正在跳转...')).toBeInTheDocument()

    // Check localStorage is updated
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'USER_ROLES',
      JSON.stringify(['admin'])
    )
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'SELECTED_ROLE',
      JSON.stringify('admin')
    )
  })

  it('handles QR code expiry and refresh', async () => {
    let callCount = 0
    mockCallFunction.mockImplementation(async (fnName, data) => {
      if (fnName === 'qrLogin' && data.action === 'qrInit') {
        callCount++
        return {
          success: true,
          data: {
            sessionId: `test-session-${callCount}`,
            qrData: `test-qr-payload-${callCount}`,
            expiresAt: Date.now() + 90000,
            nonce: `test-nonce-${callCount}`
          }
        }
      }
      if (fnName === 'qrLogin' && data.action === 'qrStatus') {
        return {
          success: true,
          data: {
            status: 'expired',
            message: '二维码已过期'
          }
        }
      }
      return { success: false }
    })

    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    // Simulate polling detecting expiry
    vi.advanceTimersByTime(2000)

    // Wait for auto-refresh
    await waitFor(() => {
      expect(screen.getByText('二维码已过期')).toBeInTheDocument()
    })

    // Trigger auto-refresh
    vi.advanceTimersByTime(1000)

    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledTimes(2) // Initial + refresh
    })
  })

  it('handles manual QR code refresh', async () => {
    let callCount = 0
    mockCallFunction.mockImplementation(async (fnName, data) => {
      if (fnName === 'qrLogin' && data.action === 'qrInit') {
        callCount++
        return {
          success: true,
          data: {
            sessionId: `test-session-${callCount}`,
            qrData: `test-qr-payload-${callCount}`,
            expiresAt: Date.now() + 90000,
            nonce: `test-nonce-${callCount}`
          }
        }
      }
      return { success: false }
    })

    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    const refreshButton = screen.getByText('刷新二维码 (3)')
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledTimes(2) // Initial + manual refresh
    })
  })

  it('handles login cancellation', async () => {
    const onLoginSuccess = vi.fn()
    const onLoginError = vi.fn()

    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={onLoginError}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    const cancelButton = screen.getByText('取消登录')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledWith('qrLogin', expect.objectContaining({
        action: 'qrCancel',
        sessionId: 'test-session-123',
        reason: 'user_cancelled'
      }))
    })

    expect(screen.getByText('已取消登录')).toBeInTheDocument()
  })

  it('handles network errors gracefully', async () => {
    mockCallFunction.mockRejectedValue(new Error('网络连接失败'))

    const onLoginError = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={() => {}}
        onLoginError={onLoginError}
      />
    )

    await waitFor(() => {
      expect(onLoginError).toHaveBeenCalledWith(expect.any(Error))
    })

    await waitFor(() => {
      expect(screen.getByText('网络连接失败')).toBeInTheDocument()
    })
  })

  it('displays countdown timer correctly', async () => {
    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    // Initial time should be 90 seconds
    expect(screen.getByText('二维码有效期 1:30')).toBeInTheDocument()

    // Advance time by 10 seconds
    vi.advanceTimersByTime(10000)

    await waitFor(() => {
      expect(screen.getByText('二维码有效期 1:20')).toBeInTheDocument()
    })
  })

  it('shows warning when time is running out', async () => {
    // Create session with only 10 seconds remaining
    mockCallFunction.mockImplementation(async (fnName, data) => {
      if (fnName === 'qrLogin' && data.action === 'qrInit') {
        return {
          success: true,
          data: {
            sessionId: 'test-session-123',
            qrData: 'test-qr-payload',
            expiresAt: Date.now() + 10000, // Only 10 seconds
            nonce: 'test-nonce-123'
          }
        }
      }
      return { success: false }
    })

    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    // Should show warning overlay when time <= 10 seconds
    await waitFor(() => {
      expect(screen.getByText('即将过期')).toBeInTheDocument()
    })
  })

  it('limits refresh attempts', async () => {
    let callCount = 0
    mockCallFunction.mockImplementation(async (fnName, data) => {
      if (fnName === 'qrLogin' && data.action === 'qrInit') {
        callCount++
        return {
          success: true,
          data: {
            sessionId: `test-session-${callCount}`,
            qrData: `test-qr-payload-${callCount}`,
            expiresAt: Date.now() + 1000, // Short expiry to trigger refresh
            nonce: `test-nonce-${callCount}`
          }
        }
      }
      if (fnName === 'qrLogin' && data.action === 'qrStatus') {
        return {
          success: true,
          data: { status: 'expired', message: '二维码已过期' }
        }
      }
      return { success: false }
    })

    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    // Trigger multiple refresh cycles
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(3000)
      await vi.waitFor(() => true, { timeout: 100 })
    }

    // Should not exceed max refresh attempts (3)
    expect(callCount).toBeLessThanOrEqual(4) // Initial + max 3 refreshes
  })

  it('stores user information in localStorage on successful login', async () => {
    mockCallFunction.mockImplementation(async (fnName, data) => {
      if (fnName === 'qrLogin' && data.action === 'qrInit') {
        return {
          success: true,
          data: {
            sessionId: 'test-session-123',
            qrData: 'test-qr-payload',
            expiresAt: Date.now() + 90000,
            nonce: 'test-nonce-123'
          }
        }
      }
      if (fnName === 'qrLogin' && data.action === 'qrStatus') {
        return {
          success: true,
          data: {
            status: 'confirmed',
            message: '登录成功',
            loginTicket: 'test-ticket-123',
            userInfo: {
              uid: 'test-user-123',
              selectedRole: 'social_worker',
              roles: ['social_worker', 'volunteer'],
              nickName: '测试社工'
            }
          }
        }
      }
      return { success: false }
    })

    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="social_worker"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    // Trigger login success
    vi.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalled()
    })

    // Verify localStorage updates
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'USER_ROLES',
      JSON.stringify(['social_worker', 'volunteer'])
    )
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'SELECTED_ROLE',
      JSON.stringify('social_worker')
    )
  })

  it('displays user info after successful login', async () => {
    mockCallFunction.mockImplementation(async (fnName, data) => {
      if (fnName === 'qrLogin' && data.action === 'qrInit') {
        return {
          success: true,
          data: {
            sessionId: 'test-session-123',
            qrData: 'test-qr-payload',
            expiresAt: Date.now() + 90000,
            nonce: 'test-nonce-123'
          }
        }
      }
      if (fnName === 'qrLogin' && data.action === 'qrStatus') {
        return {
          success: true,
          data: {
            status: 'confirmed',
            message: '登录成功',
            loginTicket: 'test-ticket-123',
            userInfo: {
              uid: 'test-user-123',
              selectedRole: 'volunteer',
              roles: ['volunteer'],
              nickName: '测试志愿者',
              avatarUrl: 'https://example.com/avatar.jpg'
            }
          }
        }
      }
      return { success: false }
    })

    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="volunteer"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })

    // Trigger login success
    vi.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(screen.getByText('测试志愿者')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('志愿者')).toBeInTheDocument()
    })

    // Check avatar is displayed
    const avatar = screen.getByAltText('用户头像')
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })
})