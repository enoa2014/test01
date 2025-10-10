import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import tcb, { CloudBase, Auth } from '@cloudbase/js-sdk';

type CloudbaseContextValue = {
  app: CloudBase | null;
  auth: Auth | null;
  user: {
    uid: string;
    username?: string;
    role?: string;
    ticketIssuedAt?: number;
  } | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshLoginState: () => Promise<void>;
};

const CloudbaseContext = createContext<CloudbaseContextValue | undefined>(undefined);

const DEFAULTS = {
  envId: import.meta.env.VITE_TCB_ENV_ID as string,
  authFunctionName: (import.meta.env.VITE_AUTH_FUNCTION_NAME as string) || 'auth'
};

if (!DEFAULTS.envId) {
  console.warn('VITE_TCB_ENV_ID is not configured; cloud calls will fail until provided.');
}

export const CloudbaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [app] = useState(() => (DEFAULTS.envId ? tcb.init({ env: DEFAULTS.envId }) : null));
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<CloudbaseContextValue['user']>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!app) {
      setLoading(false);
      return;
    }
    const instance = app.auth({ persistence: 'local' });
    setAuth(instance);
    let cancelled = false;

    (async () => {
      try {
        const state = await instance.getLoginState();
        if (!cancelled && state && state.user) {
          setUser({
            uid: state.user.uid,
            username: state.user?.customUserId || state.user?.uid,
            role: state.user?.customUserId?.split(':')[0],
            ticketIssuedAt: state.credential?.refreshTime
          });
        }
      } catch (error) {
        console.warn('Unable to load CloudBase login state', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [app]);

  const ensureAnonymousLogin = useCallback(async () => {
    if (!auth) {
      throw new Error('CloudBase auth not ready.');
    }

    const state = await auth.getLoginState();
    if (state) {
      return;
    }

    if (typeof auth.signInAnonymously === 'function') {
      await auth.signInAnonymously();
      return;
    }

    if (typeof auth.anonymousAuthProvider === 'function') {
      await auth.anonymousAuthProvider().signIn();
      return;
    }

    console.warn('Anonymous login is not supported by the current CloudBase SDK runtime.');
  }, [auth]);

  const refreshLoginState = useCallback(async () => {
    if (!auth) {
      setUser(null);
      return;
    }
    const state = await auth.getLoginState();
    if (state && state.user) {
      setUser({
        uid: state.user.uid,
        username: state.user?.customUserId || state.user?.uid,
        role: state.user?.customUserId?.split(':')[0],
        ticketIssuedAt: state.credential?.refreshTime
      });
    } else {
      setUser(null);
    }
  }, [auth]);

  const login = useCallback(
    async (username: string, password: string) => {
      if (!app || !auth) {
        throw new Error('CloudBase 未初始化');
      }
      await ensureAnonymousLogin();
      const res = await app.callFunction({
        name: DEFAULTS.authFunctionName,
        data: { action: 'login', username, password }
      });
      if (!res.result || !res.result.success) {
        const message = res.result?.error?.message || '登录失败';
        throw new Error(message);
      }

      const { ticket, user: userInfo } = res.result;
      if (!ticket) {
        throw new Error('未获取到登录凭据');
      }
      const loginState = await auth.customAuthProvider().signInWithTicket(ticket);
      const nextUser = {
        uid: loginState.user?.uid || userInfo?.uid || '',
        username: userInfo?.username || loginState.user?.customUserId,
        role: userInfo?.role,
        ticketIssuedAt: Date.now()
      };
      setUser(nextUser);
    },
    [app, auth, ensureAnonymousLogin]
  );

  const logout = useCallback(async () => {
    if (!auth) {
      setUser(null);
      return;
    }
    await auth.signOut();
    setUser(null);
  }, [auth]);

  const value = useMemo<CloudbaseContextValue>(
    () => ({ app, auth, user, loading, login, logout, refreshLoginState }),
    [app, auth, user, loading, login, logout, refreshLoginState]
  );

  return <CloudbaseContext.Provider value={value}>{children}</CloudbaseContext.Provider>;
};

export function useCloudbaseContext(): CloudbaseContextValue {
  const ctx = useContext(CloudbaseContext);
  if (!ctx) {
    throw new Error('useCloudbaseContext must be used within CloudbaseProvider');
  }
  return ctx;
}
