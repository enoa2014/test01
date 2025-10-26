#!/usr/bin/env node
/**
 * 将 CloudBase 控制台下载的自定义登录密钥 JSON 导入到根目录 .env
 * 用法：
 *   node scripts/import-custom-login-key.js <path/to/key.json>
 * 若未传路径，将自动在 prepare/ 下匹配 tcb_custom_login_key*.json
 */
const fs = require('fs');
const path = require('path');

function findDefaultKeyFile() {
  const dir = path.resolve(process.cwd(), 'prepare');
  if (!fs.existsSync(dir)) return '';
  const files = fs.readdirSync(dir);
  const cand = files.filter((f) => /custom_login_key.*\.json$/i.test(f));
  // 优先 tcb_custom_login_key*.json
  const tcb = cand.filter((f) => /^tcb_custom_login_key.*\.json$/i.test(f));
  const list = tcb.length ? tcb : cand;
  return list.length ? path.join(dir, list[0]) : '';
}

function loadKeyObject(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const obj = JSON.parse(raw);
  if (!obj.private_key_id || !obj.private_key || !obj.env_id) {
    throw new Error('密钥 JSON 缺少必要字段(private_key_id/private_key/env_id)');
  }
  return obj;
}

function upsertEnvLine(lines, key, value) {
  const idx = lines.findIndex((l) => l.trim().startsWith(key + '='));
  const safe = String(value);
  const newLine = `${key}='${safe.replace(/'/g, "'\''")}'`;
  if (idx >= 0) lines[idx] = newLine; else lines.push(newLine);
}

function main() {
  const argPath = process.argv[2] || '';
  const keyPath = argPath ? path.resolve(process.cwd(), argPath) : findDefaultKeyFile();
  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('未找到密钥文件，请指定路径或将文件放在 prepare/ 目录');
    process.exit(1);
  }
  const key = loadKeyObject(keyPath);
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('未找到 .env，请先在仓库根目录创建 .env');
    process.exit(1);
  }
  const envText = fs.readFileSync(envPath, 'utf-8');
  const lines = envText.split(/\r?\n/);

  // 将完整 JSON（单行）写入 .env
  const keyJsonOneLine = JSON.stringify({
    private_key_id: key.private_key_id,
    private_key: key.private_key,
    env_id: key.env_id,
  });

  upsertEnvLine(lines, 'TCB_CUSTOM_LOGIN_PRIVATE_KEY_ID', key.private_key_id);
  upsertEnvLine(lines, 'TCB_CUSTOM_LOGIN_PRIVATE_KEY', keyJsonOneLine);
  upsertEnvLine(lines, 'CUSTOM_LOGIN_ENV_ID', key.env_id);

  fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
  console.log('[import-custom-login-key] 已将密钥导入到 .env（未输出敏感内容）');
}

main();

