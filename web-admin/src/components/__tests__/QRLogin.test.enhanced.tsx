/**
 * QR Login Component Tests - Fixed Version
 * Addresses timeout issues and provides comprehensive coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QRLogin from '../QRLogin'

// Mock qrcode to avoid canvas operations
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-image')
  },
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-image')
}))

// Mock useCloudFunction hook with proper error handling
const callFunctionMock = vi.fn()
vi.mock('../../hooks/useCloudFunction', () => ({
  useCloudFunction: () => ({
    callFunction: callFunctionMock,
    loading: false,
    error: null
  })
}))

// Mock useRBAC context
const switchRoleMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../contexts/RBACContext', () => ({
  useRBAC: () => ({
    switchRole: switchRoleMock,
    currentRole: null,
    permissions: []
  })
}))

// Mock useCloudbase hook
const signInWithTicketMock = vi.fn().mockResolvedValue({ user: { uid: 'test-user-123' } })
const refreshLoginStateMock = vi.fn().mockResolvedValue(undefined)
vi.mock('../../hooks/useCloudbase', () => ({
  useCloudbase: () => ({
    auth: {
      customAuthProvider: () => ({
        signInWithTicket: signInWithTicketMock
      })
    },
    refreshLoginState: refreshLoginStateMock
  })
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
global.localStorage = localStorageMock

describe('QRLogin Component - Enhanced Test Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    // Reset localStorage mock
    localStorageMock.getItem.mockReturnValue(null)

    // Default successful cloud function response
    callFunctionMock.mockImplementation(async (fnName: string, data: any) => {
      if (fnName === 'qrLogin') {
        if (data.action === 'qrInit') {
          return {
            success: true,
            data: {
              sessionId: 'test-session-123',
              qrData: 'test-qr-payload-encrypted',
              expiresAt: Date.now() + 90000,
              nonce: 'test-nonce-123'
            }
          }
        }
        if (data.action === 'qrStatus') {
          return {
            success: true,
            data: {
              status: 'approved',
              message: '登录成功',
              loginTicket: 'test-login-ticket-123',
              userInfo: {
                uid: 'test-user-123',
                selectedRole: 'admin',
                roles: ['admin'],
                nickName: '测试管理员',
                avatarUrl: 'https://example.com/avatar.jpg'
              },
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
      return { success: false, error: { code: 'UNKNOWN_ACTION', message: '未知操作' } }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('🚀 Basic Functionality', () => {
    it('renders role selector in multi mode', () => {
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

      // Check all role buttons are present
      expect(screen.getByText('系统管理员')).toBeInTheDocument()
      expect(screen.getByText('社工')).toBeInTheDocument()
      expect(screen.getByText('志愿者')).toBeInTheDocument()
      expect(screen.getByText('家长')).toBeInTheDocument()
      expect(screen.getByText('游客')).toBeInTheDocument()
    })

    it('shows single role in single mode', () => {
      const onLoginSuccess = vi.fn()
      const onLoginError = vi.fn()

      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={onLoginSuccess}
          onLoginError={onLoginError}
        />
      )

      // Should show admin role info
      expect(screen.getByText('系统管理员')).toBeInTheDocument()
      expect(screen.getByText('拥有完整的系统管理权限，可以管理用户、配置系统、查看所有数据')).toBeInTheDocument()
    })

    it('generates QR code when role button is clicked', async () => {
      const onLoginSuccess = vi.fn()
      const onLoginError = vi.fn()

      render(
        <QRLogin
          mode="multi"
          onLoginSuccess={onLoginSuccess}
          onLoginError={onLoginError}
        />
      )

      const adminButton = screen.getByText('系统管理员')
      fireEvent.click(adminButton)

      await waitFor(() => {
        expect(callFunctionMock).toHaveBeenCalledWith('qrLogin', expect.objectContaining({
          action: 'qrInit',
          type: 'admin',
          deviceInfo: expect.any(Object),
          metadata: expect.objectContaining({
            source: 'web_admin',
            version: '1.0.0'
          })
        }))
      })

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })
    })
  })

  describe('🔄 Login Flow', () => {
    it('completes successful login flow', async () => {
      const onLoginSuccess = vi.fn()
      const onLoginError = vi.fn()

      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={onLoginSuccess}
          onLoginError={onLoginError}
        />
      )

      // Step 1: Generate QR code
      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      // Step 2: Simulate polling response
      vi.advanceTimersByTime(2100)

      await waitFor(() => {
        expect(onLoginSuccess).toHaveBeenCalledWith(expect.objectContaining({
          uid: 'test-user-123',
          selectedRole: 'admin',
          roles: ['admin'],
          nickName: '测试管理员'
        }))
      })

      // Verify CloudBase authentication was called
      expect(signInWithTicketMock).toHaveBeenCalledWith('test-login-ticket-123')
      expect(refreshLoginStateMock).toHaveBeenCalled()
      expect(switchRoleMock).toHaveBeenCalledWith('admin')
    })

    it('handles QR code scanning status', async () => {
      // Mock scanned status
      callFunctionMock.mockImplementation(async (fnName: string, data: any) => {
        if (fnName === 'qrLogin' && data.action === 'qrInit') {
          return {
            success: true,
            data: {
              sessionId: 'test-session-123',
              qrData: 'test-qr-payload',
              expiresAt: Date.now() + 90000,
              nonce: 'test-nonce'
            }
          }
        }
        if (fnName === 'qrLogin' && data.action === 'qrStatus') {
          return {
            success: true,
            data: {
              status: 'scanned',
              message: '二维码已扫描，请在小程序中确认登录'
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

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      // Trigger status update
      vi.advanceTimersByTime(2100)

      await waitFor(() => {
        expect(screen.getByText('请在小程序中确认登录')).toBeInTheDocument()
      })
    })
  })

  describe('⏰ QR Code Expiry & Refresh', () => {
    it('handles QR code expiration', async () => {
      // Mock expired status
      callFunctionMock.mockImplementation(async (fnName: string, data: any) => {
        if (fnName === 'qrLogin' && data.action === 'qrInit') {
          return {
            success: true,
            data: {
              sessionId: 'test-session-123',
              qrData: 'test-qr-payload',
              expiresAt: Date.now() + 90000,
              nonce: 'test-nonce'
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

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      // Trigger expiration
      vi.advanceTimersByTime(2100)

      await waitFor(() => {
        expect(screen.getByText('二维码已过期')).toBeInTheDocument()
      })
    })

    it('auto-refreshes QR code up to max retries', async () => {
      let initCallCount = 0
      callFunctionMock.mockImplementation(async (fnName: string, data: any) => {
        if (fnName === 'qrLogin' && data.action === 'qrInit') {
          initCallCount++
          return {
            success: true,
            data: {
              sessionId: `test-session-${initCallCount}`,
              qrData: `test-qr-payload-${initCallCount}`,
              expiresAt: Date.now() + 90000,
              nonce: `test-nonce-${initCallCount}`
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

      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      // Trigger multiple refresh cycles
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(2100)
        await vi.waitUntil(() => true)
      }

      // Should have called init multiple times (initial + refreshes)
      expect(initCallCount).toBeGreaterThan(1)
    })
  })

  describe('❌ Error Handling', () => {
    it('handles QR code generation errors', async () => {
      callFunctionMock.mockRejectedValue(new Error('网络连接失败'))

      const onLoginError = vi.fn()
      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={onLoginError}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(onLoginError).toHaveBeenCalledWith(expect.any(Error))
      })

      await waitFor(() => {
        expect(screen.getByText('网络连接失败')).toBeInTheDocument()
      })
    })

    it('handles CloudBase authentication errors', async () => {
      signInWithTicketMock.mockRejectedValue(new Error('CloudBase认证失败'))

      const onLoginError = vi.fn()
      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={onLoginError}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      // Trigger successful QR status but failed authentication
      vi.advanceTimersByTime(2100)

      await waitFor(() => {
        expect(onLoginError).toHaveBeenCalledWith(expect.any(Error))
      })

      await waitFor(() => {
        expect(screen.getByText(/CloudBase认证失败/)).toBeInTheDocument()
      })
    })

    it('handles polling errors gracefully', async () => {
      callFunctionMock.mockImplementation(async (fnName: string, data: any) => {
        if (fnName === 'qrLogin' && data.action === 'qrInit') {
          return {
            success: true,
            data: {
              sessionId: 'test-session-123',
              qrData: 'test-qr-payload',
              expiresAt: Date.now() + 90000,
              nonce: 'test-nonce'
            }
          }
        }
        if (fnName === 'qrLogin' && data.action === 'qrStatus') {
          throw new Error('轮询请求失败')
        }
        return { success: false }
      })

      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      // Polling error should not crash the component
      vi.advanceTimersByTime(2100)

      // QR code should still be displayed
      expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
    })
  })

  describe('🛡️ Security Features', () => {
    it('includes device information in QR generation', async () => {
      const onLoginSuccess = vi.fn()
      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={onLoginSuccess}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(callFunctionMock).toHaveBeenCalledWith('qrLogin', expect.objectContaining({
          deviceInfo: expect.objectContaining({
            userAgent: expect.any(String),
            screenResolution: expect.any(String),
            timezone: expect.any(String),
            language: expect.any(String),
            platform: expect.any(String),
            colorDepth: expect.any(Number)
          })
        }))
      })
    })

    it('stores user roles in localStorage on successful login', async () => {
      const onLoginSuccess = vi.fn()
      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={onLoginSuccess}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      vi.advanceTimersByTime(2100)

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'USER_ROLES',
          JSON.stringify(['admin'])
        )
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'SELECTED_ROLE',
          JSON.stringify('admin')
        )
      })
    })
  })

  describe('🎯 UI Interaction', () => {
    it('shows countdown timer', async () => {
      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByText(/剩余时间/)).toBeInTheDocument()
      })

      // Timer should count down
      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        expect(screen.getByText(/1:2/)).toBeInTheDocument() // Should show remaining time
      })
    })

    it('shows warning when time is running out', async () => {
      // Mock QR with less time remaining
      callFunctionMock.mockImplementation(async (fnName: string, data: any) => {
        if (fnName === 'qrLogin' && data.action === 'qrInit') {
          return {
            success: true,
            data: {
              sessionId: 'test-session-123',
              qrData: 'test-qr-payload',
              expiresAt: Date.now() + 8000, // Only 8 seconds
              nonce: 'test-nonce'
            }
          }
        }
        return { success: false }
      })

      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      // Fast forward to when warning should appear
      vi.advanceTimersByTime(5000)

      await waitFor(() => {
        expect(screen.getByText('即将过期')).toBeInTheDocument()
      })
    })

    it('allows manual QR refresh', async () => {
      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      const refreshButton = screen.getByText(/刷新二维码/)
      expect(refreshButton).toBeInTheDocument()
      expect(refreshButton).not.toBeDisabled()

      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(callFunctionMock).toHaveBeenCalledTimes(2) // Initial + refresh
      })
    })

    it('allows login cancellation', async () => {
      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        expect(screen.getByAltText('登录二维码')).toBeInTheDocument()
      })

      const cancelButton = screen.getByText('取消登录')
      fireEvent.click(cancelButton)

      await waitFor(() => {
        expect(callFunctionMock).toHaveBeenCalledWith('qrLogin', expect.objectContaining({
          action: 'qrCancel',
          sessionId: 'test-session-123',
          reason: 'user_cancelled'
        }))
      })
    })
  })

  describe('♿ Accessibility', () => {
    it('has proper ARIA labels and semantic HTML', () => {
      render(
        <QRLogin
          mode="multi"
          onLoginSuccess={() => {}}
          onLoginError={() => {}}
        />
      )

      // Check for main heading
      expect(screen.getByRole('heading', { name: '扫码登录' })).toBeInTheDocument()

      // Check for accessible buttons
      const roleButtons = screen.getAllByRole('button')
      expect(roleButtons.length).toBeGreaterThan(0)

      // Check for descriptive text
      expect(screen.getByText('选择您的角色，使用微信小程序扫码快速登录')).toBeInTheDocument()
    })

    it('provides alternative text for QR code image', async () => {
      render(
        <QRLogin
          mode="admin"
          onLoginSuccess={() => {}}
          onLoginError={() => {}}
        />
      )

      fireEvent.click(screen.getByText('系统管理员'))

      await waitFor(() => {
        const qrImage = screen.getByAltText('登录二维码')
        expect(qrImage).toBeInTheDocument()
      })
    })
  })
})