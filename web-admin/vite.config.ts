import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // 兼容未设置 VITE_TCB_ENV_ID 的情况：回退读取 TCB_ENV / TCB_ENV_ID / CLOUDBASE_ENV_ID
  const resolvedEnvId =
    env.VITE_TCB_ENV_ID || env.TCB_ENV || env.TCB_ENV_ID || env.CLOUDBASE_ENV_ID || '';
  const authFn = env.VITE_AUTH_FUNCTION_NAME || 'auth';

  return {
    plugins: [react()],
    server: {
      host: env.VITE_HOST || '0.0.0.0',
      port: Number(env.VITE_PORT || 5173)
    },
    // 以编译期常量注入，确保前端可读取到环境配置
    define: {
      'import.meta.env.VITE_TCB_ENV_ID': JSON.stringify(resolvedEnvId),
      'import.meta.env.VITE_AUTH_FUNCTION_NAME': JSON.stringify(authFn)
    }
  };
});
