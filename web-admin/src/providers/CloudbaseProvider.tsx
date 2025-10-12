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
  // E2E 测试模式：通过 localStorage("E2E_BYPASS_LOGIN"=1) 启用
  const isE2ETestBypass =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.localStorage.getItem('E2E_BYPASS_LOGIN') === '1';
      } catch {
        return false;
      }
    })();

  // 提供一个极简的 stub CloudBase，覆盖 callFunction 与认证相关方法
  function createE2EStub() {
    const store: any = {
      users: [{ uid: 'e2e-uid', username: 'e2e-admin', role: 'admin' }],
      patients: [
        {
          patientKey: 'p-001',
          patientName: '张三',
          gender: '男',
          birthDate: '2010-06-01',
          latestAdmissionTimestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
          latestHospital: '协和医院',
          latestDiagnosis: '骨髓异常',
          admissionCount: 2,
          careStatus: 'in_care',
        },
        {
          patientKey: 'p-002',
          patientName: '李四',
          gender: '女',
          birthDate: '2012-03-15',
          latestAdmissionTimestamp: Date.now() - 50 * 24 * 60 * 60 * 1000,
          latestHospital: '湘雅医院',
          latestDiagnosis: '免疫缺陷',
          admissionCount: 1,
          careStatus: 'pending',
        },
        {
          patientKey: 'p-003',
          patientName: '王五',
          gender: '男',
          birthDate: '2008-11-20',
          latestAdmissionTimestamp: Date.now() - 200 * 24 * 60 * 60 * 1000,
          latestHospital: '北医三院',
          latestDiagnosis: '白血病',
          admissionCount: 3,
          careStatus: 'discharged',
          checkoutAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        },
      ],
    };

    const user = { uid: 'e2e-uid', customUserId: 'admin:e2e-admin' } as any;

    const auth: any = {
      async getLoginState() {
        return { user, credential: { refreshTime: Date.now() } };
      },
      async signOut() {
        return;
      },
      customAuthProvider() {
        return {
          async signInWithTicket(_ticket: string) {
            return { user };
          },
        };
      },
      signInAnonymously: async () => {},
      anonymousAuthProvider: () => ({ signIn: async () => {} }),
    };

    const app: any = {
      async callFunction({ name, data }: any) {
        if (name === DEFAULTS.authFunctionName) {
          // 模拟登录云函数
          if (data && data.action === 'login') {
            if (!data.username || !data.password) {
              return { result: { success: false, error: { message: '缺少用户名或口令' } } };
            }
            return {
              result: {
                success: true,
                ticket: 'e2e-ticket',
                user: { uid: 'e2e-uid', username: data.username, role: 'admin' },
              },
            };
          }
        }
        if (name === 'patientProfile') {
          if (data && data.action === 'list') {
            return {
              result: {
                success: true,
                patients: store.patients,
                totalCount: store.patients.length,
                hasMore: false,
              },
            };
          }
          if (data && data.action === 'export') {
            return { result: { success: true, fileId: 'file-e2e-001' } };
          }
          if (data && data.action === 'delete') {
            const key = data.patientKey;
            const before = store.patients.length;
            store.patients = store.patients.filter((p: any) => (p.patientKey || p.key) !== key);
            const changed = store.patients.length !== before;
            return changed
              ? { result: { success: true } }
              : { result: { success: false, error: { message: '未找到住户' } } };
          }
        }
        if (name === 'patientIntake') {
          if (data && data.action === 'updateCareStatus') {
            const { patientKey, status } = data || {};
            const item = store.patients.find((p: any) => p.patientKey === patientKey);
            if (!item) {
              return { result: { success: false, error: { message: '未找到住户' } } };
            }
            item.careStatus = status;
            return { result: { success: true } };
          }
        }
        // 默认成功回包
        return { result: { success: true } };
      },
      auth() {
        return auth;
      },
    };

    return { app: app as CloudBase, auth: auth as Auth };
  }

  const [app, setApp] = useState<CloudBase | null>(() => {
    if (isE2ETestBypass) {
      return createE2EStub().app;
    }
    return DEFAULTS.envId ? tcb.init({ env: DEFAULTS.envId }) : null;
  });
  const [auth, setAuth] = useState<Auth | null>(null);
  const [user, setUser] = useState<CloudbaseContextValue['user']>(
    isE2ETestBypass
      ? { uid: 'e2e-uid', username: 'e2e-admin', role: 'admin', ticketIssuedAt: Date.now() }
      : null
  );
  const [loading, setLoading] = useState(!isE2ETestBypass);

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
    if (isE2ETestBypass) {
      const stub = createE2EStub();
      setApp(stub.app);
      await initAuthForApp(stub.app);
      return stub.app;
    }
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
  }, [initAuthForApp, isE2ETestBypass]);

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
