#!/usr/bin/env node
const http = require('http');
const path = require('path');
const fs = require('fs');
const serveStatic = require('serve-static');
const finalhandler = require('finalhandler');
const { spawn } = require('child_process');

const isPkg = typeof process.pkg !== 'undefined';
const baseDir = isPkg ? path.dirname(process.execPath) : __dirname;
const distDir = path.join(baseDir, 'dist');

const hasDist = fs.existsSync(distDir);
if (!hasDist) {
  console.warn(`未找到静态资源目录: ${distDir}`);
  console.warn('将仅提供 API 路由 /api/func/*，静态资源请使用 Vite 开发服务器。');
}

const serve = serveStatic(distDir, {
  index: ['index.html'],
  fallthrough: true,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
  },
});

const MAX_PORT_SHIFT = 10;
const basePort = Number(process.env.PORT || process.env.port || 4173) || 4173;

function createServer() {
  return http.createServer((req, res) => {
    // API: /api/func/<name> 统一服务端代理云函数
    if (req.url && req.url.startsWith('/api/func/')) {
      return handleApi(req, res);
    }

    if (hasDist) {
      serve(req, res, err => {
        if (err) {
          return finalhandler(req, res)(err);
        }

     if (
       req.method === 'GET' &&
       req.headers.accept &&
       req.headers.accept.includes('text/html')
     ) {
       const indexPath = path.join(distDir, 'index.html');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        fs.createReadStream(indexPath)
          .on('error', error => finalhandler(req, res)(error))
          .pipe(res);
        return;
      }

        finalhandler(req, res)();
      });
    } else {
      // API-only mode without dist
      finalhandler(req, res)();
    }
  });
}

function parseBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
  });
}

async function handleApi(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean); // ['api','func','<name>']
    const name = parts[2] || '';
    if (!name) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: { message: '缺少云函数名称' } }));
      return;
    }
    const dotenv = require('dotenv');
    const tcb = require('tcb-admin-node');
    // 加载上级 .env 以及本地 .env
    try { dotenv.config({ path: path.join(__dirname, '../.env') }); } catch {}
    try { dotenv.config({ path: path.join(__dirname, '.env') }); } catch {}
    try { dotenv.config({ path: path.join(__dirname, '.env.local') }); } catch {}

    const envId = process.env.VITE_TCB_ENV_ID || process.env.TCB_ENV || process.env.TCB_ENV_ID || process.env.CLOUDBASE_ENV_ID || '';
    const secretId = process.env.TENCENTCLOUD_SECRETID || '';
    const secretKey = process.env.TENCENTCLOUD_SECRETKEY || '';
    if (!envId || !secretId || !secretKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: { message: 'CloudBase 环境或凭证未配置 (envId/secretId/secretKey)' } }));
      return;
    }
    const app = tcb.init({ env: envId, credentials: { secretId, secretKey } });
    const { data } = await parseBody(req);
    const result = await app.callFunction({ name, data });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(result?.result ?? result ?? {}));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: { message: e && e.message ? e.message : String(e) } }));
  }
}

function attemptListen(port, attemptsLeft) {
  const server = createServer();
  server.once('error', error => {
    if ((error.code === 'EADDRINUSE' || error.code === 'EACCES') && attemptsLeft > 0) {
      const nextPort = port + 1;
      console.warn(`端口 ${port} 已占用，尝试使用端口 ${nextPort}`);
      setTimeout(() => attemptListen(nextPort, attemptsLeft - 1), 200);
      return;
    }
    console.error('启动失败:', error.message || error);
    process.exit(1);
  });

  server.listen(port, () => {
    const address = `http://localhost:${port}`;
    console.log('Web 管理端已启动 ✅');
    console.log(`访问地址: ${address}`);

    if (isPkg && process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', address], { stdio: 'ignore', detached: true });
    }
  });
}

attemptListen(basePort, MAX_PORT_SHIFT);
