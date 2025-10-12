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
  const [app, setApp] = useState<CloudBase | null>(() =>
    DEFAULTS.envId ? tcb.init({ env: DEFAULTS.envId }) : null
  );
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<CloudbaseContextValue['user']>(null);
  const [loading, setLoading] = useState(true);

  const initAuthForApp = useCallback(async (appInstance: CloudBase | null) => {
    if (!appInstance) {
      setAuth(null);
      return null;
    }
    const instance = appInstance.auth({ persistence: 'local' });
    setAuth(instance);
    return instance;
  }, []);

  // 尝试使用 SDK 的“当前环境”符号进行回退初始化
  const tryReinitWithFallbackEnv = useCallback(async (): Promise<CloudBase | null> => {
    try {
      const sym: any = (tcb as any).SYMBOL_CURRENT_ENV;
      if (sym) {
        const newApp = tcb.init({ env: sym });
        await initAuthForApp(newApp);
        setApp(newApp);
        return newApp;
      }
    } catch (_) {
      // ignore
    }
    return null;
  }, [initAuthForApp]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let currentApp = app;
      if (!currentApp) {
        currentApp = await tryReinitWithFallbackEnv();
        if (!currentApp) {
          setLoading(false);
          return;
        }
      }
      const instance = await initAuthForApp(currentApp);
      if (!instance) {
        setLoading(false);
        return;
      }
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
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app, initAuthForApp, tryReinitWithFallbackEnv]);

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
      const execLogin = async (appInstance: CloudBase, authInstance: Auth) => {
        // 确保具备最小权限以调用云函数（匿名登录）
        const state = await authInstance.getLoginState();
        if (!state) {
          if (typeof authInstance.signInAnonymously === 'function') {
            await authInstance.signInAnonymously();
          } else if (typeof authInstance.anonymousAuthProvider === 'function') {
            await authInstance.anonymousAuthProvider().signIn();
          }
        }
        const res = await appInstance.callFunction({
          name: DEFAULTS.authFunctionName,
          data: { action: 'login', username, password }
        });
        if (!res.result || !res.result.success) {
          const message = res.result?.error?.message || '登录失败';
          throw new Error(message);
        }
        const { ticket, user: userInfo } = res.result as any;
        if (!ticket) {
          throw new Error('未获取到登录凭据');
        }
        const loginState = await authInstance.customAuthProvider().signInWithTicket(ticket);
        const nextUser = {
          uid: loginState.user?.uid || userInfo?.uid || '',
          username: userInfo?.username || loginState.user?.customUserId,
          role: userInfo?.role,
          ticketIssuedAt: Date.now()
        };
        setUser(nextUser);
      };

      const isEnvConfigError = (err: unknown) => {
        const msg = String((err as any)?.message || '').toLowerCase();
        return (
          msg.includes('no env in config') ||
          msg.includes('missing env id') ||
          (msg.includes('env') && msg.includes('config'))
        );
      };

      if (!app || !auth) {
        const newApp = await tryReinitWithFallbackEnv();
        const newAuth = await initAuthForApp(newApp);
        if (newApp && newAuth) {
          try {
            await execLogin(newApp, newAuth);
            return;
          } catch (e) {
            if (!isEnvConfigError(e)) throw e;
            await new Promise(r => setTimeout(r, 600));
            await execLogin(newApp, newAuth);
            return;
          }
        }
        throw new Error('CloudBase 未初始化或缺少环境 ID');
      }

      try {
        await execLogin(app, auth);
      } catch (e) {
        if (!isEnvConfigError(e)) throw e;
        const newApp = await tryReinitWithFallbackEnv();
        const newAuth = await initAuthForApp(newApp);
        if (!newApp || !newAuth) {
          await new Promise(r => setTimeout(r, 600));
          await execLogin(app, auth);
          return;
        }
        try {
          await execLogin(newApp, newAuth);
        } catch (_) {
          await new Promise(r => setTimeout(r, 600));
          await execLogin(newApp, newAuth);
        }
      }
    },
    [app, auth, ensureAnonymousLogin, initAuthForApp, tryReinitWithFallbackEnv]
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
