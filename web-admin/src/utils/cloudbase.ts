import type { CloudBase } from '@cloudbase/js-sdk';

// 统一走服务端代理，避免浏览器域名白名单限制
export const callCloudFunction = async (_app: CloudBase | null, name: string, data?: any) => {
  const resp = await fetch(`/api/func/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json?.error) {
    const message = json?.error?.message || `调用云函数失败: ${name}`;
    throw new Error(message);
  }
  return json;
};
