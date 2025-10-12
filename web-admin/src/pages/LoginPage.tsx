import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, type Location } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';
import { useCloudbaseContext } from '../providers/CloudbaseProvider';

const LoginPage: React.FC = () => {
  const { user, login, loading } = useCloudbase();
  const { app } = useCloudbaseContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      const redirectTo = (location.state as { from?: Location })?.from?.pathname;
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
      }
    }
  }, [user, navigate, location.state]);

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请稍后再试');
      setSubmitting(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!app) {
      setError('CloudBase未初始化');
      return;
    }

    setCreatingAdmin(true);
    setError(null);

    try {
      const result = await app.callFunction({
        name: 'auth',
        data: {
          action: 'seedAdmin',
          code: 'seed-admin-2025',
          username: username.trim() || 'admin',
          password: password || 'test123'
        }
      });

      if (result.result && result.result.success) {
        setError('管理员账号创建成功！现在可以登录了。');
      } else {
        setError(result.result?.error?.message || '创建管理员账号失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建管理员账号失败');
    } finally {
      setCreatingAdmin(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: '60px auto' }}>
      <h2 style={{ marginTop: 0 }}>管理员登录</h2>
      {loading && <p>正在检测登录状态...</p>}
      <form className="form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            type="text"
            placeholder="请输入账号"
            value={username}
            onChange={event => setUsername(event.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">口令</label>
          <input
            id="password"
            type="password"
            placeholder="请输入口令"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting || loading}>
          {submitting ? '登录中...' : '登录'}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={handleCreateAdmin}
          disabled={creatingAdmin || loading}
          style={{ marginTop: '10px', width: '100%' }}
        >
          {creatingAdmin ? '创建中...' : '创建管理员账号'}
        </button>
      </form>
      <div className="spacer" />
      <p style={{ fontSize: 12, color: '#64748b' }}>
        首次使用请在云函数 `auth` 中配置管理员账号，并在环境变量中启用自定义登录私钥。
      </p>
    </div>
  );
};

export default LoginPage;
