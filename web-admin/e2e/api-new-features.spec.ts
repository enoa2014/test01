import { test, expect } from '@playwright/test';

test.describe('新功能API测试', () => {
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // 获取认证令牌
    const loginResponse = await request.post('/api/login', {
      data: {
        username: 'admin',
        password: 'admin123'
      }
    });

    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      authToken = loginData.token || loginData.data?.token;
    }
  });

  test.describe('导入Excel API', () => {
    test('POST /api/import/parse - 解析Excel文件', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      // 这里应该模拟文件上传，但Playwright的request context不支持文件上传
      // 可以通过页面测试来验证这个功能

      const response = await request.post('/api/import/parse', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          fileId: 'test-file-id'
        }
      });

      // 由于没有实际的文件，预期返回错误
      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData).toHaveProperty('error');
    });

    test('POST /api/import/import - 执行导入任务', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.post('/api/import/import', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          jobId: 'test-job-id'
        }
      });

      // 由于没有实际的任务，预期返回错误
      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData).toHaveProperty('error');
    });

    test('GET /api/import/jobs - 获取导入任务列表', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.get('/api/import/jobs', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          page: 1,
          pageSize: 20
        }
      });

      // 应该返回任务列表（可能为空）
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
    });
  });

  test.describe('导出数据 API', () => {
    test('POST /api/export/create - 创建导出任务', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.post('/api/export/create', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          filters: {
            keyword: 'test',
            gender: '男'
          },
          fieldsPolicy: 'masked'
        }
      });

      // 应该成功创建导出任务
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      if (data.success) {
        expect(data).toHaveProperty('jobId');
      }
    });

    test('POST /api/export/export - 执行导出任务', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.post('/api/export/export', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          jobId: 'test-job-id'
        }
      });

      // 由于没有实际的任务，预期返回错误
      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData).toHaveProperty('error');
    });

    test('GET /api/export/jobs - 获取导出任务列表', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.get('/api/export/jobs', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          page: 1,
          pageSize: 20
        }
      });

      // 应该返回任务列表
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
    });

    test('GET /api/export/download - 下载导出文件', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.get('/api/export/download', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          jobId: 'test-job-id'
        }
      });

      // 由于没有实际的文件，预期返回错误
      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData).toHaveProperty('error');
    });
  });

  test.describe('审计日志 API', () => {
    test('GET /api/audit/logs - 获取审计日志列表', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.get('/api/audit/logs', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          page: 1,
          pageSize: 20
        }
      });

      // 应该返回日志列表
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
    });

    test('GET /api/audit/logs - 带过滤条件的日志查询', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.get('/api/audit/logs', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          page: 1,
          pageSize: 20,
          actor: 'admin',
          action: 'login',
          level: 'info'
        }
      });

      // 应该返回过滤后的日志列表
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
    });

    test('GET /api/audit/logs/:id - 获取日志详情', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.get('/api/audit/logs/test-log-id', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      // 由于没有实际的日志ID，预期返回错误
      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData).toHaveProperty('error');
    });
  });

  test.describe('系统设置 API', () => {
    test('GET /api/settings/system - 获取系统信息', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.get('/api/settings/system', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      // 应该返回系统信息
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
      if (data.success) {
        expect(data).toHaveProperty('data');
        expect(data.data).toHaveProperty('envId');
        expect(data.data).toHaveProperty('functions');
        expect(data.data).toHaveProperty('storage');
        expect(data.data).toHaveProperty('database');
      }
    });

    test('PUT /api/settings/security - 更新安全设置', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.put('/api/settings/security', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          allowWorkerImport: false,
          forceWorkerExportMasked: true
        }
      });

      // 应该成功更新设置
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
    });

    test('PUT /api/settings/audit - 更新审计设置', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.put('/api/settings/audit', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          logLevel: 'info',
          retentionDays: 90
        }
      });

      // 应该成功更新设置
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
    });

    test('PUT /api/settings/export - 更新导出设置', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.put('/api/settings/export', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          fileRetentionDays: 7,
          maxExportRecords: 10000
        }
      });

      // 应该成功更新设置
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
    });

    test('PUT /api/user/password - 修改密码', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.put('/api/user/password', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {
          currentPassword: 'admin123',
          newPassword: 'newpassword123'
        }
      });

      // 应该成功修改密码
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('success');
    });
  });

  test.describe('权限验证 API', () => {
    test('未授权用户访问导入API', async ({ request }) => {
      const response = await request.get('/api/import/jobs');
      expect(response.status()).toBe(401);
    });

    test('未授权用户访问导出API', async ({ request }) => {
      const response = await request.get('/api/export/jobs');
      expect(response.status()).toBe(401);
    });

    test('未授权用户访问审计API', async ({ request }) => {
      const response = await request.get('/api/audit/logs');
      expect(response.status()).toBe(401);
    });

    test('未授权用户访问设置API', async ({ request }) => {
      const response = await request.get('/api/settings/system');
      expect(response.status()).toBe(401);
    });
  });

  test.describe('错误处理 API', () => {
    test('无效的请求参数', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      // 测试无效的页码
      const response = await request.get('/api/audit/logs', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          page: 'invalid',
          pageSize: 20
        }
      });

      // 应该返回400错误或使用默认值
      expect([200, 400]).toContain(response.status());
    });

    test('不存在的资源ID', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      const response = await request.get('/api/audit/logs/nonexistent-id', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      // 应该返回404错误
      expect(response.status()).toBe(404);
    });

    test('缺少必需参数', async ({ request }) => {
      if (!authToken) test.skip('No auth token available');

      // 创建导出任务时缺少必需参数
      const response = await request.post('/api/export/create', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        data: {} // 空数据
      });

      // 应该返回400错误
      expect(response.status()).toBe(400);
      const errorData = await response.json();
      expect(errorData).toHaveProperty('error');
    });
  });
});

test.describe('新功能API - 性能测试', () => {
  test('API响应时间测试', async ({ request }) => {
    // 获取认证令牌
    const loginResponse = await request.post('/api/login', {
      data: {
        username: 'admin',
        password: 'admin123'
      }
    });

    if (!loginResponse.ok()) {
      test.skip('Login failed');
    }

    const loginData = await loginResponse.json();
    const authToken = loginData.token || loginData.data?.token;

    if (!authToken) {
      test.skip('No auth token available');
    }

    // 测试各个API的响应时间
    const apiTests = [
      { method: 'GET', url: '/api/audit/logs', name: '审计日志列表' },
      { method: 'GET', url: '/api/import/jobs', name: '导入任务列表' },
      { method: 'GET', url: '/api/export/jobs', name: '导出任务列表' },
      { method: 'GET', url: '/api/settings/system', name: '系统信息' }
    ];

    for (const apiTest of apiTests) {
      const startTime = Date.now();

      let response;
      if (apiTest.method === 'GET') {
        response = await request.get(apiTest.url, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
      }

      const responseTime = Date.now() - startTime;

      // 验证响应时间在合理范围内（2秒内）
      expect(responseTime).toBeLessThan(2000);

      if (response) {
        expect(response.status()).toBeLessThan(500);
      }

      console.log(`${apiTest.name}: ${responseTime}ms`);
    }
  });
});