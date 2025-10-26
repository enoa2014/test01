import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '..');
// Dev-only CloudBase server proxy implemented as a Vite middleware
function cloudbaseProxy(): Plugin {
  return {
    name: 'cloudbase-dev-proxy',
    async configureServer(server) {
      const logger = server.config.logger;
      const proxyDisabled =
        process.env.VITE_ENABLE_CLOUDBASE_PROXY === '0' ||
        process.env.VITE_ENABLE_CLOUDBASE_PROXY === 'false';
      if (proxyDisabled) {
        logger.info('[cloudbase-proxy] 已根据环境变量禁用 CloudBase 代理');
        return;
      }

      let tcb: any;
      try {
        const mod = await import('tcb-admin-node');
        tcb = mod?.default ?? mod;
      } catch (error: any) {
        logger.warn(
          `[cloudbase-proxy] 未安装 tcb-admin-node，已跳过 CloudBase 代理：${error?.message || error}`,
        );
        return;
      }

      // Load parent .env (repo root) and local .env for credentials
      const thisDir = path.dirname(fileURLToPath(new URL(import.meta.url)));
      try { dotenv.config({ path: path.resolve(thisDir, '../.env') }); } catch {}
      try { dotenv.config({ path: path.resolve(thisDir, '.env') }); } catch {}
      try { dotenv.config({ path: path.resolve(thisDir, '.env.local') }); } catch {}

      server.middlewares.use('/api/func', async (req, res, next) => {
        // Be robust to Connect mounting behavior: when mounted at '/api/func',
        // req.url is usually '/<name>' (without the mount prefix). Fallback to
        // originalUrl when available.
        const raw = (req as any).originalUrl || req.url || '';
        // Prefer extracting after explicit prefix when present
        let fnName = '';
        const pref = '/api/func/';
        if (raw.startsWith(pref)) {
          fnName = raw.slice(pref.length).split('?')[0].split('/')[0];
        } else {
          const parts = raw.split('?')[0].split('/').filter(Boolean);
          // Mounted form gives ['<name>']; unmounted would be ['api','func','<name>']
          fnName = parts[0] || parts[2] || parts[1] || '';
        }
        if (!fnName) return next();

        // Read JSON body
        let body = '';
        await new Promise<void>((resolve) => {
          req.on('data', (chunk: any) => (body += chunk));
          req.on('end', () => resolve());
        });
        let payload: any = {};
        try { payload = body ? JSON.parse(body) : {}; } catch {}

        const envId = process.env.VITE_TCB_ENV_ID || process.env.TCB_ENV || process.env.TCB_ENV_ID || process.env.CLOUDBASE_ENV_ID || '';
        const secretId = process.env.TENCENTCLOUD_SECRETID || '';
        const secretKey = process.env.TENCENTCLOUD_SECRETKEY || '';
        try {
          if (!envId || !secretId || !secretKey) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              error: {
                message: 'CloudBase 环境或凭证未配置 (envId/secretId/secretKey)'
              }
            }));
            return;
          }
          const app = tcb.init({ env: envId, credentials: { secretId, secretKey } });
          const cfRes = await app.callFunction({ name: fnName, data: payload?.data });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(cfRes?.result ?? cfRes ?? {}));
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: { message: e?.message || String(e) } }));
        }
      });

      // Storage upload helper for E2E (dev only)
      server.middlewares.use('/api/storage/upload', async (req, res, next) => {
        let body = '';
        await new Promise<void>((resolve) => {
          req.on('data', (chunk: any) => (body += chunk));
          req.on('end', () => resolve());
        });
        let payload: any = {};
        try { payload = body ? JSON.parse(body) : {}; } catch {}

        const envId = process.env.VITE_TCB_ENV_ID || process.env.TCB_ENV || process.env.TCB_ENV_ID || process.env.CLOUDBASE_ENV_ID || '';
        const secretId = process.env.TENCENTCLOUD_SECRETID || '';
        const secretKey = process.env.TENCENTCLOUD_SECRETKEY || '';
        if (!envId || !secretId || !secretKey) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: { message: 'CloudBase 环境或凭证未配置 (envId/secretId/secretKey)' } }));
          return;
        }
        try {
          const app = tcb.init({ env: envId, credentials: { secretId, secretKey } });
          const buffer = Buffer.from(String(payload.contentBase64 || ''), 'base64');
          if (!payload.cloudPath || !buffer.length) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: { message: '缺少 cloudPath 或 contentBase64' } }));
            return;
          }
          const uploadRes = await app.uploadFile({ cloudPath: payload.cloudPath, fileContent: buffer, contentType: payload.contentType || '' });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, fileID: uploadRes.fileID, cloudPath: payload.cloudPath }));
        } catch (e: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: { message: e?.message || String(e) } }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // 预先加载仓库根目录的环境变量，确保 .env 中的 TCB_ENV 可作为默认值
  dotenv.config({ path: path.join(repoRoot, '.env') });
  dotenv.config({ path: path.join(repoRoot, '.env.local') });

  const env = loadEnv(mode, process.cwd(), '');

  // 兼容未设置 VITE_TCB_ENV_ID 的情况：回退读取 TCB_ENV / TCB_ENV_ID / CLOUDBASE_ENV_ID
  const resolvedEnvId =
    env.VITE_TCB_ENV_ID ||
    env.TCB_ENV ||
    env.TCB_ENV_ID ||
    env.CLOUDBASE_ENV_ID ||
    process.env.VITE_TCB_ENV_ID ||
    process.env.TCB_ENV ||
    process.env.TCB_ENV_ID ||
    process.env.CLOUDBASE_ENV_ID ||
    '';
  const authFn = env.VITE_AUTH_FUNCTION_NAME || process.env.VITE_AUTH_FUNCTION_NAME || 'auth';

  return {
    plugins: [react(), cloudbaseProxy()],
    server: {
      host: env.VITE_HOST || '0.0.0.0',
      port: Number(env.VITE_PORT || 5173),
      // No generic '/api' proxy in dev: we implement /api/* locally above.
    },
    // 以编译期常量注入，确保前端可读取到环境配置
    define: {
      'import.meta.env.VITE_TCB_ENV_ID': JSON.stringify(resolvedEnvId),
      'import.meta.env.VITE_AUTH_FUNCTION_NAME': JSON.stringify(authFn)
    }
  };
});
