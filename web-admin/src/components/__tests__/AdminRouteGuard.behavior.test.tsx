import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

// 每个用例通过局部 mock hooks/useRBAC，避免与全局 setup 冲突
const mockUseRBAC = (opts: { user?: any; loading?: boolean; isAdmin?: boolean } = {}) => {
  vi.doMock('../../hooks/useRBAC', () => ({
    useRBAC: () => ({
      user: (Object.prototype.hasOwnProperty.call(opts, 'user'))
        ? opts.user
        : { userId: 'u1', roles: ['admin'], displayName: 'Test Admin' },
      loading: opts.loading ?? false,
      isAdmin: opts.isAdmin ?? true,
      isSocialWorker: false,
      hasAnyRole: () => true,
      hasRole: () => true,
      refreshUser: async () => {},
    }),
  }));
};

describe('AdminRouteGuard(behavior)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('requireAdmin=true 且 isAdmin=true 时应渲染子内容', async () => {
    mockUseRBAC({ isAdmin: true, user: { userId: 'u1', roles: ['admin'], displayName: 'Admin' } });
    const { AdminRouteGuard } = await import('../AdminRouteGuard');

    render(
      React.createElement(MemoryRouter, { initialEntries: ['/admin'] },
        React.createElement(Routes, null,
          React.createElement(Route, {
            path: '/admin',
            element: React.createElement(AdminRouteGuard, { requireAdmin: true },
              React.createElement('div', { 'data-testid': 'protected' }, '受保护内容')
            )
          })
        )
      )
    );

    expect(screen.getByTestId('protected')).toBeInTheDocument();
  });

  it('requireAdmin=true 且 isAdmin=false 时应显示权限不足', async () => {
    mockUseRBAC({ isAdmin: false, user: { userId: 'u2', roles: ['user'], displayName: 'User' } });
    const { AdminRouteGuard } = await import('../AdminRouteGuard');

    render(
      React.createElement(MemoryRouter, { initialEntries: ['/admin'] },
        React.createElement(Routes, null,
          React.createElement(Route, {
            path: '/admin',
            element: React.createElement(AdminRouteGuard, { requireAdmin: true },
              React.createElement('div', { 'data-testid': 'protected' }, '受保护内容')
            )
          })
        )
      )
    );

    expect(screen.getByText('权限不足')).toBeInTheDocument();
  });

  it('未登录(user=null)时应重定向到fallback', async () => {
    mockUseRBAC({ user: null, isAdmin: false });
    const { AdminRouteGuard } = await import('../AdminRouteGuard');

    render(
      React.createElement(MemoryRouter, { initialEntries: ['/admin'] },
        React.createElement(Routes, null,
          React.createElement(Route, {
            path: '/admin',
            element: React.createElement(AdminRouteGuard, { fallback: '/login' },
              React.createElement('div', { 'data-testid': 'protected' }, '受保护内容')
            )
          }),
          React.createElement(Route, {
            path: '/login',
            element: React.createElement('div', { 'data-testid': 'login' }, '登录页')
          })
        )
      )
    );

    expect(screen.getByTestId('login')).toBeInTheDocument();
  });
});
