import { test, expect } from '@playwright/test';

test.describe('Web Admin - API 接口测试示例 (使用 Axios 文档)', () => {
  const BASE_URL = 'http://localhost:5180';

  test.beforeEach(async ({ page }) => {
    // 设置请求拦截器来监控 API 调用
    await page.goto('/login');
  });

  test('登录接口错误处理测试', async ({ page }) => {
    // 监控网络请求
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('/auth') || response.url().includes('/login')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers()
        });
      }
    });

    // 参考 Axios 文档中的错误处理模式
    // 发送错误凭据
    await page.getByLabel('用户名').fill('invalid-user');
    await page.getByLabel('口令').fill('invalid-password');
    await page.getByRole('button', { name: '登录' }).click();

    // 等待响应
    await page.waitForTimeout(3000);

    // 验证响应处理
    console.log('API 响应:', responses);

    // 检查错误消息显示
    await expect(page.getByText(/用户名不存在|密码错误|登录失败/)).toBeVisible();

    // 验证表单状态保持
    await expect(page.getByLabel('用户名')).toHaveValue('invalid-user');
    await expect(page.getByLabel('口令')).toHaveValue('invalid-password');
  });

  test('网络请求性能和错误分析', async ({ page }) => {
    // 收集网络性能数据
    const performanceData = {
      requests: [],
      errors: []
    };

    // 监听请求
    page.on('request', request => {
      performanceData.requests.push({
        url: request.url(),
        method: request.method(),
        timestamp: Date.now()
      });
    });

    // 监听响应
    page.on('response', response => {
      const request = performanceData.requests.find(r => r.url === response.url());
      if (request) {
        request.duration = Date.now() - request.timestamp;
        request.status = response.status();
        request.statusText = response.statusText();

        if (response.status() >= 400) {
          performanceData.errors.push({
            url: response.url(),
            status: response.status(),
            duration: request.duration
          });
        }
      }
    });

    // 执行多次登录尝试来生成性能数据
    const testCases = [
      { username: 'user1', password: 'pass1' },
      { username: 'user2', password: 'pass2' },
      { username: '', password: '' },
      { username: 'admin', password: 'admin' }
    ];

    for (const testCase of testCases) {
      await page.getByLabel('用户名').fill(testCase.username);
      await page.getByLabel('口令').fill(testCase.password);
      await page.getByRole('button', { name: '登录' }).click();
      await page.waitForTimeout(2000);

      // 清除表单
      await page.getByLabel('用户名').fill('');
      await page.getByLabel('口令').fill('');
    }

    // 分析性能数据
    console.log('=== 网络请求性能分析 ===');
    console.log('总请求数:', performanceData.requests.length);
    console.log('错误请求数:', performanceData.errors.length);

    if (performanceData.requests.length > 0) {
      const avgDuration = performanceData.requests
        .filter(r => r.duration)
        .reduce((sum, r) => sum + r.duration, 0) / performanceData.requests.filter(r => r.duration).length;

      console.log('平均响应时间:', Math.round(avgDuration), 'ms');

      const maxDuration = Math.max(...performanceData.requests.filter(r => r.duration).map(r => r.duration));
      console.log('最长响应时间:', maxDuration, 'ms');
    }

    if (performanceData.errors.length > 0) {
      console.log('错误详情:');
      performanceData.errors.forEach(error => {
        console.log(`- ${error.url}: ${error.status} (${error.duration}ms)`);
      });
    }

    // 性能断言
    expect(performanceData.requests.length).toBeGreaterThan(0);
    if (performanceData.requests.length > 0) {
      const durations = performanceData.requests.filter(r => r.duration).map(r => r.duration);
      expect(Math.max(...durations)).toBeLessThan(10000); // 没有请求超过10秒
    }
  });

  test('Axios 风格的 Promise 处理测试', async ({ page }) => {
    // 模拟 Axios 风格的错误处理
    const loginResults = [];

    for (let i = 0; i < 3; i++) {
      const result = await page.evaluate(async () => {
        // 模拟 Axios 风格的请求处理
        try {
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: 'test-user',
              password: 'test-password'
            })
          });

          if (!response.ok) {
            // 模拟 Axios 错误处理
            const error = {
              response: {
                status: response.status,
                statusText: response.statusText,
                data: await response.text()
              },
              config: {
                url: '/api/auth/login',
                method: 'POST'
              }
            };
            throw error;
          }

          return {
            success: true,
            data: await response.json(),
            status: response.status
          };
        } catch (error) {
          // 参考 Axios 文档中的错误处理模式
          if (error.response) {
            // 服务器响应了错误状态码
            return {
              success: false,
              type: 'response_error',
              status: error.response.status,
              data: error.response.data,
              message: `HTTP ${error.response.status}: ${error.response.statusText}`
            };
          } else if (error.request) {
            // 请求已发出但没有收到响应
            return {
              success: false,
              type: 'network_error',
              message: 'Network error - no response received'
            };
          } else {
            // 请求设置出错
            return {
              success: false,
              type: 'setup_error',
              message: error.message
            };
          }
        }
      });

      loginResults.push(result);
    }

    // 分析结果
    console.log('=== 登录请求结果分析 ===');
    loginResults.forEach((result, index) => {
      console.log(`请求 ${index + 1}:`, result);
    });

    // 验证错误处理
    const errors = loginResults.filter(r => !r.success);
    if (errors.length > 0) {
      expect(errors.every(e => e.type === 'response_error' || e.type === 'network_error')).toBeTruthy();
    }
  });

  test('并发请求测试 (Promise.all 模式)', async ({ page }) => {
    // 参考 Axios 文档中的并发请求模式
    const concurrentResults = await page.evaluate(async () => {
      const makeRequest = async (endpoint, data) => {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
          });

          return {
            endpoint,
            status: response.status,
            ok: response.ok,
            timestamp: Date.now()
          };
        } catch (error) {
          return {
            endpoint,
            error: error.message,
            timestamp: Date.now()
          };
        }
      };

      // 模拟多个并发登录请求
      const requests = [
        makeRequest('/api/auth/login', { username: 'user1', password: 'pass1' }),
        makeRequest('/api/auth/login', { username: 'user2', password: 'pass2' }),
        makeRequest('/api/auth/login', { username: 'user3', password: 'pass3' })
      ];

      // 使用 Promise.all 等待所有请求完成
      const results = await Promise.all(requests);

      return {
        results,
        totalTime: Date.now(),
        requestCount: results.length,
        errorCount: results.filter(r => r.error || !r.ok).length
      };
    });

    console.log('=== 并发请求结果 ===');
    console.log('总请求数:', concurrentResults.requestCount);
    console.log('错误数:', concurrentResults.errorCount);
    console.log('结果详情:', concurrentResults.results);

    // 验证并发处理
    expect(concurrentResults.requestCount).toBe(3);
    expect(concurrentResults.results).toHaveLength(3);
  });

  test('validateStatus 配置测试', async ({ page }) => {
    // 参考 Axios 文档中的 validateStatus 配置
    const statusValidationResults = await page.evaluate(async () => {
      const makeRequestWithValidation = async (url, validateStatus) => {
        try {
          const response = await fetch(url);

          // 自定义状态码验证逻辑
          const isValidStatus = validateStatus ? validateStatus(response.status) : response.ok;

          return {
            status: response.status,
            isValid: isValidStatus,
            validationType: validateStatus ? 'custom' : 'default'
          };
        } catch (error) {
          return {
            error: error.message,
            status: null,
            isValid: false
          };
        }
      };

      // 测试不同的状态码验证规则
      const testCases = [
        {
          name: '默认验证 (2xx)',
          validateStatus: null
        },
        {
          name: '宽松验证 (< 500)',
          validateStatus: (status) => status < 500
        },
        {
          name: '严格验证 (仅 200)',
          validateStatus: (status) => status === 200
        }
      ];

      const results = {};
      for (const testCase of testCases) {
        results[testCase.name] = await makeRequestWithValidation('/api/auth/login', testCase.validateStatus);
      }

      return results;
    });

    console.log('=== 状态码验证测试结果 ===');
    Object.entries(statusValidationResults).forEach(([name, result]) => {
      console.log(`${name}:`, result);
    });

    // 验证自定义状态码验证逻辑
    expect(Object.keys(statusValidationResults)).toHaveLength(3);
  });

  test('错误信息 JSON 序列化测试', async ({ page }) => {
    // 参考 Axios 文档中的 toJSON 方法
    const errorSerializationResults = await page.evaluate(async () => {
      const simulateAxiosError = async (endpoint) => {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) {
            // 模拟 Axios 错误对象的 toJSON 方法
            const error = {
              message: `Request failed with status code ${response.status}`,
              name: 'AxiosError',
              config: {
                url: endpoint,
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
              },
              code: 'ERR_BAD_RESPONSE',
              status: response.status,
              request: 'XMLHttpRequest' // 在浏览器环境中
            };

            // 模拟 toJSON 方法
            error.toJSON = () => ({
              message: error.message,
              name: error.name,
              config: error.config,
              code: error.code,
              status: error.status,
              request: error.request
            });

            return {
              error: error,
              serialized: error.toJSON(),
              timestamp: Date.now()
            };
          }
        } catch (networkError) {
          return {
            error: { message: networkError.message, type: 'NetworkError' },
            serialized: null,
            timestamp: Date.now()
          };
        }
      };

      const results = await simulateAxiosError('/api/auth/login');
      return results;
    });

    console.log('=== 错误序列化测试结果 ===');
    console.log('原始错误:', errorSerializationResults.error);
    console.log('序列化错误:', errorSerializationResults.serialized);

    // 验证错误序列化
    if (errorSerializationResults.serialized) {
      expect(errorSerializationResults.serialized).toHaveProperty('message');
      expect(errorSerializationResults.serialized).toHaveProperty('status');
      expect(errorSerializationResults.serialized).toHaveProperty('config');
    }
  });
});