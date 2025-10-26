/**
 * QRLogin Component Tests - Simple Version
 * 基础功能测试，避免复杂的异步问题
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QRLogin from '../QRLogin'

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

// Mock qrcode
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-image-data')
  }
}))

// Mock environment
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

Object.defineProperty(global, 'Intl', {
  value: {
    DateTimeFormat: () => ({
      resolvedOptions: () => ({ timeZone: 'Asia/Shanghai' })
    })
  },
  writable: true
})

describe('QRLogin Component - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
    localStorageMock.setItem.mockClear()

    // Default success response
    mockCallFunction.mockResolvedValue({
      success: true,
      data: {
        sessionId: 'test-session-123',
        qrData: 'test-qr-payload',
        expiresAt: Date.now() + 90000,
        nonce: 'test-nonce-123'
      }
    })
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

    // Check that cloud function was called
    await waitFor(() => {
      expect(mockCallFunction).toHaveBeenCalledWith('qrLogin', expect.objectContaining({
        action: 'qrInit',
        type: 'admin'
      }))
    }, { timeout: 5000 })
  })

  it('handles network errors', async () => {
    mockCallFunction.mockRejectedValue(new Error('网络连接失败'))

    const onLoginError = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={() => {}}
        onLoginError={onLoginError}
      />
    )

    // Wait for error to be handled
    await waitFor(() => {
      expect(onLoginError).toHaveBeenCalledWith(expect.any(Error))
    }, { timeout: 5000 })

    await waitFor(() => {
      expect(screen.getByText('网络连接失败')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('handles login cancellation', async () => {
    const onLoginSuccess = vi.fn()
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    // Wait for QR code to appear
    await waitFor(() => {
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    }, { timeout: 5000 })

    const cancelButton = screen.getByText('取消登录')
    fireEvent.click(cancelButton)

    await waitFor(() => {
      expect(screen.getByText('已取消登录')).toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('stores user roles in localStorage', async () => {
    // Mock successful login response
    mockCallFunction.mockImplementation(async (fnName, data) => {
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
    render(
      <QRLogin
        mode="admin"
        onLoginSuccess={onLoginSuccess}
        onLoginError={() => {}}
      />
    )

    // Wait for login success
    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalled()
    }, { timeout: 5000 })

    // Check localStorage was called
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'USER_ROLES',
      JSON.stringify(['admin'])
    )
  })
})