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
    authSource?: 'cloudbase' | 'manual';
  } | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithTicket: (ticket: string, userInfo?: any) => Promise<void>;
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

const LOCAL_SESSION_KEY = 'WEB_ADMIN_MANUAL_SESSION';

const readManualSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeManualSession = (data: any) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LOCAL_SESSION_KEY,
      JSON.stringify({ ...data, timestamp: Date.now() })
    );
  } catch {
    // ignore storage failures
  }
};

const clearManualSession = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
  } catch {
    // ignore
  }
};

export const CloudbaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // E2E / 本地开发绕过：
  // - 运行时：localStorage("E2E_BYPASS_LOGIN") === '1'
  // - 编译时：VITE_E2E_BYPASS_LOGIN=1 | true
  const ENV_BYPASS =
    (import.meta as any)?.env?.VITE_E2E_BYPASS_LOGIN === '1' ||
    String((import.meta as any)?.env?.VITE_E2E_BYPASS_LOGIN || '')?.toLowerCase() === 'true';
  const isE2ETestBypass =
    ENV_BYPASS ||
    (typeof window !== 'undefined' &&
      (() => {
        try {
          return window.localStorage.getItem('E2E_BYPASS_LOGIN') === '1';
        } catch {
          return false;
        }
      })());

  // 提供一个极简的 stub CloudBase，覆盖 callFunction 与认证相关方法
  function createE2EStub() {
    const store: any = {
      users: [{ uid: 'e2e-uid', username: 'e2e-admin', role: 'admin' }],
      invites: [],
      patients: [
        {
          _id: 'p-001',
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
          _id: 'p-002',
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
          _id: 'p-003',
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
        if (name === 'rbac') {
          const action = data?.action;
          if (action === 'listInvites') {
            const items = store.invites
              .filter((it: any) => (data?.state ? it.state === data.state : true))
              .filter((it: any) => (data?.role ? it.role === data.role : true))
              .sort((a: any, b: any) => b.createdAt - a.createdAt);
            return { result: { success: true, data: { items, total: items.length } } };
          }
          if (action === 'createInvite') {
            const code = Math.random().toString(36).slice(2, 10).toUpperCase();
            const invite = {
              id: 'e2e-invite-' + Date.now(),
              code,
              role: data.role,
              scopeId: data.patientId || null,
              usesLeft: Number.isFinite(data.uses) ? data.uses : 1,
              expiresAt: data.expiresAt || null,
              state: 'active',
              createdBy: 'e2e-uid',
              createdAt: Date.now(),
              sharePath: `pages/auth/invite-code/index?code=${code}`,
            };
            store.invites.push(invite);
            return { result: { success: true, data: { code, inviteId: invite.id, sharePath: invite.sharePath } } };
          }
          if (action === 'generateInviteQr') {
            const found = store.invites.find((it: any) => it.id === data?.inviteId);
            if (!found) return { result: { success: false, error: { message: '邀请不存在' } } };
            const url = `data:image/png;base64,${btoa('QR:' + found.code)}`;
            found.qrUrl = url;
            return { result: { success: true, data: { url } } };
          }
          if (action === 'revokeInvite') {
            const found = store.invites.find((it: any) => it.id === data?.inviteId);
            if (!found) return { result: { success: false, error: { message: '邀请不存在' } } };
            found.state = 'revoked';
            return { result: { success: true } };
          }
          // default success for other RBAC actions
          return { result: { success: true } };
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
      ? {
          uid: 'e2e-uid',
          username: 'e2e-admin',
          role: 'admin',
          ticketIssuedAt: Date.now(),
          authSource: 'manual'
        }
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
      const manual = readManualSession();
      if (manual?.user && !cancelled) {
        setUser({
          ...manual.user,
          authSource: manual.user?.authSource || 'manual'
        });
      }

      let currentApp = app;
      if (!currentApp) {
        currentApp = await tryReinitWithFallbackEnv();
      }

      if (!currentApp) {
        if (!cancelled) setLoading(false);
        return;
      }

      const instance = await initAuthForApp(currentApp);
      if (!instance) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const state = await instance.getLoginState();
        if (!cancelled && state && state.user) {
          // 角色/用户名回退：优先使用 customUserId 中的前缀；否则读取本地存储
          let storedRole = '';
          let storedName = '';
          try {
            storedRole = window.localStorage.getItem('CLOUD_USER_ROLE') || '';
            storedName = window.localStorage.getItem('CLOUD_USER_NAME') || '';
          } catch {}
          const parsedRole = (state.user?.customUserId || '').includes(':')
            ? String(state.user?.customUserId).split(':')[0]
            : '';
          setUser({
            uid: state.user.uid,
            username: state.user?.customUserId || storedName || state.user?.uid,
            role: parsedRole || storedRole || undefined,
            ticketIssuedAt: state.credential?.refreshTime,
            authSource: 'cloudbase'
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

  // 始终用服务端代理重写 callFunction，避免浏览器域名限制
  const appWithProxy = useMemo<CloudBase | null>(() => {
    if (!app) return null;
    const original: any = app as any;
    const proxy: any = Object.create(original);
    proxy.callFunction = async ({ name, data }: any) => {
      // 透传前端登录用户的主体ID到云函数（用于 Web 自定义登录场景）
      const enriched = {
        ...(data || {}),
        __principalId: (user && (user.uid || user.username)) || '',
        __role: (user && user.role) || '',
      };
      try {
        const resp = await fetch(`/api/func/${encodeURIComponent(name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: enriched })
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || json?.error) {
          const message = json?.error?.message || `调用云函数失败: ${name}`;
          throw new Error(message);
        }
        // 对齐浏览器 SDK 返回结构
        return { result: json };
      } catch (proxyError) {
        console.warn(
          `[CloudbaseProvider] Proxy 调用失败，回退使用 SDK 原生 callFunction:`,
          proxyError
        );
        // 回退使用 SDK 原生 callFunction
        return await original.callFunction({ name, data });
      }
    };
    return proxy as CloudBase;
  }, [app, user]);

  const refreshLoginState = useCallback(async () => {
    if (!auth) {
      const manual = readManualSession();
      if (manual?.user) {
        setUser({
          ...manual.user,
          authSource: manual.user?.authSource || 'manual'
        });
      } else {
        setUser(null);
      }
      return;
    }
    const state = await auth.getLoginState();
    if (state && state.user) {
      let storedRole = '';
      let storedName = '';
      try {
        storedRole = window.localStorage.getItem('CLOUD_USER_ROLE') || '';
        storedName = window.localStorage.getItem('CLOUD_USER_NAME') || '';
      } catch {}
      const parsedRole = (state.user?.customUserId || '').includes(':')
        ? String(state.user?.customUserId).split(':')[0]
        : '';
      setUser({
        uid: state.user.uid,
        username: state.user?.customUserId || storedName || state.user?.uid,
        role: parsedRole || storedRole || undefined,
        ticketIssuedAt: state.credential?.refreshTime,
        authSource: 'cloudbase'
      });
    } else {
      const manual = readManualSession();
      if (manual?.user) {
        setUser({
          ...manual.user,
          authSource: manual.user?.authSource || 'manual'
        });
      } else {
        setUser(null);
      }
    }
  }, [auth]);

  const login = useCallback(
    async (username: string, password: string) => {
      const buildManualSession = (fallbackUser: any) => {
        const manualUser = {
          uid: fallbackUser?.uid || `manual:${fallbackUser?.username || username}`,
          customUserId:
            fallbackUser?.username || username
              ? `${fallbackUser?.role || 'admin'}:${fallbackUser?.username || username}`
              : fallbackUser?.uid || username,
          ...fallbackUser,
        };
        return { loginState: { user: manualUser }, source: 'manual' as const };
      };

      const performTicketSignIn = async (
        authInstance: Auth,
        ticket: string,
        fallbackUser: any
      ): Promise<{ loginState: any; source: 'cloudbase' | 'manual' }> => {
        const shouldFallbackToManual = (error: unknown) => {
          const code = String((error as any)?.code || '').toLowerCase();
          const message = String((error as any)?.message || '').toLowerCase();
          if (!code && !message) return false;
          return (
            code.includes('domain') ||
            code.includes('network') ||
            code.includes('requestfail') ||
            message.includes('domain') ||
            message.includes('安全域名') ||
            message.includes('not in valid request domain') ||
            message.includes('request domain') ||
            message.includes('network request fail') ||
            message.includes('network error')
          );
        };

        const trySignIn = async (
          signer: ((ticket: string) => Promise<any>) | undefined,
          context?: any
        ) => {
          if (typeof signer !== 'function') return null;
          try {
            const loginState = await signer.call(context, ticket);
            return { loginState, source: 'cloudbase' as const };
          } catch (err) {
            if (shouldFallbackToManual(err)) {
              console.warn(
                '[CloudbaseProvider] signInWithTicket failed, fallback to manual session.',
                err
              );
              return buildManualSession(fallbackUser);
            }
            throw err;
          }
        };

        const candidate = (authInstance as any).customAuthProvider;
        if (typeof candidate === 'function') {
          const provider = candidate.call(authInstance);
          const result = await trySignIn(provider?.signInWithTicket, provider);
          if (result) return result;
        } else if (candidate && typeof candidate.signInWithTicket === 'function') {
          const result = await trySignIn(candidate.signInWithTicket, candidate);
          if (result) return result;
        }

        const direct = (authInstance as any).signInWithTicket;
        const directResult = await trySignIn(direct, authInstance);
        if (directResult) return directResult;

        console.warn(
          '当前 CloudBase SDK 缺少 customAuthProvider/signInWithTicket，已使用手动会话回退。'
        );
        return buildManualSession(fallbackUser);
      };

      const callAuthViaProxy = async (payload: any): Promise<{ result: any } | null> => {
        if (typeof fetch !== 'function') return null;
        try {
          const response = await fetch(`/api/func/${encodeURIComponent(DEFAULTS.authFunctionName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: payload })
          });
          const json = await response.json().catch(() => ({}));
          if (!response.ok || json?.error) {
            const message = json?.error?.message || `调用云函数失败: ${DEFAULTS.authFunctionName}`;
            throw new Error(message);
          }
          return { result: json };
        } catch (proxyError) {
          console.warn(
            '[CloudbaseProvider] Proxy login call failed, fallback to CloudBase SDK callFunction.',
            proxyError
          );
          return null;
        }
      };

      const execLogin = async (appInstance: CloudBase, authInstance: Auth) => {
        if (import.meta.env.DEV) {
          // 仅在开发环境打印一次可用方法，便于排查 SDK 差异
          try {
            const marker = (authInstance as any).__loggedMethods;
            if (!marker) {
              Object.defineProperty(authInstance, '__loggedMethods', { value: true, enumerable: false });
              // eslint-disable-next-line no-console
              console.debug('[CloudbaseProvider] authInstance methods:', Object.keys(authInstance).sort());
            }
          } catch {
            // ignore logging failure
          }
        }
        // 确保具备最小权限以调用云函数（匿名登录）
        let state: any = null;
        try {
          state = await authInstance.getLoginState();
        } catch (err) {
          console.warn('[CloudbaseProvider] getLoginState failed, continue with anonymous auth.', err);
        }
        if (!state) {
          try {
            if (typeof authInstance.signInAnonymously === 'function') {
              await authInstance.signInAnonymously();
            } else if (typeof authInstance.anonymousAuthProvider === 'function') {
              await authInstance.anonymousAuthProvider().signIn();
            }
          } catch (anonError) {
            console.warn('[CloudbaseProvider] Anonymous auth failed, proceeding without it.', anonError);
          }
        }
        const payload = { action: 'login', username, password };
        const proxyRes = await callAuthViaProxy(payload);
        const res =
          proxyRes ||
          (await appInstance.callFunction({
            name: DEFAULTS.authFunctionName,
            data: payload
          }));
        if (!res.result || !res.result.success) {
          const message = res.result?.error?.message || '登录失败';
          throw new Error(message);
        }
        const { ticket, user: userInfo } = res.result as any;
        if (!ticket) {
          throw new Error('未获取到登录凭据');
        }
        // CloudBase JS SDK 版本兼容：
        // - 旧版（v2）：auth.customAuthProvider().signIn(ticket|withTicket)
        // - 新版（v3）：auth.setCustomSignFunc(() => ticket); await auth.signInWithCustomTicket()
        let loginState: any;
        let source: 'cloudbase' | 'manual' = 'cloudbase';
        const anyAuth: any = authInstance as any;
        try {
          if (typeof anyAuth.customAuthProvider === 'function') {
            const provider = anyAuth.customAuthProvider();
            if (provider && typeof provider.signInWithTicket === 'function') {
              loginState = await provider.signInWithTicket(ticket);
            } else if (provider && typeof provider.signIn === 'function') {
              loginState = await provider.signIn(ticket);
            } else {
              // 回退到 v3 风格
              if (typeof anyAuth.setCustomSignFunc === 'function') {
                anyAuth.setCustomSignFunc(async () => ticket);
              }
              if (typeof anyAuth.signInWithCustomTicket === 'function') {
                loginState = await anyAuth.signInWithCustomTicket();
              } else {
                throw new Error('CloudBase SDK 不支持自定义登录（缺少 signIn/signInWithCustomTicket）');
              }
            }
          } else {
            // 没有 customAuthProvider：使用 v3 接口
            if (typeof anyAuth.setCustomSignFunc === 'function') {
              anyAuth.setCustomSignFunc(async () => ticket);
            }
            if (typeof anyAuth.signInWithCustomTicket === 'function') {
              loginState = await anyAuth.signInWithCustomTicket();
            } else {
              throw new Error('CloudBase SDK 不支持自定义登录（缺少 signInWithCustomTicket）');
            }
          }
        } catch (e) {
          console.warn(
            '[CloudbaseProvider] signInWithTicket failed, fallback to manual session.',
            e
          );
          const manual = buildManualSession(userInfo);
          loginState = manual.loginState;
          source = manual.source;
        }
        const nextUser = {
          uid: loginState.user?.uid || userInfo?.uid || '',
          username: userInfo?.username || loginState.user?.customUserId || username,
          role: userInfo?.role || loginState.user?.role || (loginState.user?.customUserId?.split(':')[0] ?? 'admin'),
          ticketIssuedAt: Date.now(),
          authSource: source
        };
        setUser(nextUser);
        // 持久化角色与用户名，便于后续刷新还原
        try {
          window.localStorage.setItem('CLOUD_USER_ROLE', String(nextUser.role || ''));
          window.localStorage.setItem('CLOUD_USER_NAME', String(nextUser.username || ''));
        } catch {}
        writeManualSession({ user: nextUser, source });
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
    [app, auth, initAuthForApp, tryReinitWithFallbackEnv]
  );

  const loginWithTicket = useCallback(
    async (ticket: string, userInfo?: any) => {
      if (!auth || !app) {
        throw new Error('CloudBase 未初始化');
      }

      try {
        // 确保具备最小权限以调用云函数（匿名登录）
        const state = await auth.getLoginState();
        if (!state) {
          if (typeof auth.signInAnonymously === 'function') {
            await auth.signInAnonymously();
          } else if (typeof auth.anonymousAuthProvider === 'function') {
            await auth.anonymousAuthProvider().signIn();
          }
        }

        // CloudBase JS SDK 版本兼容：
        let loginState: any;
        const anyAuth: any = auth as any;

        try {
          if (typeof anyAuth.customAuthProvider === 'function') {
            const provider = anyAuth.customAuthProvider();
            if (provider && typeof provider.signInWithTicket === 'function') {
              loginState = await provider.signInWithTicket(ticket);
            } else if (provider && typeof provider.signIn === 'function') {
              loginState = await provider.signIn(ticket);
            } else {
              // 回退到 v3 风格
              if (typeof anyAuth.setCustomSignFunc === 'function') {
                anyAuth.setCustomSignFunc(async () => ticket);
              }
              if (typeof anyAuth.signInWithCustomTicket === 'function') {
                loginState = await anyAuth.signInWithCustomTicket();
              } else {
                throw new Error('CloudBase SDK 不支持自定义登录');
              }
            }
          } else {
            // 没有 customAuthProvider：使用 v3 接口
            if (typeof anyAuth.setCustomSignFunc === 'function') {
              anyAuth.setCustomSignFunc(async () => ticket);
            }
            if (typeof anyAuth.signInWithCustomTicket === 'function') {
              loginState = await anyAuth.signInWithCustomTicket();
            } else {
              throw new Error('CloudBase SDK 不支持自定义登录');
            }
          }
        } catch (e) {
          throw e;
        }

        const nextUser = {
          uid: loginState.user?.uid || userInfo?.uid || '',
          username: userInfo?.username || userInfo?.nickName || loginState.user?.customUserId,
          role: userInfo?.role,
          ticketIssuedAt: Date.now()
        };

        setUser(nextUser);

        // 持久化角色与用户名
        try {
          window.localStorage.setItem('CLOUD_USER_ROLE', String(nextUser.role || ''));
          window.localStorage.setItem('CLOUD_USER_NAME', String(nextUser.username || ''));
        } catch {}
      } catch (error) {
        console.error('Ticket登录失败:', error);
        throw error;
      }
    },
    [auth, app]
  );

  const logout = useCallback(async () => {
    try {
      await auth?.signOut();
    } catch (err) {
      console.warn('Failed to sign out from CloudBase auth; proceeding with manual cleanup.', err);
    }
    setUser(null);
    clearManualSession();
  }, [auth]);

  const value = useMemo<CloudbaseContextValue>(
    () => ({ app: appWithProxy, auth, user, loading, login, loginWithTicket, logout, refreshLoginState }),
    [appWithProxy, auth, user, loading, login, loginWithTicket, logout, refreshLoginState]
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
