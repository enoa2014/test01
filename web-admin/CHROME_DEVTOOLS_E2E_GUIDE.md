# Chrome DevTools E2E 测试使用指南

本指南展示如何使用 Chrome DevTools MCP 服务器进行 Web E2E 测试。

## 概述

Chrome DevTools MCP 服务器提供了强大的浏览器自动化功能，可以用于：

- 页面交互测试
- 网络请求监控
- 性能分析
- 控制台消息监控
- 响应式设计测试

## 环境配置

### 1. 启动开发服务器

```bash
cd web-admin
npm run dev
```

服务器将启动在 `http://localhost:5180`

### 2. 测试配置

Playwright 配置文件位于 `playwright.config.ts`，已配置：
- 基础 URL: `http://localhost:5180`
- 自动启动开发服务器
- 多浏览器支持 (Chrome, Firefox, Safari)

## 基本使用方法

### 1. 页面导航和交互

```typescript
import { test, expect } from '@playwright/test';

test('页面交互示例', async ({ page }) => {
  // 导航到页面
  await page.goto('/login');

  // 等待页面加载
  await page.waitForLoadState('networkidle');

  // 验证元素存在
  await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();

  // 填写表单
  await page.getByLabel('用户名').fill('test-user');
  await page.getByLabel('口令').fill('test-password');

  // 点击按钮
  await page.getByRole('button', { name: '登录' }).click();
});
```

### 2. 网络请求监控

```typescript
test('网络请求监控', async ({ page }) => {
  const requests = [];
  const responses = [];

  // 监听请求
  page.on('request', request => {
    requests.push({
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
  });

  // 监听响应
  page.on('response', response => {
    responses.push({
      url: response.url(),
      status: response.status(),
      headers: response.headers()
    });
  });

  await page.goto('/login');

  // 执行操作...
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForTimeout(3000);

  // 分析网络数据
  console.log('请求数量:', requests.length);
  console.log('响应状态码:', responses.map(r => r.status));
});
```

### 3. 控制台监控

```typescript
test('控制台消息监控', async ({ page }) => {
  const consoleMessages = [];

  // 监听控制台消息
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  await page.goto('/login');

  // 执行可能产生日志的操作
  await page.getByLabel('用户名').fill('test-user');
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForTimeout(2000);

  // 分析日志
  const errors = consoleMessages.filter(msg => msg.type === 'error');
  const warnings = consoleMessages.filter(msg => msg.type === 'warning');

  console.log('错误数量:', errors.length);
  console.log('警告数量:', warnings.length);
});
```

### 4. 性能分析

```typescript
test('性能指标测试', async ({ page }) => {
  await page.goto('/login');

  // 等待页面完全加载
  await page.waitForLoadState('networkidle');

  // 获取性能指标
  const performanceMetrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0
    };
  });

  console.log('性能指标:', performanceMetrics);

  // 验证性能指标
  expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
  expect(performanceMetrics.firstContentfulPaint).toBeLessThan(3000);
});
```

### 5. 响应式设计测试

```typescript
test('响应式设计测试', async ({ page }) => {
  await page.goto('/login');

  const viewports = [
    { width: 1920, height: 1080, name: 'Desktop' },
    { width: 768, height: 1024, name: 'Tablet' },
    { width: 375, height: 667, name: 'Mobile' }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    // 验证关键元素在不同尺寸下都可见
    await expect(page.getByRole('heading', { name: '管理员登录' })).toBeVisible();
    await expect(page.getByLabel('用户名')).toBeVisible();
    await expect(page.getByLabel('口令')).toBeVisible();
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible();

    // 可选：截图记录
    await page.screenshot({
      path: `test-results/${viewport.name.toLowerCase()}-${Date.now()}.png`,
      fullPage: true
    });
  }
});
```

## 使用 Context7 查询 API 文档

当需要测试 API 接口时，可以使用 Context7 查询相关库的文档：

```typescript
// 示例：查询 Axios 文档
// 1. 解析库 ID
const axiosId = await resolveLibraryId('axios');

// 2. 获取文档
const axiosDocs = await getLibraryDocs(axiosId, 'error handling');

// 3. 基于文档编写测试
test('API 错误处理测试', async ({ page }) => {
  const result = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'test' })
      });

      if (!response.ok) {
        // 参考 Axios 错误处理模式
        throw {
          response: {
            status: response.status,
            statusText: response.statusText,
            data: await response.text()
          }
        };
      }

      return { success: true, data: await response.json() };
    } catch (error) {
      if (error.response) {
        // 服务器响应错误
        return {
          success: false,
          type: 'response_error',
          status: error.response.status
        };
      } else if (error.request) {
        // 网络错误
        return {
          success: false,
          type: 'network_error'
        };
      } else {
        // 其他错误
        return {
          success: false,
          type: 'setup_error',
          message: error.message
        };
      }
    }
  });

  console.log('API 测试结果:', result);
});
```

## 运行测试

### 运行所有测试

```bash
npm run test:e2e
```

### 运行特定测试文件

```bash
npm run test:e2e simple-chrome-devtools.spec.ts
```

### 运行测试并显示浏览器界面

```bash
npm run test:e2e:headed
```

### 运行测试 UI 模式

```bash
npm run test:e2e:ui
```

## 最佳实践

### 1. 测试组织

- 使用 `test.describe()` 组织相关测试
- 使用 `test.beforeEach()` 和 `test.afterEach()` 进行测试准备和清理
- 为不同类型的测试创建不同的测试文件

### 2. 等待策略

```typescript
// 等待元素出现
await expect(page.getByRole('button', { name: '登录' })).toBeVisible();

// 等待页面加载完成
await page.waitForLoadState('networkidle');

// 等待特定时间
await page.waitForTimeout(2000);

// 等待 URL 变化
await page.waitForURL('**/dashboard');
```

### 3. 错误处理

```typescript
test('错误处理示例', async ({ page }) => {
  try {
    await page.goto('/login');
    await page.getByLabel('用户名').fill('test-user');
    await page.getByRole('button', { name: '登录' }).click();

    // 等待错误消息
    await expect(page.getByText(/错误/)).toBeVisible({ timeout: 10000 });
  } catch (error) {
    // 截图记录失败状态
    await page.screenshot({ path: `test-results/error-${Date.now()}.png` });
    throw error;
  }
});
```

### 4. 调试技巧

```typescript
// 暂停执行进行调试
await page.pause();

// 打印页面内容
console.log(await page.content());

// 获取页面截图
await page.screenshot({ path: 'debug.png' });

// 获取当前 URL
console.log(page.url());
```

## 示例测试文件

项目中的示例测试文件：

- `simple-chrome-devtools.spec.ts` - 基础功能演示
- `chrome-devtools-example.spec.ts` - 完整功能示例
- `api-testing-example.spec.ts` - API 接口测试示例

## 注意事项

1. **端口配置**: 确保 Playwright 配置中的端口与开发服务器端口一致
2. **超时设置**: 根据网络环境调整测试超时时间
3. **并行测试**: 避免同时修改共享状态的测试
4. **清理数据**: 测试完成后清理生成的测试数据
5. **错误监控**: 监控控制台错误，及时发现前端问题

通过这个指南，你可以有效地使用 Chrome DevTools 进行全面的 Web E2E 测试。