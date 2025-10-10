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

if (!fs.existsSync(distDir)) {
  console.error(`未找到静态资源目录: ${distDir}`);
  console.error('请先运行 "npm run build"，并确保 dist 目录与可执行文件同级。');
  process.exit(1);
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
  });
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
